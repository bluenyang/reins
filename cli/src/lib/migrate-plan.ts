import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { listFiles } from './fsx.js';
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

/** A work file is open unless its frontmatter says done. */
function isOpen(abs: string): boolean {
  const { data } = splitFrontmatter(readFileSync(abs, 'utf8'));
  return !data || String(data['status'] ?? 'todo') !== 'done';
}

export function planMigration(root: string): MigratePlan {
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
        for (const f of files)
          if (f.endsWith('.md') && isOpen(join(root, f)))
            moves.push({
              from: f,
              to: `.loctx/ticket/${sub(f)}`,
              action: 'ticket',
              why: 'open work item → ticket',
            });
          else
            moves.push({
              from: f,
              to: `.loctx/history/work/${sub(f)}`,
              action: 'move',
              why: 'closed work item',
            });
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
  return { moves, report };
}

/** work → ticket frontmatter (design §7): `release: <ver>-rc.N` becomes planned; the rest carries over. */
export function convertWorkToTicket(text: string, fileName: string): string {
  const { data, body } = splitFrontmatter(text);
  const fm = data ?? {};
  const rel = String(fm['release'] ?? '');
  const ticket: Record<string, unknown> = {
    id: String(fm['id'] ?? basename(fileName, '.md')),
    intent: '000',
    plan_step: Number(fm['id'] ?? 1) || 1,
    title: String(fm['title'] ?? basename(fileName, '.md')),
    status: ['todo', 'doing', 'blocked', 'done'].includes(String(fm['status']))
      ? String(fm['status'])
      : 'todo',
    depends: Array.isArray(fm['depends']) ? fm['depends'] : [],
    release:
      /rc\.(\d+)/.exec(rel) && Number(/rc\.(\d+)/.exec(rel)?.[1]) > 1 ? 'stabilization' : 'planned',
    role: 'implementer',
    asks: [],
    ...(fm['branch'] ? { branch: fm['branch'] } : {}),
    migrated_from: fileName,
  };
  const yaml = Object.entries(ticket)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');
  return `---\n${yaml}\n---\n${body}`;
}
