import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ciRuns } from './detect-ci.js';
import {
  forwards,
  ownProjectFile,
  workspaceGlobs,
  workspacePackages,
} from './detect-workspaces.js';

/** Generation of an existing harness (design §7). First match wins, from the most specific. */
export type Generation = 'reins' | 'gen4' | 'gen3' | 'gen2' | 'gen1' | 'none';

export function generation(root: string): Generation {
  const agents = join(root, 'AGENTS.md');
  const hasAgents = existsSync(agents);
  if (
    hasAgents &&
    readFileSync(agents, 'utf8').includes('<!-- reins:begin') &&
    existsSync(join(root, '.agents/harness'))
  )
    return 'reins';
  const skills = join(root, '.claude/skills');
  const skillDirs = existsSync(skills) ? readdirSync(skills) : [];
  if (skillDirs.length >= 10 && skillDirs.some((s) => s === 'work-cicd-to' || s === 'go-flow'))
    return 'gen4';
  if (existsSync(join(root, '.claude/commands'))) return 'gen3';
  if (hasAgents) return 'gen2';
  if (existsSync(join(root, '.ai'))) return 'gen1';
  return 'none';
}

export interface Vendor {
  name: 'claude' | 'openai' | 'google' | 'gemini' | 'copilot' | 'cursor';
  cli: string;
  detected: boolean;
}

function onPath(bin: string): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function vendors(): Vendor[] {
  return [
    { name: 'claude', cli: 'claude', detected: onPath('claude') },
    { name: 'openai', cli: 'codex', detected: onPath('codex') },
    { name: 'google', cli: 'agy', detected: onPath('agy') },
    { name: 'gemini', cli: 'gemini', detected: onPath('gemini') },
    { name: 'copilot', cli: 'copilot', detected: onPath('copilot') },
    { name: 'cursor', cli: 'cursor-agent', detected: onPath('cursor-agent') },
  ];
}

export function stacks(root: string): string[] {
  const out: string[] = [];
  if (existsSync(join(root, 'package.json'))) out.push('node');
  if (existsSync(join(root, 'go.mod'))) out.push('go');
  if (existsSync(join(root, 'build.gradle.kts')) || existsSync(join(root, 'build.gradle')))
    out.push('gradle');
  if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'requirements.txt')))
    out.push('python');
  return out;
}

export function runner(root: string): string | null {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, 'package-lock.json')) || existsSync(join(root, 'package.json')))
    return 'npm';
  if (existsSync(join(root, 'Makefile'))) return 'make';
  return null;
}

export interface Gate {
  name: string;
  cmd: string;
  from: string;
  optional?: boolean;
}

/** A gate found below the root, in CI or not chosen by default: named `<dir-slug>-<script>`, run from the repo root. */
export interface SubdirGate {
  name: string;
  cmd: string;
  from: string;
}

/**
 * One gate candidate (024 S-4–S-10). `pick`: chosen by default at install; `offer`: shown, not chosen;
 * `covered`: another script or gate already runs it; `excluded`: never a gate. `reasons` say why.
 */
export interface Candidate {
  name: string;
  cmd: string;
  from: string;
  /** the directory from the root ('' for the root) */
  dir: string;
  /** the script, target or CI command it comes from */
  script: string;
  source: 'npm' | 'make' | 'go' | 'ci';
  status: 'pick' | 'offer' | 'covered' | 'excluded';
  reasons: string[];
  optional?: boolean;
  /** the script's own body (npm) */
  body?: string;
}

export interface GateProposal {
  gates: Gate[];
  excluded: { name: string; cmd: string; why: string }[];
  /** candidates offered but not chosen (below the root, in CI, other root scripts); never part of `gates` */
  proposals: SubdirGate[];
  /** every candidate, with its status and reasons (024 S-9) */
  candidates: Candidate[];
}

const MUTATING = /--fix\b|--write\b|\bfmt\b(?!:check)|(^|\s)format(\s|$)/;

const tidy = (s: string) => s.trim().replace(/\s+/g, ' ');
const unredirect = (s: string) => s.replace(/\d*>&\d+/g, '').replace(/\d*>\s*\S+/g, '');

/**
 * Quoted text that is not one plain word (letters, digits, `_`, `:`, `.`, `-`) becomes one opaque word, so text inside
 * quotes is never split into commands (023 A-11); a quoted single word stays for `unquote`. null when a
 * quote is left open or a backslash appears: the body is then unclear and nothing in it counts.
 */
const OPAQUE = '\u0000quoted\u0000';
function maskQuotes(body: string): string | null {
  // an escape may hide or fake a quote; a body with a backslash is unclear (A-11)
  if (body.includes('\\')) return null;
  const out = body.replace(/(["'])(.*?)\1/g, (m: string, _q: string, inner: string) =>
    /^[\w:.-]+$/.test(inner) ? m : OPAQUE,
  );
  return /["']/.test(out.replace(/(["'])[\w:.-]+\1/g, '')) ? null : out;
}

/** A bundle script's body split into its commands (023 S-2): quoted text masked, redirects gone, split on && || ; | &. */
function pieces(raw: string): string[] {
  const body = maskQuotes(raw);
  if (body === null) return [];
  return unredirect(body)
    .split(/&&|\|\||[;|&]/)
    .map(tidy)
    .filter(Boolean);
}

/** run-s / run-p / npm-run-all options that take no value; any other option makes the command unclear. */
const RUN_ALL_FLAGS = new Set([
  '-p',
  '--parallel',
  '-s',
  '--sequential',
  '-c',
  '--continue-on-error',
  '-l',
  '--print-label',
  '-n',
  '--print-name',
  '--silent',
]);
const unquote = (w: string) => w.replace(/^(['"])(.*)\1$/, '$2');

/**
 * Whether one command runs the root script `name` by name (023 S-2.1, A-5, A-6): `pnpm|yarn|bun [run]
 * name` or `npm run|run-script name` with no option at all (an option may hold a value read as the
 * name, print help, or point at another package or directory), or `run-s|run-p|npm-run-all … name …`
 * with value-free flags only. When unsure, it does not count, so the check is kept: `pnpm lint --quiet`
 * runs twice, no check is lost. `echo lint` and `turbo run lint` do not count.
 */
function runsByName(piece: string, name: string): boolean {
  const [tool, ...rest] = piece.split(' ').map(unquote);
  if (tool === 'run-s' || tool === 'run-p' || tool === 'npm-run-all')
    return rest.every((w) => !w.startsWith('-') || RUN_ALL_FLAGS.has(w)) && rest.includes(name);
  if (rest.some((w) => w.startsWith('-'))) return false;
  if (tool === 'pnpm' || tool === 'yarn' || tool === 'bun')
    return (rest[0] === 'run' ? rest[1] : rest[0]) === name;
  if (tool === 'npm') return (rest[0] === 'run' || rest[0] === 'run-script') && rest[1] === name;
  return false;
}

/**
 * Whether the bundle body already runs the root script `name` (023 S-2): one of its commands runs it
 * by name, or is the script's own body cleaned up the same way.
 */
function calls(bundle: string | null, name: string, scripts: Record<string, string>): boolean {
  if (bundle === null) return false;
  // the script's own body, cleaned up the same way; a body with masked or open quotes never matches (A-11)
  const masked = maskQuotes(scripts[name] ?? '');
  const own = masked === null || masked.includes(OPAQUE) ? '' : tidy(unredirect(masked));
  return pieces(bundle).some((piece) => runsByName(piece, name) || (own !== '' && piece === own));
}

/** The reasons a candidate carries (024 S-9); tests assert these texts. */
export const REASON = {
  ci: (file: string) => `also in CI (${file})`,
  runs: (by: string, piece: string) => `${by} already runs it (${piece})`,
  calls: (bundle: string) => `${bundle} already calls it`,
  dependsOn: (target: string) => `Makefile ${target} depends on it`,
  holds: (by: string) => `the body of ${by} holds it`,
  mutates: 'rewrites files',
  neverEnds: 'never ends',
  install: 'install step',
  platform: 'platform packaging',
  outside: (file: string) => `outside the workspace (${file})`,
  unclear: (why: string) => `unclear (${why})`,
} as const;

const KEYWORDS = new Set(['check', 'lint', 'test', 'typecheck', 'build', 'e2e', 'verify', 'ci']);
const NEVER_ENDS = new Set(['dev', 'start', 'watch', 'serve', 'preview']);
const INSTALL_STEPS = new Set(['prepare', 'preinstall', 'install', 'postinstall']);
const PLATFORM = new Set([
  'win',
  'windows',
  'mac',
  'macos',
  'darwin',
  'linux',
  'dmg',
  'exe',
  'msi',
  'appimage',
  'deb',
  'rpm',
  'snap',
  'pkg',
]);
const words = (name: string) => name.split(/[:_-]/);
const bodyWords = (body: string) => body.split(/\s+/);

/** Whether a script name is a gate candidate by its name (024 S-4): a keyword as one of its words. */
export function keywordName(name: string): boolean {
  return name === 'type-check' || words(name).some((w) => KEYWORDS.has(w));
}

/** Why a script is never a gate (024 S-4), or null. A check-named script that rewrites files is only passed over. */
export function exclusion(name: string, body: string): string | null {
  if (INSTALL_STEPS.has(name)) return REASON.install;
  if (
    words(name).some((w) => NEVER_ENDS.has(w)) ||
    bodyWords(body).some((w) => NEVER_ENDS.has(w) || w === '--watch')
  )
    return REASON.neverEnds;
  if (words(name).some((w) => PLATFORM.has(w.toLowerCase()))) return REASON.platform;
  if (MUTATING.test(body)) return REASON.mutates;
  return null;
}

/** A `pre<x>`/`post<x>` script of another script `x`: an npm lifecycle hook, not a gate. */
const lifecycle = (name: string, scripts: Record<string, string>) => {
  const m = /^(?:pre|post)(.+)$/.exec(name);
  return !!m && m[1]! in scripts;
};

/** A gate name from a script name: `:` cannot stand in a gates.yaml key the gate script reads (024 A-3). */
const gateName = (s: string) => s.replace(/:/g, '-');

const readScripts = (p: string): Record<string, string> => {
  try {
    const s = (JSON.parse(readFileSync(p, 'utf8')) as { scripts?: Record<string, unknown> })
      .scripts;
    return Object.fromEntries(
      Object.entries(s ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
  } catch {
    return {};
  }
};

/** The Makefile's targets with their prerequisites and recipe lines. */
function makeTargets(text: string): Map<string, { deps: string[]; recipe: string[] }> {
  const out = new Map<string, { deps: string[]; recipe: string[] }>();
  let cur: { deps: string[]; recipe: string[] } | null = null;
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_.-]+)\s*:(?!=)\s*(.*)$/.exec(line);
    if (m && !m[1]!.startsWith('.')) {
      cur = { deps: m[2]!.replace(/#.*/, '').trim().split(/\s+/).filter(Boolean), recipe: [] };
      out.set(m[1]!, cur);
    } else if (line.startsWith('\t') && cur) cur.recipe.push(line.trim());
    else if (line.trim() && !line.startsWith('#')) cur = null;
  }
  return out;
}

const MAKE_TARGETS = ['check', 'lint', 'test', 'build', 'vet', 'verify'];

/** The pieces of a body split into words, quoted words unquoted (for the workspace forms). */
const pieceWords = (piece: string) => piece.split(' ').map(unquote);

/**
 * Every gate candidate of the repository (024 S-4–S-10): the root package.json (or the root Makefile),
 * package.json scripts, Makefile targets and go.mod below the root to depth 3, and the one-line `run:`
 * commands of pull-request workflows, each with its status and reasons.
 */
export function detectCandidates(root: string): Candidate[] {
  const out: Candidate[] = [];
  const run = runner(root);
  const pkgs = workspacePackages(root);
  const covered = (c: Candidate, why: string) => {
    if (c.status === 'excluded') return;
    if (c.status !== 'covered') c.status = 'covered';
    if (!c.reasons.includes(why)) c.reasons.push(why);
  };

  // the root
  const rootScripts: Record<string, string> =
    run && run !== 'make' && existsSync(join(root, 'package.json'))
      ? readScripts(join(root, 'package.json'))
      : {};
  if (run && run !== 'make' && existsSync(join(root, 'package.json'))) {
    const cmd = (s: string) => (run === 'npm' ? `npm run ${s}` : `${run} ${s}`);
    const bundle =
      ['check', 'verify', 'ci'].find(
        (n) => n in rootScripts && !MUTATING.test(rootScripts[n] ?? ''),
      ) ?? null;
    const has = (n: string) => n in rootScripts && !exclusion(n, rootScripts[n] ?? '');
    const test = has('test') ? 'test' : has('test:unit') ? 'test:unit' : null;
    const e2e = has('test:e2e') ? 'test:e2e' : has('e2e') ? 'e2e' : null;
    const picks = new Set(
      [
        bundle,
        'lint',
        'typecheck',
        test,
        'build',
        e2e,
        'lint:check',
        'format:check',
        'type-check',
      ].filter((n): n is string => !!n),
    );
    for (const [name, body] of Object.entries(rootScripts)) {
      if (!/^[\w:.-]+$/.test(name) || lifecycle(name, rootScripts)) continue;
      const why = exclusion(name, body);
      if (why) {
        if (why === REASON.mutates && /check/.test(name) && name !== 'typecheck') continue;
        out.push({
          name,
          cmd: body,
          from: `package.json#scripts.${name}`,
          dir: '',
          script: name,
          source: 'npm',
          status: 'excluded',
          reasons: [why],
          body,
        });
        continue;
      }
      if (!keywordName(name)) continue;
      const g =
        name === bundle ? 'check' : name === test ? 'test' : name === e2e ? 'e2e' : gateName(name);
      out.push({
        name: g,
        cmd: cmd(name),
        from: `package.json#scripts.${name}`,
        dir: '',
        script: name,
        source: 'npm',
        status: picks.has(name) ? 'pick' : 'offer',
        reasons: [],
        body,
        ...(name === e2e ? { optional: true } : {}),
      });
    }
    // what the bundle already calls (023 S-2, now for every candidate)
    if (bundle)
      for (const c of out)
        if (
          c.dir === '' &&
          c.script !== bundle &&
          calls(rootScripts[bundle] ?? '', c.script, rootScripts)
        )
          covered(c, REASON.calls(bundle));
  } else if (run === 'make') {
    const t = makeTargets(readFileSync(join(root, 'Makefile'), 'utf8'));
    for (const name of MAKE_TARGETS)
      if (t.has(name))
        out.push({
          name,
          cmd: `make ${name}`,
          from: `Makefile:${name}`,
          dir: '',
          script: name,
          source: 'make',
          status: ['check', 'test', 'build'].includes(name) ? 'pick' : 'offer',
          reasons: [],
        });
  }

  // below the root (spec 019 S-5): package.json, Makefile, go.mod
  out.push(...subdirCandidates(root, run));

  // a body that holds another candidate's body in the same directory (S-6)
  for (const c of out) {
    if (c.status === 'excluded' || !c.body) continue;
    const own = c.body.trim().replace(/\s+/g, ' ');
    for (const by of out)
      if (
        by !== c &&
        by.dir === c.dir &&
        by.body &&
        by.status !== 'excluded' &&
        by.script !== c.script
      ) {
        const ps = pieces(by.body);
        if (ps.length > 1 && ps.includes(own)) covered(c, REASON.holds(by.script));
      }
  }

  // Makefiles: a target another one depends on or calls; go test/vet a recipe already runs (S-6)
  const dirs = new Set(out.filter((c) => c.source === 'make').map((c) => c.dir));
  for (const d of dirs) {
    const t = makeTargets(readFileSync(join(root, d, 'Makefile'), 'utf8'));
    for (const c of out.filter((x) => x.dir === d && x.source === 'make'))
      for (const [target, { deps, recipe }] of t)
        if (
          target !== c.script &&
          MAKE_TARGETS.includes(target) &&
          (deps.includes(c.script) ||
            recipe.some((r) => new RegExp(`(?:\\$\\(MAKE\\)|\\bmake)\\s+${c.script}\\b`).test(r)))
        )
          covered(c, REASON.dependsOn(target));
    const recipes = [...t.values()].flatMap((x) => x.recipe);
    for (const c of out.filter((x) => x.dir === d && x.source === 'go'))
      if (recipes.some((r) => new RegExp(`\\bgo ${c.script}\\b`).test(r)))
        covered(c, REASON.holds(`Makefile ${c.script}`));
  }

  // workspace packages a root script already runs (S-7)
  if (pkgs.length)
    for (const [name, body] of Object.entries(rootScripts)) {
      if (exclusion(name, body)) continue;
      for (const piece of pieces(body)) {
        const f = forwards(pieceWords(piece), pkgs);
        if (!f || 'unclear' in f) continue;
        for (const c of out)
          if (
            c.source === 'npm' &&
            f.pkgs.some((p) => p.dir === c.dir) &&
            f.scripts.includes(c.script)
          )
            covered(c, REASON.runs(name, piece));
      }
    }
  // a directory with a project file of its own is outside the root workspace
  if (pkgs.length || workspaceGlobs(root))
    for (const c of out) {
      const own = ownProjectFile(root, c.dir);
      if (own && c.source === 'npm' && !c.reasons.includes(REASON.outside(own)))
        c.reasons.push(REASON.outside(own));
    }

  // pull-request workflows (S-8)
  const skip = (cmd: string) => exclusion('', cmd) !== null;
  for (const r of ciRuns(root, compound, skip)) {
    const same =
      out.find((c) => c.status !== 'excluded' && c.cmd === r.cmd) ??
      out.find(
        (c) =>
          c.status !== 'excluded' &&
          c.dir === r.dir &&
          c.body !== undefined &&
          c.body.trim().replace(/\s+/g, ' ') === r.raw,
      );
    if (same) {
      if (!same.reasons.includes(REASON.ci(r.file))) same.reasons.push(REASON.ci(r.file));
      continue;
    }
    const slug = r.cmd
      .split(' ')
      .filter((w) => !w.startsWith('-') && !w.startsWith('.') && w !== r.dir)
      .map((w) => w.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, ''))
      .filter(Boolean)
      .join('-');
    out.push({
      name: `ci-${slug}`,
      cmd: r.cmd,
      from: r.file,
      dir: r.dir,
      script: r.raw,
      source: 'ci',
      status: 'offer',
      reasons: [REASON.ci(r.file)],
    });
  }

  // one name each: a later candidate with a taken name gets -2, -3 …
  const taken = new Set<string>();
  for (const c of out) {
    if (c.status === 'excluded') continue;
    let n = c.name;
    for (let i = 2; taken.has(n); i++) n = `${c.name}-${i}`;
    c.name = n;
    taken.add(n);
  }
  return out;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '.loctx', '.agents']);
const MAX_DEPTH = 3;
const SAFE_DIR = /^[\w@.+-]+(\/[\w@.+-]+)*$/;
const ROOT_GATE_NAMES = ['check', 'lint', 'typecheck', 'test', 'build', 'e2e'];

function dirRunner(root: string, dir: string, rootRunner: string | null): 'pnpm' | 'yarn' | 'npm' {
  if (existsSync(join(root, dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, dir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, dir, 'package-lock.json'))) return 'npm';
  return rootRunner === 'pnpm' || rootRunner === 'yarn' ? rootRunner : 'npm';
}

const SOURCE_ORDER = ['npm', 'make', 'go'] as const;
type Source = (typeof SOURCE_ORDER)[number];

/**
 * Candidates below the root (019 S-5, 024 S-4): package.json scripts named by the pattern, Makefile
 * targets and go.mod, to depth 3, one command each with the tool's own directory option.
 */
function subdirCandidates(root: string, rootRunner: string | null): Candidate[] {
  const cands: (Candidate & { source: Source })[] = [];
  const walk = (dir: string, depth: number) => {
    let entries;
    try {
      entries = readdirSync(join(root, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (!SAFE_DIR.test(rel)) continue;
      const pkg = join(root, rel, 'package.json');
      if (existsSync(pkg)) {
        const scripts = readScripts(pkg);
        const run = dirRunner(root, rel, rootRunner);
        for (const [sc, body] of Object.entries(scripts))
          if (
            /^[\w:.-]+$/.test(sc) &&
            keywordName(sc) &&
            !lifecycle(sc, scripts) &&
            !exclusion(sc, body)
          )
            cands.push({
              name: '',
              cmd:
                run === 'npm'
                  ? `npm --prefix ${rel} run ${sc}`
                  : run === 'yarn'
                    ? `yarn --cwd ${rel} ${sc}`
                    : `pnpm --dir ${rel} ${sc}`,
              from: `${rel}/package.json#scripts.${sc}`,
              dir: rel,
              script: sc,
              source: 'npm',
              status: 'offer',
              reasons: [],
              body,
            });
      }
      const mk = join(root, rel, 'Makefile');
      if (existsSync(mk)) {
        const t = makeTargets(readFileSync(mk, 'utf8'));
        for (const name of MAKE_TARGETS)
          if (t.has(name))
            cands.push({
              name: '',
              cmd: `make -C ${rel} ${name}`,
              from: `${rel}/Makefile:${name}`,
              dir: rel,
              script: name,
              source: 'make',
              status: 'offer',
              reasons: [],
            });
      }
      if (existsSync(join(root, rel, 'go.mod')))
        for (const t of ['test', 'vet'])
          cands.push({
            name: '',
            cmd: `go -C ${rel} ${t} ./...`,
            from: `${rel}/go.mod`,
            dir: rel,
            script: t,
            source: 'go',
            status: 'offer',
            reasons: [],
          });
      if (depth < MAX_DEPTH) walk(rel, depth + 1);
    }
  };
  walk('', 1);

  // Names are settled in a fixed order (path, source, script): the first keeps `<dir-slug>-<script>`,
  // a later one takes a source suffix, then -2, -3 … until free.
  cands.sort(
    (a, b) =>
      (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0) ||
      SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) ||
      (a.script < b.script ? -1 : a.script > b.script ? 1 : 0),
  );
  const taken = new Set(ROOT_GATE_NAMES);
  const out: Candidate[] = [];
  for (const c of cands) {
    if (compound(c.cmd)) continue;
    const base = `${c.dir.replace(/\//g, '-')}-${gateName(c.script)}`;
    let name = base;
    if (taken.has(name)) name = `${base}-${c.source}`;
    for (let i = 2; taken.has(name); i++) name = `${base}-${c.source}-${i}`;
    taken.add(name);
    out.push({ ...c, name });
  }
  return out;
}

/** The order of the gates install writes: check, lint, typecheck, test, build, e2e (023), the 024 ones beside their kin. */
const PICK_ORDER = [
  'check',
  'lint',
  'lint-check',
  'format-check',
  'typecheck',
  'type-check',
  'test',
  'build',
  'e2e',
];
const pickRank = (c: Candidate) => {
  const i = PICK_ORDER.indexOf(c.name);
  return i < 0 ? PICK_ORDER.length : i;
};

/**
 * The discovery of installation (design §5, 024 S-10): the candidates chosen by default become `gates`,
 * the excluded ones are listed, and the ones only offered are `proposals`.
 */
export function discoverGates(root: string): GateProposal {
  const candidates = detectCandidates(root);
  return {
    gates: candidates
      .filter((c) => c.status === 'pick')
      .toSorted((a, b) => pickRank(a) - pickRank(b))
      .map((c) => ({
        name: c.name,
        cmd: c.cmd,
        from: c.from,
        ...(c.optional ? { optional: true } : {}),
      })),
    excluded: candidates
      .filter((c) => c.status === 'excluded')
      .map((c) => ({ name: c.script, cmd: c.cmd, why: c.reasons[0] ?? '' })),
    proposals: candidates
      .filter((c) => c.status === 'offer')
      .map((c) => ({ name: c.name, cmd: c.cmd, from: c.from })),
    candidates,
  };
}

/** The candidates offered and not chosen by default (`config gates --add`). */
export function subdirProposals(root: string): SubdirGate[] {
  return discoverGates(root).proposals;
}

/** Vendor of a model ID by prefix, in order: gpt, gemini, cursor-, else claude (spec S-2). */
export function vendorOf(model: string): Vendor['name'] {
  if (model.startsWith('gpt')) return 'openai';
  if (model.startsWith('gemini')) return 'google';
  if (model.startsWith('cursor-')) return 'cursor';
  return 'claude';
}

/** Model IDs seen working in this environment. */
export const CONFIRMED_MODELS = new Set([
  'claude-opus-5-5',
  'claude-fable-5-1',
  'gpt-6-sol',
  'gpt-6-luna',
]);

export interface RunResult {
  status: number | null;
  stdout: string;
  timedOut?: boolean;
  error?: string;
}
export type ModelsRunner = (cli: string, args: string[]) => RunResult;

/** Runs `<cli> models` without a shell, stdin closed, 10 s limit. Nothing else is ever run. */
export const spawnModels: ModelsRunner = (cli, args) => {
  if (process.env['REINS_NO_VENDOR_SPAWN']) throw new Error(`refusing to spawn ${cli} under test`);
  const r = spawnSync(cli, args, {
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 10_000,
    encoding: 'utf8',
  });
  const code = (r.error as NodeJS.ErrnoException | undefined)?.code;
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    timedOut: code === 'ETIMEDOUT',
    error: r.error?.message,
  };
};

const LISTERS = { google: 'agy', cursor: 'cursor-agent' } as const;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

function parseModels(cli: string, out: string): string[] {
  const ids: string[] = [];
  for (const line of out.replace(ANSI, '').split(/\r?\n/)) {
    if (cli === 'agy') {
      if (line.includes('\t')) ids.push(line.split('\t')[0]!.trim());
    } else {
      const m = /^(\S+) - .+$/.exec(line);
      if (m) ids.push(m[1]!);
    }
  }
  return ids.filter(Boolean);
}

export type ListResult = { ids: string[] } | { failed: string };

/** `<cli> models` → model IDs, or the reason it could not be read. */
export function listModels(
  vendor: 'google' | 'cursor',
  run: ModelsRunner = spawnModels,
): ListResult {
  const cli = LISTERS[vendor];
  const r = run(cli, ['models']);
  if (r.timedOut) return { failed: 'timed out after 10 s' };
  if (r.error) return { failed: r.error };
  if (r.status !== 0) return { failed: `exit ${r.status}` };
  const ids = parseModels(cli, r.stdout);
  return ids.length ? { ids } : { failed: 'no model IDs in output' };
}

export interface ModelCache {
  run: ModelsRunner;
  onPath: (bin: string) => boolean;
  warn: (msg: string) => void;
  lists: Map<string, ListResult>;
}

export function newModelCache(o: Partial<Omit<ModelCache, 'lists'>> = {}): ModelCache {
  return {
    run: o.run ?? spawnModels,
    onPath: o.onPath ?? (process.env['REINS_NO_VENDOR_SPAWN'] ? () => false : onPath),
    warn: o.warn ?? ((m) => void process.stderr.write(`warning: ${m}\n`)),
    lists: new Map(),
  };
}

/**
 * Checks a binding against the vendor CLI's model list (spec S-3). Returns the fields to record,
 * or null when the vendor has no list command or its CLI is absent. Never blocks, never changes the model.
 */
export function checkBinding(
  model: string,
  vendor: Vendor['name'],
  cache: ModelCache,
): { unverified?: true; note?: string } | null {
  if (vendor !== 'google' && vendor !== 'cursor') return null;
  const cli = LISTERS[vendor];
  if (!cache.onPath(cli)) return null;
  let res = cache.lists.get(cli);
  if (!res) {
    res = listModels(vendor, cache.run);
    cache.lists.set(cli, res);
  }
  if ('failed' in res) return { unverified: true, note: `${cli} models failed: ${res.failed}` };
  if (res.ids.includes(model)) return {};
  cache.warn(`${model} is not in \`${cli} models\` — recorded as unverified`);
  return { unverified: true, note: `not in ${cli} models` };
}

/** A command with a pipe, list, redirect or substitution: a gate must be one plain command. */
export function compound(cmd: string): boolean {
  return /[|;&<>`]|\$\(/.test(cmd.replace(/'[^']*'|"[^"]*"/g, ''));
}
