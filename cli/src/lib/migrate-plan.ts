import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { listFiles } from './fsx.js';
import { isSecretPath } from './secrets.js';
import { splitFrontmatter } from './skills.js';

/**
 * What `reins migrate` does with an existing workspace (design §7). Pure: it reads, never writes.
 * - move:    same content, new place
 * - ticket:  an open work item, frontmatter converted to the ticket schema
 * - legacy:  kept under .loctx/_legacy/ and reported — tool files that may hold secrets, old procedures
 */
export type Action = 'move' | 'ticket' | 'legacy';

export interface Move {
  from: string; // repository-relative
  to: string;
  action: Action;
  why: string;
  /** ticket moves: the number this item gets (`000-<n>`) and where its `depends` can be remapped */
  n?: number;
  idMap?: Record<string, string>;
  /** ticket moves: a ticket with the same `migrated_from` already exists at `to` */
  existing?: boolean;
  /** ticket moves: dependencies that could not be remapped, recorded in `asks:` */
  dropped?: string[];
}

export interface PlanOptions {
  /** where legacy files go: `local` = .loctx/_legacy/ (default), `committed` = .agents/legacy/ */
  legacy?: 'local' | 'committed';
}

export interface MigratePlan {
  moves: Move[];
  report: string[]; // things a person should look at
}

const TOOL_EXT = new Set([
  '.cjs',
  '.mjs',
  '.js',
  '.ts',
  '.sh',
  '.ps1',
  '.py',
  '.pem',
  '.key',
  '.env',
  '.yml',
  '.yaml',
  '.json',
  '.toml',
  '.dockerfile',
]);
const isToolFile = (f: string) =>
  TOOL_EXT.has(extname(f).toLowerCase()) || /dockerfile|compose|\.env/i.test(basename(f));

function dirFiles(root: string, rel: string): string[] {
  return listFiles(join(root, rel)).map((f) => `${rel}/${f}`);
}

const natural = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
const slugOf = (fileName: string) =>
  basename(fileName, '.md')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '') || 'work';

interface WorkItem {
  path: string; // repository-relative
  group: string; // same subfolder and version
  id: string; // original id, '' when it has none
  deps: string[];
  open: boolean;
}

/** A work file is open unless its frontmatter says done. */
function workItem(root: string, path: string, dir: string): WorkItem {
  const { data } = splitFrontmatter(readFileSync(join(root, path), 'utf8'));
  const fm = data ?? {};
  const name = basename(path, '.md');
  const version = String(fm['version'] ?? (name.includes('_') ? name.split('_')[0] : ''));
  const sub = path.slice(dir.length + 1);
  return {
    path,
    group: `${sub.includes('/') ? sub.slice(0, sub.lastIndexOf('/')) : ''}|${version}`,
    id: fm['id'] == null ? '' : String(fm['id']),
    deps: Array.isArray(fm['depends']) ? fm['depends'].map(String) : [],
    open: !data || String(fm['status'] ?? 'todo') !== 'done',
  };
}

/** `migrated_from` → ticket path, and the highest `000-<n>` in use, among tickets already written. */
function existingTickets(root: string): { byFrom: Map<string, string>; max: number } {
  const byFrom = new Map<string, string>();
  let max = 0;
  const dir = '.loctx/ticket';
  for (const f of existsSync(join(root, dir)) ? readdirSync(join(root, dir)) : []) {
    const m = /^000-(\d+)_/.exec(f);
    if (!m) continue;
    max = Math.max(max, Number(m[1]));
    const { data } = splitFrontmatter(readFileSync(join(root, dir, f), 'utf8'));
    if (data?.['migrated_from']) byFrom.set(String(data['migrated_from']), `${dir}/${f}`);
  }
  return { byFrom, max };
}

/** Open work items become `000-1…000-N` in path order; `depends` is remapped only where one open item in the same folder and version carries the id. */
function planTickets(root: string, ai: string, files: string[], moves: Move[]): void {
  const items = files
    .filter((f) => f.endsWith('.md'))
    .toSorted(natural)
    .map((f) => workItem(root, f, `${ai}/work`));
  const prior = existingTickets(root);
  let next = prior.max;
  const numberOf = new Map<string, string>();
  const pending: { move: Move; item: WorkItem }[] = [];
  for (const it of items) {
    const sub = it.path.slice(`${ai}/work/`.length);
    if (!it.open) {
      moves.push({
        from: it.path,
        to: `.loctx/history/work/${sub}`,
        action: 'move',
        why: 'closed work item',
      });
      continue;
    }
    const was = prior.byFrom.get(sub);
    const m: Move = was
      ? { from: it.path, to: was, action: 'ticket', existing: true, why: 'already migrated' }
      : { from: it.path, to: '', action: 'ticket', why: 'open work item → ticket' };
    if (!was) {
      next += 1;
      m.n = next;
      m.to = `.loctx/ticket/000-${next}_${slugOf(it.path)}.md`;
      numberOf.set(it.path, `000-${next}`);
    }
    moves.push(m);
    pending.push({ move: m, item: it });
  }
  for (const { move, item } of pending) {
    if (move.existing) continue;
    const peers = items.filter((p) => p.group === item.group);
    const idMap: Record<string, string> = {};
    const dropped: string[] = [];
    for (const d of item.deps) {
      const same = peers.filter((p) => p.id === d);
      const target = same.length === 1 && same[0]?.open ? numberOf.get(same[0].path) : undefined;
      if (target) idMap[d] = target;
      else if (same.length === 1 && !same[0]?.open) continue; // finished — nothing to wait for
      else dropped.push(d);
    }
    move.idMap = idMap;
    move.dropped = dropped;
  }
}

export function planMigration(root: string, opts: PlanOptions = {}): MigratePlan {
  const moves: Move[] = [];
  const report: string[] = [];
  const ai = '.ai';
  if (!existsSync(join(root, ai))) return { moves, report };

  for (const entry of readdirSync(join(root, ai)).toSorted()) {
    const rel = `${ai}/${entry}`;
    const abs = join(root, rel);
    const isDir = statSync(abs).isDirectory();
    const files = isDir ? dirFiles(root, rel) : [rel];
    const sub = (f: string) => f.slice(rel.length + 1);

    switch (isDir ? entry : '') {
      case 'history':
        for (const f of files)
          moves.push({
            from: f,
            to: `.loctx/history/${sub(f)}`,
            action: 'move',
            why: 'know-how stays local, unchanged',
          });
        continue;
      case 'work':
        planTickets(root, ai, files, moves);
        continue;
      case 'release':
      case 'pr':
        for (const f of files)
          moves.push({ from: f, to: `.loctx/${entry}/${sub(f)}`, action: 'move', why: 'drafts' });
        continue;
      case 'test':
        for (const f of files)
          if (isToolFile(f)) {
            moves.push({
              from: f,
              to: `.loctx/_legacy/${f.slice(4)}`,
              action: 'legacy',
              why: 'tool file in a report folder — may hold secrets',
            });
            report.push(
              `test asset candidate (review, then move to test/ if it should be committed): ${f}`,
            );
          } else
            moves.push({
              from: f,
              to: `.loctx/reports/${sub(f)}`,
              action: 'move',
              why: 'test report',
            });
        continue;
      case 'verify':
      case 'benchmark':
      case 'artifacts':
        for (const f of files)
          moves.push({
            from: f,
            to: `.loctx/_legacy/${f.slice(4)}`,
            action: 'legacy',
            why: 'verification assets — review before committing',
          });
        report.push(
          `${rel}/ (${files.length} files) kept in .loctx/_legacy/ — promote what should be committed to test/`,
        );
        continue;
      case 'plan':
        for (const f of files)
          moves.push({
            from: f,
            to: `.loctx/context/plan/${sub(f)}`,
            action: 'move',
            why: 'plans before reins — kept as context',
          });
        if (files.length)
          report.push(
            'plans moved to .loctx/context/plan/ — open version plans become intents through the intent skill, with the user',
          );
        continue;
      default:
        break;
    }
    if (!isDir) {
      if (/^ROADMAP\.local\.md$/i.test(entry) || entry === 'ROADMAP.md')
        moves.push({
          from: rel,
          to: '.loctx/ROADMAP.local.md',
          action: 'move',
          why: 'raw roadmap',
        });
      else if (/^ROADMAP\.pub\.md$/i.test(entry)) {
        moves.push({
          from: rel,
          to: existsSync(join(root, 'docs/ROADMAP.md'))
            ? '.loctx/context/ROADMAP.pub.md'
            : 'docs/ROADMAP.md',
          action: 'move',
          why: 'public roadmap',
        });
      } else if (entry === 'README.md')
        moves.push({
          from: rel,
          to: '.loctx/context/ai-README.md',
          action: 'move',
          why: 'the old workspace readme',
        });
      else if (entry === '.gitignore')
        moves.push({
          from: rel,
          to: '.loctx/_legacy/ai.gitignore',
          action: 'legacy',
          why: 'replaced by .loctx/.gitignore',
        });
      else
        moves.push({
          from: rel,
          to: `.loctx/context/${entry}`,
          action: 'move',
          why: 'other workspace file',
        });
      continue;
    }
    // conversation/, interview/, survey/, assets/, docs/, … → personal context
    for (const f of files)
      moves.push({
        from: f,
        to: `.loctx/context/${f.slice(4)}`,
        action: 'move',
        why: 'personal context',
      });
  }

  // a second ROADMAP*.md would collide with the first
  const seen = new Set<string>();
  for (const m of moves) {
    if (seen.has(m.to)) {
      m.to = `.loctx/context/${basename(m.from)}`;
      m.why += ' (target taken)';
    }
    seen.add(m.to);
  }

  // .claude/memory (AI-GW) → knowledge; old procedures → legacy
  for (const f of dirFiles(root, '.claude/memory'))
    moves.push({
      from: f,
      to: `.agents/knowledge/${f.slice('.claude/memory/'.length)}`,
      action: 'move',
      why: 'shared memory → knowledge',
    });
  for (const d of [
    '.claude/commands',
    ...(existsSync(join(root, '.claude/skills'))
      ? readdirSync(join(root, '.claude/skills'))
          .filter((s) => s.endsWith('-workflow'))
          .map((s) => `.claude/skills/${s}`)
      : []),
  ]) {
    const fs = dirFiles(root, d);
    for (const f of fs)
      moves.push({
        from: f,
        to: `.loctx/_legacy/${f}`,
        action: 'legacy',
        why: 'replaced by reins skills',
      });
    if (fs.length)
      report.push(
        `${d}/ moved to .loctx/_legacy/ — keep any project-specific procedure as a skill in .agents/skills/`,
      );
  }
  if (opts.legacy === 'committed') {
    // committed legacy goes to .agents/legacy/ — except what looks like a secret, which stays local
    const kept: string[] = [];
    let moved = 0;
    for (const m of moves) {
      if (m.action !== 'legacy') continue;
      if (isSecretPath(m.from)) {
        kept.push(m.from);
        m.why += ' (secret pattern — kept local)';
      } else {
        m.to = m.to.replace('.loctx/_legacy/', '.agents/legacy/');
        moved += 1;
      }
    }
    for (const k of kept)
      report.push(`${k} matches a secret pattern — kept in .loctx/_legacy/, not .agents/legacy/`);
    if (moved)
      report.push(
        `.agents/legacy/ (${moved} files) — review before committing: a script or config there can still hold a secret the patterns do not catch`,
      );
  }
  return { moves, report };
}

/**
 * work → ticket frontmatter (design §7): `release: <ver>-rc.N` becomes planned; the rest carries over.
 * `n` and `idMap` come from planMigration: the number this item gets, and the new ids its `depends` can use.
 */
export function convertWorkToTicket(
  text: string,
  fileName: string,
  n: number,
  idMap: Record<string, string> = {},
  dropped: string[] = [],
): string {
  const { data, body } = splitFrontmatter(text);
  const fm = data ?? {};
  const rel = String(fm['release'] ?? '');
  const origId = fm['id'] == null ? '' : String(fm['id']);
  const depends = (Array.isArray(fm['depends']) ? fm['depends'].map(String) : [])
    .map((d) => idMap[d])
    .filter((d): d is string => d !== undefined);
  const ticket: Record<string, unknown> = {
    // intent 000 = not yet tied to an intent; the PL links it when the work is planned again
    id: `000-${n}`,
    intent: '000',
    plan_step: Number.parseInt(origId, 10) || 1,
    title: String(fm['title'] ?? basename(fileName, '.md')),
    status: ['todo', 'doing', 'blocked', 'done'].includes(String(fm['status']))
      ? String(fm['status'])
      : 'todo',
    depends,
    release:
      /rc\.(\d+)/.exec(rel) && Number(/rc\.(\d+)/.exec(rel)?.[1]) > 1 ? 'stabilization' : 'planned',
    role: 'implementer',
    asks: dropped.map(
      (d) =>
        `depends on ${d} (${fileName}) could not be matched to one migrated ticket — set it by hand`,
    ),
    ...(fm['branch'] ? { branch: fm['branch'] } : {}),
    migrated_from: fileName,
    ...(origId ? { migrated_id: origId } : {}),
  };
  const yaml = Object.entries(ticket)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');
  return `---\n${yaml}\n---\n${body}`;
}
