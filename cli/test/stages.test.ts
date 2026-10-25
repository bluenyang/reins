import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
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
    bus('001-1_04', 'pass', '$ pnpm test\nexit 0');
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
    expect(rcClose(d, '0.2.0')).toEqual([]);
  });
});
