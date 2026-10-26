import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { driftConvention, driftMatch } from '../src/commands/check.js';
import { loadSchemas } from '../src/lib/schema.js';
import { validateFile } from '../src/lib/schema.js';
import { packageHarness } from '../src/lib/upstream.js';
import { collectStatus } from '../src/commands/status.js';
import { ticketStart } from '../src/commands/stages.js';
import { readdirSync } from 'node:fs';
import { runMigrate } from '../src/commands/migrate.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { generation } from '../src/lib/detect.js';

const claudeOnly = () => [
  { name: 'claude' as const, cli: 'claude', detected: true },
  { name: 'openai' as const, cli: 'codex', detected: false },
  { name: 'google' as const, cli: 'agy', detected: false },
  { name: 'cursor' as const, cli: 'cursor-agent', detected: false },
];

function repo(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-migrate-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(d, p)), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}

const GEN4 = {
  'AGENTS.md':
    '# AGENTS.md\n\n## Project\nmine\n\n## Workflow\n- old loop rules\n\n## Language\nKorean notes\n',
  'package.json': JSON.stringify({ scripts: { check: 'oxlint .', test: 'vitest run' } }),
  '.ai/README.md': '# old ws',
  '.ai/ROADMAP.local.md': '# real roadmap\n- 1.3.0 offline export\n',
  '.ai/history/2026-10-01-0900_x.md': 'decisions: a\n',
  '.ai/work/1.3.0_2_export.md':
    '---\nid: 2\ntitle: export\nstatus: doing\nrelease: 1.3.0-rc.1\n---\n## 목적\nx\n',
  '.ai/test/compose-test.env': 'X=1',
  ...Object.fromEntries(
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'work-cicd-to'].map((s) => [
      `.claude/skills/${s}/SKILL.md`,
      '',
    ]),
  ),
};

describe('reins migrate (S1)', () => {
  it('moves a 4th-generation workspace onto the reins layout, idempotently', async () => {
    const d = repo(GEN4);
    expect(generation(d)).toBe('gen4');
    const opts = {
      tier: 'graph' as const,
      mode: 'auto' as const,
      asker: defaultsAsker,
      cwd: d,
      detectVendors: claudeOnly,
      now: new Date(2026, 9, 25, 13, 0),
    };
    const r = await runMigrate(opts);
    expect(r.refused).toBeUndefined();
    expect(existsSync(join(d, '.ai'))).toBe(false);
    expect(readFileSync(join(d, '.loctx/ROADMAP.local.md'), 'utf8')).toContain('offline export'); // replaced the install stub
    expect(existsSync(join(d, '.loctx/history/2026-10-01-0900_x.md'))).toBe(true);
    expect(readFileSync(join(d, '.loctx/ticket/000-1_1-3-0-2-export.md'), 'utf8')).toMatch(
      /release: "planned"/,
    );
    expect(existsSync(join(d, '.loctx/_legacy/test/compose-test.env'))).toBe(true);
    const agents = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('## Project\nmine');
    expect(agents).toContain('reins:begin workflow');
    expect(agents).not.toContain('old loop rules');
    expect(readFileSync(join(d, '.loctx/context/agents-md.before.md'), 'utf8')).toContain(
      'old loop rules',
    );
    expect(r.history).toBe('.loctx/history/2026-10-25-1300_migrate-graph.md');
    expect(generation(d)).toBe('reins');
    expect(driftConvention(d)).toEqual([]);
    expect(driftMatch(d)).toEqual([]);
    const again = await runMigrate(opts);
    expect(again.moves).toEqual([]);
    expect(again.agents.swapped).toEqual([]);
    expect(again.history).toBeUndefined();
  });

  it('dry run touches nothing', async () => {
    const d = repo(GEN4);
    const r = await runMigrate({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: claudeOnly,
      dryRun: true,
    });
    expect(r.moves.length).toBe(5);
    expect(r.moves.every((m) => m.result === 'planned')).toBe(true);
    expect(existsSync(join(d, '.ai/README.md'))).toBe(true);
    expect(existsSync(join(d, '.agents'))).toBe(false);
  });

  it('refuses where there is nothing to migrate', async () => {
    const d = repo({ 'README.md': '' });
    expect(
      (await runMigrate({ tier: 'graph', mode: 'auto', asker: defaultsAsker, cwd: d })).refused,
    ).toMatch(/install/);
  });
});

const work = (id: number, version: string, status: string, depends: number[] = []) =>
  `---\nversion: ${version}\nid: ${id}\nrelease: ${version}-rc.1\ntitle: item ${version}#${id}\narea: main\ndepends: [${depends.join(', ')}]\nstatus: ${status}\n---\n## 목적\nx\n`;

// the croffle shape: flat files named <version>_<id>.md, ids 1.. repeated for each version
const CROFFLE = {
  'package.json': JSON.stringify({ version: '1.3.0', scripts: { test: 'vitest run' } }),
  '.ai/work/1.3.0_1.md': work(1, '1.3.0', 'todo'),
  '.ai/work/1.3.0_2.md': work(2, '1.3.0', 'done'),
  '.ai/work/1.3.0_3.md': work(3, '1.3.0', 'todo', [1, 2, 9]),
  '.ai/work/1.3.0_10.md': work(10, '1.3.0', 'todo', [3]),
  '.ai/work/1.3.1_1.md': work(1, '1.3.1', 'todo'),
  '.ai/work/1.3.1_2.md': work(2, '1.3.1', 'todo', [1]),
  '.ai/work/1.3.1_3.md': work(3, '1.3.1', 'done'),
  '.ai/work/1.3.2_1.md': work(1, '1.3.2', 'todo'),
  '.ai/work/1.3.2_2.md': work(2, '1.3.2', 'doing'),
  '.ai/work/1.3.2_3.md': work(3, '1.3.2', 'todo', [2]),
  '.ai/work/sub/a.md': work(1, '1.3.2', 'todo'),
  '.ai/work/sub/b.md': work(1, '1.3.2', 'todo', [1]), // two open items carry id 1 here
  '.ai/test/.env': 'X=1',
  '.ai/verify/run.sh': 'echo hi',
};

describe('reins migrate — ticket ids, intent 000, legacy (012-3)', () => {
  const opts = (d: string, legacy?: 'local' | 'committed') => ({
    tier: 'graph' as const,
    mode: 'auto' as const,
    asker: defaultsAsker,
    cwd: d,
    detectVendors: claudeOnly,
    now: new Date(2026, 9, 27, 9, 0),
    legacy,
  });
  const tickets = (d: string) => readdirSync(join(d, '.loctx/ticket')).toSorted();
  const read = (d: string, p: string) => readFileSync(join(d, p), 'utf8');

  it('numbers open work once, remaps depends inside a version, asks for the rest', async () => {
    const d = repo(CROFFLE);
    await runMigrate(opts(d));
    const names = tickets(d);
    expect(names).toHaveLength(10); // 13 files, 3 done
    expect(new Set(names.map((n) => n.split('_')[0]))).toEqual(
      new Set(Array.from({ length: 10 }, (_, i) => `000-${i + 1}`)),
    );
    const v = loadSchemas(packageHarness()).get('ticket');
    for (const n of names)
      expect(validateFile(v!, n, false, read(d, `.loctx/ticket/${n}`))).toEqual([]);
    const by = (from: string) =>
      read(
        d,
        `.loctx/ticket/${names.find((n) => read(d, `.loctx/ticket/${n}`).includes(`migrated_from: "${from}"`))}`,
      );
    // 1.3.0_3 depends on 1 (open), 2 (done) and 9 (nowhere): only 1 maps, 9 is asked
    const t3 = by('1.3.0_3.md');
    expect(t3).toMatch(/depends: \["000-1"\]/);
    expect(t3).toMatch(/asks: \["depends on 9/);
    expect(t3).toMatch(/migrated_id: "3"/);
    // 1.3.0_10 depends on 3 → the 1.3.0 one, not 1.3.1 or 1.3.2
    expect(by('1.3.0_10.md')).toMatch(/depends: \["000-2"\]/);
    // 1.3.1_2 depends on 1 of 1.3.1
    expect(by('1.3.1_2.md')).toMatch(/depends: \["000-\d+"\]/);
    expect(by('1.3.1_2.md')).not.toMatch(/depends: \["000-1"\]/);
    // sub/b depends on id 1 but two open items carry it there → dropped and asked
    const sb = by('sub/b.md');
    expect(sb).toMatch(/depends: \[\]/);
    expect(sb).toMatch(/asks: \["depends on 1/);
    expect(existsSync(join(d, '.loctx/history/work/1.3.0_2.md'))).toBe(true);
    expect(existsSync(join(d, '.ai'))).toBe(false);

    const again = await runMigrate(opts(d));
    expect(again.moves).toEqual([]);
    expect(tickets(d)).toEqual(names);
  });

  it('does not duplicate a ticket whose source file is still there', async () => {
    const d = repo({ ...CROFFLE });
    await runMigrate(opts(d));
    const before = tickets(d);
    mkdirSync(join(d, '.ai/work'), { recursive: true });
    writeFileSync(join(d, '.ai/work/1.3.0_1.md'), work(1, '1.3.0', 'todo')); // came back
    mkdirSync(join(d, '.ai/work'), { recursive: true });
    const r = await runMigrate(opts(d));
    expect(r.moves.find((m) => m.from.endsWith('1.3.0_1.md'))?.result).toBe('same');
    expect(tickets(d)).toEqual(before);
  });

  it('writes intent 000 as a draft; T1 says draft; status asks the user to approve', async () => {
    const d = repo(CROFFLE);
    await runMigrate(opts(d));
    const path = '.agents/intent/000_migrated/intent.md';
    const v = loadSchemas(packageHarness()).get('intent');
    expect(validateFile(v!, path, false, read(d, path))).toEqual([]);
    const text = read(d, path);
    expect(text).toMatch(/status: draft/);
    expect(text).toMatch(/version: "1.3.0"/);
    expect(text).toContain('000-1 — from .ai/work/1.3.0_1.md');
    expect(
      ticketStart(d, '000-1')
        .map((f) => f.message)
        .join('\n'),
    ).toMatch(/draft/);
    expect(collectStatus(d).intents.find((i) => i.id === '000')?.next).toBe(
      'user: approve the intent',
    );
    const second = await runMigrate(opts(d));
    expect(second.report.join()).not.toContain('000_migrated');
  });

  it('keeps an existing intent 000 and defaults the version to 0.0.0', async () => {
    const d = repo({ ...CROFFLE, 'package.json': '{}' });
    await runMigrate(opts(d));
    expect(read(d, '.agents/intent/000_migrated/intent.md')).toMatch(/version: "0.0.0"/);
  });

  it('--legacy committed: tool files to .agents/legacy/, secrets stay local and are reported', async () => {
    const d = repo(CROFFLE);
    const r = await runMigrate(opts(d, 'committed'));
    expect(existsSync(join(d, '.agents/legacy/verify/run.sh'))).toBe(true);
    expect(existsSync(join(d, '.loctx/_legacy/test/.env'))).toBe(true);
    expect(existsSync(join(d, '.agents/legacy/test/.env'))).toBe(false);
    const rep = r.report.join('\n');
    expect(rep).toMatch(/test\/\.env matches a secret pattern/);
    expect(rep).toMatch(/review before committing/);
  });

  it('remaps depends onto a ticket from an earlier run', async () => {
    const d = repo(CROFFLE);
    await runMigrate(opts(d));
    const first = tickets(d).find((n) =>
      read(d, `.loctx/ticket/${n}`).includes('migrated_from: "1.3.1_1.md"'),
    )!;
    const id = first.split('_')[0];
    mkdirSync(join(d, '.ai/work'), { recursive: true });
    writeFileSync(join(d, '.ai/work/1.3.1_4.md'), work(4, '1.3.1', 'todo', [1]));
    await runMigrate(opts(d));
    const added = tickets(d).find((n) =>
      read(d, `.loctx/ticket/${n}`).includes('migrated_from: "1.3.1_4.md"'),
    )!;
    const text = read(d, `.loctx/ticket/${added}`);
    expect(text).toContain(`depends: ["${id}"]`);
    expect(text).toMatch(/asks: \[\]/);
  });

  it('keeps non-Markdown files under .ai/work/ moving to history/work/', async () => {
    const d = repo({ ...CROFFLE, '.ai/work/notes/diagram.png': 'png', '.ai/work/data.json': '{}' });
    await runMigrate(opts(d));
    expect(existsSync(join(d, '.loctx/history/work/notes/diagram.png'))).toBe(true);
    expect(existsSync(join(d, '.loctx/history/work/data.json'))).toBe(true);
    expect(existsSync(join(d, '.ai'))).toBe(false);
  });

  it('--legacy local (default) keeps everything in .loctx/_legacy/', async () => {
    const d = repo(CROFFLE);
    await runMigrate(opts(d));
    expect(existsSync(join(d, '.loctx/_legacy/verify/run.sh'))).toBe(true);
    expect(existsSync(join(d, '.agents/legacy'))).toBe(false);
  });
});
