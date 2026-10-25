#!/usr/bin/env node
import { Command } from 'commander';
import { runCheck, type CheckOptions } from './commands/check.js';
import { EXIT } from './lib/verdict.js';

const program = new Command()
  .name('reins')
  .description('agent harness — install, migrate, update; check keeps agents inside their roles')
  .version('0.1.0');

const notYet = (name: string) => () => {
  process.stderr.write(`reins ${name}: not implemented yet (see docs/design.md §11)\n`);
  process.exit(2);
};

for (const n of ['install', 'migrate', 'update', 'configure', 'recall', 'status', 'doctor'])
  program.command(n).allowUnknownOption().allowExcessArguments().action(notYet(n));

program
  .command('check')
  .description('harness verifier: --stage pre-commit|pre-push|test|rc-close, or --drift')
  .option('--stage <stage>')
  .option('--drift')
  .option('--json')
  .action(async (o: { stage?: CheckOptions['stage']; drift?: boolean; json?: boolean }) => {
    let pushRefs: string[] = [];
    if (o.stage === 'pre-push' && !process.stdin.isTTY) {
      const chunks: Buffer[] = [];
      for await (const c of process.stdin) chunks.push(c as Buffer);
      pushRefs = Buffer.concat(chunks).toString('utf8').split('\n').filter(Boolean);
    }
    const r = runCheck({ stage: o.stage, drift: o.drift, pushRefs });
    if (o.json) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    else {
      process.stdout.write(`${r.summary}\n`);
      for (const f of r.findings)
        process.stdout.write(
          `  [${f.reason} ${f.verdict}] ${f.path ? `${f.path}: ` : ''}${f.message}${f.resume ? `\n      → ${f.resume}` : ''}\n`,
        );
    }
    process.exit(EXIT[r.verdict]);
  });

program.parseAsync(process.argv);
