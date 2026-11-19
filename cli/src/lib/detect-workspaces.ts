import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/** A package of the root workspace (024 S-7): its directory from the root, and its `name`. */
export interface WorkspacePackage {
  dir: string;
  name?: string;
}

const LOCKS = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb', 'bun.lock'];
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '.loctx', '.agents']);

const readJson = (p: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** A file that makes `dir` a project of its own, outside the root workspace (croffle `apps/server/web`). */
export function ownProjectFile(root: string, dir: string): string | null {
  if (!dir) return null;
  for (const f of [...LOCKS, 'pnpm-workspace.yaml'])
    if (existsSync(join(root, dir, f))) return `${dir}/${f}`;
  return null;
}

/** The workspace globs of the root: `pnpm-workspace.yaml` `packages`, else package.json `workspaces`. */
export function workspaceGlobs(root: string): { globs: string[]; file: string } | null {
  const pnpm = join(root, 'pnpm-workspace.yaml');
  if (existsSync(pnpm)) {
    try {
      const doc = parse(readFileSync(pnpm, 'utf8')) as { packages?: unknown } | null;
      if (Array.isArray(doc?.packages))
        return { globs: doc.packages.map(String), file: 'pnpm-workspace.yaml' };
    } catch {
      return null;
    }
  }
  const pkg = readJson(join(root, 'package.json'));
  const ws = pkg?.['workspaces'];
  const list = Array.isArray(ws)
    ? ws
    : ws && typeof ws === 'object' && Array.isArray((ws as { packages?: unknown }).packages)
      ? (ws as { packages: unknown[] }).packages
      : null;
  return list ? { globs: list.map(String), file: 'package.json' } : null;
}

/** One path segment of a glob as a regular expression: `*` is any run of characters but `/`. */
const segment = (s: string) =>
  new RegExp(`^${s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);

/** Directories (with a package.json) a workspace glob names: literal, `a/*`, `a/*-x`, `a/**`. */
function expand(root: string, glob: string): string[] {
  const parts = glob.replace(/^\.\//, '').replace(/\/$/, '').split('/');
  const out: string[] = [];
  const walk = (dir: string, i: number, depth: number) => {
    if (i === parts.length) {
      if (existsSync(join(root, dir, 'package.json'))) out.push(dir);
      return;
    }
    const p = parts[i]!;
    if (p === '**') {
      walk(dir, i + 1, depth); // zero directories
      if (depth > 4) return;
      for (const e of children(root, dir)) walk(dir ? `${dir}/${e}` : e, i, depth + 1);
      return;
    }
    if (!p.includes('*')) {
      walk(dir ? `${dir}/${p}` : p, i + 1, depth);
      return;
    }
    const re = segment(p);
    for (const e of children(root, dir))
      if (re.test(e)) walk(dir ? `${dir}/${e}` : e, i + 1, depth);
  };
  walk('', 0, 0);
  return out;
}

function children(root: string, dir: string): string[] {
  try {
    return readdirSync(join(root, dir), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !SKIP.has(e.name))
      .map((e) => e.name)
      .toSorted();
  } catch {
    return [];
  }
}

/**
 * The packages of the root workspace (024 S-7): the globs expanded to directories with a package.json,
 * `!` globs taken out, and a directory with a lock or workspace file of its own left out.
 */
export function workspacePackages(root: string): WorkspacePackage[] {
  const ws = workspaceGlobs(root);
  if (!ws) return [];
  const take = new Set<string>();
  for (const g of ws.globs.filter((x) => !x.startsWith('!')))
    for (const d of expand(root, g)) take.add(d);
  for (const g of ws.globs.filter((x) => x.startsWith('!')))
    for (const d of expand(root, g.slice(1))) take.delete(d);
  return [...take]
    .filter((d) => d !== '' && !ownProjectFile(root, d))
    .toSorted()
    .map((dir) => {
      const name = readJson(join(root, dir, 'package.json'))?.['name'];
      return typeof name === 'string' ? { dir, name } : { dir };
    });
}

/** What one command forwards to workspace packages (024 S-7): the scripts it runs, in which packages. */
export type Forward = { scripts: string[]; pkgs: WorkspacePackage[] } | { unclear: string } | null;

const nameGlob = (p: string) =>
  new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

/** The packages a pnpm `--filter`/npm `-w` value selects: a name as written, or `./dir`/`dir`. */
function select(pkgs: WorkspacePackage[], v: string): WorkspacePackage[] | null {
  if (/[*{}[\]^!]|\.\.\./.test(v)) return null;
  const path = v.replace(/^\.\//, '').replace(/\/$/, '');
  const byName = pkgs.filter((p) => p.name === v);
  if (byName.length) return byName;
  const byDir = pkgs.filter((p) => p.dir === path);
  return byDir.length ? byDir : [];
}

/** The script after an optional `run`, with nothing after it; null when that is not the shape. */
function scriptAt(rest: string[]): string | null {
  const r = rest[0] === 'run' ? rest.slice(1) : rest;
  return r.length === 1 && /^[\w:.-]+$/.test(r[0]!) ? r[0]! : null;
}

const HARMLESS = new Set(['--parallel', '--stream', '--if-present']);

/**
 * Whether one command (already split into words) runs a script in workspace packages, in one of the
 * forms of 024 S-7. A form with any other flag is unclear, so nothing is filtered by it.
 */
export function forwards(words: string[], pkgs: WorkspacePackage[]): Forward {
  const [tool, ...a] = words;
  if (tool === 'pnpm') {
    let all = false;
    let picked: WorkspacePackage[] | null = null;
    const rest: string[] = [];
    for (let i = 0; i < a.length; i++) {
      const w = a[i]!;
      if (w === '-r' || w === '--recursive') all = true;
      else if (w === '--filter' || w === '-F' || w.startsWith('--filter=') || /^-F./.test(w)) {
        const v = w.includes('=')
          ? w.slice(w.indexOf('=') + 1)
          : w.length > 2 && w.startsWith('-F')
            ? w.slice(2)
            : a[++i];
        const s = v === undefined ? null : select(pkgs, v);
        if (s === null) return { unclear: `pnpm filter ${v ?? ''}` };
        picked = [...(picked ?? []), ...s];
      } else if (HARMLESS.has(w)) continue;
      else if (w.startsWith('-')) return all || picked ? { unclear: `pnpm ${w}` } : null;
      else rest.push(w);
    }
    if (!all && !picked) return null;
    const s = scriptAt(rest);
    if (!s) return { unclear: 'pnpm: not one script' };
    return { scripts: [s], pkgs: all ? pkgs : picked! };
  }
  if (tool === 'npm') {
    let all = false;
    let picked: WorkspacePackage[] | null = null;
    const rest: string[] = [];
    for (let i = 0; i < a.length; i++) {
      const w = a[i]!;
      if (w === '--workspaces' || w === '-ws') all = true;
      else if (w === '-w' || w === '--workspace' || w.startsWith('--workspace=')) {
        const v = w.includes('=') ? w.slice(w.indexOf('=') + 1) : a[++i];
        const s = v === undefined ? null : select(pkgs, v);
        if (s === null) return { unclear: `npm workspace ${v ?? ''}` };
        picked = [...(picked ?? []), ...s];
      } else if (HARMLESS.has(w)) continue;
      else if (w.startsWith('-')) return all || picked ? { unclear: `npm ${w}` } : null;
      else rest.push(w);
    }
    if (!all && !picked) return null;
    if (rest[0] !== 'run' && rest[0] !== 'run-script') return { unclear: 'npm: not run' };
    const s = scriptAt(rest.slice(1));
    if (!s) return { unclear: 'npm: not one script' };
    return { scripts: [s], pkgs: all ? pkgs : picked! };
  }
  if (tool === 'yarn') {
    if (a[0] === 'workspaces' && a[1] === 'run') {
      const s = scriptAt(a.slice(2));
      return s ? { scripts: [s], pkgs } : { unclear: 'yarn workspaces run' };
    }
    if (a[0] === 'workspace' && a[1]) {
      const s = scriptAt(a.slice(2));
      const p = select(pkgs, a[1]);
      return s && p ? { scripts: [s], pkgs: p } : { unclear: 'yarn workspace' };
    }
    if (a[0] === 'workspaces' && a[1] === 'foreach') {
      const ok = new Set([
        '-A',
        '--all',
        '-p',
        '--parallel',
        '-v',
        '--verbose',
        '-i',
        '--interlaced',
        '-t',
        '--topological',
        '-R',
        '--recursive',
      ]);
      const rest = a.slice(2);
      const i = rest.indexOf('run');
      if (i < 0 || rest.slice(0, i).some((w) => !ok.has(w)))
        return { unclear: 'yarn workspaces foreach' };
      const s = scriptAt(rest.slice(i));
      return s ? { scripts: [s], pkgs } : { unclear: 'yarn workspaces foreach' };
    }
    return null;
  }
  if (tool === 'bun') {
    if (a[0] !== '--filter' || a[1] === undefined) return null;
    if (/[^\w@/.*-]/.test(a[1])) return { unclear: `bun filter ${a[1]}` };
    const re = nameGlob(a[1]);
    const s = scriptAt(a.slice(2));
    return s
      ? { scripts: [s], pkgs: pkgs.filter((p) => p.name !== undefined && re.test(p.name)) }
      : { unclear: 'bun --filter' };
  }
  if (tool === 'turbo' || tool === 'lerna') {
    if (a[0] !== 'run') return null;
    const s = a.slice(1);
    if (s.length === 0 || s.some((w) => !/^[\w:.-]+$/.test(w))) return { unclear: `${tool} run` };
    return { scripts: tool === 'lerna' ? s.slice(0, 1) : s, pkgs };
  }
  if (tool === 'nx') {
    if (a[0] !== 'run-many') return null;
    const s = a.slice(1);
    if ((s[0] !== '-t' && s[0] !== '--target' && s[0] !== '--targets') || s.length < 2)
      return { unclear: 'nx run-many' };
    const names = s.slice(1);
    if (names.some((w) => !/^[\w:.-]+$/.test(w))) return { unclear: 'nx run-many' };
    return { scripts: names, pkgs };
  }
  return null;
}
