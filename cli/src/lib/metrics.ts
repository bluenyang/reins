import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { redLines, stops } from './harness.js';

/** Metrics live next to the other local evidence; one JSON object per line (design §3, intent 002). */
export const METRICS_FILE = '.loctx/reports/metrics.jsonl';
export const METRIC_SCHEMA = 'reins/metric@1';

export interface StopCounts {
  intent: number;
  knowledge: number;
  redline: number;
}

interface Base {
  schema: typeof METRIC_SCHEMA;
  ts: string;
}

export interface CheckMetric extends Base {
  kind: 'check';
  stage: string;
  ticket?: string;
  intent?: string;
  verdict: string;
  reasons: string[];
  warns: string[];
  stops: StopCounts;
}

export interface GateMetric extends Base {
  kind: 'gate';
  ticket?: string;
  intent?: string;
  gate: string;
  exit: number | null;
  report: string;
}

export interface UsageMetric extends Base {
  kind: 'usage';
  role: string;
  vendor: string;
  model: string;
  tokens: number;
  ticket?: string;
  intent?: string;
  note?: string;
}

export type Metric = CheckMetric | GateMetric | UsageMetric;
/** A record before `appendMetric` stamps schema and ts. */
export type NewMetric =
  | Omit<CheckMetric, 'schema' | 'ts'>
  | Omit<GateMetric, 'schema' | 'ts'>
  | Omit<UsageMetric, 'schema' | 'ts'>;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local time to the second, with the UTC offset: `2026-10-25T14:03:07+09:00`. */
export function localIso(d = new Date()): string {
  const off = -d.getTimezoneOffset();
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
  );
}

/** The intent number is the first three characters of a ticket id (`002-1` → `002`). */
export function intentOf(ticket: string | undefined): string | undefined {
  return ticket ? ticket.slice(0, 3) : undefined;
}

/** Fill `intent` from `ticket` and put the shared keys first. */
function stamp(rec: NewMetric): Metric {
  const { ticket, intent, ...rest } = rec as NewMetric & { ticket?: string; intent?: string };
  const out: Record<string, unknown> = { schema: METRIC_SCHEMA, ts: localIso(), ...rest };
  if (ticket) out['ticket'] = ticket;
  const i = ticket ? intentOf(ticket) : intent;
  if (i) out['intent'] = i;
  return out as unknown as Metric;
}

/**
 * Appends one line to the metrics file. A repository without `.loctx/` is skipped, and a write
 * error never escapes: the exit code and output of `check` and `gate` do not depend on metrics.
 * Returns whether a line was written.
 */
export function appendMetric(root: string, rec: NewMetric): boolean {
  try {
    if (!existsSync(join(root, '.loctx'))) return false;
    const file = join(root, METRICS_FILE);
    mkdirSync(join(root, '.loctx', 'reports'), { recursive: true });
    appendFileSync(file, `${JSON.stringify(stamp(rec))}\n`);
    return true;
  } catch {
    return false;
  }
}

const strs = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const opt = (v: unknown) => v === undefined || typeof v === 'string';

function valid(o: unknown): o is Metric {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  if (r['schema'] !== METRIC_SCHEMA || typeof r['ts'] !== 'string') return false;
  if (!opt(r['ticket']) || !opt(r['intent'])) return false;
  switch (r['kind']) {
    case 'check': {
      const s = r['stops'] as Record<string, unknown> | undefined;
      return (
        typeof r['stage'] === 'string' &&
        typeof r['verdict'] === 'string' &&
        strs(r['reasons']) &&
        strs(r['warns']) &&
        !!s &&
        ['intent', 'knowledge', 'redline'].every((k) => Number.isInteger(s[k]))
      );
    }
    case 'gate':
      return typeof r['gate'] === 'string' && typeof r['report'] === 'string';
    case 'usage':
      return (
        typeof r['role'] === 'string' &&
        typeof r['vendor'] === 'string' &&
        typeof r['model'] === 'string' &&
        Number.isInteger(r['tokens']) &&
        (r['tokens'] as number) >= 0
      );
    default:
      return false;
  }
}

/** Reads every line; lines that are not a valid record are counted, not fatal. */
export function readMetrics(root: string): { records: Metric[]; broken: number } {
  const file = join(root, METRICS_FILE);
  const records: Metric[] = [];
  let broken = 0;
  if (!existsSync(file)) return { records, broken };
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return { records, broken };
  }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const o: unknown = JSON.parse(line);
      if (valid(o)) records.push(o);
      else broken++;
    } catch {
      broken++;
    }
  }
  return { records, broken };
}

/**
 * Counts blocking reason ids by kind. An id found in stops.yaml counts as that stop's kind
 * (so C1 and C2 are knowledge stops); otherwise an id in common-red-lines.yaml is a redline;
 * an id in neither is not counted and stays in `reasons` only. Each distinct id counts once.
 */
export function classify(reasons: string[], harness: string | null): StopCounts {
  const out: StopCounts = { intent: 0, knowledge: 0, redline: 0 };
  if (!harness) return out;
  let kinds = new Map<string, 'intent' | 'knowledge'>();
  let lines = new Set<string>();
  try {
    kinds = new Map(stops(harness).map((s) => [s.id, s.kind]));
    lines = new Set(redLines(harness).map((r) => r.id));
  } catch {
    return out;
  }
  for (const id of new Set(reasons)) {
    const k = kinds.get(id);
    if (k) out[k]++;
    else if (lines.has(id)) out.redline++;
  }
  return out;
}

export interface TicketRow {
  ticket: string;
  intent: string;
  tokens: number;
  checks: number;
  knowledgeStops: number;
}

export interface IntentRow {
  intent: string;
  tokens: number;
  checks: number;
  stops: StopCounts;
  tickets: number;
  /** null when the intent has no tickets (the ratio is undefined, not zero). */
  knowledgeStopsPerTicket: number | null;
}

export interface Summary {
  counts: { check: number; gate: number; usage: number };
  broken: number;
  tokens: { total: number; byRole: Record<string, number>; byVendor: Record<string, number> };
  tickets: TicketRow[];
  intents: IntentRow[];
}

const sortKeys = (o: Record<string, number>) =>
  Object.fromEntries(Object.entries(o).toSorted(([a], [b]) => a.localeCompare(b)));

export function summarize(
  records: Metric[],
  opts: { intent?: string; broken?: number } = {},
): Summary {
  const rs = opts.intent ? records.filter((r) => r.intent === opts.intent) : records;
  const counts = { check: 0, gate: 0, usage: 0 };
  const byRole: Record<string, number> = {};
  const byVendor: Record<string, number> = {};
  let total = 0;
  const tickets = new Map<string, TicketRow>();
  const intents = new Map<string, IntentRow & { seen: Set<string> }>();
  const intentRow = (i: string) => {
    let row = intents.get(i);
    if (!row) {
      row = {
        intent: i,
        tokens: 0,
        checks: 0,
        stops: { intent: 0, knowledge: 0, redline: 0 },
        tickets: 0,
        knowledgeStopsPerTicket: null,
        seen: new Set(),
      };
      intents.set(i, row);
    }
    return row;
  };
  for (const r of rs) {
    counts[r.kind]++;
    const i = r.intent ? intentRow(r.intent) : undefined;
    let t: TicketRow | undefined;
    if (r.ticket) {
      t = tickets.get(r.ticket);
      if (!t) {
        t = {
          ticket: r.ticket,
          intent: r.intent ?? intentOf(r.ticket)!,
          tokens: 0,
          checks: 0,
          knowledgeStops: 0,
        };
        tickets.set(r.ticket, t);
      }
      i?.seen.add(r.ticket);
    }
    if (r.kind === 'usage') {
      total += r.tokens;
      byRole[r.role] = (byRole[r.role] ?? 0) + r.tokens;
      byVendor[r.vendor] = (byVendor[r.vendor] ?? 0) + r.tokens;
      if (t) t.tokens += r.tokens;
      if (i) i.tokens += r.tokens;
    } else if (r.kind === 'check') {
      if (t) {
        t.checks++;
        t.knowledgeStops += r.stops.knowledge;
      }
      if (i) {
        i.checks++;
        i.stops.intent += r.stops.intent;
        i.stops.knowledge += r.stops.knowledge;
        i.stops.redline += r.stops.redline;
      }
    }
  }
  const intentRows = [...intents.values()]
    .map(({ seen, ...row }) => ({
      ...row,
      tickets: seen.size,
      knowledgeStopsPerTicket:
        seen.size === 0 ? null : Math.round((row.stops.knowledge / seen.size) * 100) / 100,
    }))
    .toSorted((a, b) => a.intent.localeCompare(b.intent));
  return {
    counts,
    broken: opts.broken ?? 0,
    tokens: { total, byRole: sortKeys(byRole), byVendor: sortKeys(byVendor) },
    tickets: [...tickets.values()].toSorted((a, b) => a.ticket.localeCompare(b.ticket)),
    intents: intentRows,
  };
}
