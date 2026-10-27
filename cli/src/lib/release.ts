import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/** One proposed `release.workflows` entry, read off a dispatchable workflow. Never written anywhere. */
export interface ReleaseDraft {
  file: string;
  inputs: Record<string, string>;
  approval: 'none';
}

/**
 * Proposes `release:` settings (design §4) from `.github/workflows/*.yml|yaml` that have an
 * `on: workflow_dispatch` trigger (string, list or map form). Pure: reads, never writes; files
 * that do not parse are ignored. Returns [] when install.yaml already has a `release:` key.
 */
const RELEASE_NAME = /release|publish|deploy|ship/i;

export function draftRelease(root: string): ReleaseDraft[] {
  const pin = join(root, '.agents/harness/install.yaml');
  if (existsSync(pin))
    try {
      const doc = parse(readFileSync(pin, 'utf8')) as Record<string, unknown> | null;
      if (doc && typeof doc === 'object' && 'release' in doc) return [];
    } catch {
      // an unreadable pin has no release key to respect
    }
  const dir = join(root, '.github/workflows');
  if (!existsSync(dir)) return [];
  const out: ReleaseDraft[] = [];
  for (const f of readdirSync(dir).sort()) {
    if (!/\.ya?ml$/.test(f)) continue;
    let doc: unknown;
    try {
      doc = parse(readFileSync(join(dir, f), 'utf8'));
    } catch {
      continue;
    }
    if (!doc || typeof doc !== 'object') continue;
    const d = doc as Record<string, unknown>;
    const on = 'on' in d ? d['on'] : d['true']; // YAML 1.1 readers turn `on` into true
    let dispatch: unknown;
    if (on === 'workflow_dispatch') dispatch = {};
    else if (Array.isArray(on)) dispatch = on.includes('workflow_dispatch') ? {} : undefined;
    else if (on && typeof on === 'object' && 'workflow_dispatch' in on)
      dispatch = (on as Record<string, unknown>)['workflow_dispatch'] ?? {};
    if (dispatch === undefined) continue;
    const declared = (dispatch as { inputs?: unknown } | null)?.inputs;
    const inputs: Record<string, string> = {};
    if (declared && typeof declared === 'object')
      for (const [name, spec] of Object.entries(declared as Record<string, unknown>)) {
        const type = (spec as { type?: unknown } | null)?.type;
        inputs[name] =
          name === 'version'
            ? '{version}'
            : name === 'tag'
              ? 'v{version}'
              : type === 'boolean'
                ? 'false'
                : '<fill in>';
      }
    out.push({ file: f, inputs, approval: 'none' });
  }
  // CI and scanners are often dispatchable too: when some workflow looks like a release, propose only those
  const releasing = out.filter((d) => RELEASE_NAME.test(d.file));
  return releasing.length ? releasing : out;
}

/** The notes install and migrate print for a draft (and their dry runs). */
export function releaseDraftNotes(drafts: ReleaseDraft[]): string[] {
  return drafts.map(
    (d) =>
      `release settings draft (not written; add under release.workflows in install.yaml if right): {file: ${d.file}, inputs: {${Object.entries(
        d.inputs,
      )
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ')}}, approval: ${d.approval}}`,
  );
}

/** The checks `release.docs` may name (design §4). */
export const DOC_CHECKS = ['roadmap-row', 'changelog-section', 'mentions-version'] as const;
export type DocCheck = (typeof DOC_CHECKS)[number];

/** One entry of `release.docs` in install.yaml: a file the release must leave up to date. */
export interface ReleaseDoc {
  file: string;
  check: DocCheck;
}

/** Reads `release.docs`; [] when the file, the key or an entry is missing or malformed. */
export function readReleaseDocs(root: string): ReleaseDoc[] {
  const p = join(root, '.agents/harness/install.yaml');
  if (!existsSync(p)) return [];
  let doc: unknown;
  try {
    doc = parse(readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
  const list = (doc as { release?: { docs?: unknown } } | null)?.release?.docs;
  if (!Array.isArray(list)) return [];
  const out: ReleaseDoc[] = [];
  for (const d of list as Record<string, unknown>[]) {
    const check = d?.['check'];
    if (typeof d?.['file'] === 'string' && DOC_CHECKS.includes(check as DocCheck))
      out.push({ file: d['file'], check: check as DocCheck });
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);

/**
 * Whether `text` is up to date for version `v` (pure). `roadmap-row`: a table row whose first
 * cell is `v` and whose state cell is not planned/계획. `changelog-section`: rc `## [Unreleased] — v`
 * or `## [v]`; stable only `## [v]`. `mentions-version`: `v` as a token of its own.
 */
export function checkDoc(
  text: string,
  check: DocCheck,
  v: string,
  stage: 'rc' | 'stable',
): boolean {
  const e = escapeRe(v);
  if (check === 'roadmap-row')
    return text.split(/\r?\n/).some((line) => {
      const cells = line.split('|').map((c) => c.trim());
      return (
        line.trimStart().startsWith('|') &&
        cells[1] === v &&
        cells[2] !== undefined &&
        cells[2] !== '' &&
        !/^(planned|계획)$/i.test(cells[2])
      );
    });
  if (check === 'changelog-section')
    return stage === 'stable'
      ? new RegExp(`^## \\[${e}\\]`, 'm').test(text)
      : new RegExp(`^## (\\[Unreleased\\] — ${e}(?![\\w.])|\\[${e}\\])`, 'm').test(text);
  return new RegExp(`(?<![\\w.])${e}(?![\\w]|\\.\\d)`).test(text);
}
