import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertWorkToTicket, planMigration } from '../src/lib/migrate-plan.js';

function tree(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-mig-'));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(d, p)), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}

describe('migrate plan (design §7)', () => {
  it('maps a 4th-generation .ai/ onto .loctx and .agents', () => {
    const d = tree({
      '.ai/README.md': '# ws',
      '.ai/ROADMAP.local.md': '# r',
      '.ai/ROADMAP.pub.md': '# pub',
      '.ai/history/2026-10-01-0900_x.md': 'decisions: a',
      '.ai/work/1.2.0_3_fix.md': '---\nid: 3\nstatus: doing\nrelease: 1.2.0-rc.2\n---\n## 목적\n',
      '.ai/work/1.1.0_1_old.md': '---\nstatus: done\n---\n',
      '.ai/test/2026-10-02_1.2.0.md': '| pass |',
      '.ai/test/compose-test.env': 'X=1',
      '.ai/verify/check.mjs': '',
      '.ai/conversation/2026-09-01-sync.md': '',
      '.claude/memory/2026-10-14_deploy.md': '---\ntopics: [deploy]\n---\n',
      '.claude/commands/work.md': '',
    });
    const p = planMigration(d);
    const to = Object.fromEntries(p.moves.map((m) => [m.from, `${m.action}:${m.to}`]));
    expect(to).toMatchObject({
      '.ai/README.md': 'move:.loctx/context/ai-README.md',
      '.ai/ROADMAP.local.md': 'move:.loctx/ROADMAP.local.md',
      '.ai/ROADMAP.pub.md': 'move:docs/ROADMAP.md',
      '.ai/history/2026-10-01-0900_x.md': 'move:.loctx/history/2026-10-01-0900_x.md',
      '.ai/work/1.2.0_3_fix.md': 'ticket:.loctx/ticket/000-1_1-2-0-3-fix.md',
      '.ai/work/1.1.0_1_old.md': 'move:.loctx/history/work/1.1.0_1_old.md',
      '.ai/test/2026-10-02_1.2.0.md': 'move:.loctx/reports/2026-10-02_1.2.0.md',
      '.ai/test/compose-test.env': 'legacy:.loctx/_legacy/test/compose-test.env',
      '.ai/verify/check.mjs': 'legacy:.loctx/_legacy/verify/check.mjs',
      '.ai/conversation/2026-09-01-sync.md': 'move:.loctx/context/conversation/2026-09-01-sync.md',
      '.claude/memory/2026-10-14_deploy.md': 'move:.agents/knowledge/2026-10-14_deploy.md',
      '.claude/commands/work.md': 'legacy:.loctx/_legacy/.claude/commands/work.md',
    });
    expect(p.report.join('\n')).toMatch(/compose-test\.env/);
    expect(new Set(p.moves.map((m) => m.to)).size).toBe(p.moves.length);
  });

  it('turns a work file into a ticket: rc.2+ is stabilization, the body is kept', () => {
    const t = convertWorkToTicket(
      '---\nid: 3\ntitle: fix it\nstatus: doing\nrelease: 1.2.0-rc.2\n---\n## 목적\nx\n',
      '1.2.0_3_fix.md',
      7,
    );
    expect(t).toMatch(/release: "stabilization"/);
    expect(t).toMatch(/status: "doing"/);
    expect(t).toMatch(/id: "000-7"/);
    expect(t).toMatch(/## 목적\nx/);
    expect(convertWorkToTicket('---\nrelease: 1.2.0-rc.1\n---\n', 'a.md', 1)).toMatch(
      /release: "planned"/,
    );
  });

  it('does nothing without a .ai/ workspace', () => {
    expect(planMigration(tree({ 'README.md': '' }))).toEqual({ moves: [], report: [] });
  });
});
