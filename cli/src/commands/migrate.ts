import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { Asker } from '../lib/ask.js';
import { relPath } from '../lib/fsx.js';
import { generation, type Generation, type Vendor } from '../lib/detect.js';
import { repoRoot } from '../lib/git.js';
import { convertWorkToTicket, planMigration, type Move } from '../lib/migrate-plan.js';
import { splitFrontmatter } from '../lib/skills.js';
import { packageHarness } from '../lib/upstream.js';
import { ROADMAP_STUB, runInstall } from './install.js';
import { placeNote, reconcileNote } from '../lib/agents-md.js';

export interface MigrateOptions {
  mode: 'manual' | 'auto';
  dryRun?: boolean;
  /** where legacy files go: local = .loctx/_legacy/ (default), committed = .agents/legacy/ */
  legacy?: 'local' | 'committed';
  cwd?: string;
  asker: Asker;
  detectVendors?: () => Vendor[];
  now?: Date;
}

export interface MigrateResult {
  root: string;
  generation: Generation;
  refused?: string;
  moves: (Move & { result: 'moved' | 'converted' | 'kept-both' | 'same' | 'planned' })[];
  agents: { swapped: string[]; inserted: string[] };
  report: string[];
}

function removeEmptyDirs(dir: string): void {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
  for (const e of readdirSync(dir)) removeEmptyDirs(join(dir, e));
  if (readdirSync(dir).length === 0) rmdirSync(dir);
}

/** Intent 000 (draft) whose plan lists the migrated work — only when this run moved work and none exists. */
function writeMigratedIntent(root: string, moves: MigrateResult['moves']): string | null {
  const made = moves.filter((m) => m.result === 'converted');
  const dir = join(root, '.agents/intent');
  if (made.length === 0 || (existsSync(dir) && readdirSync(dir).some((e) => e.startsWith('000_'))))
    return null;
  let version = '0.0.0';
  try {
    const v = (
      JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version?: unknown }
    ).version;
    if (typeof v === 'string' && v) version = v;
  } catch {
    // no package.json — keep the default
  }
  const { body } = splitFrontmatter(
    readFileSync(join(packageHarness(), 'templates/intent.md'), 'utf8'),
  );
  const list = made
    .map(
      (m) =>
        `- ${m.to.slice('.loctx/context/migrated-work/'.length, m.to.indexOf('_'))} — from .ai/work/${m.from.slice('.ai/work/'.length)} (${m.to})`,
    )
    .join('\n');
  const text = body
    .replace(
      /## 문제\n—/,
      () =>
        '## 문제\nOpen work items that `reins migrate` moved out of `.ai/work/`. The PM plans them again: approve this intent, then write a spec whose work units cover them.',
    )
    .replace(/## 계획\n—/, () => `## 계획\n${list}`);
  const yaml = [
    'id: "000"',
    'slug: migrated',
    `version: ${JSON.stringify(version)}`,
    'status: draft',
    'origin: user',
    'approvals: []',
    'supersedes: null',
  ].join('\n');
  const out = join(dir, '000_migrated/intent.md');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `---\n${yaml}\n---\n${text}`);
  return '.agents/intent/000_migrated/intent.md written as a draft whose plan lists the migrated work — the user approves it before any of it starts';
}

/** `reins migrate` (design §7): install, move the old workspace, set AGENTS.md aside for the PM to reconcile. Idempotent. */
export async function runMigrate(o: MigrateOptions): Promise<MigrateResult> {
  const root = repoRoot(o.cwd ?? process.cwd());
  const gen = generation(root);
  const res: MigrateResult = {
    root,
    generation: gen,
    moves: [],
    agents: { swapped: [], inserted: [] },
    report: [],
  };
  if (gen === 'none')
    return { ...res, refused: 'no existing harness or workspace here — use `reins install`' };

  // the project's own AGENTS.md before reins touches it: the PM reconciles it in the next conversation
  const agentsPath = join(root, 'AGENTS.md');
  const original =
    existsSync(agentsPath) && gen !== 'reins' ? readFileSync(agentsPath, 'utf8') : undefined;

  // 1. make sure the target layout exists (install is idempotent)
  {
    const inst = await runInstall({
      mode: o.mode,
      asker: o.asker,
      cwd: root,
      detectVendors: o.detectVendors,
      now: o.now,
      overExisting: true,
      dryRun: o.dryRun, // plans only: gate proposals and memory drafts show up as notes
    });
    if (inst.refused) return { ...res, refused: inst.refused };
    res.report.push(
      ...inst.notes.filter(
        (n) => !n.startsWith('next:') && !n.includes('managed') && !n.includes('not placed'),
      ),
    );
  }

  // 2. move the old workspace
  const plan = planMigration(root, { legacy: o.legacy });
  res.report.push(...plan.report);
  for (const m of plan.moves) {
    const from = join(root, m.from);
    const to = join(root, m.to);
    if (o.dryRun) {
      res.moves.push({ ...m, result: 'planned' });
      continue;
    }
    mkdirSync(dirname(to), { recursive: true });
    const src = readFileSync(from);
    if (m.action === 'ticket' && m.existing) {
      unlinkSync(from); // converted by an earlier run
      res.moves.push({ ...m, result: 'same' });
    } else if (m.action === 'ticket') {
      writeFileSync(
        to,
        convertWorkToTicket(
          src.toString('utf8'),
          m.from.slice('.ai/work/'.length),
          m.n ?? 1,
          m.idMap,
          m.dropped,
          m.group,
        ),
      );
      unlinkSync(from);
      res.moves.push({ ...m, result: 'converted' });
    } else if (!existsSync(to) || readFileSync(to, 'utf8') === ROADMAP_STUB) {
      renameSync(from, to);
      res.moves.push({ ...m, result: 'moved' });
    } else if (Buffer.compare(readFileSync(to), src) === 0) {
      unlinkSync(from);
      res.moves.push({ ...m, result: 'same' });
    } else {
      const alt = to.replace(/(\.[^./]+)?$/, '.from-ai$1');
      renameSync(from, alt);
      res.moves.push({ ...m, to: relPath(root, alt), result: 'kept-both' });
      res.report.push(
        `${m.to} already existed — the old file is next to it as ${relPath(root, alt)}`,
      );
    }
  }
  if (!o.dryRun) removeEmptyDirs(join(root, '.ai'));
  if (!o.dryRun) {
    const made = writeMigratedIntent(root, res.moves);
    if (made) res.report.push(made);
  }

  // 3. AGENTS.md (design §5): the previous text is kept aside as reference; the PM merges what applies
  if (original !== undefined && original.trim() && !o.dryRun) {
    const prev = join(root, '.agents/AGENTS.previous.md');
    if (!existsSync(prev)) {
      mkdirSync(dirname(prev), { recursive: true });
      writeFileSync(prev, original);
      const now = readFileSync(agentsPath, 'utf8');
      const next = placeNote(
        now,
        reconcileNote('reins migrate replaced the harness this repository used.'),
        'reconcile',
      );
      if (next !== now) writeFileSync(agentsPath, next);
      res.agents.inserted.push('reconcile');
      res.report.push(
        'AGENTS.md: the previous text is in .agents/AGENTS.previous.md — the PM reconciles it in the next conversation',
      );
    }
  }
  return res;
}
