import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { driftConvention, driftMatch } from '../src/commands/check.js';
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
    expect(readFileSync(join(d, '.loctx/ticket/1.3.0_2_export.md'), 'utf8')).toMatch(
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
