import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REASON, type Candidate } from './detect.js';
import { forwards, workspacePackages } from './detect-workspaces.js';

/** A gate as `gates.yaml` holds it. A gate without `from` was written by hand. */
export interface FileGate {
  name: string;
  cmd: string;
  from?: string;
  optional?: boolean;
}

/**
 * One row of `config gates --refresh` (024 S-11): a gate of `gates.yaml` or a candidate of the discovery,
 * with its state. reins never says a gate is gone; it only says what it found and where.
 */
export type GateState =
  | 'applied'
  | 'applied, written by hand'
  | 'applied, source not found'
  | 'applied, another command'
  | 'not applied'
  | 'not applied, already runs';

export interface StatusRow {
  state: GateState;
  /** the gate's name in gates.yaml, or a free name for a candidate not applied */
  name: string;
  cmd: string;
  from?: string;
  /** the command the discovery finds now (`applied, another command`) */
  found?: { cmd: string; from: string };
  optional?: boolean;
  reasons: string[];
}

/** What picking a row does (024 S-13): add a candidate, remove a gate, or give a gate the command found now. */
export type GateAction = 'add' | 'remove' | 'replace';

/** `<path>#x` and `<path>:x` are one source (the old notation, 024 S-11). */
const normal = (from: string) => from.replace(/#(?!scripts\.)/, ':');

/**
 * Whether the script or target a `from` points at is really there (024 S-11): a package.json script,
 * a Makefile target, a go.mod, a workflow file. A source of another kind reads as there.
 */
export function sourceThere(root: string, from: string): boolean {
  const f = normal(from);
  const pkg = /^(.*package\.json)#scripts\.(.+)$/.exec(f);
  if (pkg) {
    try {
      const s = (JSON.parse(readFileSync(join(root, pkg[1]!), 'utf8')) as { scripts?: object })
        .scripts;
      return !!s && pkg[2]! in s;
    } catch {
      return false;
    }
  }
  const mk = /^(.*Makefile):(.+)$/.exec(f);
  if (mk) {
    try {
      return new RegExp(`^${mk[2]!.replace(/[.+?^${}()|[\]\\]/g, '\\$&')}\\s*:(?!=)`, 'm').test(
        readFileSync(join(root, mk[1]!), 'utf8'),
      );
    } catch {
      return false;
    }
  }
  if (/(^|\/)go\.mod$/.test(f) || f.startsWith('.github/workflows/'))
    return existsSync(join(root, f));
  return true;
}

const pieceWords = (cmd: string) => cmd.trim().split(/\s+/);

/**
 * Pair the gates of the file with the candidates (024 S-11): the same command is the same gate whatever
 * the source; then the same source. A gate's own command may run candidates through the workspace
 * (`pnpm -r test`): those read `not applied, already runs`. Excluded candidates are not listed.
 */
export function gateStatus(root: string, file: FileGate[], candidates: Candidate[]): StatusRow[] {
  let left = candidates.filter((c) => c.status !== 'excluded');
  const take = (match: (c: Candidate) => boolean) => {
    const c = left.find(match);
    if (c) left = left.filter((x) => x !== c);
    return c;
  };
  const rows: StatusRow[] = [];
  // pairing in passes over every gate, so a looser match never takes a candidate a later gate has by
  // command (review 1): the same command; then the same source and name, the same source and script
  // (two go gates share one go.mod), the same source; then, with a source, the same name (the root
  // `check` that now points at another script; 021, 024 A-7)
  const pair = new Map<FileGate, Candidate>();
  const pass = (match: (g: FileGate, c: Candidate) => boolean, withSource = false) => {
    for (const g of file)
      if (!pair.has(g) && (!withSource || g.from)) {
        const c = take((x) => match(g, x));
        if (c) pair.set(g, c);
      }
  };
  const same = (g: FileGate, c: Candidate) => normal(c.from) === normal(g.from!);
  const scriptOf = (cmd: string) =>
    cmd.split(' ').find((w) => ['test', 'vet', 'build', 'check', 'lint'].includes(w));
  pass((g, c) => c.cmd === g.cmd);
  pass((g, c) => same(g, c) && c.name === g.name, true);
  pass((g, c) => same(g, c) && c.script === scriptOf(g.cmd), true);
  pass(same, true);
  pass((g, c) => c.name === g.name, true);
  for (const g of file) {
    const c = pair.get(g);
    const base = {
      name: g.name,
      cmd: g.cmd,
      ...(g.from ? { from: g.from } : {}),
      ...(g.optional ? { optional: true } : {}),
      reasons: c ? c.reasons.filter((r) => !r.startsWith('unclear')) : [],
    };
    if (!g.from) rows.push({ ...base, state: 'applied, written by hand' });
    else if (c && c.cmd !== g.cmd)
      rows.push({
        ...base,
        state: 'applied, another command',
        found: { cmd: c.cmd, from: c.from },
      });
    else if (!c && !sourceThere(root, g.from))
      rows.push({ ...base, state: 'applied, source not found' });
    else rows.push({ ...base, state: 'applied' });
  }
  // a gate that runs workspace packages already runs their candidates
  const pkgs = workspacePackages(root);
  const by = new Map<Candidate, string[]>();
  if (pkgs.length)
    for (const g of file) {
      const f = forwards(pieceWords(g.cmd), pkgs);
      if (!f || 'unclear' in f) continue;
      for (const c of left)
        if (
          c.source === 'npm' &&
          f.pkgs.some((p) => p.dir === c.dir) &&
          f.scripts.includes(c.script)
        )
          by.set(c, [...(by.get(c) ?? []), REASON.runs(g.name, g.cmd)]);
    }
  const taken = new Set(file.map((g) => g.name));
  for (const c of left) {
    let name = c.name;
    for (let i = 2; taken.has(name); i++) name = `${c.name}-${i}`;
    taken.add(name);
    const extra = by.get(c) ?? [];
    rows.push({
      state: c.status === 'covered' || extra.length ? 'not applied, already runs' : 'not applied',
      name,
      cmd: c.cmd,
      from: c.from,
      ...(c.optional ? { optional: true } : {}),
      reasons: [...c.reasons, ...extra.filter((r) => !c.reasons.includes(r))],
    });
  }
  return rows;
}

/** The actions a row offers (024 S-13): add for a candidate, remove for a gate, replace for another command. */
export function actionsOf(row: StatusRow): GateAction[] {
  if (row.state.startsWith('not applied')) return ['add'];
  return row.state === 'applied, another command' ? ['replace', 'remove'] : ['remove'];
}

/** One line per row, for the report, the screen and `.loctx/gates-refresh.md`. */
export function formatGateRow(r: StatusRow): string {
  const cmd = r.found ? `${r.cmd} → ${r.found.cmd}` : r.cmd;
  const why = r.reasons.length ? ` — ${r.reasons.join('; ')}` : '';
  return `${r.state.padEnd(27)} ${r.name}  ${cmd}${r.from ? `   (${r.from})` : ''}${r.optional ? '  optional' : ''}${why}`;
}
