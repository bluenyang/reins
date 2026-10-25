import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../lib/git.js';
import { harnessDir, readYaml } from '../lib/harness.js';

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
