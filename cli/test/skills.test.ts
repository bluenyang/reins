import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
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
  /** One managed block of the AGENTS.md template, by name. */
  const block = (name: string) => {
    const t = readFileSync(join(process.cwd(), 'harness/templates/agents-md-blocks.md'), 'utf8');
    const m = new RegExp(
      `<!-- reins:begin ${name} [^>]*-->\\n([\\s\\S]*?)<!-- reins:end ${name} -->`,
    ).exec(t);
    if (!m) throw new Error(`no block ${name}`);
    return m[1]!;
  };
  /** The text of one `## n. Title` section of a skill, up to the next `## `. */
  const section = (text: string, heading: string) => {
    const i = text.indexOf(heading);
    if (i < 0) throw new Error(`no section ${heading}`);
    const j = text.indexOf('\n## ', i + heading.length);
    return text.slice(i, j < 0 ? undefined : j);
  };
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
  it('the English design says what the Korean one says in the two places the audit found (021 S-30)', () => {
    const design = (f: string) => readFileSync(join(process.cwd(), 'docs', f), 'utf8');
    const en = design('design.md');
    expect(en).toContain(
      'Settings without any fallback get a delegation section that does not mention fallbacks.',
    );
    expect(en).not.toContain('A file without any fallback');
    expect(design('design.ko.md')).toContain(
      '대체가 하나도 없는 설정의 위임 절은 대체를 말하지 않는다.',
    );
    expect(en).toContain('small pieces of work that may be reverted together may share one commit');
    expect(design('design.ko.md')).toContain(
      '함께 되돌아가도 되는 작은 작업은 한 커밋에 합칠 수 있다',
    );
  });
  it('the design describes fallback models in both editions (021 S-20)', () => {
    const design = (f: string) => readFileSync(join(process.cwd(), 'docs', f), 'utf8');
    for (const f of ['design.md', 'design.ko.md']) {
      const t = design(f);
      expect(t).toContain('`; fallback: <vendor> <model> — <');
      expect(t).toContain('config bindings --fallback <');
      // `fallback` is no longer on the list of keys that are gone
      expect(t).not.toMatch(/`escalation`, `limits`, `parallel`, `fallback`/);
      expect(t).toContain('fallback: { vendor: openai, model: gpt-6.1-terra }');
    }
  });
  it('the design and the READMEs describe the gate refresh in both editions (021 S-26)', () => {
    const doc = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
    for (const f of ['docs/design.md', 'docs/design.ko.md']) {
      expect(doc(f)).toContain('`config gates --refresh [--apply <');
      for (const k of ['**changed**', '**new**', '**gone**', '"yours"'])
        expect(doc(f)).toContain(k);
    }
    for (const f of ['README.md', 'docs/README.ko.md'])
      expect(doc(f)).toContain('`config gates --refresh`');
  });
  it('no document names a PM model (022 S-27c, V-9)', () => {
    const doc = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
    for (const f of ['docs/design.md', 'docs/design.ko.md']) {
      expect(doc(f)).not.toMatch(/^default: \{ vendor/m);
      expect(doc(f)).toContain('you are the PM — the model in this conversation');
    }
    expect(doc('docs/design.md')).toContain("The PM's model is not written down.");
    expect(doc('docs/design.ko.md')).toContain('PM의 모델은 적지 않는다.');
    expect(read('audit')).not.toContain("same vendor's top model");
    expect(read('audit')).toContain('a new run of your own model, or another one the user chooses');
    expect(doc('harness/CHANGELOG.md')).toContain('The PM is the model in the conversation.');
  });
  it('after the approvals the work is one flow without asking (022 S-1..S-4, V-1)', () => {
    const flow = block('flow');
    expect(flow).toContain('one flow without asking');
    const stops = block('stops');
    expect(stops).not.toContain('anything that leaves the machine');
    expect(stops).toContain(
      'Pushing a branch of the work in progress and opening its PR is part of the flow',
    );
    const ask = stops.split('\n').find((l) => l.startsWith('- **Ask the user and stop:**'))!;
    expect(ask).toContain('a merge;');
    expect(ask).toContain('a stable release;');
    const merge = section(read('merge'), '## 2. Procedure');
    expect(merge).not.toContain('otherwise ask');
    expect(merge).toContain('Push the branch and open the PR without asking');
    expect(merge).toContain('report once');
    expect(merge).toContain("Every merge needs the user's instruction");
    const doc = (f: string) => readFileSync(join(process.cwd(), 'docs', f), 'utf8');
    expect(doc('design.md')).toContain('**one flow without asking**');
    expect(doc('design.md')).not.toContain('anything that leaves the machine');
    expect(doc('design.ko.md')).toContain('**묻지 않고 이어 가는 하나의 흐름**');
    expect(doc('design.ko.md')).not.toContain('기계 밖으로 나가는 일(push');
  });
  it('the spec may be adjusted while working; only a changed work unit stops (022 S-5..S-8, V-2)', () => {
    const harness = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
    // the template has the adjustment record between the checks and the concerns
    const heads = [...harness('harness/templates/spec.md').matchAll(/^## (.+)$/gm)].map(
      (m) => m[1],
    );
    expect(heads).toEqual([
      '요구 해석',
      '설계',
      '작업 단위',
      '검증 기준',
      '조정 기록',
      '우려',
      '범위 밖',
    ]);
    expect(harness('harness/templates/spec.md')).toContain(
      '## 조정 기록\n<!-- - A-n (YYYY-MM-DD, W-n) 무엇을 · 왜 · 커밋 -->\n—\n',
    );
    expect(section(read('implement'), '## 2. Procedure')).toContain(
      '`- A-n (date, W-n) what · why · commit`',
    );
    const stop = 'Adding, dropping or rescoping a work unit';
    expect(section(read('implement'), '## 2. Procedure')).toContain(stop);
    expect(section(read('implement'), '## 2. Procedure')).toContain('is an adjustment');
    expect(section(read('implement'), '## 2. Procedure')).toContain('names its `A-n`');
    expect(section(read('implement'), '## 6. Stop and ask')).toContain(
      'has to be added, dropped or rescoped',
    );
    expect(section(read('spec'), '## 2. Procedure')).toContain('added, dropped or rescoped');
    expect(section(read('spec'), '## 2. Procedure')).toContain('adjustment record (`A-n`)');
    expect(section(read('review'), '## 2. Procedure')).toContain('A small fix is an adjustment');
    expect(block('flow')).toContain(stop);
    expect(block('flow')).toContain('a smaller adjustment goes on');
    for (const t of [read('audit'), harness('harness/roles/auditor.md')]) {
      expect(t).toContain('an adjustment recorded in the spec is kept');
      expect(t).toContain('added, dropped or rescoped without approval is a violation');
    }
    // another order of the units is an adjustment now, and an rc fix is no unit of its own kind
    for (const n of STAGES) expect(read(n), n).not.toContain('reordered');
    expect(block('flow')).not.toContain('reordered');
    expect(read('release')).not.toContain('stabilisation work units');
    expect(harness('docs/design.md')).toContain('**Adjusting the spec while working.**');
    expect(harness('docs/design.ko.md')).toContain('**작업 중 spec 조정.**');
  });
  it('a finding accepted three times becomes knowledge and the audits list it apart (022 S-17..S-19, V-4)', () => {
    const harness = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
    const schema = JSON.parse(harness('harness/schemas/knowledge.schema.json')) as {
      properties: { kind: { enum: string[] } };
    };
    expect(schema.properties.kind.enum).toEqual(['decision', 'failure', 'accepted-finding']);
    const ok = new Ajv2020({ strict: false }).compile(schema);
    const entry = (kind: string) => ({
      id: '2026-01-01_x',
      kind,
      status: 'active',
      topics: [],
      decisions: [],
      applies_to: 'all',
      source: 'x',
    });
    expect(ok(entry('accepted-finding'))).toBe(true);
    expect(ok(entry('other'))).toBe(false);
    expect(harness('harness/templates/knowledge.md')).toContain('accepted-finding');
    const audit = read('audit');
    const a = audit.indexOf('### First audit — before the merge');
    const b = audit.indexOf('### Second audit — after the release');
    expect(audit.slice(0, a)).toContain('is listed as a **known acceptance**');
    expect(audit.slice(a, b)).toContain('list each known acceptance apart from the violations');
    expect(audit.slice(b)).toContain('with each known acceptance apart');
    expect(harness('harness/roles/auditor.md')).toContain('is listed as a known acceptance');
    const tpl = harness('harness/templates/audit.md');
    expect(tpl.split('### 알려진 수용').length).toBe(3);
    const retro = section(read('retro'), '## 2. Procedure');
    expect(retro).toContain('accepted three times or more');
    expect(retro).toContain('`kind: accepted-finding`');
    expect(harness('docs/design.md')).toContain('**Accepted findings.**');
    expect(harness('docs/design.ko.md')).toContain('**수용된 지적.**');
  });
  it('the retro ends the loop, and waiting is not filled with the next work (022 S-25..S-26a, V-6)', () => {
    const harness = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
    const flow = block('flow');
    expect(flow).toContain('**The retro ends the loop**');
    expect(flow).toContain('Naming a version is not an instruction to start it');
    expect(flow).toContain('for that instruction only');
    expect(flow).toContain('every merge and the stable release still wait for the user');
    const stops = block('stops');
    expect(stops).toContain('- **While you wait for the user**');
    expect(stops).toContain("do not start another unit's work");
    expect(stops).toContain('- **The retro ends the loop:** report that it is closed and stop.');
    const when = section(read('intent'), '## 1. When');
    expect(when).toContain('the user started this work');
    expect(when).toContain('the previous loop is closed');
    expect(when).toContain('record a waiver');
    const roadmap = section(read('roadmap'), '## 2. Procedure');
    expect(roadmap).toContain('it is not an instruction to start it');
    expect(roadmap).toContain('A version name alone is not a settlement');
    expect(roadmap).toContain('when the user starts that work and the previous loop is closed');
    const retro = section(read('retro'), '## 2. Procedure').trimEnd().split('\n').at(-1)!;
    expect(retro).toMatch(/^7\. Report that the loop is closed and stop\./);
    expect(section(read('release'), '## 2. Procedure')).toContain('report and wait');
    expect(section(read('release'), '## 2. Procedure')).toContain(
      'Do not start the work of another unit meanwhile',
    );
    expect(harness('docs/design.md')).toContain('The retro ends the loop');
    expect(harness('docs/design.md')).toContain('**Where a loop ends.**');
    expect(harness('docs/design.ko.md')).toContain('회고가 루프를 끝낸다');
    expect(harness('docs/design.ko.md')).toContain('**루프의 끝.**');
  });
  it('merge, review and retro carry what this repository had to learn (022 S-21..S-24a, V-7)', () => {
    const harness = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
    const review = section(read('review'), '## 2. Procedure');
    expect(review).toContain('including one that changes tests or documents only');
    expect(review).toContain('record that and why');
    const merge = section(read('merge'), '## 2. Procedure');
    for (const k of [
      'the PM judges which PR the instruction means',
      'If you cannot tell, ask',
      'A general "go on" is not a merge instruction',
      'Delete the merged branch, remote and local',
      "names the default branch's SHAs",
      'Do not rewrite the first audit',
      '`### SHA 대응`',
    ])
      expect(merge, k).toContain(k);
    expect(section(read('merge'), '## 4. Files and lifetime')).toContain(
      'The work branch — deleted at the merge',
    );
    expect(section(read('retro'), '## 2. Procedure')).toContain('about the harness itself');
    expect(read('audit')).toContain("unless the spec's adjustment record says so and why");
    // nothing about one agent tool's own permission checks
    for (const n of STAGES) expect(read(n), n).not.toMatch(/auto mode|Claude Code/);
    expect(harness('docs/design.md')).toContain('the PM judges which PR a merge instruction means');
    expect(harness('docs/design.ko.md')).toContain(
      '머지 지시가 어느 PR을 말하는지는 PM이 판단한다',
    );
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
    const next = (n: string) =>
      [...section(read(n), '## 5. Next').matchAll(/`([a-z]+)`/g)].map((m) => m[1]);
    const chain = ['roadmap', 'intent', 'spec', 'implement'];
    for (let i = 0; i < chain.length - 1; i++) expect(next(chain[i]!)).toEqual([chain[i + 1]]);
    expect(next('implement')).toEqual(['review']);
    expect(next('review')).toEqual(['implement', 'test']);
    expect(next('test')).toEqual(['merge']);
    // two audits: the first sits between the PR and the merge, the second between the release and the retro
    expect(next('merge')).toEqual(['audit', 'release']);
    expect(next('audit')).toEqual(['merge', 'retro']);
    expect(next('release')).toEqual(['audit', 'retro']);
    expect(next('retro')).toEqual(['roadmap']);
  });
  it('a version is audited twice: risk before the merge, procedure after the release (022 S-9..S-16, V-3)', () => {
    const harness = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
    const audit = read('audit');
    const a = audit.indexOf('### First audit — before the merge');
    const b = audit.indexOf('### Second audit — after the release');
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    const first = audit.slice(a, b);
    const second = audit.slice(b, audit.indexOf('## 3. Delegation'));
    for (const k of [
      'Look for **risk**',
      'commits the record on the PR branch',
      'Push it',
      'wait for CI again',
      'until CI is green on the last of these commits',
    ])
      expect(first, k).toContain(k);
    expect(first).toContain('A fix made after the audit is not audited again');
    for (const k of [
      '**procedure only**',
      'handed to the retro',
      '### 회고에서의 처리',
      '### SHA 대응',
    ])
      expect(second, k).toContain(k);
    expect(second).not.toMatch(/remedy/i);
    expect(section(audit, '## 1. When')).toContain('both are mandatory');
    const merge = section(read('merge'), '## 2. Procedure');
    expect(merge).toContain("Every merge needs the user's instruction");
    expect(merge).toContain('go on to the first audit (`audit`) without asking');
    expect(merge).toContain('and the user says to merge, merge at once');
    expect(section(read('release'), '## 1. When')).toContain('The first audit is done');
    expect(section(read('retro'), '## 2. Procedure')).toContain(
      'what the second audit handed to the retro',
    );
    const tpl = harness('harness/templates/audit.md');
    for (const h of [
      '## 1차 감사',
      '### 사용자 처리',
      '## 2차 감사',
      '### 회고로 넘길 것',
      '### SHA 대응',
      '### 회고에서의 처리',
    ])
      expect(tpl, h).toContain(`\n${h}\n`);
    expect(tpl).toMatch(/^first: \{ range: /m);
    expect(tpl).toMatch(/^second: \{ range: /m);
    expect(tpl.indexOf('### 해결 방법')).toBeLessThan(tpl.indexOf('## 2차 감사'));
    expect(block('flow')).toContain('the first audit: risk, before the merge');
    expect(block('flow')).toContain('the second audit: procedure only, handed to the retro');
    expect(block('flow')).not.toContain('after the merge, before the rc');
    expect(block('settings')).toContain('every version is audited twice');
    const role = harness('harness/roles/auditor.md');
    expect(role).toContain('**First audit**');
    expect(role).toContain('**Second audit**');
    expect(harness('docs/design.md')).toContain(
      'The **first audit** comes after CI passes and before the merge',
    );
    expect(harness('docs/design.md')).toContain('it looks at **procedure only**');
    expect(harness('docs/design.md')).not.toContain('after the merge, before the rc');
    expect(harness('docs/design.ko.md')).toContain('**1차 감사**는 CI가 통과한 뒤 머지 전에');
    expect(harness('docs/design.ko.md')).toContain('**절차만** 본다');
    expect(harness('docs/design.ko.md')).not.toContain('머지 뒤, rc 전');
    for (const f of ['README.md', 'docs/README.ko.md'])
      expect(harness(f)).not.toMatch(/After the merge and before the rc|머지 뒤, rc 전/);
  });
});
