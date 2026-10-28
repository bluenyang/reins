import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { defaultsAsker } from '../lib/ask.js';
import { migrateDetected } from '../lib/bindings.js';
import { overrides } from '../lib/blocks.js';
import type { Vendor } from '../lib/detect.js';
import { repoRoot } from '../lib/git.js';
import { BACK, EXIT, type Prompter } from '../lib/prompter.js';
import { harnessVersion, packageHarness, packageVersion } from '../lib/upstream.js';
import { runInstall, type InstallResult, type Tier } from './install.js';

export interface UpdateOptions {
  cwd?: string;
  dryRun?: boolean;
  now?: Date;
  detectVendors?: () => Vendor[];
  /**
   * Confirm before writing (design §9): given only when stdin and stdout are terminals, without
   * `--yes`, `--dry-run` or `--json`. A dry run is made first, `show` prints its plan, then `confirm` asks.
   */
  prompter?: Prompter;
  show?: (plan: UpdateResult) => void;
}

export interface UpdateResult {
  root: string;
  refused?: string;
  from?: string;
  to?: string;
  /** `cli` in install.yaml before the update, or 'none'. */
  cliFrom?: string;
  /** The running package version. */
  cliTo?: string;
  changes: string[]; // changelog entries newer than the pin
  needsSkill: boolean; // some entry asks for /reins-update
  overrides: string[];
  /** Vendors whose `detected` moved from bindings.yaml to the local file (design §5). */
  bindingsMoved?: string[];
  install?: InstallResult;
  /** The user answered no at the confirmation: nothing was written. */
  declined?: boolean;
}

/** Numeric dotted-version compare; pre-release suffixes are ignored. */
export function newer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** Changelog entries for versions in (from, to]. */
export function changesBetween(changelog: string, from: string, to: string): string[] {
  const out: string[] = [];
  let take = false;
  for (const line of changelog.split(/\r?\n/)) {
    const h = /^## (\S+)/.exec(line);
    if (h) take = newer(h[1] ?? '0', from) && !newer(h[1] ?? '0', to);
    else if (take && line.startsWith('- ')) out.push(line.slice(2));
  }
  return out;
}

/**
 * `reins update` (design §5, two paths): the deterministic part — upstream harness files, managed blocks,
 * generated vendor files and the version pin — is re-applied from the package; project-owned files stay.
 * When the changelog says a project section needs changing, it points to the /reins-update skill.
 */
export async function runUpdate(o: UpdateOptions): Promise<UpdateResult> {
  if (o.prompter && !o.dryRun) {
    const plan = await runUpdate({ ...o, prompter: undefined, dryRun: true });
    if (plan.refused) return plan;
    const a = plan.install?.applied;
    const nothing =
      !plan.bindingsMoved && (!a || a.created.length + a.changed.length + a.removed.length === 0);
    if (nothing) return plan;
    o.show?.(plan);
    const ok = await o.prompter.confirm({ message: 'Apply this update?', initial: true });
    if (ok === BACK || ok === EXIT || !ok) return { ...plan, declined: true };
    return runUpdate({ ...o, prompter: undefined });
  }
  return updateNow(o);
}

async function updateNow(o: UpdateOptions): Promise<UpdateResult> {
  const root = repoRoot(o.cwd ?? process.cwd());
  const res: UpdateResult = { root, changes: [], needsSkill: false, overrides: [] };
  const pinPath = join(root, '.agents/harness/install.yaml');
  if (!existsSync(pinPath))
    return {
      ...res,
      refused: 'reins is not installed here — use `reins install` or `reins migrate`',
    };
  const pin = parse(readFileSync(pinPath, 'utf8')) as {
    tier: Tier;
    version: string;
    cli?: string;
    mode: 'manual' | 'auto';
  };
  const up = packageHarness();
  res.from = pin.version;
  res.to = harnessVersion(up);
  res.cliFrom = pin.cli ? String(pin.cli) : 'none';
  res.cliTo = packageVersion();
  const cl = join(up, 'CHANGELOG.md');
  if (existsSync(cl) && newer(res.to, res.from)) {
    res.changes = changesBetween(readFileSync(cl, 'utf8'), res.from, res.to);
    res.needsSkill = res.changes.some((c) => c.includes('[skill]'));
  }
  const agents = join(root, 'AGENTS.md');
  if (existsSync(agents)) res.overrides = [...overrides(readFileSync(agents, 'utf8'))];
  const moved = migrateDetected(root, o.dryRun);
  if (moved.length > 0) res.bindingsMoved = moved;
  res.install = await runInstall({
    tier: pin.tier,
    mode: pin.mode,
    asker: defaultsAsker,
    cwd: root,
    dryRun: o.dryRun,
    now: o.now,
    detectVendors: o.detectVendors,
    recordAs: 'update',
    retire: true,
  });
  return res;
}

/** The report `reins update` prints; with `dry` it is the plan shown before the confirmation. */
export function formatUpdate(r: UpdateResult, dry: boolean): string {
  const out: string[] = [];
  const a = r.install?.applied;
  out.push(
    `reins update — cli ${r.cliFrom === 'none' ? 'none' : `v${r.cliFrom}`} → v${r.cliTo}, harness v${r.from} → v${r.to}${dry ? ' (dry run)' : ''}`,
  );
  for (const c of r.changes) out.push(`  · ${c}`);
  if (r.bindingsMoved)
    out.push(
      `bindings: ${dry ? 'would move' : 'moved'} detected vendors (${r.bindingsMoved.join(', ')}) to .loctx/bindings.local.yaml`,
    );
  if (a && a.created.length + a.changed.length + a.removed.length === 0)
    out.push('already up to date');
  else if (a) {
    out.push(
      `${dry ? 'would write' : 'wrote'}: ${a.created.length} new, ${a.changed.length} changed${a.removed.length ? `, ${a.removed.length} removed` : ''}`,
    );
    for (const p of a.created) out.push(`  + ${p}`);
    for (const p of a.changed) out.push(`  ~ ${p}`);
    for (const p of a.removed) out.push(`  - ${p} (no longer installed by this tier)`);
  }
  for (const n of r.overrides)
    out.push(
      `• block "${n}" is overridden by the project — compare it with the new upstream block`,
    );
  for (const n of r.install?.notes.filter((x) => x.startsWith('left alone')) ?? [])
    out.push(`• ${n}`);
  if (r.needsSkill)
    out.push('• this update needs project sections changed: run /reins-update in your agent');
  if (r.install?.history) out.push(`recorded: ${r.install.history}`);
  return `${out.join('\n')}\n`;
}
