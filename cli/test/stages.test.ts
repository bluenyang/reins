import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { driftConvention } from '../src/commands/check.js';
import { checkDoc, dispatchLines, readRelease } from '../src/lib/release.js';
import { rcClose, ticketStart, verdictCheck } from '../src/commands/stages.js';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';

const onlyClaude = () => [
  { name: 'claude' as const, cli: 'claude', detected: true },
  { name: 'openai' as const, cli: 'codex', detected: false },
  { name: 'google' as const, cli: 'agy', detected: false },
  { name: 'cursor' as const, cli: 'cursor-agent', detected: false },
];

function put(root: string, rel: string, text: string) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}
const git = (root: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd: root,
    stdio: 'ignore',
  });

const INTENT = (status: string, approvals = '[]') =>
  `---\nid: "001"\nslug: status\nversion: 0.2.0\nstatus: ${status}\norigin: user\napprovals: ${approvals}\n---\n## 문제\n—\n`;
const SPEC = (status: string) =>
  `---\nintent: "001"\nstatus: ${status}\napprovals: []\nsummary_for_user: "x"\n---\n## 요구 해석\n- S-1 —\n`;
const PLAN = (status: string, tickets = '["001-1", "001-2"]') =>
  `---\nintent: "001"\nstatus: ${status}\nagents: { implement: [implementer] }\ntickets: ${tickets}\n---\n## 작업 순서\n1. a\n2. b\n`;
const TICKET = (id: string, extra = '') =>
  `---\nid: ${id}\nintent: "001"\nplan_step: 1\ntitle: t\nstatus: todo\nrelease: planned\nrole: implementer\n${extra}---\n## 목적\n—\n`;

async function project(): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-stages-'));
  git(d, 'init', '-q');
  await runInstall({
    tier: 'graph',
    mode: 'auto',
    asker: defaultsAsker,
    cwd: d,
    detectVendors: onlyClaude,
  });
  return d;
}

/** An intent the user approved, recorded with the trailer, plus an accepted spec and a reviewed plan. */
function approved(d: string) {
  put(
    d,
    '.agents/intent/001_status/intent.md',
    INTENT('approved', '[{role: user, at: 2026-10-25}]'),
  );
  put(d, '.agents/intent/001_status/spec.md', SPEC('accepted'));
  put(d, '.agents/intent/001_status/plan.md', PLAN('reviewed'));
  git(d, 'add', '.agents/intent');
  git(d, 'commit', '-q', '-m', 'docs(intent): approve 001', '-m', 'Approved-by: user');
}

describe('T1 ticket-start', () => {
  let d: string;
  beforeAll(async () => {
    d = await project();
  });

  it('holds while the intent is a draft and the spec is not accepted', () => {
    put(d, '.agents/intent/001_status/intent.md', INTENT('draft'));
    put(d, '.loctx/ticket/001-1_cli.md', TICKET('001-1'));
    const f = ticketStart(d, '001-1');
    expect(f.filter((x) => x.verdict === 'HOLD').map((x) => x.reason)).toEqual(['B3', 'B3']);
    expect(f.some((x) => x.message.includes('no plan.md'))).toBe(true);
  });

  it('holds an approved intent that git does not record as approved', () => {
    put(d, '.agents/intent/001_status/intent.md', INTENT('approved', '[{role: user, at: x}]'));
    put(d, '.agents/intent/001_status/spec.md', SPEC('accepted'));
    put(d, '.agents/intent/001_status/plan.md', PLAN('reviewed'));
    const f = ticketStart(d, '001-1');
    expect(f.map((x) => x.message)).toEqual([
      'the approval is not recorded in git (no commit with an Approved-by: trailer)',
    ]);
  });

  it('continues on an approved chain; open asks hold and cite a recorded decision', () => {
    approved(d);
    expect(ticketStart(d, '001-1')).toEqual([]);
    put(d, '.loctx/history/2026-10-25-1000_x.md', 'decisions: status-json-output\n\n# x\n');
    put(d, '.loctx/ticket/001-1_cli.md', TICKET('001-1', 'asks: ["json output for status?"]\n'));
    const [f] = ticketStart(d, '001-1');
    expect(f?.reason).toBe('B1');
    expect(f?.message).toContain('possibly answered already: status-json-output');
  });

  it('stops on an open dependency, an unknown role and a ticket outside the plan', () => {
    put(d, '.loctx/ticket/001-1_cli.md', TICKET('001-1'));
    put(d, '.loctx/ticket/001-2_docs.md', TICKET('001-2', 'depends: ["001-1"]\n'));
    expect(ticketStart(d, '001-2').map((x) => x.reason)).toEqual(['F2']);
    put(d, '.loctx/ticket/001-3_x.md', TICKET('001-3').replace('implementer', 'wizard'));
    expect(ticketStart(d, '001-3').map((x) => x.reason)).toEqual(['P2', 'F2']);
  });
});

const req = (id: string) =>
  `schema: reins/bus/request@1\nid: ${id}\nfrom: pl\nto: verify-tool\nticket: 001-1\nintent: "001"\nkind: verify\nchanges: []\nwhy: w\nrevert: r\n`;
const res = (id: string, verdict: string, evidence: string) =>
  `schema: reins/bus/response@1\nrequest: ${id}\nfrom: verify-tool\nverdict: ${verdict}\ngrounds: g\nmay_proceed: true\nevidence: ${JSON.stringify(evidence)}\n`;
describe('T3 verdict', () => {
  let d: string;
  beforeAll(async () => {
    d = await project();
  });
  const bus = (id: string, verdict: string, evidence: string) => {
    put(d, `.loctx/bus/${id}.request.yaml`, req(id));
    put(d, `.loctx/bus/${id}.response.yaml`, res(id, verdict, evidence));
  };

  it('reports a bus file that is not valid YAML as F2 with its path (S-6)', () => {
    put(
      d,
      '.loctx/bus/001-9_01.request.yaml',
      req('001-9_01').replace('why: w', 'why: allowed: a.ts'),
    );
    const f = verdictCheck(d, '001-9');
    expect(f.map((x) => x.reason)).toEqual(['F2']);
    expect(f[0]?.path).toBe('.loctx/bus/001-9_01.request.yaml');
    expect(f[0]?.message).toMatch(/not valid YAML: \S+/);
    expect(f[0]?.message).not.toContain('\n');
  });

  it('stops without any verification, and on a pass with no evidence', () => {
    expect(verdictCheck(d, '001-1').map((x) => x.reason)).toEqual(['D5']);
    bus('001-1_01', 'pass', '');
    expect(verdictCheck(d, '001-1').map((x) => x.reason)).toEqual(['D5']);
  });

  it('accepts raw evidence from a report file; rejects piped gates and non-zero exits', () => {
    put(d, '.loctx/reports/001-1_check.log', '$ pnpm check\nok\nexit 0\n');
    bus('001-1_01', 'pass', '.loctx/reports/001-1_check.log');
    expect(verdictCheck(d, '001-1')).toEqual([]);
    bus('001-1_01', 'pass', '$ pnpm test | tail -5\nok\nexit 0');
    expect(verdictCheck(d, '001-1').map((x) => x.message)).toEqual([
      'the gate did not run as a single command: pnpm test | tail -5',
    ]);
    bus('001-1_01', 'pass', '$ pnpm test\n1 failed\nexit 1');
    expect(verdictCheck(d, '001-1')[0]?.reason).toBe('D4');
  });

  it('warns after one failed round and escalates after two; a pass resets the count', () => {
    bus('001-1_02', 'fail', '$ pnpm test\nexit 1');
    expect(verdictCheck(d, '001-1').map((x) => `${x.reason} ${x.verdict}`)).toEqual(['D1 WARN']);
    bus('001-1_03', 'fail', '$ pnpm test\nexit 1');
    expect(verdictCheck(d, '001-1').map((x) => `${x.reason} ${x.verdict}`)).toEqual([
      'D1 ESCALATE',
    ]);
    bus('001-1_04', 'pass', '$ pnpm test\nok\nexit 0');
    expect(verdictCheck(d, '001-1')).toEqual([]);
  });
});

describe('T5 rc-close', () => {
  it('stops on open or unrecorded tickets and passes once all are done and in history', async () => {
    const d = await project();
    approved(d);
    expect(rcClose(d, undefined)[0]?.message).toContain('--release');
    expect(rcClose(d, '9.9.9')[0]?.message).toContain('no approved intent');
    put(d, '.loctx/ticket/001-1_cli.md', TICKET('001-1'));
    expect(rcClose(d, '0.2.0').map((x) => x.message)).toEqual([
      'ticket 001-1 is still open (todo)',
      'ticket 001-2 is gone but no history page mentions it',
    ]);
    rmSync(join(d, '.loctx/ticket/001-1_cli.md'));
    put(d, '.loctx/history/2026-10-26-1000_001.md', '# 001\n- 001-1 done\n- 001-2 done\n');
    const msgs = (r: string) => rcClose(d, r).map((x) => `${x.verdict} ${x.message}`);
    expect(msgs('0.2.0')).toEqual([
      'WARN next rc: 0.2.0-rc.1',
      'WARN no release settings (install.yaml has no release:) — merge only',
    ]);
    put(
      d,
      '.loctx/release/0.2.0.md',
      '- rc.1 abc123 stage-1 2026-10-26\n- rc.2 def456 stage-2 2026-10-27\n',
    );
    expect(msgs('0.2.0').slice(0, 1)).toEqual(['WARN next rc: 0.2.0-rc.3']);
    put(d, '.loctx/release/0.2.0.md', '- rc.2 def456 s 2026-10-27\n- rc.1 abc123 s 2026-10-26\n');
    expect(msgs('0.2.0')).toEqual(['STOP 0.2.0-rc.2 is already recorded']);
  });
  it('prints the dispatch line from install.yaml release (C-2)', async () => {
    const d = await project();
    approved(d);
    put(d, '.loctx/history/2026-10-26-1000_001.md', '# 001\n- 001-1 done\n- 001-2 done\n');
    const pin = join(d, '.agents/harness/install.yaml');
    writeFileSync(
      pin,
      readFileSync(pin, 'utf8') +
        'release:\n  workflows:\n' +
        '    - { file: publish.yml, inputs: { version: "{version}", dry_run: "false" }, approval: npm-staged }\n' +
        '    - { file: notes.yml, inputs: { tag: "v{version}" }, stages: [stable] }\n',
    );
    const msgs = rcClose(d, '0.2.0').map((x) => x.message);
    expect(msgs).toContain(
      'dispatch: gh workflow run publish.yml -f version=0.2.0-rc.1 -f dry_run=false',
    );
    expect(msgs.filter((m) => m.startsWith('dispatch:'))).toHaveLength(1);
  });

  it('install.yaml with and without release passes the install schema (C-1)', async () => {
    const d = await project();
    const pin = join(d, '.agents/harness/install.yaml');
    expect(driftConvention(d).filter((f) => f.path?.endsWith('install.yaml'))).toEqual([]);
    writeFileSync(
      pin,
      readFileSync(pin, 'utf8') + 'release:\n  workflows:\n    - { file: p.yml }\n',
    );
    expect(driftConvention(d).filter((f) => f.path?.endsWith('install.yaml'))).toEqual([]);
    writeFileSync(pin, readFileSync(pin, 'utf8') + '    - { approval: nope }\n');
    expect(driftConvention(d).filter((f) => f.path?.endsWith('install.yaml'))).not.toEqual([]);
  });
  it('deploy role and release skill name no fixed branch or workflow outside npm-staged (C-3)', () => {
    const deploy = readFileSync('harness/roles/deploy.md', 'utf8');
    const skill = readFileSync('skills/reins-release/SKILL.md', 'utf8');
    expect(deploy).not.toMatch(/master/);
    expect(skill).not.toMatch(/master|publish\.yml/);
    expect(deploy.split('### `approval: npm-staged`')[0]).not.toMatch(
      /publish\.yml|approve the staged/,
    );
    for (const f of ['docs/design.md', 'docs/design.ko.md']) {
      const d = readFileSync(f, 'utf8');
      expect(d).toContain('release:');
      expect(d).toContain('npm-staged');
    }
  });
});

describe('release.docs (C-8, C-9)', () => {
  const docsYaml =
    'release:\n  docs:\n' +
    '    - { file: docs/ROADMAP.md, check: roadmap-row }\n' +
    '    - { file: CHANGELOG.md, check: changelog-section }\n' +
    '    - { file: README.md, check: mentions-version }\n';
  async function ready() {
    const d = await project();
    approved(d);
    put(d, '.loctx/history/2026-10-26-1000_001.md', '# 001\n- 001-1 done\n- 001-2 done\n');
    const pin = join(d, '.agents/harness/install.yaml');
    writeFileSync(pin, readFileSync(pin, 'utf8') + docsYaml);
    return d;
  }
  const warns = (d: string) =>
    rcClose(d, '0.2.0')
      .filter((x) => x.message.startsWith('docs:'))
      .map((x) => `${x.verdict} ${x.message}`);

  it('warns once per stale document and never stops (C-8)', async () => {
    const d = await ready();
    put(d, 'docs/ROADMAP.md', '| Version | State |\n|---|---|\n| 0.2.0 | planned |\n');
    put(d, 'CHANGELOG.md', '## [0.1.0] — 2026-01-01\n');
    put(d, 'README.md', 'Version 0.1.0 is out.\n');
    expect(warns(d)).toEqual([
      'WARN docs: docs/ROADMAP.md still describes the previous state (roadmap-row)',
      'WARN docs: CHANGELOG.md still describes the previous state (changelog-section)',
      'WARN docs: README.md still describes the previous state (mentions-version)',
    ]);
    expect(rcClose(d, '0.2.0').every((x) => x.verdict === 'WARN')).toBe(true);
  });
  it('is silent when every document is current, and without release.docs (C-8)', async () => {
    const d = await ready();
    put(d, 'docs/ROADMAP.md', '| 0.2.0 | rc |\n');
    put(d, 'CHANGELOG.md', '## [Unreleased] — 0.2.0\n');
    put(d, 'README.md', 'Version 0.2.0 is out.\n');
    expect(warns(d)).toEqual([]);
    const pin = join(d, '.agents/harness/install.yaml');
    writeFileSync(pin, readFileSync(pin, 'utf8').replace(docsYaml, ''));
    put(d, 'README.md', 'nothing\n');
    expect(warns(d)).toEqual([]);
  });
  it('checks each kind (C-8)', () => {
    const row = (state: string) => `| Version | State |\n|---|---|\n| 0.2.0 | ${state} |\n`;
    expect(checkDoc(row('planned'), 'roadmap-row', '0.2.0', 'rc')).toBe(false);
    expect(checkDoc(row('계획'), 'roadmap-row', '0.2.0', 'rc')).toBe(false);
    expect(checkDoc(row('published'), 'roadmap-row', '0.2.0', 'rc')).toBe(true);
    expect(checkDoc(row('rc'), 'roadmap-row', '0.2.1', 'rc')).toBe(false);
    const unreleased = '## [Unreleased] — 0.2.0\n';
    expect(checkDoc(unreleased, 'changelog-section', '0.2.0', 'rc')).toBe(true);
    expect(checkDoc(unreleased, 'changelog-section', '0.2.0', 'stable')).toBe(false);
    expect(checkDoc('## [0.2.0] — 2026-11-01\n', 'changelog-section', '0.2.0', 'stable')).toBe(
      true,
    );
    expect(checkDoc('## [0.2.0] — 2026-11-01\n', 'changelog-section', '0.2.0', 'rc')).toBe(true);
    expect(checkDoc('Version 0.2.0 is out', 'mentions-version', '0.2.0', 'rc')).toBe(true);
    expect(checkDoc('Version 0.2.01 and 10.2.0', 'mentions-version', '0.2.0', 'rc')).toBe(false);
    expect(checkDoc('Version 0.2.0.', 'mentions-version', '0.2.0', 'rc')).toBe(true);
  });
  it('deploy role and release skill put the docs step before T5 (C-9)', () => {
    const deploy = readFileSync('harness/roles/deploy.md', 'utf8');
    const skill = readFileSync('skills/reins-release/SKILL.md', 'utf8');
    expect(deploy).toContain('release.docs');
    expect(deploy.indexOf('Release documents')).toBeLessThan(deploy.indexOf('## rc procedure'));
    expect(skill).toContain('release.docs');
    expect(skill.indexOf('release.docs')).toBeLessThan(skill.indexOf('(T5)'));
  });
});

describe('release dispatch lines', () => {
  it('quotes so the printed line round-trips through sh (review 1)', () => {
    const v = "a b'c $(x)";
    const [line] = dispatchLines(
      [{ file: 'p q.yml', inputs: { k: '{version}' }, stages: ['rc'], approval: 'none' }],
      'rc',
      v,
    );
    const out = execFileSync(
      'sh',
      ['-c', `set -- ${line?.replace('gh workflow run', '')}; printf '%s\\n' "$@"`],
      {
        encoding: 'utf8',
      },
    );
    expect(out).toBe(`p q.yml\n-f\nk=${v}\n`);
    expect(
      dispatchLines(
        [
          {
            file: 'publish.yml',
            inputs: { version: '{version}' },
            stages: ['rc'],
            approval: 'none',
          },
        ],
        'rc',
        '1.0.0-rc.1',
      ),
    ).toEqual(['gh workflow run publish.yml -f version=1.0.0-rc.1']);
  });

  it('stages default only when omitted; empty list fails the schema (review 2)', async () => {
    const d = await project();
    const pin = join(d, '.agents/harness/install.yaml');
    const base = readFileSync(pin, 'utf8');
    writeFileSync(
      pin,
      `${base}release:\n  workflows:\n    - { file: s.yml, stages: [stable] }\n    - { file: all.yml }\n`,
    );
    expect(dispatchLines(readRelease(d) ?? [], 'rc', '1.0.0-rc.1')).toEqual([
      'gh workflow run all.yml',
    ]);
    writeFileSync(pin, `${base}release:\n  workflows:\n    - { file: s.yml, stages: [] }\n`);
    expect(driftConvention(d).filter((f) => f.path?.endsWith('install.yaml'))).not.toEqual([]);
  });
});
