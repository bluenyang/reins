import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInstall } from '../src/commands/install.js';
import { acceptKnowledge, dismissKnowledge, proposeKnowledge } from '../src/commands/knowledge.js';
import { runRetro } from '../src/commands/retro.js';
import { collectStatus } from '../src/commands/status.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { METRICS_FILE } from '../src/lib/metrics.js';
import { driftConvention } from '../src/commands/check.js';

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

const metric = (o: Record<string, unknown>) =>
  JSON.stringify({ schema: 'reins/metric@1', ts: '2026-10-26T10:00:00+09:00', ...o });
const check = (ticket: string | undefined, verdict: string, reasons: string[]) =>
  metric({
    kind: 'check',
    stage: 'pre-commit',
    ...(ticket ? { ticket, intent: ticket.slice(0, 3) } : {}),
    verdict,
    reasons,
    warns: [],
    stops: { intent: 0, knowledge: 0, redline: 0 },
  });
const usage = (ticket: string, role: string, tokens: number) =>
  metric({
    kind: 'usage',
    role,
    vendor: 'v',
    model: 'm',
    tokens,
    ticket,
    intent: ticket.slice(0, 3),
  });
const page = (_n: string, decisions: string, reasons = '') =>
  `decisions: ${decisions}\n${reasons ? `reasons: ${reasons}\n` : ''}\n# x\n`;
const INTENT = (id: string, version: string) =>
  `---\nid: "${id}"\nslug: s${id}\nversion: ${version}\nstatus: released\norigin: user\napprovals: []\n---\n## x\n`;

async function fixture(): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-retro-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  await runInstall({
    tier: 'graph',
    mode: 'auto',
    asker: defaultsAsker,
    cwd: d,
    detectVendors: onlyClaude,
  });
  put(d, '.agents/intent/001_a/intent.md', INTENT('001', '0.1.3'));
  put(d, '.agents/intent/002_b/intent.md', INTENT('002', '0.2.0'));
  put(
    d,
    METRICS_FILE,
    [
      check('001-1', 'STOP', ['F2']),
      check('001-1', 'STOP', ['F2']), // same ticket twice: counts once as a key
      check('002-1', 'HOLD', ['F2']),
      check(undefined, 'CONTINUE', []),
      usage('001-1', 'implementer', 100),
      usage('002-1', 'implementer', 40),
    ].join('\n') + '\n',
  );
  put(
    d,
    '.loctx/history/2026-10-26-1000_001-1-x.md',
    page('a', 'quote-values, only-here', 'slow-gate'),
  );
  put(d, '.loctx/history/2026-10-26-1001_001-1-y.md', page('b', 'quote-values')); // same ticket
  put(d, '.loctx/history/2026-10-26-1100_002-1-z.md', page('c', 'quote-values', 'slow-gate'));
  return d;
}

describe('reins retro', () => {
  it('counts stops, failed rounds, tokens and per-axis candidates (C-1)', async () => {
    const d = await fixture();
    const r = runRetro({ cwd: d });
    expect(r.stops).toEqual({ F2: 3 });
    expect(r.failedRounds).toEqual({ HOLD: 1, STOP: 2 });
    expect(r.tokens.byRole).toEqual({ implementer: 140 });
    const keys = Object.fromEntries(r.keys.map((k) => [k.key, k.units]));
    expect(keys['stop:F2']).toEqual(['001-1', '002-1']);
    expect(keys['decision:quote-values']).toEqual(['001-1', '002-1']);
    expect(keys['reason:slow-gate']).toEqual(['001-1', '002-1']);
    expect(keys['decision:only-here']).toEqual(['001-1']);
    expect(r.candidates.map((c) => c.key).toSorted()).toEqual([
      'decision:quote-values',
      'reason:slow-gate',
      'stop:F2',
    ]);
  });

  it('--release narrows to the intents of that version (C-2)', async () => {
    const d = await fixture();
    const r = runRetro({ cwd: d, release: '0.1.3' });
    expect(r.stops).toEqual({ F2: 2 });
    expect(r.failedRounds).toEqual({ HOLD: 0, STOP: 2 });
    expect(r.tokens.total).toBe(100);
    expect(r.candidates).toEqual([]); // one ticket only
  });

  it('drops keys of active knowledge, not of superseded (C-3), and status agrees (C-4)', async () => {
    const d = await fixture();
    const entry = (status: string) =>
      `---\nid: e\nkind: decision\nstatus: ${status}\nsupersedes: null\ntopics: []\ndecisions: [quote-values]\nsymptoms: [slow-gate]\napplies_to: all\nsource: x\napproved: { by: user, at: 2026-10-26 }\n---\n## x\n`;
    put(d, '.agents/knowledge/2026-10-26_e.md', entry('active'));
    expect(runRetro({ cwd: d }).candidates.map((c) => c.key)).toEqual(['stop:F2']);
    expect(collectStatus(d).knowledgeCandidates).toBe(1);
    put(d, '.agents/knowledge/2026-10-26_e.md', entry('superseded'));
    expect(runRetro({ cwd: d }).candidates).toHaveLength(3);
    expect(collectStatus(d).knowledgeCandidates).toBe(3);
  });
});

describe('noise', () => {
  it('tool-written pages and ticketless records are not units', async () => {
    const d = await fixture();
    put(d, '.loctx/history/2026-10-26-1200_update-graph.md', 'decisions: update-graph\n\n# x\n');
    put(d, '.loctx/history/2026-10-26-1201_update-graph.md', 'decisions: update-graph\n\n# x\n');
    put(d, '.loctx/history/2026-10-26-1202_a.md', 'decisions: marked\nsource: tool\n');
    put(d, '.loctx/history/2026-10-26-1203_b.md', 'decisions: marked\nsource: tool\n');
    put(d, '.loctx/history/2026-10-26-1204_c.md', 'decisions: plain\n');
    put(d, '.loctx/history/2026-10-26-1205_d.md', 'decisions: plain\n');
    put(
      d,
      METRICS_FILE,
      [check(undefined, 'STOP', ['Z9']), check(undefined, 'STOP', ['Z9'])].join('\n') + '\n',
    );
    const keys = runRetro({ cwd: d }).candidates.map((c) => c.key);
    expect(keys).toContain('decision:plain'); // untagged ticketless pages still count, one each
    expect(keys).not.toContain('decision:update-graph');
    expect(keys).not.toContain('decision:marked');
    expect(keys).not.toContain('stop:Z9');
    put(d, '.loctx/history/2026-10-26-1300_003-1-t.md', 'decisions: tk\nsource: tool\n');
    put(d, '.loctx/history/2026-10-26-1301_004-1-t.md', 'decisions: tk\nsource: tool\n');
    expect(runRetro({ cwd: d }).candidates.map((c) => c.key)).not.toContain('decision:tk');
    expect(runRetro({ cwd: d }).stops).toEqual({ Z9: 2 });
  });
});

describe('reins knowledge', () => {
  it('propose writes only a draft; accept writes an approved entry and removes it (C-5)', async () => {
    const d = await fixture();
    const p = proposeKnowledge('decision:quote-values', { cwd: d });
    expect(p.path).toBe('.loctx/knowledge-proposals/quote-values.md');
    expect(existsSync(join(d, '.agents/knowledge/2026-10-26_x.md'))).toBe(false);
    const draft = readFileSync(join(d, p.path!), 'utf8');
    expect(draft).not.toMatch(/^approved:/m);
    expect(draft).toMatch(/^decisions: \[quote-values\]/m);
    expect(draft).toMatch(/2026-10-26-1000_001-1-x\.md/);
    const a = acceptKnowledge('quote-values', { cwd: d });
    expect(a.path).toMatch(/^\.agents\/knowledge\/\d{4}-\d{2}-\d{2}_quote-values\.md$/);
    const text = readFileSync(join(d, a.path!), 'utf8');
    expect(text).toMatch(/^approved: \{ by: user, at: \d{4}-\d{2}-\d{2} \}$/m);
    expect(existsSync(join(d, p.path!))).toBe(false);
  });

  it('refuses without records or twice', async () => {
    const d = await fixture();
    expect(proposeKnowledge('nothing-here', { cwd: d }).refused).toMatch(/no record/);
    const ok = '2026-10-26-1000_001-1-x.md';
    expect(proposeKnowledge('quote-values', { cwd: d, from: ['h.md'] }).refused).toMatch(
      /not a page/,
    );
    expect(proposeKnowledge('quote-values', { cwd: d, from: ['../../x.md'] }).refused).toMatch(
      /not a page/,
    );
    expect(
      proposeKnowledge('slow-gate', { cwd: d, from: [ok, '2026-10-26-1001_001-1-y.md'] }).refused,
    ).toMatch(/does not contain/);
    expect(existsSync(join(d, '.loctx/knowledge-proposals'))).toBe(false);
    const p = proposeKnowledge('quote-values', {
      cwd: d,
      from: [ok, '.loctx/history/2026-10-26-1100_002-1-z.md'],
    });
    expect(p.path).toBeDefined();
    expect(readFileSync(join(d, p.path!), 'utf8')).toMatch(/1100_002-1-z\.md/);
    expect(proposeKnowledge('quote-values', { cwd: d, from: [ok] }).refused).toMatch(/exists/);
    expect(acceptKnowledge('absent', { cwd: d }).refused).toMatch(/no draft/);
  });

  it('dismiss: retro and status stop counting a candidate until it repeats further', async () => {
    const d = await fixture();
    expect(dismissKnowledge('stop:F2', { cwd: d }).refused).toMatch(/--reason/);
    expect(dismissKnowledge('decision:only-here', { cwd: d, reason: 'r' }).refused).toMatch(
      /not a current candidate/,
    );
    const r = dismissKnowledge('stop:F2', { cwd: d, reason: 'a dependency wait, not a lesson' });
    expect(r.path).toBe('.loctx/knowledge-proposals/dismissed.jsonl');
    const after = runRetro({ cwd: d });
    expect(after.candidates.map((c) => c.key)).not.toContain('stop:F2');
    expect(after.dismissed.map((c) => c.key)).toEqual(['stop:F2']);
    expect(collectStatus(d).knowledgeCandidates).toBe(2);
    expect(dismissKnowledge('stop:F2', { cwd: d, reason: 'again' }).refused).toMatch(
      /not a current candidate/,
    );
    // a third ticket stops on F2: the key is back
    const m = readFileSync(join(d, METRICS_FILE), 'utf8');
    put(d, METRICS_FILE, `${m}${check('002-2', 'STOP', ['F2'])}\n`);
    expect(runRetro({ cwd: d }).candidates.map((c) => c.key)).toContain('stop:F2');
  });

  it('a knowledge entry without approved stops the convention check (C-6)', async () => {
    const d = await fixture();
    const body = (extra: string) =>
      `---\nid: e\nkind: decision\nstatus: active\nsupersedes: null\ntopics: []\ndecisions: [x]\napplies_to: all\nsource: some.md\n${extra}---\n## x\n`;
    put(d, '.agents/knowledge/2026-10-26_e.md', body(''));
    const f = driftConvention(d).filter((x) => x.path === '.agents/knowledge/2026-10-26_e.md');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ reason: 'F2', verdict: 'STOP' });
    put(d, '.agents/knowledge/2026-10-26_e.md', body('approved: { by: user, at: 2026-10-26 }\n'));
    expect(driftConvention(d).filter((x) => x.path?.startsWith('.agents/knowledge/'))).toEqual([]);
  });
});
