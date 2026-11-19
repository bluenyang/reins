import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import { LOCAL_BINDINGS, readLocalBindings, writeBindings } from './bindings.js';
import { mergeSettings } from './vendor-write.js';

/**
 * Force push with lease, per person (024 revision 1, S-26a). The team's `.claude/settings.json` does not
 * deny it; each person decides at install, update or `config --local`, and reins writes the answer into
 * the personal, git-ignored `.claude/settings.local.json`. Claude Code lets a deny anywhere win over an
 * allow anywhere, so a team deny could not be lifted per person.
 */
export const LOCAL_SETTINGS = '.claude/settings.local.json';

/** The rules reins puts into the personal file when the answer is deny. */
export const FORCE_WITH_LEASE_RULES = [
  'Bash(git push --force-with-lease)',
  'Bash(git push --force-with-lease *)',
];

/** Which rules of the personal file reins wrote (never the team's `generated.yaml`: the file is personal). */
export const LOCAL_SETTINGS_OWNED = '.loctx/settings.local.owned.yaml';

export type ForceWithLease = 'deny' | 'allow';

/** The answer recorded in `.loctx/bindings.local.yaml` (`local.force_with_lease`), if any. */
export function recordedForceWithLease(root: string): ForceWithLease | undefined {
  const v: unknown = readLocalBindings(root)?.local?.force_with_lease;
  return v === 'deny' || v === 'allow' ? v : undefined;
}

/** The question install, update and `config --local` ask. */
export const FORCE_WITH_LEASE_QUESTION =
  'Deny `git push --force-with-lease` to the agents on this machine? (written to .claude/settings.local.json; the team settings do not deny it)';

function readOwned(root: string): string[] {
  const p = join(root, LOCAL_SETTINGS_OWNED);
  if (!existsSync(p)) return [];
  const doc = parse(readFileSync(p, 'utf8')) as { owned?: unknown } | null;
  return Array.isArray(doc?.owned)
    ? doc.owned.filter((r): r is string => typeof r === 'string')
    : [];
}

export interface LocalForcePushResult {
  choice: ForceWithLease;
  /** what changed in the personal file: written, unchanged, or refused (not a settings object) */
  file: 'written' | 'unchanged' | 'refused';
  note: string;
}

/**
 * Record the answer and bring `.claude/settings.local.json` in line with it (S-26a): on deny the two rules
 * are added where missing; on allow only the rules reins wrote are taken out. Every other key and entry of
 * the file stays as the person has it. A file that is not a settings object is left alone and named.
 */
export function applyLocalForcePush(
  root: string,
  choice: ForceWithLease,
  dryRun = false,
  /** an answer the person gave; the non-interactive default is applied but not recorded, so a terminal run still asks */
  answered = true,
): LocalForcePushResult {
  const path = join(root, LOCAL_SETTINGS);
  const was = readOwned(root);
  const now = choice === 'deny' ? FORCE_WITH_LEASE_RULES : [];
  const before = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const how =
    choice === 'deny'
      ? `force push with lease: denied to the agents on this machine (${LOCAL_SETTINGS}; \`reins config --local\` changes it)`
      : `force push with lease: not denied on this machine (\`reins config --local\` changes it)`;
  // allow and nothing of ours there: no file to make
  const next = before === null && now.length === 0 ? null : mergeSettings(before ?? '{}', now, was);
  if (before !== null && next === null)
    return {
      choice,
      file: 'refused',
      note: `${LOCAL_SETTINGS} is not a settings object — not changed; force push with lease is ${choice === 'deny' ? 'not denied there yet' : 'left as the file has it'}`,
    };
  if (dryRun)
    return { choice, file: next !== null && next !== before ? 'written' : 'unchanged', note: how };
  if (answered && recordedForceWithLease(root) !== choice) {
    const doc = readLocalBindings(root) ?? {};
    writeBindings(root, { ...doc, local: { ...doc.local, force_with_lease: choice } }, 'local');
  }
  const p = join(root, LOCAL_SETTINGS_OWNED);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(
    p,
    `# the deny rules reins wrote into ${LOCAL_SETTINGS} — this machine only\n${stringify({ owned: now })}`,
  );
  if (next === null || next === before) return { choice, file: 'unchanged', note: how };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  return { choice, file: 'written', note: how };
}

/** Where the answer is kept, for the report. */
export const FORCE_WITH_LEASE_RECORD = LOCAL_BINDINGS;
