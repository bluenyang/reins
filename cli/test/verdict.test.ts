import { describe, expect, it } from 'vitest';
import { EXIT, report } from '../src/lib/verdict.js';

describe('verdict ranking and exit codes (design §3)', () => {
  it('maps verdicts to the CLI exit contract', () => {
    expect(EXIT).toEqual({ CONTINUE: 0, HOLD: 10, STOP: 20, ESCALATE: 30 });
  });
  it('picks the most demanding finding; HOLD outranks STOP and ESCALATE', () => {
    expect(report('t', []).verdict).toBe('CONTINUE');
    expect(report('t', [{ reason: 'F2', verdict: 'STOP', message: '' }]).verdict).toBe('STOP');
    expect(
      report('t', [
        { reason: 'D1', verdict: 'ESCALATE', message: '' },
        { reason: 'A1', verdict: 'HOLD', message: '' },
        { reason: 'F2', verdict: 'STOP', message: '' },
      ]).verdict,
    ).toBe('HOLD');
  });
});
