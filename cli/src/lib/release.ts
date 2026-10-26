import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/** One release workflow from `release.workflows` in `.agents/harness/install.yaml` (design §9). */
export interface ReleaseWorkflow {
  file: string;
  inputs: Record<string, string>;
  stages: ('rc' | 'stable')[];
  approval: 'npm-staged' | 'none';
}

/** Reads `release:` from install.yaml; null when the file or the key is missing or malformed. */
export function readRelease(root: string): ReleaseWorkflow[] | null {
  const p = join(root, '.agents/harness/install.yaml');
  if (!existsSync(p)) return null;
  let doc: unknown;
  try {
    doc = parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
  const list = (doc as { release?: { workflows?: unknown } } | null)?.release?.workflows;
  if (!Array.isArray(list)) return null;
  const out: ReleaseWorkflow[] = [];
  for (const w of list as Record<string, unknown>[]) {
    if (!w || typeof w['file'] !== 'string') continue;
    const inputs: Record<string, string> = {};
    for (const [k, v] of Object.entries((w['inputs'] as Record<string, unknown> | undefined) ?? {}))
      inputs[k] = String(v);
    const explicit = Array.isArray(w['stages']);
    const stages = Array.isArray(w['stages'])
      ? (w['stages'] as unknown[]).filter((s): s is 'rc' | 'stable' => s === 'rc' || s === 'stable')
      : [];
    out.push({
      file: w['file'],
      inputs,
      stages: explicit ? stages : ['rc', 'stable'],
      approval: w['approval'] === 'npm-staged' ? 'npm-staged' : 'none',
    });
  }
  return out;
}

/** POSIX single-quote `s` unless it only has safe characters. */
export function shq(s: string): string {
  return /^[A-Za-z0-9_.,:/@%+=-]+$/.test(s) ? s : `'${s.split("'").join("'\\''")}'`;
}

/** The `gh workflow run` lines for one stage; `{version}` in an input value becomes `version`. */
export function dispatchLines(
  workflows: ReleaseWorkflow[],
  stage: 'rc' | 'stable',
  version: string,
): string[] {
  return workflows
    .filter((w) => w.stages.includes(stage))
    .map((w) => {
      const args = Object.entries(w.inputs).flatMap(([k, v]) => [
        '-f',
        shq(`${k}=${v.split('{version}').join(version)}`),
      ]);
      return ['gh workflow run', shq(w.file), ...args].join(' ');
    });
}
