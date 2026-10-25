import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { runInstall } from '../src/commands/install.js';
import { collectMetrics, formatMetrics, recordUsage } from '../src/commands/metrics.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { harnessDir } from '../src/lib/harness.js';
import {
  appendMetric,
  classify,
  METRICS_FILE,
  readMetrics,
  summarize,
} from '../src/lib/metrics.js';

const onlyClaude = () => [
  { name: 'claude' as const, cli: 'claude', detected: true },
  { name: 'openai' as const, cli: 'codex', detected: false },
  { name: 'google' as const, cli: 'agy', detected: false },
  { name: 'cursor' as const, cli: 'cursor-agent', detected: false },
];

const git = (root: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd: root,
    stdio: 'ignore',
  });

function put(root: string, rel: string, text: string) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

/** A git repository with the harness installed (so stops.yaml, red lines and bindings exist). */
async function project(): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-metrics-'));
  git(d, 'init', '-q');
  await runInstall({
    tier: 'graph',
    mode: 'auto',
    asker: defaultsAsker,
    cwd: d,
    detectVendors: onlyClaude,
  });
  git(d, 'commit', '-q', '--allow-empty', '-m', 'init');
  return d;
}

const lines = (d: string) =>
  readFileSync(join(d, METRICS_FILE), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);

describe('classify (S-1)', () => {
  let d: string;
  beforeAll(async () => {
    d = await project();
  });

  it('counts stops.yaml ids by their kind first, then red lines, and ignores the rest', () => {
    const h = harnessDir(d);
    expect(classify(['B3'], h)).toEqual({ intent: 1, knowledge: 0, redline: 0 });
    expect(classify(['F2'], h)).toEqual({ intent: 0, knowledge: 1, redline: 0 });
    expect(classify(['C4'], h)).toEqual({ intent: 0, knowledge: 0, redline: 1 });
    // C2 is in both lists: stops.yaml wins, so it is a knowledge stop
    expect(classify(['C2'], h)).toEqual({ intent: 0, knowledge: 1, redline: 0 });
    expect(classify(['C1'], h)).toEqual({ intent: 0, knowledge: 1, redline: 0 });
    expect(classify(['ZZ9'], h)).toEqual({ intent: 0, knowledge: 0, redline: 0 });
    expect(classify(['B3', 'B3', 'F2', 'C4', 'C2', 'ZZ9'], h)).toEqual({
      intent: 1,
      knowledge: 2,
      redline: 1,
    });
  });

  it('counts nothing when there is no harness to read', () => {
    expect(classify(['B3', 'C4'], null)).toEqual({ intent: 0, knowledge: 0, redline: 0 });
  });
});

describe('appendMetric / readMetrics (S-1, C-1, C-2)', () => {
  it('writes nothing in a repository without .loctx/', () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-metrics-bare-'));
    expect(appendMetric(d, { kind: 'gate', gate: 'lint', exit: 0, report: 'x.log' })).toBe(false);
    expect(existsSync(join(d, '.loctx'))).toBe(false);
  });

  it('appends one JSON line per record, shared keys first, intent from the ticket', () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-metrics-w-'));
    mkdirSync(join(d, '.loctx'));
    expect(
      appendMetric(d, {
        kind: 'gate',
        ticket: '002-1',
        gate: 'lint',
        exit: 1,
        report: '.loctx/reports/002-1_lint.log',
      }),
    ).toBe(true);
    appendMetric(d, {
      kind: 'usage',
      role: 'pl',
      vendor: 'claude',
      model: 'm',
      tokens: 0,
      intent: '003',
    });
    const [g, u] = lines(d);
    expect(Object.keys(g!)).toEqual([
      'schema',
      'ts',
      'kind',
      'gate',
      'exit',
      'report',
      'ticket',
      'intent',
    ]);
    expect(g).toMatchObject({ schema: 'reins/metric@1', kind: 'gate', intent: '002', exit: 1 });
    expect(g!['ts']).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
    expect(u).toMatchObject({ kind: 'usage', intent: '003', tokens: 0 });
    expect(u).not.toHaveProperty('ticket');
  });

  it('swallows a write error (the metrics file is a directory)', () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-metrics-block-'));
    mkdirSync(join(d, METRICS_FILE), { recursive: true });
    expect(() =>
      appendMetric(d, { kind: 'gate', gate: 'lint', exit: 0, report: 'x' }),
    ).not.toThrow();
    expect(appendMetric(d, { kind: 'gate', gate: 'lint', exit: 0, report: 'x' })).toBe(false);
  });

  it('counts broken lines instead of failing', () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-metrics-r-'));
    put(
      d,
      METRICS_FILE,
      [
        '{"schema":"reins/metric@1","ts":"t","kind":"gate","gate":"a","exit":0,"report":"r"}',
        '{not json',
        '{"schema":"other","kind":"gate"}',
        '{"schema":"reins/metric@1","ts":"t","kind":"usage","role":"pl","vendor":"v","model":"m","tokens":-1}',
        '',
      ].join('\n'),
    );
    const r = readMetrics(d);
    expect(r.records).toHaveLength(1);
    expect(r.broken).toBe(3);
  });
});

describe('recordUsage (S-3, C-3)', () => {
  let d: string;
  beforeAll(async () => {
    d = await project();
  });
  const count = () => (existsSync(join(d, METRICS_FILE)) ? lines(d).length : 0);

  it('fills vendor and model from bindings and the intent from the ticket', () => {
    const r = recordUsage({ cwd: d, role: 'implementer', tokens: '1200', ticket: '002-1' });
    expect(r.refused).toBeUndefined();
    const last = lines(d).at(-1)!;
    expect(last).toMatchObject({
      kind: 'usage',
      role: 'implementer',
      vendor: 'claude',
      model: 'claude-sonnet-5-5',
      tokens: 1200,
      ticket: '002-1',
      intent: '002',
    });
  });

  it('accepts --tokens 0, an intent without a ticket, explicit vendor/model and a note', () => {
    expect(recordUsage({ cwd: d, role: 'pl', tokens: '0' }).refused).toBeUndefined();
    const r = recordUsage({
      cwd: d,
      role: 'pl',
      tokens: '5',
      intent: '003',
      vendor: 'openai',
      model: 'gpt-x',
      note: 'second pass',
    });
    expect(r.refused).toBeUndefined();
    expect(lines(d).at(-1)).toMatchObject({
      vendor: 'openai',
      model: 'gpt-x',
      intent: '003',
      note: 'second pass',
    });
    expect(
      recordUsage({ cwd: d, role: 'pl', tokens: '7', ticket: '002-1', intent: '002' }).refused,
    ).toBeUndefined();
  });

  it('refuses and writes nothing', () => {
    const before = count();
    const bad: Parameters<typeof recordUsage>[0][] = [
      { role: 'nobody', tokens: '5' },
      { role: 'pl', tokens: '-1' },
      { role: 'pl', tokens: '1.5' },
      { role: 'pl', tokens: 'abc' },
      { role: 'pl', tokens: '' },
      { role: 'pl' },
      { tokens: '5' },
      { role: 'pl', tokens: '5', ticket: '002-1', intent: '003' },
      { role: 'pl', tokens: '5', ticket: 'x' },
      { role: 'pl', tokens: '5', intent: '2' },
    ];
    for (const o of bad)
      expect(recordUsage({ cwd: d, ...o }).refused, JSON.stringify(o)).toBeTruthy();
    expect(count()).toBe(before);
  });

  it('refuses without .loctx/', async () => {
    const bare = await project();
    execFileSync('rm', ['-rf', join(bare, '.loctx')]);
    expect(recordUsage({ cwd: bare, role: 'pl', tokens: '1' }).refused).toContain('.loctx');
  });
});

describe('summarize (S-4, C-4)', () => {
  const stamp = { schema: 'reins/metric@1', ts: '2026-10-25T10:00:00+09:00' } as const;
  const usage = (
    role: string,
    vendor: string,
    tokens: number,
    where: { ticket?: string; intent?: string },
  ) => ({ ...stamp, kind: 'usage', role, vendor, model: 'm', tokens, ...where });
  const check = (ticket: string, stops: [number, number, number]) => ({
    ...stamp,
    kind: 'check',
    stage: 'pre-commit',
    ticket,
    intent: ticket.slice(0, 3),
    verdict: 'STOP',
    reasons: [],
    warns: [],
    stops: { intent: stops[0], knowledge: stops[1], redline: stops[2] },
  });
  const rows = [
    usage('pl', 'claude', 100, { ticket: '002-1', intent: '002' }),
    usage('implementer', 'claude', 300, { ticket: '002-1', intent: '002' }),
    usage('code-review', 'openai', 50, { ticket: '002-2', intent: '002' }),
    usage('planner', 'claude', 20, { intent: '003' }),
    check('002-1', [1, 0, 0]),
    check('002-1', [0, 2, 0]),
    check('002-2', [0, 0, 1]),
    {
      ...stamp,
      kind: 'gate',
      ticket: '002-1',
      intent: '002',
      gate: 'lint',
      exit: 0,
      report: 'r',
    },
  ];
  const d = mkdtempSync(join(tmpdir(), 'reins-metrics-sum-'));
  git(d, 'init', '-q');
  mkdirSync(join(d, '.loctx'));
  put(d, METRICS_FILE, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n{broken\n`);
  const { records, broken } = readMetrics(d);

  it('matches the hand calculation', () => {
    const s = summarize(records, { broken });
    expect(s.counts).toEqual({ check: 3, gate: 1, usage: 4 });
    expect(s.broken).toBe(1);
    expect(s.tokens.total).toBe(470);
    expect(s.tokens.byRole).toEqual({ 'code-review': 50, implementer: 300, pl: 100, planner: 20 });
    expect(s.tokens.byVendor).toEqual({ claude: 420, openai: 50 });
    expect(s.tickets).toEqual([
      { ticket: '002-1', intent: '002', tokens: 400, checks: 2, knowledgeStops: 2 },
      { ticket: '002-2', intent: '002', tokens: 50, checks: 1, knowledgeStops: 0 },
    ]);
    expect(s.intents).toEqual([
      {
        intent: '002',
        tokens: 450,
        checks: 3,
        stops: { intent: 1, knowledge: 2, redline: 1 },
        tickets: 2,
        knowledgeStopsPerTicket: 1,
      },
      {
        intent: '003',
        tokens: 20,
        checks: 0,
        stops: { intent: 0, knowledge: 0, redline: 0 },
        tickets: 0,
        knowledgeStopsPerTicket: null,
      },
    ]);
  });

  it('filters by intent', () => {
    const s = summarize(records, { intent: '003', broken });
    expect(s.counts).toEqual({ check: 0, gate: 0, usage: 1 });
    expect(s.tickets).toEqual([]);
    expect(s.intents.map((i) => i.intent)).toEqual(['003']);
    expect(s.tokens.total).toBe(20);
  });

  it('prints the same numbers as text and as JSON, and says so when there is no file', () => {
    const m = collectMetrics({ cwd: d });
    expect(m).toMatchObject({ present: true, intent: null, broken: 1 });
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
    const text = formatMetrics(m);
    expect(text).toContain('check 3 · gate 1 · usage 4 · broken 1');
    expect(text).toContain('knowledge stops per ticket —');
    expect(text).toContain('knowledge stops per ticket 1');
    expect(formatMetrics(collectMetrics({ cwd: d, intent: '003' }))).toContain('intent 003');
    const empty = mkdtempSync(join(tmpdir(), 'reins-metrics-none-'));
    git(empty, 'init', '-q');
    const none = collectMetrics({ cwd: empty });
    expect(none.present).toBe(false);
    expect(formatMetrics(none)).toBe('no metrics yet\n');
  });
});
