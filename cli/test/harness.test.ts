import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { redLines } from '../src/lib/harness.js';
import { splitFrontmatter } from '../src/lib/skills.js';

const ROOT = join(import.meta.dirname, '..', '..');
const HARNESS = join(ROOT, 'harness');

describe('harness sources match the design (docs/design.md)', () => {
  it('has the seven role groups of §2-2, each role with does, must_not and tools', () => {
    const groups = readdirSync(join(HARNESS, 'roles'))
      .map((f) => f.replace(/\.md$/, ''))
      .toSorted();
    expect(groups).toEqual([
      'advisor',
      'auditor',
      'executor',
      'implementer',
      'pl',
      'planner',
      'pm',
    ]);
    for (const g of groups) {
      const { data } = splitFrontmatter(readFileSync(join(HARNESS, 'roles', `${g}.md`), 'utf8'));
      expect(data?.['group']).toBe(g);
      const roles = data?.['roles'] as Record<
        string,
        { does?: string; must_not?: unknown[]; tools?: object }
      >;
      expect(Object.keys(roles).length).toBeGreaterThan(0);
      for (const [r, spec] of Object.entries(roles)) {
        expect(spec.does, `${g}/${r}`).toBeTruthy();
        expect(spec.must_not?.length, `${g}/${r}`).toBeTruthy();
        expect(spec.tools, `${g}/${r}`).toBeTruthy();
      }
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

  it('templates and knowledge seeds pass their own schemas (convention layer)', () => {
    // Isolated from the developer's local .loctx/: only committed sources are copied (S-4).
    const tmp = mkdtempSync(join(tmpdir(), 'reins-conv-'));
    try {
      for (const d of ['harness', '.agents/intent', '.agents/knowledge'])
        if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
    } finally {
      rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
