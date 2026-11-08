import { existsSync, readFileSync } from 'node:fs';
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
