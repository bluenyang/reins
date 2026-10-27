import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MARKED_DOCS,
  applyMarkers,
  enforcementRows,
  expectedIds,
  readRules,
  renderTable,
} from '../src/lib/enforcement.js';
import { loadSchemas } from '../src/lib/schema.js';

const ROOT = join(import.meta.dirname, '..', '..');
const HARNESS = join(ROOT, 'harness');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const rules = readRules(readFileSync(join(HARNESS, 'policy', 'enforcement.yaml'), 'utf8'));

describe('enforcement.yaml covers every rule once (013 C-1)', () => {
  it('has exactly one line per policy id, role must_not item and budget scope', () => {
    const ids = rules.map((r) => r.id);
    expect(ids.toSorted()).toEqual(expectedIds(HARNESS).toSorted());
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('validates against its schema, and held and by come from the allowed lists', () => {
    const v = loadSchemas(HARNESS).get('enforcement');
    expect(v).toBeDefined();
    const doc = { schema: 'reins/policy/enforcement@1', rules };
    expect(v?.(doc)).toBe(true);
    for (const r of rules) {
      expect(['blocked', 'checked', 'advised']).toContain(r.held);
      expect(r.by.length).toBeGreaterThan(0);
    }
  });
  it('rejects an unknown held or by value', () => {
    const v = loadSchemas(HARNESS).get('enforcement');
    const bad = (r: object): boolean | undefined =>
      v?.({ schema: 'reins/policy/enforcement@1', rules: [r] }) as boolean | undefined;
    expect(bad({ id: 'C1', held: 'enforced', by: ['role'] })).toBe(false);
    expect(bad({ id: 'C1', held: 'advised', by: ['magic'] })).toBe(false);
    expect(bad({ id: 'C1', held: 'advised', by: ['role'] })).toBe(true);
  });
  it('gives a non-advised rule a mechanism other than the role', () => {
    for (const r of rules.filter((x) => x.held !== 'advised'))
      expect(
        r.by.some((b) => b !== 'role'),
        r.id,
      ).toBe(true);
  });
});

describe('enforcement.yaml agrees with docs/violations.md (013 C-2)', () => {
  const caughtBy = new Map<string, string>();
  for (const line of read('docs/violations.md').split(/\r?\n/)) {
    const c = line.split('|').map((x) => x.trim());
    const id = /^([A-G]\d+|P\d+) ?(?:\((?:red line|stop)\))?$/.exec(c[1] ?? '')?.[1];
    if (id && c[3]) caughtBy.set(id, c[3]);
  }
  it('parses the 34 rows', () => {
    expect(caughtBy.size).toBe(34);
  });
  it('advised where nothing but a role catches it, not advised where the verifier or a deny does', () => {
    const held = new Map(rules.map((r) => [r.id, r.held]));
    for (const [id, by] of caughtBy) {
      if (/^(none \(gap\)|role)/.test(by)) expect(held.get(id), id).toBe('advised');
      if (/^(settings deny|verifier)/.test(by)) expect(held.get(id), id).not.toBe('advised');
    }
  });
});

describe('the rendered tables equal the documents (013 C-3)', () => {
  const rows = enforcementRows(HARNESS);
  for (const d of MARKED_DOCS) {
    it(`${d.file} holds ${d.pairs} up-to-date marker pair(s)`, () => {
      const text = read(d.file);
      const out = applyMarkers(text, d.lang, rows);
      expect(out.pairs).toBe(d.pairs);
      expect(out.text.replaceAll('\r\n', '\n')).toBe(text.replaceAll('\r\n', '\n'));
    });
  }
  it('renders the Korean grade words and the English ones', () => {
    expect(renderTable(rows, 'ko', 'redlines')).toContain('| C2 | 차단 |');
    expect(renderTable(rows, 'en', 'redlines')).toContain('| C2 | blocked |');
    expect(renderTable(rows, 'en')).toContain('| code-review | 1 | 0 | 2 |');
  });
  it('no longer claims the verifier enforces the red lines', () => {
    for (const f of ['README.md', 'docs/README.ko.md', 'docs/design.md', 'docs/design.ko.md'])
      expect(read(f)).not.toMatch(/enforced by the verifier|검증기가 (?:강제|집행)/);
  });
});

describe('both roadmap editions link the table from 0.2 (013 C-4)', () => {
  it('has the link in the 0.2 section', () => {
    const en =
      read('docs/ROADMAP.md')
        .split(/^## 0\.2/m)[1]
        ?.split(/^## 0\.3/m)[0] ?? '';
    const ko =
      read('docs/ROADMAP.ko.md')
        .split(/^## 0\.2/m)[1]
        ?.split(/^## 0\.3/m)[0] ?? '';
    expect(en).toContain('README.md#enforced-versus-advised');
    expect(en).toContain('policy/enforcement.yaml');
    expect(ko).toContain('README.ko.md#강제와-권고');
    expect(ko).toContain('policy/enforcement.yaml');
  });
});
