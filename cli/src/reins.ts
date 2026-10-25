#!/usr/bin/env node
import { Command } from 'commander';
import { runCheck, type CheckOptions } from './commands/check.js';
import { runInstall, type Tier } from './commands/install.js';
import { defaultsAsker, stdinAsker } from './lib/ask.js';
import { EXIT } from './lib/verdict.js';

const program = new Command()
  .name('reins')
  .description('agent harness — install, migrate, update; check keeps agents inside their roles')
  .version('0.1.0');

const notYet = (name: string) => () => {
  process.stderr.write(`reins ${name}: not implemented yet (see docs/design.md §11)\n`);
  process.exit(2);
};

program
  .command('install')
  .description('install the harness at a tier: harness | loop | graph')
  .argument('<tier>', 'harness | loop | graph')
  .option('--mode <mode>', 'manual (ask) | auto (detect and apply defaults)', 'manual')
  .option('--hooks', 'add the reins check line to existing husky hooks (otherwise only proposed)')
  .option('--dry-run', 'show what would be written')
  .option('--json')
  .action(
    async (
      tier: string,
      o: { mode: 'manual' | 'auto'; hooks?: boolean; dryRun?: boolean; json?: boolean },
    ) => {
      if (!['harness', 'loop', 'graph'].includes(tier)) {
        process.stderr.write(
          `reins install: tier must be harness, loop or graph (got "${tier}")\n`,
        );
        process.exit(2);
      }
      const asker = o.mode === 'auto' ? defaultsAsker : await stdinAsker();
      const r = await runInstall({
        tier: tier as Tier,
        mode: o.mode,
        hooks: o.hooks,
        dryRun: o.dryRun,
        asker,
      });
      asker.close();
      if (o.json) {
        process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        process.exit(r.refused ? 2 : 0);
      }
      if (r.refused) {
        process.stderr.write(`reins install: ${r.refused}\n`);
        process.exit(2);
      }
      const a = r.applied!;
      const verb = o.dryRun ? 'would write' : 'wrote';
      process.stdout.write(`reins install ${tier} — generation before: ${r.generation}\n`);
      process.stdout.write(
        `${verb}: ${a.created.length} new, ${a.changed.length} changed; ${a.unchanged.length} already up to date\n`,
      );
      for (const p of a.created) process.stdout.write(`  + ${p}\n`);
      for (const p of a.changed) process.stdout.write(`  ~ ${p}\n`);
      for (const n of r.notes) process.stdout.write(`• ${n}\n`);
      if (r.history) process.stdout.write(`recorded: ${r.history}\n`);
    },
  );

for (const n of ['migrate', 'update', 'configure', 'recall', 'status', 'doctor'])
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
