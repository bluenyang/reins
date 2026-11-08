#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { runInstall, type Tier } from './commands/install.js';
import { runMigrate } from './commands/migrate.js';
import { formatUpdate, runUpdate } from './commands/update.js';
import { configureBindings, configureGates } from './commands/configure.js';
import { runConfig } from './commands/config.js';
import { stateLabel } from './lib/bindings.js';
import { defaultsAsker, stdinAsker } from './lib/ask.js';
import { clackPrompter, isInteractive } from './lib/prompter.js';

// the version npm installed — cli/dist/reins.js sits two levels below package.json
const VERSION = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

// every command: a reader that went away (`| head`) ends the run quietly with the exit code already set
process.stdout.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EPIPE') process.exit(process.exitCode ?? 0);
  throw e;
});

const program = new Command()
  .name('reins')
  .description(
    'manages an agent harness — install, migrate, update, config; never called while a project works',
  )
  .version(VERSION)
  .enablePositionalOptions();

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
      // screens only on a terminal, in manual mode, without --json; otherwise the line-based questions
      const screens = o.mode === 'manual' && !o.json && isInteractive();
      const asker = o.mode === 'auto' || screens ? defaultsAsker : await stdinAsker();
      const r = await runInstall({
        tier: tier as Tier,
        mode: o.mode,
        hooks: o.hooks,
        dryRun: o.dryRun,
        asker,
        prompter: screens ? await clackPrompter() : undefined,
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
      if (r.cancelled) {
        process.stdout.write('reins install: cancelled — nothing was written\n');
        process.exit(0);
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
  .option('--legacy <where>', 'local (.loctx/_legacy/) | committed (.agents/legacy/)', 'local')
  .option('--dry-run', 'show the moves without touching anything')
  .option('--json')
  .action(
    async (
      tier: string,
      o: { mode: 'manual' | 'auto'; legacy: string; dryRun?: boolean; json?: boolean },
    ) => {
      if (!['local', 'committed'].includes(o.legacy)) {
        process.stderr.write(
          `reins migrate: --legacy must be local or committed (got "${o.legacy}")\n`,
        );
        process.exit(2);
      }
      if (!['harness', 'loop', 'graph'].includes(tier)) {
        process.stderr.write(
          `reins migrate: tier must be harness, loop or graph (got "${tier}")\n`,
        );
        process.exit(2);
      }
      const asker = o.mode === 'auto' || o.dryRun ? defaultsAsker : await stdinAsker();
      const r = await runMigrate({
        tier: tier as Tier,
        mode: o.mode,
        dryRun: o.dryRun,
        legacy: o.legacy as 'local' | 'committed',
        asker,
      });
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
  .option('--yes', 'do not ask for confirmation')
  .option('--json')
  .action(async (o: { dryRun?: boolean; yes?: boolean; json?: boolean }) => {
    // on a terminal, show the plan and ask first (design §9); otherwise run as before
    const confirm = !o.yes && !o.dryRun && !o.json && isInteractive();
    const r = await runUpdate({
      dryRun: o.dryRun,
      prompter: confirm ? await clackPrompter() : undefined,
      show: (plan) => process.stdout.write(formatUpdate(plan, true)),
    });
    if (o.json) {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      process.exit(r.refused ? 2 : 0);
    }
    if (r.refused) {
      process.stderr.write(`reins update: ${r.refused}\n`);
      process.exit(2);
    }
    if (r.declined) {
      process.stdout.write('reins update: not applied — nothing was written\n');
      process.exit(0);
    }
    process.stdout.write(formatUpdate(r, !!o.dryRun));
  });

program
  .command('config')
  .description('settings screen on a terminal; the resolved bindings table otherwise')
  .option('--json', 'print the resolved bindings as JSON (no screen)')
  .action(async (o: { json?: boolean }) => {
    process.exit(await runConfig({ json: o.json }));
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
  .option('--local', 'with --set: write your own override to .loctx/bindings.local.yaml')
  .option('--disable <roles...>', 'switch roles off (pm, implementer and verify-tool cannot be)')
  .option('--enable <roles...>', 'switch roles on again')
  .option('--show', 'print what each role actually runs on')
  .option('--json')
  .action(
    async (o: {
      set?: string[];
      vendors?: string;
      json?: boolean;
      local?: boolean;
      show?: boolean;
      disable?: string[];
      enable?: string[];
    }) => {
      const asker =
        !o.set && !o.vendors && !o.local && !o.show && !o.disable && !o.enable
          ? await stdinAsker()
          : undefined;
      const r = await configureBindings({
        local: o.local,
        show: o.show,
        set: o.set,
        disable: o.disable,
        enable: o.enable,
        vendors: o.vendors?.split(',').map((s) => s.trim()),
        asker,
      });
      asker?.close();
      if (o.json) {
        process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        process.exit(r.refused ? (r.code ?? 2) : 0);
      }
      if (r.refused) {
        process.stderr.write(`reins configure bindings: ${r.refused}\n`);
        process.exit(r.code ?? 2);
      }
      if (o.show || o.local) {
        for (const t of r.resolved ?? [])
          process.stdout.write(
            `  ${r.changed.includes(t.role) ? '*' : ' '} ${t.role.padEnd(12)} ${t.vendor.padEnd(7)} ${t.model} (${t.source}: ${t.reason})${stateLabel(t) ? ` ${stateLabel(t)}` : ''}\n`,
          );
      } else
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
    },
  );

configure
  .command('gates')
  .description('subdirectory gate proposals not in gates.yaml; --add <name>… appends them')
  .option('--add <names...>', 'proposal names to append after the existing gates')
  .option('--json')
  .action((o: { add?: string[]; json?: boolean }) => {
    const r = configureGates({ add: o.add });
    if (o.json) {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      process.exit(r.code ?? 0);
    }
    if (r.refused) {
      process.stderr.write(`reins configure gates: ${r.refused}\n`);
      process.exit(r.code ?? 2);
    }
    for (const n of r.added) process.stdout.write(`added: ${n}\n`);
    if (!r.available.length) process.stdout.write('no more proposals\n');
    for (const g of r.available) process.stdout.write(`  ${g.name}  ${g.cmd}   (${g.from})\n`);
  });

program.parseAsync(process.argv);
