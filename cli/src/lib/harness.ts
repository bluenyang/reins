import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { workTreeReader, type Reader } from './reader.js';

/**
 * Where the harness sources live: an installed project has `.agents/harness/`;
 * this repository (the upstream) keeps them at `harness/`.
 */
export function harnessDir(root: string): string | null {
  for (const d of ['.agents/harness', 'harness']) {
    if (existsSync(join(root, d, 'policy'))) return join(root, d);
  }
  return null;
}

/** Like `harnessDir`, but repository-relative and read through a `Reader` (the index, for pre-commit). */
export function harnessRel(rd: Reader): string | null {
  for (const d of ['.agents/harness', 'harness']) if (rd.list(`${d}/policy`).length > 0) return d;
  return null;
}

export function readYaml<T>(path: string): T {
  return parse(readFileSync(path, 'utf8')) as T;
}

export interface RedLine {
  id: string;
  text: string;
  patterns?: string[];
  allowed?: string[];
}

export interface StopCondition {
  id: string;
  group: string;
  kind: 'intent' | 'knowledge';
  grade: 'HOLD' | 'STOP' | 'ESCALATE' | 'WARN';
  detect: string;
  text: string;
  resume: string;
}

export function redLines(dir: string): RedLine[] {
  return readYaml<{ rules: RedLine[] }>(join(dir, 'policy', 'common-red-lines.yaml')).rules;
}

export function stops(dir: string): StopCondition[] {
  return readYaml<{ stops: StopCondition[] }>(join(dir, 'policy', 'stops.yaml')).stops;
}

/** Secret patterns from red line C4, or null when there is no harness to read. */
export function secretPolicy(
  root: string,
  rd: Reader = workTreeReader(root),
): { patterns: string[]; allowed: string[] } | null {
  const rel = harnessRel(rd);
  if (!rel) return null;
  const text = rd.read(`${rel}/policy/common-red-lines.yaml`);
  if (text === undefined) return null;
  const c4 = (parse(text) as { rules: RedLine[] }).rules.find((r) => r.id === 'C4');
  if (!c4?.patterns) return null;
  return { patterns: c4.patterns, allowed: c4.allowed ?? [] };
}
