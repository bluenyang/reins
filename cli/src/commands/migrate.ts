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
import { applyBlocks, parseBlocks, swapSections } from '../lib/blocks.js';
import { generation, type Generation, type Vendor } from '../lib/detect.js';
import { repoRoot } from '../lib/git.js';
import { convertWorkToTicket, planMigration, type Move } from '../lib/migrate-plan.js';
import { splitFrontmatter } from '../lib/skills.js';
import { packageHarness } from '../lib/upstream.js';
import { ROADMAP_STUB, runInstall, type Tier } from './install.js';

export interface MigrateOptions {
  tier: Tier;
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
  history?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const stampOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;

function removeEmptyDirs(dir: string): void {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
  for (const e of readdirSync(dir)) removeEmptyDirs(join(dir, e));
  if (readdirSync(dir).length === 0) rmdirSync(dir);
}

/** Intent 000 (draft) that the migrated tickets point at — only when this run made tickets and none exists. */
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
        `- ${m.to.slice('.loctx/ticket/'.length, m.to.indexOf('_'))} — from .ai/work/${m.from.slice('.ai/work/'.length)}`,
    )
    .join('\n');
  const text = body.replace(
    /## 문제\n—/,
    () =>
      `## 문제\nOpen work items that \`reins migrate\` moved out of \`.ai/work/\`. They point at this intent until the PL plans them again:\n\n${list}`,
  );
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
  return '.agents/intent/000_migrated/intent.md written as a draft listing the migrated tickets — the user approves it before any of them starts';
}

/** `reins migrate <tier>` (design §7): install if needed, move the old workspace, swap AGENTS.md sections. Idempotent. */
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

  // 1. make sure the target layout exists (install is idempotent)
  if (!o.dryRun) {
    const inst = await runInstall({
      tier: o.tier,
      mode: o.mode,
      asker: o.asker,
      cwd: root,
      detectVendors: o.detectVendors,
      now: o.now,
      overExisting: true,
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
      res.moves.push({ ...m, to: alt.slice(root.length + 1), result: 'kept-both' });
      res.report.push(
        `${m.to} already existed — the old file is next to it as ${alt.slice(root.length + 1)}`,
      );
    }
  }
  if (!o.dryRun) removeEmptyDirs(join(root, '.ai'));
  if (!o.dryRun) {
    const made = writeMigratedIntent(root, res.moves);
    if (made) res.report.push(made);
  }

  // 3. AGENTS.md: sections reins owns become managed blocks; the originals are kept locally
  const agentsPath = join(root, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    const up = parseBlocks(
      readFileSync(join(packageHarness(), 'templates/agents-md-blocks.md'), 'utf8'),
    );
    const before = readFileSync(agentsPath, 'utf8');
    const swap = swapSections(before, up);
    const placed = applyBlocks(swap.text, up);
    res.agents = { swapped: swap.swapped, inserted: placed.inserted };
    if (placed.text !== before && !o.dryRun) {
      writeFileSync(agentsPath, placed.text);
      if (swap.removed) {
        const keep = join(root, '.loctx/context/agents-md.before.md');
        mkdirSync(dirname(keep), { recursive: true });
        const prev = existsSync(keep) ? `${readFileSync(keep, 'utf8')}\n\n` : '';
        writeFileSync(
          keep,
          `${prev}<!-- replaced by reins migrate, ${stampOf(o.now ?? new Date())} -->\n${swap.removed}\n`,
        );
        res.report.push(
          'AGENTS.md: the replaced sections are in .loctx/context/agents-md.before.md — move project-specific rules back outside the blocks',
        );
      }
    }
  }

  // 4. record, only when something happened
  const happened = res.moves.length > 0 || res.agents.swapped.length > 0;
  if (happened && !o.dryRun) {
    res.history = `.loctx/history/${stampOf(o.now ?? new Date())}_migrate-${o.tier}.md`;
    const count = (r: string) => res.moves.filter((m) => m.result === r).length;
    writeFileSync(
      join(root, res.history),
      [
        `decisions: migrate-${o.tier}`,
        'source: tool',
        '',
        `# reins migrate ${o.tier} — from ${gen}`,
        '',
        `- moved ${count('moved')} · converted to tickets ${count('converted')} · identical ${count('same')} · kept both ${count('kept-both')}`,
        `- AGENTS.md: swapped ${res.agents.swapped.join(', ') || 'none'}; inserted ${res.agents.inserted.join(', ') || 'none'}`,
        '',
        '## for a person to look at',
        ...res.report.map((r) => `- ${r}`),
        '',
        '## moves',
        ...res.moves.map((m) => `- ${m.from} → ${m.to} (${m.result})`),
        '',
      ].join('\n'),
    );
  }
  return res;
}
