import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { runInstall } from '../src/commands/install.js';
import { ticketStart } from '../src/commands/stages.js';
import { collectStatus, formatStatus, nextForIntent, runStatus } from '../src/commands/status.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { report } from '../src/lib/verdict.js';

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

const INTENT = (status: string, id = '001', slug = 'status') =>
  `---\nid: "${id}"\nslug: ${slug}\nversion: 0.2.0\nstatus: ${status}\norigin: user\napprovals: []\n---\n## x\n`;
const SPEC = (status: string, id = '001') =>
  `---\nintent: "${id}"\nstatus: ${status}\napprovals: []\nsummary_for_user: "x"\n---\n## x\n`;
const PLAN = (status: string, tickets = '["001-1"]', id = '001') =>
  `---\nintent: "${id}"\nstatus: ${status}\nagents: { implement: [implementer] }\ntickets: ${tickets}\n---\n## x\n`;
const TICKET = (id: string, status = 'todo', extra = '') =>
  `---\nid: ${id}\nintent: "${id.slice(0, 3)}"\nplan_step: 1\ntitle: t\nstatus: ${status}\nrelease: planned\nrole: implementer\n${extra}---\n## x\n`;

async function project(install = true): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-status-'));
  git(d, 'init', '-q');
  if (install)
    await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
  return d;
}

/** One intent with the given statuses (spec/plan null = file missing). */
function intent(d: string, id: string, s: string, spec: string | null, plan: string | null) {
  const dir = `.agents/intent/${id}_t${id}`;
  put(d, `${dir}/intent.md`, INTENT(s, id, `t${id}`));
  if (spec) put(d, `${dir}/spec.md`, SPEC(spec, id));
  if (plan) put(d, `${dir}/plan.md`, PLAN(plan, '[]', id));
}

const one = (d: string, id: string) => collectStatus(d).intents.find((i) => i.id === id)!;

/** A hash of every file under root (the .git directory excluded), `.loctx/` included. */
function treeHash(root: string): string {
  const h = createHash('sha256');
  const walk = (dir: string) => {
    for (const e of readdirSync(dir).toSorted()) {
      if (e === '.git') continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(p).update(readFileSync(p));
    }
  };
  walk(root);
  return h.digest('hex');
}

describe('C-1 harness line', () => {
  it('says "not installed" when there is no harness', async () => {
    const d = await project(false);
    const s = collectStatus(d);
    expect(s.harness.installed).toBe(false);
    expect(formatStatus(s)).toContain('harness: not installed — run reins install');
    expect(runStatus({ cwd: d }).code).toBe(0);
  });

  it('shows tier, both versions and drift: ok when installed', async () => {
    const d = await project();
    const s = collectStatus(d);
    expect(s.harness).toMatchObject({ installed: true, tier: 'graph' });
    expect(s.harness.installedVersion).toBe(s.harness.packageVersion);
    expect(s.harness.drift.ok).toBe(true);
    const line = formatStatus(s).split('\n')[0]!;
    expect(line).toContain('graph');
    expect(line).toContain(`installed v${s.harness.installedVersion}`);
    expect(line).toContain(`package v${s.harness.packageVersion}`);
    expect(line).toContain('drift: ok');
  });

  it('lists the reason ids when a managed harness file is hand-edited, and still exits 0', async () => {
    const d = await project();
    appendFileSync(join(d, '.agents/harness/roles/implementer.md'), '\nhand edit\n');
    const s = collectStatus(d);
    expect(s.harness.drift.ok).toBe(false);
    expect(s.harness.drift.reasons).toContain('F2');
    expect(formatStatus(s).split('\n')[0]).toContain('drift: F2');
    expect(runStatus({ cwd: d }).code).toBe(0);
  });
});

describe('C-2 superseded intents', () => {
  it('hides a superseded intent and counts it', async () => {
    const d = await project();
    intent(d, '001', 'superseded', null, null);
    intent(d, '002', 'draft', null, null);
    const s = collectStatus(d);
    expect(s.intents.map((i) => i.id)).toEqual(['002']);
    expect(s.supersededIntents).toBe(1);
    const text = formatStatus(s);
    expect(text).not.toContain('001 t001');
    expect(text).toContain('(1 superseded, hidden)');
  });

  it('counts open tickets against the tickets the plan lists', async () => {
    const d = await project();
    intent(d, '001', 'approved', 'accepted', null);
    put(d, '.agents/intent/001_t001/plan.md', PLAN('reviewed', '["001-1", "001-2", "001-3"]'));
    put(d, '.loctx/ticket/001-1_a.md', TICKET('001-1'));
    put(d, '.loctx/ticket/001-2_b.md', TICKET('001-2'));
    expect(one(d, '001').tickets).toEqual({ open: 2, planned: 3 });
    expect(formatStatus(collectStatus(d))).toContain('tickets: 2 open / 3 planned');
  });
});

describe('C-3 the next-step table', () => {
  it.each([
    ['draft', null, null, 'user: approve the intent'],
    ['approved', null, null, 'planner: write spec.md'],
    ['approved', 'draft', null, 'pm + qa-design: review the spec'],
    ['approved', 'reviewed', null, 'user: read summary_for_user (veto or accept)'],
    ['approved', 'rejected', null, 'planner: revise spec.md'],
    ['approved', 'accepted', null, 'pl: write plan.md'],
    ['approved', 'accepted', 'draft', 'qa-design: review the plan'],
  ])('intent %s, spec %s, plan %s → %s', async (i, sp, pl, expected) => {
    const d = await project();
    intent(d, '001', i, sp, pl);
    expect(one(d, '001').next).toBe(expected);
  });

  it.each(['reviewed', 'active'])(
    'plan %s with no open ticket and an unrecorded planned ticket → create tickets',
    async (plan) => {
      const d = await project();
      intent(d, '001', 'approved', 'accepted', null);
      put(d, '.agents/intent/001_t001/plan.md', PLAN(plan));
      expect(one(d, '001').next).toBe('pl: create tickets');
    },
  );

  it('every planned ticket closed and in history → close the rc', async () => {
    const d = await project();
    intent(d, '001', 'approved', 'accepted', null);
    put(d, '.agents/intent/001_t001/plan.md', PLAN('active', '["001-1", "001-2"]'));
    put(d, '.loctx/history/2026-10-25-0100_a.md', '001-1 done\n');
    expect(one(d, '001').next).toBe('pl: create tickets');
    put(d, '.loctx/history/2026-10-25-0200_b.md', 'ticket 001-2 done\n');
    expect(one(d, '001').next).toContain('pm: close the rc (reins check --stage rc-close');
  });

  it('plan done with every planned ticket recorded → close the rc, whatever the plan status', async () => {
    const d = await project();
    intent(d, '001', 'approved', 'accepted', null);
    put(d, '.loctx/history/2026-10-25-0100_a.md', '001-1 done\n');
    for (const plan of ['reviewed', 'active', 'done']) {
      put(d, '.agents/intent/001_t001/plan.md', PLAN(plan));
      expect(one(d, '001').next).toContain('pm: close the rc');
    }
  });

  it('plan done with an unrecorded planned ticket does not ask for tickets', async () => {
    const d = await project();
    intent(d, '001', 'approved', 'accepted', null);
    put(d, '.agents/intent/001_t001/plan.md', PLAN('done'));
    expect(one(d, '001').next).toBe('—');
  });

  it('an open planned ticket is neither "create tickets" nor "close the rc"', async () => {
    const d = await project();
    intent(d, '001', 'approved', 'accepted', null);
    put(d, '.agents/intent/001_t001/plan.md', PLAN('active'));
    put(d, '.loctx/ticket/001-1_a.md', TICKET('001-1', 'doing'));
    put(d, '.loctx/history/2026-10-25-0100_a.md', '001-1 mentioned\n');
    expect(one(d, '001').next).toBe('—');
  });

  it.each(['reviewed', 'active'])(
    'a %s plan with one open ticket and one uncreated planned ticket is not "create tickets"',
    async (plan) => {
      const d = await project();
      intent(d, '001', 'approved', 'accepted', null);
      put(d, '.agents/intent/001_t001/plan.md', PLAN(plan, '["001-1", "001-2"]'));
      put(d, '.loctx/ticket/001-1_a.md', TICKET('001-1', 'doing'));
      expect(one(d, '001').next).toBe('—');
    },
  );

  it.each(['reviewed', 'active'])('an empty %s plan does not ask for tickets', async (plan) => {
    const d = await project();
    intent(d, '001', 'approved', 'accepted', null);
    put(d, '.agents/intent/001_t001/plan.md', PLAN(plan, '[]'));
    expect(one(d, '001').next).toBe('—');
  });

  it('the first matching row wins (a draft intent beats an accepted spec)', async () => {
    const d = await project();
    intent(d, '001', 'draft', 'accepted', 'reviewed');
    expect(one(d, '001').next).toBe('user: approve the intent');
  });

  it('falls back to "—", or names a broken file, when no row matches', () => {
    const base = { open: 1, openIds: ['001-1'], planned: ['001-1'], history: [], broken: [] };
    const s = { intent: 'approved', spec: 'accepted', plan: 'active', ...base };
    expect(nextForIntent(s)).toBe('—');
    expect(nextForIntent({ ...s, spec: '?', broken: ['x/spec.md'] })).toContain('x/spec.md');
  });

  it('a released intent has no next action and is folded into one line', async () => {
    const d = await project();
    intent(d, '001', 'released', 'accepted', 'active');
    put(d, '.agents/intent/001_t001/plan.md', PLAN('active', '["001-1"]'));
    put(d, '.loctx/history/001-1.md', '# 001-1 done\n');
    expect(one(d, '001').next).toBe('—');
    const text = formatStatus(collectStatus(d));
    expect(text).toMatch(/001 t001 .*— released\n/);
    expect(text).not.toContain('close the rc');
  });

  it('does not throw on a broken intent.md', async () => {
    const d = await project();
    put(d, '.agents/intent/001_t001/intent.md', '---\nstatus: [oops\n---\n');
    const i = one(d, '001');
    expect(i.next).toContain('invalid frontmatter (F2)');
    expect(() => formatStatus(collectStatus(d))).not.toThrow();
  });
});

describe('C-4 tickets', () => {
  let d: string;
  beforeAll(async () => {
    d = await project();
    put(d, '.agents/intent/001_t001/intent.md', INTENT('draft', '001', 't001'));
  });

  it('a todo ticket shows the very verdict T1 gives, B1 HOLD for an open ask', async () => {
    const p = await project();
    intent(p, '001', 'approved', 'accepted', null);
    put(p, '.agents/intent/001_t001/plan.md', PLAN('reviewed'));
    put(p, '.loctx/ticket/001-1_a.md', TICKET('001-1', 'todo', 'asks: ["which format?"]\n'));
    const t1 = report('ticket-start', ticketStart(p, '001-1'));
    expect(t1.verdict).toBe('HOLD');
    expect(t1.findings.some((f) => f.reason === 'B1')).toBe(true);
    const t = collectStatus(p).tickets[0]!;
    expect(t.t1?.verdict).toBe(t1.verdict);
    expect(t.t1?.reasons).toContain('B1');
    expect(t.next).toContain('T1 HOLD');
    expect(t.next).toContain('B1');
  });

  it('a todo ticket T1 lets through starts with its role', async () => {
    const p = await project();
    intent(p, '001', 'approved', 'accepted', null);
    put(p, '.agents/intent/001_t001/plan.md', PLAN('reviewed'));
    git(p, 'add', '.agents/intent');
    git(p, 'commit', '-q', '-m', 'x', '-m', 'Approved-by: user');
    // approvals needs a user entry too
    put(
      p,
      '.agents/intent/001_t001/intent.md',
      INTENT('approved', '001', 't001').replace(
        'approvals: []',
        'approvals: [{role: user, at: x}]',
      ),
    );
    git(p, 'add', '.agents/intent');
    git(p, 'commit', '-q', '-m', 'y', '-m', 'Approved-by: user');
    put(p, '.loctx/ticket/001-1_a.md', TICKET('001-1'));
    const t = collectStatus(p).tickets[0]!;
    expect(report('ticket-start', ticketStart(p, '001-1')).verdict).toBe('CONTINUE');
    expect(t.t1?.verdict).toBe('CONTINUE');
    expect(t.next).toBe('implementer: start');
  });

  it('a CONTINUE todo ticket starts with the role the ticket names', async () => {
    const p = await project();
    intent(p, '001', 'approved', 'accepted', null);
    put(p, '.agents/intent/001_t001/plan.md', PLAN('reviewed'));
    put(
      p,
      '.agents/intent/001_t001/intent.md',
      INTENT('approved', '001', 't001').replace(
        'approvals: []',
        'approvals: [{role: user, at: x}]',
      ),
    );
    git(p, 'add', '.agents/intent');
    git(p, 'commit', '-q', '-m', 'y', '-m', 'Approved-by: user');
    put(p, '.loctx/ticket/001-1_a.md', TICKET('001-1').replace('role: implementer', 'role: docs'));
    expect(report('ticket-start', ticketStart(p, '001-1')).verdict).toBe('CONTINUE');
    expect(collectStatus(p).tickets[0]!.next).toBe('docs: start');
  });

  it('malformed asks make that ticket invalid; the others still render and the exit is 0', () => {
    put(d, '.loctx/ticket/001-7_asks.md', TICKET('001-7', 'blocked', 'asks: [{toString: null}]\n'));
    put(d, '.loctx/ticket/001-8_asks.md', TICKET('001-8', 'blocked', 'asks: "just a string"\n'));
    put(d, '.loctx/ticket/001-9_ok.md', TICKET('001-9', 'doing'));
    const s = collectStatus(d);
    for (const id of ['001-7', '001-8']) {
      const t = s.tickets.find((x) => x.id === id)!;
      expect(t.invalid).toBe(true);
      expect(t.next).toBe('invalid (F2)');
    }
    expect(s.tickets.find((x) => x.id === '001-9')!.next).toBe(
      'reins check --stage verdict --ticket 001-9',
    );
    const text = formatStatus(s);
    expect(text).toContain('001-7 —');
    expect(text).toContain('001-9 — doing');
    expect(runStatus({ cwd: d }).code).toBe(0);
  });

  it('a malformed tickets: list in a plan does not throw', async () => {
    const p = await project();
    intent(p, '001', 'approved', 'accepted', null);
    put(
      p,
      '.agents/intent/001_t001/plan.md',
      PLAN('reviewed', '[{toString: null}, null, "001-1"]'),
    );
    expect(() => collectStatus(p)).not.toThrow();
    expect(one(p, '001').tickets.planned).toBe(1);
  });

  it('doing → the verdict check for that ticket', () => {
    put(d, '.loctx/ticket/001-1_a.md', TICKET('001-1', 'doing'));
    const t = collectStatus(d).tickets.find((x) => x.id === '001-1')!;
    expect(t.next).toBe('reins check --stage verdict --ticket 001-1');
  });

  it('blocked → the number of asks and each question', () => {
    put(d, '.loctx/ticket/001-2_b.md', TICKET('001-2', 'blocked', 'asks: ["q one", "q two"]\n'));
    const s = collectStatus(d);
    const t = s.tickets.find((x) => x.id === '001-2')!;
    expect(t.asks).toEqual(['q one', 'q two']);
    expect(t.next).toContain('2 open asks');
    const text = formatStatus(s);
    expect(text).toContain('? q one');
    expect(text).toContain('? q two');
  });

  it('done → write history, delete the ticket', () => {
    put(d, '.loctx/ticket/001-3_c.md', TICKET('001-3', 'done'));
    const t = collectStatus(d).tickets.find((x) => x.id === '001-3')!;
    expect(t.next).toBe('write history, delete the ticket');
  });

  it('a ticket whose intent folder is missing is an orphan', () => {
    put(d, '.loctx/ticket/009-1_o.md', TICKET('009-1', 'doing'));
    const t = collectStatus(d).tickets.find((x) => x.id === '009-1')!;
    expect(t.orphan).toBe(true);
    expect(formatStatus(collectStatus(d))).toContain(
      '009-1 — doing · implementer · asks: 0 · orphan',
    );
  });

  it('broken frontmatter and an unknown status are invalid (F2), with no exception', () => {
    put(d, '.loctx/ticket/001-4_bad.md', '---\nid: 001-4\nstatus: [oops\n---\n');
    put(d, '.loctx/ticket/001-5_odd.md', TICKET('001-5', 'finished'));
    put(d, '.loctx/ticket/001-6_none.md', 'no frontmatter at all\n');
    const s = collectStatus(d);
    for (const id of ['001-4', '001-5', '001-6']) {
      const t = s.tickets.find((x) => x.id === id)!;
      expect(t.invalid).toBe(true);
      expect(t.next).toBe('invalid (F2)');
    }
    expect(() => formatStatus(s)).not.toThrow();
  });
});

describe('C-5 bus and history', () => {
  it('counts the bus files and names the last history page by file name', async () => {
    const d = await project(false);
    put(d, '.loctx/bus/001-1_01.request.yaml', 'kind: verify\n');
    for (const n of ['2026-10-25-0900_c', '2026-10-24-1000_a', '2026-10-25-0100_b'])
      put(d, `.loctx/history/${n}.md`, 'x\n');
    const s = collectStatus(d);
    expect(s.bus).toBe(1);
    expect(s.lastHistory).toBe('2026-10-25-0900_c.md');
    const text = formatStatus(s);
    expect(text).toContain('bus: 1 file');
    expect(text).toContain('last history: 2026-10-25-0900_c.md');
  });

  it('shows 0 and — when there is nothing', async () => {
    const d = await project(false);
    const s = collectStatus(d);
    expect(s.bus).toBe(0);
    expect(s.lastHistory).toBeNull();
  });
});

describe('C-6 --json and text come from one object', () => {
  it('prints the object collectStatus returns, and the text is formatStatus of it', async () => {
    const d = await project();
    intent(d, '001', 'approved', 'accepted', 'reviewed');
    put(d, '.loctx/ticket/001-1_a.md', TICKET('001-1', 'doing'));
    put(d, '.loctx/history/2026-10-25-0100_a.md', 'x\n');
    const data = collectStatus(d);
    const json = JSON.parse(runStatus({ cwd: d, json: true }).stdout) as typeof data;
    expect(json).toEqual(JSON.parse(JSON.stringify(data)));
    expect(runStatus({ cwd: d }).stdout).toBe(formatStatus(data));
    const text = formatStatus(json);
    expect(text).toContain(json.intents[0]!.next);
    expect(text).toContain(json.tickets[0]!.id);
    expect(text).toContain(json.lastHistory!);
  });
});

describe('C-7 read-only, git only', () => {
  it('leaves the whole tree, .loctx/ included, byte for byte as it was', async () => {
    const d = await project();
    intent(d, '001', 'approved', 'accepted', 'reviewed');
    put(d, '.loctx/ticket/001-1_a.md', TICKET('001-1', 'todo', 'asks: ["q"]\n'));
    put(d, '.loctx/ticket/001-2_b.md', TICKET('001-2', 'blocked', 'asks: ["q"]\n'));
    put(d, '.loctx/bus/001-1_01.request.yaml', 'kind: verify\n');
    put(d, '.loctx/history/2026-10-25-0100_a.md', 'x\n');
    const before = treeHash(d);
    collectStatus(d);
    runStatus({ cwd: d, json: true });
    runStatus({ cwd: d });
    expect(treeHash(d)).toBe(before);
  });

  it('exits 2 with a one-line error outside a git repository', () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-status-nogit-'));
    const r = runStatus({ cwd: d });
    expect(r.code).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/^reins status: .*git repository\n$/);
  });
});
