/** Verdicts of the harness verifier (design §3). Exit codes are the CLI contract. */
export type Verdict = 'CONTINUE' | 'HOLD' | 'STOP' | 'ESCALATE';

export const EXIT: Record<Verdict, number> = { CONTINUE: 0, HOLD: 10, STOP: 20, ESCALATE: 30 };

/** One finding: a stop-condition id from design §3 plus what to do about it. */
export interface Finding {
  reason: string; // A1..G2, C1..C10, F2 …
  verdict: Exclude<Verdict, 'CONTINUE'>;
  message: string;
  path?: string;
  resume?: string; // how to get past it
}

export interface StopReport {
  schema: 'reins/bus/stop-report@1';
  stage: string;
  verdict: Verdict;
  findings: Finding[];
  summary: string;
}

const RANK: Record<Verdict, number> = { CONTINUE: 0, STOP: 1, ESCALATE: 2, HOLD: 3 };

/** The report's verdict is the most demanding of its findings; HOLD outranks all. */
export function report(stage: string, findings: Finding[]): StopReport {
  let verdict: Verdict = 'CONTINUE';
  for (const f of findings) if (RANK[f.verdict] > RANK[verdict]) verdict = f.verdict;
  const summary =
    findings.length === 0
      ? `${stage}: ok`
      : `${stage}: ${verdict} — ${findings.map((f) => f.reason).join(', ')}`;
  return { schema: 'reins/bus/stop-report@1', stage, verdict, findings, summary };
}
