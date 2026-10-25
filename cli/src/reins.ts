#!/usr/bin/env node
import { Command } from 'commander';
import { runCheck, STAGES, type Stage } from './commands/check.js';
import { runInstall, type Tier } from './commands/install.js';
import { runMigrate } from './commands/migrate.js';
import { runStatus } from './commands/status.js';
import { runUpdate } from './commands/update.js';
import { configureBindings } from './commands/configure.js';
import { runGates } from './commands/gate.js';
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

program
  .command('migrate')
  .description('move an existing harness or .ai/ workspace onto the reins layout')
  .argument('<tier>', 'harness | loop | graph')
  .option('--mode <mode>', 'manual | auto', 'manual')
  .option('--dry-run', 'show the moves without touching anything')
  .option('--json')
  .action(
    async (tier: string, o: { mode: 'manual' | 'auto'; dryRun?: boolean; json?: boolean }) => {
      if (!['harness', 'loop', 'graph'].includes(tier)) {
        process.stderr.write(
          `reins migrate: tier must be harness, loop or graph (got "${tier}")\n`,
        );
        process.exit(2);
      }
      const asker = o.mode === 'auto' || o.dryRun ? defaultsAsker : await stdinAsker();
      const r = await runMigrate({ tier: tier as Tier, mode: o.mode, dryRun: o.dryRun, asker });
      asker.close();
      if (o.json) {
        process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        process.exit(r.refused ? 2 : 0);
      }
      if (r.refused) {
        process.stderr.write(`reins migrate: ${r.refused}\n`);
        process.exit(2);
      }
      const by = (k: string) => r.moves.filter((m) => m.result === k).length;
      process.stdout.write(
        `reins migrate ${tier} — from ${r.generation}${o.dryRun ? ' (dry run)' : ''}\n`,
      );
      process.stdout.write(
        o.dryRun
          ? `would move ${r.moves.length} files\n`
          : `moved ${by('moved')} · tickets ${by('converted')} · identical ${by('same')} · kept both ${by('kept-both')}\n`,
      );
      if (o.dryRun)
        for (const m of r.moves)
          process.stdout.write(
            `  ${m.action === 'move' ? ' ' : m.action[0]} ${m.from} → ${m.to}\n`,
          );
      process.stdout.write(
        `AGENTS.md: swapped ${r.agents.swapped.join(', ') || 'none'}; inserted ${r.agents.inserted.join(', ') || 'none'}\n`,
      );
      for (const n of r.report) process.stdout.write(`• ${n}\n`);
      if (r.history) process.stdout.write(`recorded: ${r.history}\n`);
    },
  );

program
  .command('update')
  .description(
    're-apply the packaged harness: upstream files, managed blocks, vendor files, version pin',
  )
  .option('--dry-run', 'show what would change')
  .option('--json')
  .action(async (o: { dryRun?: boolean; json?: boolean }) => {
    const r = await runUpdate({ dryRun: o.dryRun });
    if (o.json) {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      process.exit(r.refused ? 2 : 0);
    }
    if (r.refused) {
      process.stderr.write(`reins update: ${r.refused}\n`);
      process.exit(2);
    }
    const a = r.install?.applied;
    process.stdout.write(
      `reins update — harness v${r.from} → v${r.to}${o.dryRun ? ' (dry run)' : ''}\n`,
    );
    for (const c of r.changes) process.stdout.write(`  · ${c}\n`);
    if (a) {
      process.stdout.write(
        `${o.dryRun ? 'would write' : 'wrote'}: ${a.created.length} new, ${a.changed.length} changed\n`,
      );
      for (const p of [...a.created, ...a.changed]) process.stdout.write(`  ~ ${p}\n`);
    }
    for (const n of r.overrides)
      process.stdout.write(
        `• block "${n}" is overridden by the project — compare it with the new upstream block\n`,
      );
    for (const n of r.install?.notes.filter((x) => x.startsWith('left alone')) ?? [])
      process.stdout.write(`• ${n}\n`);
    if (r.needsSkill)
      process.stdout.write(
        '• this update needs project sections changed: run /reins-update in your agent\n',
      );
    if (r.install?.history) process.stdout.write(`recorded: ${r.install.history}\n`);
  });

const configure = program.command('configure').description('change project-owned settings');
configure
  .command('bindings')
  .description(
    'bind roles to models: --set role=model … or --vendors claude,openai,…; no options asks',
  )
  .option('--set <pairs...>', 'role=model pairs')
  .option(
    '--vendors <list>',
    'rebuild every role from its defaults for these vendors (comma-separated)',
  )
  .option('--json')
  .action(async (o: { set?: string[]; vendors?: string; json?: boolean }) => {
    const asker = !o.set && !o.vendors ? await stdinAsker() : undefined;
    const r = await configureBindings({
      set: o.set,
      vendors: o.vendors?.split(',').map((s) => s.trim()),
      asker,
    });
    asker?.close();
    if (o.json) {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      process.exit(r.refused ? 2 : 0);
    }
    if (r.refused) {
      process.stderr.write(`reins configure bindings: ${r.refused}\n`);
      process.exit(2);
    }
    for (const t of r.table)
      process.stdout.write(
        `  ${r.changed.includes(t.role) ? '*' : ' '} ${t.role.padEnd(12)} ${t.vendor.padEnd(7)} ${t.model}\n`,
      );
    process.stdout.write(r.changed.length ? `changed: ${r.changed.join(', ')}\n` : 'no change\n');
    const g = r.generated;
    if (g) {
      for (const p of g.written) process.stdout.write(`  ~ ${p}\n`);
      for (const p of g.removed) process.stdout.write(`  - ${p}\n`);
      for (const x of g.refused) process.stdout.write(`• left alone ${x.path}: ${x.why}\n`);
    }
  });

program
  .command('gate')
  .description(
    'run gates.yaml gates as declared; raw output goes to .loctx/reports/ as T3 evidence',
  )
  .argument('[names...]', 'gates to run (default: the declared order)')
  .option('--ticket <id>', 'name the reports after this ticket')
  .option('--all', 'keep going after a failure')
  .option('--json')
  .action((names: string[], o: { ticket?: string; all?: boolean; json?: boolean }) => {
    const r = runGates({ names, ticket: o.ticket, all: o.all });
    if (o.json) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    else if (r.refused) process.stderr.write(`reins gate: ${r.refused}\n`);
    else
      for (const g of r.runs)
        process.stdout.write(
          `  ${g.skipped ? '-' : g.exit === 0 ? 'ok' : 'FAIL'} ${g.gate.padEnd(10)} ${g.skipped ?? `exit ${g.exit} → ${g.report}`}\n`,
        );
    process.exit(r.refused ? 2 : r.runs.every((g) => g.exit === 0) ? 0 : 1);
  });

program
  .command('status')
  .description('where the project stands: harness, intents, tickets, bus, last history (read-only)')
  .option('--json')
  .action((o: { json?: boolean }) => {
    const r = runStatus({ json: o.json });
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exit(r.code);
  });

for (const n of ['recall', 'doctor'])
  program.command(n).allowUnknownOption().allowExcessArguments().action(notYet(n));

program
  .command('check')
  .description(`harness verifier: --stage ${STAGES.join('|')}, or --drift`)
  .option(
    '--stage <stage>',
    'T1 ticket-start · T2 pre-commit · T3 verdict · T4 pre-push · T5 rc-close',
  )
  .option('--ticket <id>', 'ticket-start, verdict: the ticket id')
  .option('--release <version>', 'rc-close: the version the rc closes')
  .option('--drift')
  .option('--json')
  .action(
    async (o: {
      stage?: string;
      ticket?: string;
      release?: string;
      drift?: boolean;
      json?: boolean;
    }) => {
      if (o.stage && !(STAGES as readonly string[]).includes(o.stage)) {
        process.stderr.write(`reins check: unknown stage "${o.stage}" (${STAGES.join(', ')})\n`);
        process.exit(2);
      }
      const stage = o.stage as Stage | undefined;
      let pushRefs: string[] = [];
      if (stage === 'pre-push' && !process.stdin.isTTY) {
        const chunks: Buffer[] = [];
        for await (const c of process.stdin) chunks.push(c as Buffer);
        pushRefs = Buffer.concat(chunks).toString('utf8').split('\n').filter(Boolean);
      }
      const r = runCheck({ stage, drift: o.drift, pushRefs, ticket: o.ticket, release: o.release });
      if (o.json) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      else {
        process.stdout.write(`${r.summary}\n`);
        for (const f of r.findings)
          process.stdout.write(
            `  [${f.reason} ${f.verdict}] ${f.path ? `${f.path}: ` : ''}${f.message}${f.resume ? `\n      → ${f.resume}` : ''}\n`,
          );
      }
      process.exit(EXIT[r.verdict]);
    },
  );

program.parseAsync(process.argv);
