import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSkillFile } from '../src/lib/skills.js';
import { tierSkills } from '../src/lib/upstream.js';

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

describe('metrics line in the loop skills (S-5)', () => {
  const line =
    'reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>';
  it.each([
    'skills/reins-loop/SKILL.md',
    'skills/reins-intent/SKILL.md',
    '.claude/skills/reins-loop/SKILL.md',
    '.claude/skills/reins-intent/SKILL.md',
  ])('%s has the one-line call', (p) => {
    expect(readFileSync(join(process.cwd(), p), 'utf8')).toContain(line);
  });
});

describe('stage skills (intent 008)', () => {
  const root = process.cwd();
  const stage: Record<string, string> = {
    'reins-roadmap': 'reins status',
    'reins-intent': 'reins check --drift',
    'reins-spec': 'reins check --drift',
    'reins-implement': 'reins check --stage ticket-start --ticket <id>',
    'reins-review': 'reins check --drift',
    'reins-test': 'reins status',
    'reins-release': 'reins check --stage rc-close --release <version>',
    'reins-retro': 'reins status',
  };
  it.each(Object.keys(stage))('%s conforms and starts with its check', (name) => {
    const p = join(root, 'skills', name, 'SKILL.md');
    expect(validateSkillFile(p)).toEqual([]);
    const text = readFileSync(p, 'utf8');
    const first = text.split('\n').find((l) => l.startsWith('1. '));
    expect(first).toContain('**Check first');
    expect(first).toContain(stage[name]!);
  });
  it('reins-intent has no spec procedure; reins-loop only names stages', () => {
    const intent = readFileSync(join(root, 'skills/reins-intent/SKILL.md'), 'utf8');
    expect(intent).not.toMatch(/summary_for_user|templates\/spec\.md/);
    const loop = readFileSync(join(root, 'skills/reins-loop/SKILL.md'), 'utf8');
    for (const n of Object.keys(stage)) expect(loop).toContain(n);
    expect(loop).not.toMatch(/templates\/|gate --ticket/);
  });
});

describe('tierSkills (intent 008)', () => {
  it('harness = setup only; loop and graph = all ten', () => {
    expect(tierSkills('harness')).toEqual(['reins-setup']);
    expect(tierSkills('loop')).toHaveLength(10);
    expect(tierSkills('graph')).toEqual(tierSkills('loop'));
  });
});
