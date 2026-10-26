import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const read = (p: string): string => readFileSync(join(root, p), 'utf8');

describe('public roadmap (008 C-6)', () => {
  it('exists in both editions and links across', () => {
    expect(existsSync(join(root, 'docs/ROADMAP.md'))).toBe(true);
    expect(existsSync(join(root, 'docs/ROADMAP.ko.md'))).toBe(true);
    expect(read('docs/ROADMAP.md')).toContain('ROADMAP.ko.md');
    expect(read('docs/ROADMAP.ko.md')).toContain('ROADMAP.md');
  });
  it('is pointed to by both READMEs', () => {
    expect(read('README.md')).toContain('docs/ROADMAP.md');
    expect(read('docs/README.ko.md')).toContain('ROADMAP.ko.md');
  });
});

describe('role stage-skill lines match the design table (008 C-5)', () => {
  const roles = readdirSync(join(root, 'harness/roles'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
  const expected = new Map<string, Set<string>>(roles.map((r) => [r, new Set<string>()]));
  const section = read('docs/design.md').split('### Stage skills')[1]?.split('\n## ')[0] ?? '';
  for (const row of section.split('\n')) {
    const cells = row.split('|').map((c) => c.trim());
    const skill = /^`(reins-[a-z]+)`$/.exec(cells[1] ?? '')?.[1];
    if (!skill || !cells[2]) continue;
    for (const role of cells[2].split(/[^a-z-]+/)) expected.get(role)?.add(skill);
  }
  it('the table yields skills for the roles it names', () => {
    expect(expected.get('implementer')).toEqual(new Set(['reins-implement']));
    expect(expected.get('pm')?.size).toBe(4);
  });
  for (const role of roles) {
    it(`${role} names its stage skills`, () => {
      const line = /^Stage skills: (.*)$/m.exec(read(`harness/roles/${role}.md`))?.[1] ?? '';
      const named = new Set([...line.matchAll(/`(reins-[a-z]+)`/g)].map((m) => m[1]));
      expect(named).toEqual(expected.get(role));
      if (named.size === 0) expect(line).toMatch(/^none/);
    });
  }
});

describe('skills pin the CLI version (008)', () => {
  const dirs = readdirSync(join(root, 'skills')).filter((d) => d !== 'reins-setup');
  for (const d of dirs) {
    it(`${d} has no unpinned npx invocation`, () => {
      const t = read(`skills/${d}/SKILL.md`);
      expect(t).toContain('npx @bluenyang/reins@<v>');
      expect(t).toContain('.agents/harness/install.yaml');
      expect(t.match(/npx @bluenyang\/reins(?!@)/g) ?? []).toEqual([]);
    });
  }
});
