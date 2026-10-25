import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse } from 'yaml';
import { repoRoot } from '../lib/git.js';
import { harnessVersion, packageHarness } from '../lib/upstream.js';
import { driftGenerated } from '../lib/vendor-write.js';
import { report, type Finding, type Verdict } from '../lib/verdict.js';
import {
  historyPages,
  intentDir,
  intentFile,
  intentIds,
  openTickets,
  type WorkFile,
} from '../lib/work.js';
import { driftConvention, driftFormat, driftMatch } from './check.js';
import { ticketStart } from './stages.js';

const TICKET_STATUSES = ['todo', 'doing', 'blocked', 'done'];

export interface HarnessStatus {
  installed: boolean;
  tier: string | null;
  installedVersion: string | null;
  packageVersion: string | null;
  /** Every drift finding (the same functions `reins check --drift` runs); `reasons` are the distinct ids. */
  drift: { ok: boolean; reasons: string[]; findings: Finding[] };
}

export interface IntentStatus {
  id: string;
  slug: string;
  version: string | null;
  intent: string | null; // status of intent.md, null when the file is missing
  spec: string | null;
  plan: string | null;
  tickets: { open: number; planned: number };
  next: string;
}

export interface TicketStatus {
  id: string;
  path: string;
  status: string | null;
  role: string | null;
  intent: string | null;
  orphan: boolean;
  invalid: boolean;
  asks: string[];
  /** The T1 verdict, for a `todo` ticket only. */
  t1: { verdict: Verdict; reasons: string[] } | null;
  next: string;
}

export interface StatusData {
  harness: HarnessStatus;
  intents: IntentStatus[];
  supersededIntents: number;
  tickets: TicketStatus[];
  bus: number;
  lastHistory: string | null;
}

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
/** Strings and numbers of an array; anything else (objects, null) is dropped, so a malformed value cannot throw. */
const list = (v: unknown) =>
  Array.isArray(v)
    ? v.filter((x) => typeof x === 'string' || typeof x === 'number').map(String)
    : [];
const distinct = (xs: string[]) => [...new Set(xs)];
const mentions = (text: string, id: string) =>
  new RegExp(`(?<![\\w-])${id.replace(/[-]/g, '\\-')}(?![\\w-])`).test(text);

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function harnessStatus(root: string): HarnessStatus {
  const pin = join(root, '.agents', 'harness', 'install.yaml');
  const none = { ok: true, reasons: [], findings: [] };
  if (!existsSync(pin))
    return {
      installed: false,
      tier: null,
      installedVersion: null,
      packageVersion: null,
      drift: none,
    };
  const y = safe(
    () => (parse(readFileSync(pin, 'utf8')) as Record<string, unknown> | null) ?? {},
    {} as Record<string, unknown>,
  );
  const findings = [driftFormat, driftConvention, driftMatch, driftGenerated].flatMap((f) =>
    safe(() => f(root), [] as Finding[]),
  );
  return {
    installed: true,
    tier: str(y['tier']) || null,
    installedVersion: str(y['version']) || null,
    packageVersion: safe(() => harnessVersion(packageHarness()), null),
    drift: {
      ok: findings.length === 0,
      reasons: distinct(findings.map((f) => f.reason)),
      findings,
    },
  };
}

/** The S-3 table: the first row that matches wins. */
export function nextForIntent(s: {
  intent: string | null;
  spec: string | null;
  plan: string | null;
  /** how many open ticket files belong to this intent */
  open: number;
  /** ids of the ticket files that are still open */
  openIds: string[];
  planned: string[];
  history: string[];
  broken: string[];
}): string {
  if (s.intent === 'draft') return 'user: approve the intent';
  if (s.intent === 'approved' && s.spec === null) return 'planner: write spec.md';
  if (s.spec === 'draft') return 'pm + qa-design: review the spec';
  if (s.spec === 'reviewed') return 'user: read summary_for_user (veto or accept)';
  if (s.spec === 'rejected') return 'planner: revise spec.md';
  if (s.spec === 'accepted' && s.plan === null) return 'pl: write plan.md';
  if (s.plan === 'draft') return 'qa-design: review the plan';
  const recorded = (t: string) => s.history.some((h) => mentions(h, t));
  const closed = (t: string) => !s.openIds.includes(t);
  if (s.plan !== null && s.planned.length > 0 && s.planned.every((t) => closed(t) && recorded(t)))
    return 'pm: close the rc (reins check --stage rc-close --release <version>)';
  if (
    (s.plan === 'reviewed' || s.plan === 'active') &&
    s.open === 0 &&
    s.planned.some((t) => closed(t) && !recorded(t))
  )
    return 'pl: create tickets';
  if (s.broken.length > 0) return `invalid frontmatter (F2): ${s.broken.join(', ')}`;
  return '—';
}

function statusOf(f: WorkFile | null): string | null {
  return f ? str(f.data['status']) || '?' : null;
}

function intentsStatus(
  root: string,
  tickets: WorkFile[],
): { intents: IntentStatus[]; superseded: number } {
  const history = safe(() => historyPages(root).map((h) => h.text), [] as string[]);
  const intents: IntentStatus[] = [];
  let superseded = 0;
  for (const id of intentIds(root)) {
    const i = intentFile(root, id, 'intent');
    if (i?.data['status'] === 'superseded') {
      superseded++;
      continue;
    }
    const spec = intentFile(root, id, 'spec');
    const plan = intentFile(root, id, 'plan');
    const planned = list(plan?.data['tickets']);
    const mine = tickets.filter((t) => str(t.data['intent']) === id);
    const open = mine.length;
    const dir = intentDir(root, id);
    intents.push({
      id,
      slug: str(i?.data['slug']) || (dir ? basename(dir).replace(/^\d{3}_?/, '') : ''),
      version: str(i?.data['version']) || null,
      intent: statusOf(i),
      spec: statusOf(spec),
      plan: statusOf(plan),
      tickets: { open, planned: planned.length },
      next: nextForIntent({
        intent: statusOf(i),
        spec: statusOf(spec),
        plan: statusOf(plan),
        open,
        openIds: tickets.map(ticketId),
        planned,
        history,
        broken: [i, spec, plan].filter((f): f is WorkFile => !!f?.error).map((f) => f.path),
      }),
    });
  }
  return { intents, superseded };
}

const fileIdOf = (t: WorkFile) => /^([^_.]+)/.exec(basename(t.path))?.[1] ?? basename(t.path);
const ticketId = (t: WorkFile) => str(t.data['id']) || fileIdOf(t);

/** A ticket that cannot be read; shown as invalid so one bad file never hides the others. */
function invalidTicket(t: WorkFile): TicketStatus {
  return {
    id: ticketId(t),
    path: t.path,
    status: null,
    role: null,
    intent: null,
    orphan: false,
    invalid: true,
    asks: [],
    t1: null,
    next: 'invalid (F2)',
  };
}

function ticketStatus(root: string, t: WorkFile): TicketStatus {
  try {
    return readTicket(root, t);
  } catch {
    return invalidTicket(t);
  }
}

function readTicket(root: string, t: WorkFile): TicketStatus {
  const fileId = fileIdOf(t);
  const id = ticketId(t);
  const status = str(t.data['status']) || null;
  const intent = str(t.data['intent']) || null;
  const role = str(t.data['role']) || null;
  const rawAsks = t.data['asks'];
  const asksOk =
    rawAsks === undefined ||
    rawAsks === null ||
    (Array.isArray(rawAsks) && rawAsks.every((a) => typeof a === 'string'));
  const asks = asksOk ? list(rawAsks) : [];
  const invalid = !!t.error || !asksOk || status === null || !TICKET_STATUSES.includes(status);
  const orphan = !intent || !intentDir(root, intent);
  const base = { id, path: t.path, status, role, intent, orphan, invalid, asks, t1: null };
  if (invalid) return { ...base, next: 'invalid (F2)' };
  if (status === 'todo') {
    const findings = safe(() => ticketStart(root, fileId), [
      { reason: 'F2', verdict: 'STOP', message: 'T1 could not run' },
    ] as Finding[]);
    const r = report('ticket-start', findings);
    const reasons = distinct(findings.filter((f) => f.verdict !== 'WARN').map((f) => f.reason));
    const next =
      r.verdict === 'CONTINUE'
        ? `${role ?? 'implementer'}: start`
        : `T1 ${r.verdict} (${reasons.join(', ')}) — reins check --stage ticket-start --ticket ${fileId}`;
    return { ...base, t1: { verdict: r.verdict, reasons }, next };
  }
  if (status === 'doing') return { ...base, next: `reins check --stage verdict --ticket ${id}` };
  if (status === 'blocked')
    return { ...base, next: `blocked — ${asks.length} open ask${asks.length === 1 ? '' : 's'}` };
  return { ...base, next: 'write history, delete the ticket' };
}

function busCount(root: string): number {
  const dir = join(root, '.loctx', 'bus');
  return existsSync(dir) ? readdirSync(dir).filter((e) => e.endsWith('.yaml')).length : 0;
}

/** Everything `reins status` shows, as plain data. Reads only; never throws on malformed files. */
export function collectStatus(root: string): StatusData {
  const open = safe(() => openTickets(root), [] as WorkFile[]);
  const { intents, superseded } = safe(() => intentsStatus(root, open), {
    intents: [] as IntentStatus[],
    superseded: 0,
  });
  const pages = safe(() => historyPages(root), []);
  return {
    harness: harnessStatus(root),
    intents,
    supersededIntents: superseded,
    tickets: open.map((t) => ticketStatus(root, t)),
    bus: safe(() => busCount(root), 0),
    lastHistory: pages.length ? basename(pages[pages.length - 1]!.path) : null,
  };
}

/** The text view of the same object `--json` prints. */
export function formatStatus(d: StatusData): string {
  const out: string[] = [];
  const h = d.harness;
  if (!h.installed) out.push('harness: not installed — run reins install');
  else
    out.push(
      `harness: ${h.tier ?? '?'} · installed v${h.installedVersion ?? '?'} · package v${h.packageVersion ?? '?'} · drift: ${
        h.drift.ok ? 'ok' : h.drift.reasons.join(', ')
      }${h.drift.ok ? '' : ' (reins check --drift)'}`,
    );
  out.push('');
  out.push('intents:');
  if (d.intents.length === 0) out.push('  none');
  for (const i of d.intents) {
    out.push(
      `  ${i.id} ${i.slug}${i.version ? ` v${i.version}` : ''} — intent: ${i.intent ?? '—'} · spec: ${i.spec ?? '—'} · plan: ${i.plan ?? '—'} · tickets: ${i.tickets.open} open / ${i.tickets.planned} planned`,
    );
    out.push(`    next: ${i.next}`);
  }
  if (d.supersededIntents > 0) out.push(`  (${d.supersededIntents} superseded, hidden)`);
  out.push('');
  out.push('tickets:');
  if (d.tickets.length === 0) out.push('  none open');
  for (const t of d.tickets) {
    out.push(
      `  ${t.id} — ${t.status ?? '?'} · ${t.role ?? '?'} · asks: ${t.asks.length}${t.orphan ? ' · orphan' : ''}`,
    );
    out.push(`    next: ${t.next}`);
    if (t.status === 'blocked' && !t.invalid) for (const a of t.asks) out.push(`      ? ${a}`);
  }
  out.push('');
  out.push(`bus: ${d.bus} file${d.bus === 1 ? '' : 's'}`);
  out.push(`last history: ${d.lastHistory ?? '—'}`);
  return `${out.join('\n')}\n`;
}

export interface StatusRun {
  code: number;
  stdout: string;
  stderr: string;
}

/** `reins status [--json]`: exit 0 anywhere inside a git repository, 2 outside one. */
export function runStatus(opts: { cwd?: string; json?: boolean } = {}): StatusRun {
  let root: string;
  try {
    root = repoRoot(opts.cwd ?? process.cwd());
  } catch {
    return { code: 2, stdout: '', stderr: 'reins status: not inside a git repository\n' };
  }
  const data = collectStatus(root);
  return {
    code: 0,
    stdout: opts.json ? `${JSON.stringify(data, null, 2)}\n` : formatStatus(data),
    stderr: '',
  };
}
