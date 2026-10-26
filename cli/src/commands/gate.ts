import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../lib/git.js';
import { harnessDir, readYaml } from '../lib/harness.js';
import { loadSchemas, validateFile } from '../lib/schema.js';
import { parse, stringify } from 'yaml';

interface GatesFile {
  gates?: Record<string, { cmd?: string }>;
  order?: string[];
}

export interface GateRun {
  gate: string;
  cmd: string;
  exit: number | null;
  report: string; // relative to the root
  skipped?: string;
}

export interface GateOptions {
  names?: string[];
  ticket?: string;
  /** keep going after a failure (verify-tool stops at the first by default) */
  all?: boolean;
  cwd?: string;
}

/** One command per gate (design §5): no pipes, chains or redirects — anything else is massaged output (C5). */
export function compound(cmd: string): boolean {
  return /[|;&<>`]|\$\(/.test(cmd.replace(/'[^']*'|"[^"]*"/g, ''));
}

/**
 * Runs gates exactly as gates.yaml declares them and keeps the raw output as evidence:
 * `$ <cmd>`, the output untouched, `exit <code>` — the format `check --stage verdict` (T3) reads.
 */
export function runGates(o: GateOptions): { runs: GateRun[]; refused?: string } {
  const root = repoRoot(o.cwd ?? process.cwd());
  const dir = harnessDir(root);
  const path = dir && join(dir, 'gates.yaml');
  if (!path || !existsSync(path)) return { runs: [], refused: 'no gates.yaml — run reins install' };
  const g = readYaml<GatesFile>(path);
  const gates = g.gates ?? {};
  const names = o.names?.length ? o.names : (g.order ?? Object.keys(gates));
  const unknown = names.filter((n) => !gates[n]?.cmd);
  if (unknown.length)
    return {
      runs: [],
      refused: `unknown gate${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')} (gates: ${Object.keys(gates).join(', ')})`,
    };
  const reports = join(root, '.loctx', 'reports');
  mkdirSync(reports, { recursive: true });
  const runs: GateRun[] = [];
  let failed = false;
  for (const name of names) {
    const cmd = gates[name]!.cmd!;
    const report = `.loctx/reports/${o.ticket ?? 'adhoc'}_${name}.log`;
    if (failed && !o.all) {
      runs.push({ gate: name, cmd, exit: null, report, skipped: 'an earlier gate failed' });
      continue;
    }
    if (compound(cmd)) {
      runs.push({ gate: name, cmd, exit: null, report, skipped: 'not a single command (C5)' });
      failed = true;
      continue;
    }
    const r = spawnSync(`${cmd} 2>&1`, { cwd: root, shell: true, encoding: 'utf8' });
    const exit = r.status ?? 1;
    const out = (r.stdout ?? '').replace(/\n?$/, '\n');
    writeFileSync(join(root, report), `$ ${cmd}\n${out}exit ${exit}\n`);
    runs.push({ gate: name, cmd, exit, report });
    if (exit !== 0) failed = true;
  }
  return { runs };
}

/** One line per failing gate for stdout: the first failure signature and the first file:line in the raw report. */
export function failureSummary(report: string): string {
  const lines = report.split('\n').filter((l) => l.trim() && !l.startsWith('$ '));
  const sig =
    lines.find(
      (l) => /\b(error|fail(ed|ure)?|assertion|✗|×)\b/i.test(l) && !/^exit \d+$/.test(l),
    ) ??
    lines.find((l) => !/^exit \d+$/.test(l)) ??
    '';
  const loc = /[\w./-]+\.[a-z]{1,4}:\d+(?::\d+)?/i.exec(lines.join('\n'))?.[0];
  const text = sig.trim().slice(0, 160);
  return [text, loc && !text.includes(loc) ? loc : ''].filter(Boolean).join(' @ ');
}

export interface Respond {
  /** the bus response path (relative), when one was written */
  response?: string;
  /** why none was written */
  refused?: string;
  verdict?: 'pass' | 'fail';
  /** a failure summary per gate that did not pass */
  summaries: Record<string, string>;
}

/** The newest `kind: verify` request of the ticket that has no response yet, as its id (`<ticket>_<nn>`). */
export function openVerifyRequest(root: string, ticket: string): string | null {
  const dir = join(root, '.loctx', 'bus');
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const re = new RegExp(`^(${ticket.replace(/[-.]/g, '\\$&')}_\\d+)\\.request\\.yaml$`);
  const open = files
    .map((f) => re.exec(f)?.[1])
    .filter((id): id is string => !!id && !files.includes(`${id}.response.yaml`))
    .filter((id) => {
      try {
        const y = parse(readFileSync(join(dir, `${id}.request.yaml`), 'utf8')) as {
          kind?: unknown;
        } | null;
        return y?.kind === 'verify';
      } catch {
        return false;
      }
    })
    .sort();
  return open.at(-1) ?? null;
}

/**
 * Writes the bus response for the open verify request from a gate run. The verdict is pass only when every
 * gate ran and exited 0; evidence points at the report files, which keep the raw output (C5).
 */
export function writeResponse(root: string, ticket: string, runs: GateRun[]): Respond {
  const summaries: Record<string, string> = {};
  for (const g of runs) {
    if (g.exit === 0) continue;
    summaries[g.gate] = g.skipped
      ? `not run: ${g.skipped}`
      : failureSummary(readFileSync(join(root, g.report), 'utf8')) || `exit ${g.exit}`;
  }
  const id = openVerifyRequest(root, ticket);
  if (!id)
    return { summaries, refused: `no open kind: verify request for ${ticket} in .loctx/bus/` };
  const pass = runs.length > 0 && runs.every((g) => g.exit === 0);
  const ran = runs.filter((g) => g.exit !== null);
  const body = {
    schema: 'reins/bus/response@1',
    request: id,
    from: 'verify-tool',
    verdict: pass ? 'pass' : 'fail',
    grounds: pass
      ? `${runs.length} gate${runs.length === 1 ? '' : 's'} exited 0`
      : Object.entries(summaries)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ') || 'no gate ran',
    evidence: ran.map((g) => g.report).join(' '),
    may_proceed: pass,
  };
  const hd = harnessDir(root);
  const v = hd ? loadSchemas(hd).get('bus-response') : undefined;
  if (!v) return { summaries, refused: 'no bus-response schema in the harness' };
  const rel = `.loctx/bus/${id}.response.yaml`;
  const content = stringify(body);
  const issues = validateFile(v, rel, true, content);
  if (issues.length)
    return {
      summaries,
      refused: `response would not pass bus-response: ${issues.map((i) => i.message).join('; ')}`,
    };
  writeFileSync(join(root, rel), content, { flag: 'wx' });
  return { response: rel, verdict: body.verdict as 'pass' | 'fail', summaries };
}

/** `--respond` may only answer for the whole declared order, so a pass never rests on a subset of the gates. */
export function respondRefusal(names: string[]): string | null {
  return names.length > 0 ? '--respond runs every declared gate; do not name gates' : null;
}
