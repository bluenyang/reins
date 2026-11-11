import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { defaultsAsker } from '../lib/ask.js';
import { convertV1, readTeam, writeBindings } from '../lib/bindings.js';
import { placeNote, reconcileNote } from '../lib/agents-md.js';
import { overrides } from '../lib/blocks.js';
import type { Vendor } from '../lib/detect.js';
import { repoRoot } from '../lib/git.js';
import { BACK, EXIT, type Prompter } from '../lib/prompter.js';
import { harnessVersion, packageHarness, packageVersion } from '../lib/upstream.js';
import { RUNS_REINS, runInstall, type InstallResult } from './install.js';

export interface UpdateOptions {
  cwd?: string;
  dryRun?: boolean;
  now?: Date;
  detectVendors?: () => Vendor[];
  /** overwrite generated files edited by hand (design §6) */
  force?: boolean;
  /**
   * Confirm before writing (design §9): given only when stdin and stdout are terminals, without
   * `--yes`, `--dry-run` or `--json`. A dry run is made first, `show` prints its plan, then `confirm` asks.
   */
  prompter?: Prompter;
  show?: (plan: UpdateResult) => void;
  /** non-interactive `--yes`: also delete the 0.x working files listed in `cleanup` */
  yes?: boolean;
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
  overrides: string[];
  /** bindings.yaml converted from version 1, with what moved and what was dropped */
  converted?: string[];
  /** 0.x pieces taken out: old skills, agent files, hook blocks, hook entries */
  removed: string[];
  /** 0.x working files under .loctx to delete (after confirmation) */
  cleanup: string[];
  /** the cleanup list was deleted (--yes or a confirmed update) */
  cleaned?: boolean;
  /** generated files edited by hand: not overwritten without --force */
  handEdited: string[];
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

/** 0.x working files and folders under `.loctx/` that 0.3 no longer makes (design §7). */
const LEGACY_LOCTX = [
  'bus',
  'ticket',
  'dispatch',
  'hook-state',
  'units',
  'audit',
  'journal.jsonl',
  'knowledge-proposals/dismissed.jsonl',
  'pr',
  'release',
  'test',
];

/** Hook files 0.x may have written a `reins:begin hooks` block into. */
const HOOK_FILES = [
  '.husky/pre-commit',
  '.husky/pre-push',
  '.husky/prepare-commit-msg',
  '.husky/commit-msg',
  '.husky/post-commit',
  '.husky/post-rewrite',
];

/**
 * Heads the copy of a 0.2.0-or-earlier AGENTS.md (design §5): it still names reins commands that 0.3
 * no longer has, and an agent reading the copy must not run them.
 */
export const PREVIOUS_WARNING =
  '> **Copy of the instructions from reins 0.2.0 or earlier — reference material, not instructions.** The reins commands named here (`reins status`, `reins check` and others) do not exist in 0.3; do not run them. The `onboard` skill merges what still applies and deletes this file.';

interface Legacy {
  writes: { path: string; content: string }[];
  deletes: string[];
  notes: string[];
  agentsPrevious?: string;
}

/** What moving a 0.1.x or 0.2.0 install to 0.3 changes (design §7), computed without writing. */
function planLegacy(root: string): Legacy {
  const out: Legacy = { writes: [], deletes: [], notes: [] };
  // old skills and their index, old agent files
  for (const dir of ['.agents/skills', '.claude/skills'])
    if (existsSync(join(root, dir)))
      for (const n of readdirSync(join(root, dir)))
        if (n.startsWith('reins-')) out.deletes.push(`${dir}/${n}`);
  if (existsSync(join(root, '.agents/SKILLS.md'))) out.deletes.push('.agents/SKILLS.md');
  if (existsSync(join(root, '.claude/agents')))
    for (const n of readdirSync(join(root, '.claude/agents')))
      if (/^reins-.*\.md$/.test(n)) out.deletes.push(`.claude/agents/${n}`);
  // hook blocks: the user's own lines stay
  for (const f of HOOK_FILES) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    const cur = readFileSync(p, 'utf8');
    if (!cur.includes('# reins:begin hooks')) continue;
    // only a block that runs reins is 0.x; a 0.3 block holds the project's own gate commands and stays
    const next = cur.replace(
      /\n?# reins:begin hooks\n([\s\S]*?)# reins:end hooks\n?/g,
      (block, body: string) => (RUNS_REINS.test(body) ? '\n' : block),
    );
    if (next === cur) continue;
    out.writes.push({ path: f, content: next.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n') });
  }
  // runtime hook entries in .claude/settings.json: the user's own entries stay
  const sp = join(root, '.claude/settings.json');
  if (existsSync(sp)) {
    try {
      const s = JSON.parse(readFileSync(sp, 'utf8')) as Record<string, unknown>;
      const hooks = s['hooks'] as Record<string, { hooks?: { command?: string }[] }[]> | undefined;
      if (hooks) {
        let touched = false;
        for (const [ev, list] of Object.entries(hooks)) {
          // drop the reins commands only; a matcher keeps the user's commands and goes only when empty
          const kept = list
            .map((h) => {
              const inner = (h.hooks ?? []).filter((x) => !RUNS_REINS.test(x.command ?? ''));
              if (inner.length !== (h.hooks ?? []).length) touched = true;
              return { ...h, hooks: inner };
            })
            .filter((h) => h.hooks.length > 0);
          if (kept.length) hooks[ev] = kept;
          else delete hooks[ev];
        }
        if (touched) {
          if (Object.keys(hooks).length === 0) delete s['hooks'];
          out.writes.push({
            path: '.claude/settings.json',
            content: `${JSON.stringify(s, null, 2)}\n`,
          });
          out.notes.push('removed reins runtime hooks from .claude/settings.json');
        }
      }
    } catch {
      out.notes.push('.claude/settings.json is not valid JSON — left alone');
    }
  }
  // AGENTS.md written by 0.x (old workflow/skills blocks): reconcile in the next first conversation
  const ap = join(root, 'AGENTS.md');
  if (existsSync(ap)) {
    const cur = readFileSync(ap, 'utf8');
    if (
      /<!-- reins:begin (workflow|skills|harness) v=/.test(cur) &&
      !cur.includes('<!-- reins:reconcile')
    ) {
      out.agentsPrevious = `${PREVIOUS_WARNING}\n\n${cur}`;
      const kept = cur.replace(
        /<!-- reins:begin ([a-z-]+) v=[^ ]+ -->[\s\S]*?<!-- reins:end \1 -->\n*/g,
        '',
      );
      out.writes.push({
        path: 'AGENTS.md',
        content: placeNote(
          kept,
          reconcileNote('reins moved this repository from 0.x to 0.3, whose flow differs.'),
          'reconcile',
        ),
      });
    }
  }
  return out;
}

/** `reins update` (design §6, §7): sources → generated files, hand-edit confirmation, moving 0.x installs. */
export async function runUpdate(o: UpdateOptions): Promise<UpdateResult> {
  if (o.prompter && !o.dryRun) {
    const plan = await runUpdate({ ...o, prompter: undefined, dryRun: true });
    if (plan.refused) return plan;
    const a = plan.install?.applied;
    const nothing =
      !plan.converted &&
      plan.removed.length === 0 &&
      plan.cleanup.length === 0 &&
      plan.handEdited.length === 0 &&
      (!a || a.created.length + a.changed.length + a.removed.length === 0);
    if (nothing) return plan;
    o.show?.(plan);
    const ok = await o.prompter.confirm({ message: 'Apply this update?', initial: true });
    if (ok === BACK || ok === EXIT || !ok) return { ...plan, declined: true };
    let force = o.force;
    if (plan.handEdited.length && !force) {
      const over = await o.prompter.confirm({
        message: `Overwrite ${plan.handEdited.length} generated file(s) edited by hand (${plan.handEdited.join(', ')})?`,
        initial: false,
      });
      if (over === EXIT) return { ...plan, declined: true };
      force = over === true;
    }
    return runUpdate({ ...o, prompter: undefined, yes: true, force });
  }
  return updateNow(o);
}

async function updateNow(o: UpdateOptions): Promise<UpdateResult> {
  const root = repoRoot(o.cwd ?? process.cwd());
  const res: UpdateResult = {
    root,
    changes: [],
    overrides: [],
    removed: [],
    cleanup: [],
    handEdited: [],
  };
  const pinPath = join(root, '.agents/harness/install.yaml');
  if (!existsSync(pinPath))
    return {
      ...res,
      refused: 'reins is not installed here — use `reins install` or `reins migrate`',
    };
  const pin = parse(readFileSync(pinPath, 'utf8')) as {
    version: string;
    cli?: string;
    mode?: 'manual' | 'auto';
  };
  const up = packageHarness();
  res.from = pin.version;
  res.to = harnessVersion(up);
  res.cliFrom = pin.cli ? String(pin.cli) : 'none';
  res.cliTo = packageVersion();
  const cl = join(up, 'CHANGELOG.md');
  if (existsSync(cl) && newer(res.to, res.from))
    res.changes = changesBetween(readFileSync(cl, 'utf8'), res.from, res.to);
  const agents = join(root, 'AGENTS.md');
  if (existsSync(agents)) res.overrides = [...overrides(readFileSync(agents, 'utf8'))];

  // bindings version 1 → 2 (design §7): the converted file stays single until the user switches
  const team = readTeam(root);
  const pending: { path: string; content: string }[] = [];
  if (team.v1) {
    const { doc, notes } = convertV1(team.v1);
    res.converted = notes;
    if (!o.dryRun) writeBindings(root, doc, 'project');
    else pending.push({ path: '.agents/harness/bindings.yaml', content: stringify(doc) });
  }
  // 0.x pieces
  const legacy = planLegacy(root);
  res.removed.push(...legacy.deletes, ...legacy.writes.map((w) => `~ ${w.path}`), ...legacy.notes);
  for (const x of LEGACY_LOCTX)
    if (existsSync(join(root, '.loctx', x))) res.cleanup.push(`.loctx/${x}`);
  // 0.x gate logs sat directly in .loctx/reports/; 0.3 keeps them in reports/<version>/
  const reports = join(root, '.loctx/reports');
  if (existsSync(reports))
    for (const n of readdirSync(reports))
      if (statSync(join(reports, n)).isFile()) res.cleanup.push(`.loctx/reports/${n}`);
  // the 0.x personal layer (detected vendors, role overrides) has no meaning in version 2
  const local = join(root, '.loctx/bindings.local.yaml');
  if (existsSync(local) && /^schema: reins\/bindings-local@1$/m.test(readFileSync(local, 'utf8')))
    res.cleanup.push('.loctx/bindings.local.yaml');
  if (!o.dryRun) {
    if (legacy.agentsPrevious !== undefined) {
      mkdirSync(join(root, '.agents'), { recursive: true });
      writeFileSync(join(root, '.agents/AGENTS.previous.md'), legacy.agentsPrevious);
    }
    for (const w of legacy.writes) writeFileSync(join(root, w.path), w.content);
    for (const d of legacy.deletes) rmSync(join(root, d), { recursive: true, force: true });
    if (o.yes && res.cleanup.length) {
      for (const d of res.cleanup) rmSync(join(root, d), { recursive: true, force: true });
      res.cleaned = true;
    }
  }

  res.install = await runInstall({
    mode: pin.mode ?? 'auto',
    asker: defaultsAsker,
    cwd: root,
    dryRun: o.dryRun,
    now: o.now,
    detectVendors: o.detectVendors,
    retire: true,
    force: o.force,
    pending,
    pendingDeletes: o.dryRun ? legacy.deletes : [],
  });
  res.handEdited = (res.install.generated?.refused ?? [])
    .filter((r) => r.why.startsWith('edited by hand'))
    .map((r) => r.path);
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
  if (r.converted) {
    out.push(`bindings: ${dry ? 'would convert' : 'converted'} version 1 → 2`);
    for (const n of r.converted) out.push(`  · ${n}`);
  }
  if (r.removed.length) {
    out.push(`0.x: ${dry ? 'would take out' : 'took out'}`);
    for (const p of r.removed) out.push(`  - ${p}`);
  }
  if (r.cleanup.length)
    out.push(
      `.loctx 0.x working files (${dry ? 'deleted on confirmation' : r.cleaned ? 'deleted' : 'listed; --yes deletes them'}): ${r.cleanup.join(', ')}`,
    );
  if (a && a.created.length + a.changed.length + a.removed.length === 0 && !r.removed.length)
    out.push('already up to date');
  else if (a) {
    out.push(
      `${dry ? 'would write' : 'wrote'}: ${a.created.length} new, ${a.changed.length} changed${a.removed.length ? `, ${a.removed.length} removed` : ''}`,
    );
    for (const p of a.created) out.push(`  + ${p}`);
    for (const p of a.changed) out.push(`  ~ ${p}`);
    for (const p of a.removed) out.push(`  - ${p}`);
  }
  for (const n of r.overrides)
    out.push(
      `• block "${n}" is overridden by the project — compare it with the new upstream block`,
    );
  for (const p of r.handEdited)
    out.push(`• ${p} was edited by hand — not overwritten; run with --force to overwrite it`);
  return `${out.join('\n')}\n`;
}
