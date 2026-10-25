import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSkillFile } from '../src/lib/skills.js';

function skill(dir: string, name: string, fm: string, body = '# x\n'): string {
  const d = join(dir, name);
  mkdirSync(d, { recursive: true });
  const p = join(d, 'SKILL.md');
  writeFileSync(p, `---\n${fm}\n---\n${body}`);
  return p;
}

describe('SKILL.md format layer (Agent Skills spec)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'reins-'));
  it('accepts a conforming skill', () => {
    const p = skill(
      tmp,
      'reins-loop',
      'name: reins-loop\ndescription: Runs one ticket through the loop. Use when a ticket is ready.',
    );
    expect(validateSkillFile(p)).toEqual([]);
  });
  it('rejects name/directory mismatch, bad names, reserved words, empty description', () => {
    const p = skill(tmp, 'alpha', 'name: Alpha_One\ndescription: ""');
    const msgs = validateSkillFile(p)
      .map((i) => i.message)
      .join(' | ');
    expect(msgs).toMatch(/lowercase/);
    expect(msgs).toMatch(/description/);
    const q = skill(tmp, 'claude-helper', 'name: claude-helper\ndescription: nope');
    expect(
      validateSkillFile(q)
        .map((i) => i.message)
        .join(),
    ).toMatch(/reserved word "claude"/);
  });
  it('rejects a file without frontmatter', () => {
    const d = join(tmp, 'bare');
    mkdirSync(d);
    const p = join(d, 'SKILL.md');
    writeFileSync(p, '# no frontmatter\n');
    expect(validateSkillFile(p)[0]?.message).toMatch(/frontmatter/);
  });
});
