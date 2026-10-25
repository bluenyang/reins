import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../lib/git.js';
import type { StopReport } from '../lib/verdict.js';
import type { GateRun } from './gate.js';
import { harnessDir, readYaml } from '../lib/harness.js';
import {
  appendMetric,
  classify,
  METRICS_FILE,
  readMetrics,
  summarize,
  type Summary,
  type UsageMetric,
} from '../lib/metrics.js';

interface Bindings {
  roles?: Record<string, { vendor?: string; model?: string }>;
}

export interface UsageOptions {
  role?: string;
  tokens?: string;
  ticket?: string;
  intent?: string;
  vendor?: string;
  model?: string;
  note?: string;
  cwd?: string;
}

export interface UsageResult {
  record?: Omit<UsageMetric, 'schema' | 'ts'>;
  refused?: string;
}

const TICKET = /^\d{3}-\d+$/;
const INTENT = /^\d{3}$/;

/**
 * `reins metrics record` (S-3): one `usage` line for a role run. Anything doubtful is refused
 * and nothing is written — a wrong number in the file is worse than a missing one.
 */
export function recordUsage(o: UsageOptions): UsageResult {
  const root = repoRoot(o.cwd ?? process.cwd());
  if (!o.role) return { refused: '--role <role> is required' };
  if (o.tokens === undefined) return { refused: '--tokens <n> is required' };
  if (!/^\d+$/.test(o.tokens.trim()))
    return { refused: `--tokens must be a whole number ≥ 0 (got "${o.tokens}")` };
  const tokens = Number(o.tokens.trim());
  if (!Number.isSafeInteger(tokens))
    return { refused: `--tokens is too large (got "${o.tokens}")` };
  if (o.ticket !== undefined && !TICKET.test(o.ticket))
    return { refused: `--ticket must look like 002-1 (got "${o.ticket}")` };
  if (o.intent !== undefined && !INTENT.test(o.intent))
    return { refused: `--intent must be three digits like 002 (got "${o.intent}")` };
  if (o.ticket && o.intent && o.ticket.slice(0, 3) !== o.intent)
    return {
      refused: `--ticket ${o.ticket} belongs to intent ${o.ticket.slice(0, 3)}, not ${o.intent}`,
    };
  const dir = harnessDir(root);
  const file = dir && join(dir, 'bindings.yaml');
  if (!file || !existsSync(file)) return { refused: 'no bindings.yaml — run reins install' };
  const roles = readYaml<Bindings>(file).roles ?? {};
  const bound = roles[o.role];
  if (!bound)
    return { refused: `unknown role "${o.role}" (roles: ${Object.keys(roles).join(', ')})` };
  const vendor = o.vendor ?? bound.vendor;
  const model = o.model ?? bound.model;
  if (!vendor || !model)
    return {
      refused: `bindings.yaml has no vendor/model for ${o.role}; pass --vendor and --model`,
    };
  if (!existsSync(join(root, '.loctx'))) return { refused: 'no .loctx/ here — nothing recorded' };
  const record: Omit<UsageMetric, 'schema' | 'ts'> = {
    kind: 'usage',
    role: o.role,
    vendor,
    model,
    tokens,
    ...(o.ticket ? { ticket: o.ticket } : {}),
    ...(!o.ticket && o.intent ? { intent: o.intent } : {}),
    ...(o.note ? { note: o.note } : {}),
  };
  if (!appendMetric(root, record)) return { refused: `could not write ${METRICS_FILE}` };
  return { record };
}

export interface MetricsOptions {
  intent?: string;
  cwd?: string;
}

export interface MetricsResult extends Summary {
  present: boolean;
  intent: string | null;
}

/** `reins metrics` (S-4): read-only. */
export function collectMetrics(o: MetricsOptions = {}): MetricsResult {
  const root = repoRoot(o.cwd ?? process.cwd());
  const present = existsSync(join(root, METRICS_FILE));
  const { records, broken } = readMetrics(root);
  return { present, intent: o.intent ?? null, ...summarize(records, { intent: o.intent, broken }) };
}

const n = (x: number) => x.toLocaleString('en-US');

export function formatMetrics(m: MetricsResult): string {
  if (!m.present) return 'no metrics yet\n';
  const out: string[] = [];
  out.push(`reins metrics${m.intent ? ` — intent ${m.intent}` : ''}`);
  out.push(
    `records: check ${m.counts.check} · gate ${m.counts.gate} · usage ${m.counts.usage} · broken ${m.broken}`,
  );
  out.push(`tokens: ${n(m.tokens.total)}`);
  const group = (title: string, g: Record<string, number>) => {
    out.push(`  ${title}`);
    const rows = Object.entries(g);
    if (!rows.length) out.push('    —');
    for (const [k, v] of rows) out.push(`    ${k.padEnd(14)} ${n(v).padStart(12)}`);
  };
  group('by role', m.tokens.byRole);
  group('by vendor', m.tokens.byVendor);
  out.push('tickets');
  if (!m.tickets.length) out.push('  —');
  for (const t of m.tickets)
    out.push(
      `  ${t.ticket.padEnd(8)} tokens ${n(t.tokens).padStart(10)} · checks ${String(t.checks).padStart(3)} · knowledge stops ${t.knowledgeStops}`,
    );
  out.push('intents');
  if (!m.intents.length) out.push('  —');
  for (const i of m.intents)
    out.push(
      `  ${i.intent.padEnd(8)} tokens ${n(i.tokens).padStart(10)} · checks ${String(i.checks).padStart(3)} · stops intent ${i.stops.intent} / knowledge ${i.stops.knowledge} / redline ${i.stops.redline} · tickets ${i.tickets} · knowledge stops per ticket ${i.knowledgeStopsPerTicket ?? '—'}`,
    );
  return `${out.join('\n')}\n`;
}

const uniq = (xs: string[]) => [...new Set(xs)];

/** The `check` line for a finished run; never throws, never changes the run's result. */
export function logCheck(r: StopReport, o: { ticket?: string; cwd?: string }): void {
  try {
    const root = repoRoot(o.cwd ?? process.cwd());
    const reasons = uniq(r.findings.filter((f) => f.verdict !== 'WARN').map((f) => f.reason));
    const warns = uniq(r.findings.filter((f) => f.verdict === 'WARN').map((f) => f.reason));
    appendMetric(root, {
      kind: 'check',
      stage: r.stage,
      ...(o.ticket ? { ticket: o.ticket } : {}),
      verdict: r.verdict,
      reasons,
      warns,
      stops: classify(reasons, harnessDir(root)),
    });
  } catch {
    // metrics never change what check reports
  }
}

/** One `gate` line per gate that actually ran (skipped and refused runs write nothing). */
export function logGates(runs: GateRun[], o: { ticket?: string; cwd?: string }): void {
  try {
    const root = repoRoot(o.cwd ?? process.cwd());
    for (const g of runs) {
      if (g.exit === null) continue;
      appendMetric(root, {
        kind: 'gate',
        ...(o.ticket ? { ticket: o.ticket } : {}),
        gate: g.gate,
        exit: g.exit,
        report: g.report,
      });
    }
  } catch {
    // metrics never change what gate reports
  }
}
