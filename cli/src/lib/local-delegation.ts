import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LOCAL_DELEGATION, localDelegation } from './agents-md.js';
import { effectiveBindings, readTeam } from './bindings.js';
import { sha } from './generate.js';
import { readManifest } from './vendor-write.js';

/**
 * Bring `.loctx/delegation.local.md` in line with this person's settings (spec 020 S-1, S-2): written when
 * they delegate differently from the team, removed when they no longer do. Called by whatever writes the
 * AGENTS.md delegation block — `config` at either scope, `install`, `update` — never while a project works.
 */
export function syncLocalDelegation(
  root: string,
  dryRun = false,
): 'written' | 'removed' | undefined {
  const team = readTeam(root).doc;
  if (!team) return undefined;
  const p = join(root, LOCAL_DELEGATION);
  const files = readManifest(root).files;
  // a team agent file counts only when reins wrote it and it is unchanged (review: a refused file is not ours)
  const managed = (name: string) => {
    const f = `.claude/agents/${name}.md`;
    const abs = join(root, f);
    return files[f] !== undefined && existsSync(abs) && sha(readFileSync(abs, 'utf8')) === files[f];
  };
  const want = localDelegation(team, effectiveBindings(root)!, managed);
  const have = existsSync(p) ? readFileSync(p, 'utf8') : null;
  if (want === have) return undefined;
  if (want === null) {
    if (!dryRun) rmSync(p, { force: true });
    return 'removed';
  }
  if (!dryRun) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, want);
  }
  return 'written';
}

/** What `config` says after writing or removing the table (spec 020 S-4-3). */
export const LOCAL_DELEGATION_NOTE = (what: 'written' | 'removed'): string =>
  `personal delegation table ${what} (${LOCAL_DELEGATION}): tell a running agent session to re-read it, or start a new one`;
