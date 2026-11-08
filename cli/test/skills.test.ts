import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const STAGES = [
  'onboard',
  'roadmap',
  'intent',
  'spec',
  'implement',
  'review',
  'test',
  'merge',
  'audit',
  'release',
  'retro',
];

describe('stage skills (019 S-9, design §3-1)', () => {
  const read = (n: string) => readFileSync(join(process.cwd(), 'skills', n, 'SKILL.md'), 'utf8');
  it('ships the eleven skills and nothing else but the plugin setup', () => {
    expect(
      readdirSync(join(process.cwd(), 'skills'))
        .filter((d) => d !== 'reins-setup')
        .toSorted(),
    ).toEqual([...STAGES].toSorted());
  });
  it.each(STAGES)('%s conforms, has the six sections and never runs reins', (n) => {
    expect(validateSkillFile(join(process.cwd(), 'skills', n, 'SKILL.md'))).toEqual([]);
    const t = read(n);
    for (const h of [
      '## 1. When',
      '## 2. Procedure',
      '## 3. Delegation',
      '## 4. Files and lifetime',
      '## 5. Next',
      '## 6. Stop and ask',
    ])
      expect(t, h).toContain(h);
    expect(t).not.toMatch(
      /npx @bluenyang\/reins|node cli\/dist\/reins|`reins (check|gate|new|status|metrics|retro|knowledge|unit|approve|dispatch)/,
    );
  });
  it('the next skills follow the flow', () => {
    const next = (n: string) => /## 5\. Next\n`([a-z]+)`/.exec(read(n))?.[1];
    const chain = ['roadmap', 'intent', 'spec', 'implement', 'review'];
    for (let i = 0; i < chain.length - 1; i++) expect(next(chain[i]!)).toBe(chain[i + 1]);
    expect(next('test')).toBe('merge');
    expect(next('merge')).toBe('audit');
    expect(next('audit')).toBe('release');
    expect(next('release')).toBe('retro');
  });
});
