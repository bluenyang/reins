import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { driftConvention } from '../src/commands/check.js';
import { redLines, stops } from '../src/lib/harness.js';
import { splitFrontmatter } from '../src/lib/skills.js';

const ROOT = join(import.meta.dirname, '..', '..');
const HARNESS = join(ROOT, 'harness');

describe('harness sources match the design (docs/design.md)', () => {
  it('has the twelve roles of §2, each with a non-empty must_not', () => {
    const roles = readdirSync(join(HARNESS, 'roles'))
      .map((f) => f.replace(/\.md$/, ''))
      .toSorted();
    expect(roles).toEqual([
      'advisor',
      'code-review',
      'deploy',
      'docs',
      'implementer',
      'lookup',
      'pl',
      'planner',
      'pm',
      'qa-design',
      'qa-run',
      'verify-tool',
    ]);
    for (const r of roles) {
      const { data } = splitFrontmatter(readFileSync(join(HARNESS, 'roles', `${r}.md`), 'utf8'));
      expect(data?.['role']).toBe(r);
      expect(
        Array.isArray(data?.['must_not']) && (data['must_not'] as unknown[]).length,
      ).toBeTruthy();
    }
  });

  it('has the common red lines C1–C10, with C4 carrying the secret patterns', () => {
    const rules = redLines(HARNESS);
    expect(rules.map((r) => r.id)).toEqual([
      'C1',
      'C2',
      'C3',
      'C4',
      'C5',
      'C6',
      'C7',
      'C8',
      'C9',
      'C10',
    ]);
    expect(rules.find((r) => r.id === 'C4')?.patterns).toContain('.env.*');
  });

  it('has the twenty-four stop conditions of §3, each tagged with kind and grade', () => {
    const s = stops(HARNESS);
    expect(s).toHaveLength(24);
    const groups = new Map<string, number>();
    for (const c of s) {
      expect(['intent', 'knowledge']).toContain(c.kind);
      expect(['HOLD', 'STOP', 'ESCALATE', 'WARN']).toContain(c.grade);
      groups.set(c.id[0] ?? '', (groups.get(c.id[0] ?? '') ?? 0) + 1);
    }
    expect(Object.fromEntries(groups)).toEqual({ A: 4, B: 5, P: 2, D: 5, E: 3, F: 3, G: 2 });
    // A, B, G are a person's call; C–F are learned away
    for (const c of s) expect(c.kind).toBe('ABG'.includes(c.id[0] ?? '') ? 'intent' : 'knowledge');
  });

  it('templates and knowledge seeds pass their own schemas (convention layer)', () => {
    // Isolated from the developer's local .loctx/: only committed sources are copied (S-4).
    const tmp = mkdtempSync(join(tmpdir(), 'reins-conv-'));
    try {
      for (const d of ['harness', '.agents/intent', '.agents/knowledge'])
        if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
      expect(driftConvention(tmp)).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
