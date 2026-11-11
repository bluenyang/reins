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
  it('commits at meaningful units: implement does it, the audit judges it (020 S-13)', () => {
    const mean =
      'a point you can revert or reset to without taking other working work or features with it';
    const harness = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
    for (const t of [
      read('implement'),
      read('audit'),
      harness('harness/roles/auditor.md'),
      harness('harness/roles/implementer.md'),
      harness('harness/templates/agents-md-blocks.md'),
      harness('docs/design.md'),
    ])
      expect(t).toContain(mean);
    expect(harness('docs/design.ko.md')).toContain(
      '되돌려도 다른 멀쩡한 작업·기능은 되돌아가지 않는',
    );
    // the commit-count rule is gone everywhere it was written
    for (const t of [
      ...STAGES.map(read),
      ...['auditor', 'implementer', 'planner'].map((g) => harness(`harness/roles/${g}.md`)),
      harness('harness/templates/agents-md-blocks.md'),
      harness('docs/design.md'),
      harness('docs/design.ko.md'),
    ]) {
      expect(t).not.toMatch(
        /one work unit, one commit|lands as one commit|작업 단위 하나 = 커밋 하나/i,
      );
      expect(t).not.toContain('a unit split without approval');
    }
    expect(read('implement')).not.toContain('- A change outside the work unit.');
    // spec 020's active wording (summary, order) follows S-13; S-5..S-7 are marked superseded
    const spec = harness('.agents/intent/020_stabilise-units-audit-local/spec.md');
    expect(spec).not.toContain('단위마다 커밋 하나');
    for (const s of ['S-5', 'S-6', 'S-7']) expect(spec).toContain(`- ${s} (S-13이 대체함)`);
  });
  it('the audit gets the PR and CI records from the PM and stays offline (020 S-9, S-10)', () => {
    const audit = read('audit');
    expect(audit).toContain('the PM collects for every PR merged in the version');
    expect(audit).toContain('`gh pr checks <n>`');
    expect(audit).toContain('The audit runs without a network');
    const role = readFileSync(join(process.cwd(), 'harness/roles/auditor.md'), 'utf8');
    expect(role).toContain('fetch from the network');
    expect(role).toContain('the PR and CI records the PM collected');
  });
  it('the retro proposes knowledge candidates from what repeated (021 S-1, S-2)', () => {
    const retro = read('retro');
    expect(retro).toContain('Propose knowledge candidates');
    expect(retro).toContain('repeated (twice or more) in history and the audit');
    expect(retro).toContain("`grep -l 'decisions:.*<keyword>' .agents/knowledge/*`");
    expect(retro).toContain('"knowledge candidates: none"');
    // the candidates come before applying what the user accepts
    expect(retro.indexOf('Propose knowledge candidates')).toBeLessThan(
      retro.indexOf('Apply only what the user accepts'),
    );
    const role = readFileSync(join(process.cwd(), 'harness/roles/pl.md'), 'utf8');
    expect(role).toContain('propose knowledge candidates');
    const design = (f: string) => readFileSync(join(process.cwd(), 'docs', f), 'utf8');
    expect(design('design.md')).toContain('are proposed as knowledge candidates');
    expect(design('design.ko.md')).toContain('knowledge 후보로 제안한다');
  });
  it("the audit counts only reins' deny rules in .claude/settings.json as drift (021 S-6)", () => {
    const sentence = "only reins' deny rules count";
    expect(read('audit')).toContain(sentence);
    expect(readFileSync(join(process.cwd(), 'harness/roles/auditor.md'), 'utf8')).toContain(
      sentence,
    );
    const design = (f: string) => readFileSync(join(process.cwd(), 'docs', f), 'utf8');
    expect(design('design.md')).toContain('**`.claude/settings.json` is merged.**');
    expect(design('design.ko.md')).toContain('**`.claude/settings.json`은 합친다.**');
  });
  it('the audit run returns the record and the PM writes it unchanged (021 S-8)', () => {
    const audit = read('audit');
    expect(audit).toContain('The audit run is read-only: it returns the record as its answer');
    expect(audit).toContain('writes it unchanged to `.agents/audit/<version>.md`');
    expect(audit).toContain('keeps that answer as it came under `.loctx/reports/<version>/`');
    const role = readFileSync(join(process.cwd(), 'harness/roles/auditor.md'), 'utf8');
    expect(role).toContain('return the full text of the audit record');
    expect(role).toContain('tools: { write: false, shell: true, push: false }');
    const design = (f: string) => readFileSync(join(process.cwd(), 'docs', f), 'utf8');
    expect(design('design.md')).toContain(
      'The audit run is read-only: the auditor returns the whole record',
    );
    expect(design('design.ko.md')).toContain(
      '감사 실행은 읽기 전용이다: 감사자는 기록 전문을 답으로 돌려주고',
    );
  });
  it('the gate script is named where it is set up, read and cleaned (021 S-11, S-12)', () => {
    const line = '`sh .agents/harness/run-gates.sh pre-commit`';
    expect(read('onboard')).toContain(line);
    expect(read('onboard')).toContain('`sh .agents/harness/run-gates.sh pre-push`');
    const audit = read('audit');
    expect(audit).toContain('`.loctx/reports/gates/<tree>.log`');
    expect(audit).toContain('`git rev-parse <commit>^{tree}`');
    expect(audit).toContain('`sh .agents/harness/run-gates.sh audit`');
    expect(audit).toContain('`worktree: clean` and `exit: 0`');
    expect(audit).toContain('filled in before the audit (`stage: audit`)');
    expect(read('retro')).toContain(
      "the gate logs in `.loctx/reports/gates/` last written before the version's stable tag was made",
    );
    const role = readFileSync(join(process.cwd(), 'harness/roles/auditor.md'), 'utf8');
    expect(role).toContain('`.loctx/reports/gates/<tree>.log`');
    expect(role).toContain('`git rev-parse <commit>^{tree}`');
    const design = (f: string) => readFileSync(join(process.cwd(), 'docs', f), 'utf8');
    for (const f of ['design.md', 'design.ko.md']) {
      expect(design(f)).toContain('`sh .agents/harness/run-gates.sh audit`');
      expect(design(f)).toContain('`.loctx/reports/gates/<tree>.log`');
      expect(design(f)).toContain('worktree: clean|dirty');
    }
  });
  it.each(STAGES)('%s delegates from the personal table first when there is one (020 S-4)', (n) => {
    const t = read(n);
    expect(t.slice(t.indexOf('## 3. Delegation')).split('\n')[1]).toMatch(
      /^Check `\.loctx\/delegation\.local\.md` if it exists, otherwise the delegation table in AGENTS\.md\./,
    );
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
