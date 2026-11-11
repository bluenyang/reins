import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** A gate as `gates.yaml` holds it. A gate without `from` was written by hand. */
export interface FileGate {
  name: string;
  cmd: string;
  from?: string;
  optional?: boolean;
}

/** A gate the discovery of installation finds now (root gates and subdirectory proposals). */
export interface FoundGate {
  name: string;
  cmd: string;
  from: string;
  optional?: boolean;
}

/**
 * One difference between `gates.yaml` and what discovery finds now (design §9, `config gates --refresh`).
 * `name` is what the user picks it by: the file's name for `changed`, `gone` and `yours`, a free name for `new`.
 */
export type GateDiff =
  | { kind: 'new'; name: string; cmd: string; from: string; optional?: boolean }
  | { kind: 'changed'; name: string; cmd: string; from: string; was: { cmd: string; from: string } }
  | { kind: 'gone'; name: string; cmd: string; from: string; why: string }
  | { kind: 'yours'; name: string; cmd: string };

/** The file a `from` points into: `a/package.json#scripts.x`, `a/Makefile:test`, `a/go.mod`. */
const sourceFile = (from: string): string => from.split('#')[0]!.replace(/:[^/:]*$/, '');

/**
 * Compare the file with the discovery, in this order: same source and command → the same gate, no
 * difference; same source and name → `changed`; same name → `changed` (the root `check` now points at
 * another script); what is left of the discovery is `new`, and of the file `gone`. A gate without `from`
 * is the user's own: it is listed and never paired, changed or removed.
 */
export function diffGates(root: string, file: FileGate[], found: FoundGate[]): GateDiff[] {
  const out: GateDiff[] = [];
  let mine = file.filter((g) => g.from);
  let theirs = [...found];
  const pair = (
    match: (f: FileGate, d: FoundGate) => boolean,
    emit?: (f: FileGate, d: FoundGate) => void,
  ) => {
    const left: FileGate[] = [];
    for (const f of mine) {
      const i = theirs.findIndex((d) => match(f, d));
      if (i < 0) {
        left.push(f);
        continue;
      }
      emit?.(f, theirs[i]!);
      theirs = theirs.filter((_, k) => k !== i);
    }
    mine = left;
  };
  const changed = (f: FileGate, d: FoundGate) =>
    out.push({
      kind: 'changed',
      name: f.name,
      cmd: d.cmd,
      from: d.from,
      was: { cmd: f.cmd, from: f.from! },
    });
  pair((f, d) => f.from === d.from && f.cmd === d.cmd);
  pair((f, d) => f.from === d.from && f.name === d.name, changed);
  pair((f, d) => f.name === d.name, changed);

  const taken = new Set(file.map((g) => g.name));
  for (const d of theirs) {
    let name = d.name;
    for (let i = 2; taken.has(name); i++) name = `${d.name}-${i}`;
    taken.add(name);
    out.push({
      kind: 'new',
      name,
      cmd: d.cmd,
      from: d.from,
      ...(d.optional ? { optional: true } : {}),
    });
  }
  for (const f of mine)
    out.push({
      kind: 'gone',
      name: f.name,
      cmd: f.cmd,
      from: f.from!,
      why: existsSync(join(root, sourceFile(f.from!)))
        ? 'no longer proposed: its script or target is gone, or another gate now covers it'
        : `its source is gone (${sourceFile(f.from!)})`,
    });
  for (const g of file.filter((x) => !x.from))
    out.push({ kind: 'yours', name: g.name, cmd: g.cmd });

  const order = { changed: 0, gone: 1, new: 2, yours: 3 } as const;
  return out.toSorted((a, b) => order[a.kind] - order[b.kind]);
}

/** The differences the user can apply (`yours` is only shown). */
export const applicable = (diff: GateDiff[]): Exclude<GateDiff, { kind: 'yours' }>[] =>
  diff.filter((d): d is Exclude<GateDiff, { kind: 'yours' }> => d.kind !== 'yours');

/** One line per difference, for the report and the screen. */
export function formatGateDiff(d: GateDiff): string {
  const tag = d.kind.padEnd(8);
  switch (d.kind) {
    case 'new':
      return `${tag}${d.name}  ${d.cmd}   (${d.from})${d.optional ? '  optional' : ''}`;
    case 'changed':
      return `${tag}${d.name}  ${d.was.cmd} → ${d.cmd}   (${d.was.from === d.from ? d.from : `${d.was.from} → ${d.from}`})`;
    case 'gone':
      return `${tag}${d.name}  ${d.cmd}   (${d.from}) — ${d.why}`;
    default:
      return `${tag}${d.name}  ${d.cmd}   (written by hand — left alone)`;
  }
}
