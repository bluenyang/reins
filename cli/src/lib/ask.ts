import { createInterface } from 'node:readline/promises';

/** Asks questions on a TTY; with piped stdin, answers come from its lines in order (one per question). */
export interface Asker {
  ask(question: string, fallback: string): Promise<string>;
  close(): void;
}

export async function stdinAsker(): Promise<Asker> {
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    return {
      async ask(q, d) {
        const a = (await rl.question(`${q} [${d}] `)).trim();
        return a || d;
      },
      close: () => rl.close(),
    };
  }
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const lines = Buffer.concat(chunks).toString('utf8').split('\n');
  return {
    async ask(q, d) {
      const a = (lines.shift() ?? '').trim();
      process.stderr.write(`${q} [${d}] ${a}\n`);
      return a || d;
    },
    close: () => {},
  };
}

/** Auto mode and tests: every question takes its default. */
export const defaultsAsker: Asker = { ask: async (_q, d) => d, close: () => {} };
