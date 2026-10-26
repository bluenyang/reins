import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compound,
  failureSummary,
  openVerifyRequest,
  runGates,
  writeResponse,
} from '../src/commands/gate.js';
import { readEvidence } from '../src/commands/stages.js';
import { parse } from 'yaml';
import { loadSchemas, validateFile } from '../src/lib/schema.js';

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

  it('flags an absolute evidence path outside the repository, existing or not', () => {
    const d = project('gates: {}\n');
    const gone = join(tmpdir(), 'reins-no-such-dir', 'e.log');
    expect(readEvidence(d, gone).map((e) => [e.source, e.outside])).toEqual([[gone, true]]);
  });

  it('judges parent traversal by whole path components', () => {
    const d = project('gates: {}\n');
    mkdirSync(join(d, '..reports'), { recursive: true });
    writeFileSync(join(d, '..reports', 'e.log'), '$ x\nok\nexit 0\n');
    const [e] = readEvidence(d, join(d, '..reports', 'e.log'));
    expect(e?.outside).toBeUndefined();
    expect(e?.exit).toBe(0);
  });

  it('refuses unknown gate names', () => {
    const d = project('gates:\n  check: { cmd: "node -v" }\n');
    expect(runGates({ cwd: d, names: ['nope'] }).refused).toContain('unknown gate: nope');
  });

  describe('--respond', () => {
    const GATES =
      'gates:\n  ok: { cmd: "node -e \\"console.log(1)\\"" }\n  bad: { cmd: "node -e \\"console.error(\'AssertionError: boom at src/x.ts:12:3\');process.exit(1)\\"" }\norder: [ok, bad]\n';
    function withBus(gates: string, bus: Record<string, string>): string {
      const d = project(gates);
      cpSync(join(process.cwd(), 'harness/schemas'), join(d, '.agents/harness/schemas'), {
        recursive: true,
      });
      mkdirSync(join(d, '.loctx/bus'), { recursive: true });
      for (const [f, kind] of Object.entries(bus))
        writeFileSync(
          join(d, `.loctx/bus/${f}`),
          kind === 'response' ? 'x: 1\n' : `kind: ${kind}\n`,
        );
      return d;
    }
    const validResponse = (d: string, rel: string) => {
      const v = loadSchemas(join(d, '.agents/harness')).get('bus-response')!;
      const text = readFileSync(join(d, rel), 'utf8');
      expect(validateFile(v, rel, true, text)).toEqual([]);
      return parse(text) as Record<string, unknown>;
    };

    it('picks the newest verify request without a response', () => {
      const d = withBus('gates: {}\n', {
        '001-1_01.request.yaml': 'verify',
        '001-1_01.response.yaml': 'response',
        '001-1_02.request.yaml': 'implement',
        '001-1_03.request.yaml': 'verify',
        '001-1_04.request.yaml': 'review',
        '001-2_05.request.yaml': 'verify',
      });
      expect(openVerifyRequest(d, '001-1')).toBe('001-1_03');
      expect(openVerifyRequest(d, '009-1')).toBeNull();
    });

    it('writes a passing, schema-valid response that cites the reports', () => {
      const d = withBus('gates:\n  ok: { cmd: "node -v" }\n', {
        '001-1_01.request.yaml': 'verify',
      });
      const { runs } = runGates({ cwd: d, ticket: '001-1' });
      const r = writeResponse(d, '001-1', runs);
      expect(r.response).toBe('.loctx/bus/001-1_01.response.yaml');
      const y = validResponse(d, r.response!);
      expect(y).toMatchObject({
        request: '001-1_01',
        verdict: 'pass',
        may_proceed: true,
        evidence: '.loctx/reports/001-1_ok.log',
      });
    });

    it('a failing gate gives fail, no proceed, a summary, and the raw report in full', () => {
      const d = withBus(GATES, { '001-1_01.request.yaml': 'verify' });
      const { runs } = runGates({ cwd: d, ticket: '001-1' });
      const r = writeResponse(d, '001-1', runs);
      const y = validResponse(d, r.response!);
      expect(y).toMatchObject({ verdict: 'fail', may_proceed: false });
      expect(r.summaries['bad']).toContain('AssertionError');
      expect(r.summaries['bad']).toContain('src/x.ts:12');
      expect(readFileSync(join(d, '.loctx/reports/001-1_bad.log'), 'utf8')).toBe(
        '$ node -e "console.error(\'AssertionError: boom at src/x.ts:12:3\');process.exit(1)"\nAssertionError: boom at src/x.ts:12:3\nexit 1\n',
      );
    });

    it('without an open verify request it writes nothing', () => {
      const d = withBus('gates:\n  ok: { cmd: "node -v" }\n', {
        '001-1_01.request.yaml': 'verify',
        '001-1_01.response.yaml': 'response',
      });
      const { runs } = runGates({ cwd: d, ticket: '001-1' });
      const r = writeResponse(d, '001-1', runs);
      expect(r.response).toBeUndefined();
      expect(r.refused).toContain('no open kind: verify request');
      expect(existsSync(join(d, '.loctx/bus/001-1_02.response.yaml'))).toBe(false);
    });

    it('summarises a failure as signature plus file:line', () => {
      expect(failureSummary('$ x\nsome noise\nError: bad thing\n  at src/a.ts:3:1\nexit 1\n')).toBe(
        'Error: bad thing @ src/a.ts:3:1',
      );
    });
  });
});
