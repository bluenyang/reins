import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compound, runGates } from '../src/commands/gate.js';
import { readEvidence } from '../src/commands/stages.js';

function project(gates: string): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-gate-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  mkdirSync(join(d, '.agents/harness/policy'), { recursive: true });
  writeFileSync(join(d, '.agents/harness/gates.yaml'), gates);
  return d;
}

describe('reins gate', () => {
  it('refuses compound commands', () => {
    expect(compound('pnpm test | tail -5')).toBe(true);
    expect(compound('pnpm lint && pnpm test')).toBe(true);
    expect(compound('node -e "a|b"')).toBe(false);
    expect(compound('pnpm check')).toBe(false);
  });

  it('keeps raw output that T3 reads, and stops at the first failure', () => {
    const d = project(
      'gates:\n  ok: { cmd: "node -e \\"console.log(1)\\"" }\n  bad: { cmd: "node -e \\"process.exit(3)\\"" }\n  late: { cmd: "node -v" }\norder: [ok, bad, late]\n',
    );
    const { runs } = runGates({ cwd: d, ticket: '001-1' });
    expect(runs.map((r) => [r.gate, r.exit, r.skipped ?? ''])).toEqual([
      ['ok', 0, ''],
      ['bad', 3, ''],
      ['late', null, 'an earlier gate failed'],
    ]);
    const text = readFileSync(join(d, '.loctx/reports/001-1_ok.log'), 'utf8');
    expect(text).toBe('$ node -e "console.log(1)"\n1\nexit 0\n');
    expect(
      readEvidence(d, '.loctx/reports/001-1_ok.log .loctx/reports/001-1_bad.log').map(
        (e) => e.exit,
      ),
    ).toEqual([0, 3]);
  });

  it('refuses unknown gate names', () => {
    const d = project('gates:\n  check: { cmd: "node -v" }\n');
    expect(runGates({ cwd: d, names: ['nope'] }).refused).toContain('unknown gate: nope');
  });
});
