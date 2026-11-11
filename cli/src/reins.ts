#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { runInstall } from './commands/install.js';
import { runMigrate } from './commands/migrate.js';
import { formatUpdate, runUpdate } from './commands/update.js';
import { configureBindings, configureGates } from './commands/configure.js';
import { NotARepository } from './lib/git.js';
import { LOCAL_DELEGATION_NOTE } from './lib/local-delegation.js';
import { formatBindings, runConfig } from './commands/config.js';
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
  .description(
    'install the harness: settings, roles, stage skills, AGENTS.md blocks, hook proposals',
  )
  .option('--mode <mode>', 'manual (ask) | auto (detect and apply defaults)', 'manual')
  .option(
    '--hooks',
    'add the project gate commands to existing husky hooks (otherwise only proposed)',
  )
  .option('--dry-run', 'show what would be written')
  .option('--json')
  .action(
    async (o: { mode: 'manual' | 'auto'; hooks?: boolean; dryRun?: boolean; json?: boolean }) => {
      // screens only on a terminal, in manual mode, without --json; otherwise the line-based questions
      const screens = o.mode === 'manual' && !o.json && isInteractive();
      const asker = o.mode === 'auto' || screens ? defaultsAsker : await stdinAsker();
      const r = await runInstall({
        mode: o.mode,
        hooks: o.hooks,
        dryRun: o.dryRun,
        asker,
        prompter: screens ? await clackPrompter() : undefined,
        confirmHooks: !o.json && !o.dryRun && isInteractive() ? await clackPrompter() : undefined,
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
      process.stdout.write(`reins install — generation before: ${r.generation}\n`);
      process.stdout.write(
        `${verb}: ${a.created.length} new, ${a.changed.length} changed; ${a.unchanged.length} already up to date\n`,
      );
      for (const p of a.created) process.stdout.write(`  + ${p}\n`);
      for (const p of a.changed) process.stdout.write(`  ~ ${p}\n`);
      for (const n of r.notes) process.stdout.write(`• ${n}\n`);
    },
  );

program
  .command('migrate')
  .description('move an existing harness or .ai/ workspace onto the reins layout')
  .option('--mode <mode>', 'manual | auto', 'manual')
  .option('--legacy <where>', 'local (.loctx/_legacy/) | committed (.agents/legacy/)', 'local')
  .option('--dry-run', 'show the moves without touching anything')
  .option('--json')
  .action(
    async (o: { mode: 'manual' | 'auto'; legacy: string; dryRun?: boolean; json?: boolean }) => {
      if (!['local', 'committed'].includes(o.legacy)) {
        process.stderr.write(
          `reins migrate: --legacy must be local or committed (got "${o.legacy}")\n`,
        );
        process.exit(2);
      }
      const asker = o.mode === 'auto' || o.dryRun ? defaultsAsker : await stdinAsker();
      const r = await runMigrate({
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
      process.stdout.write(`reins migrate — from ${r.generation}${o.dryRun ? ' (dry run)' : ''}\n`);
      process.stdout.write(
        o.dryRun
          ? `would move ${r.moves.length} files\n`
          : `moved ${by('moved')} · converted ${by('converted')} · identical ${by('same')} · kept both ${by('kept-both')}\n`,
      );
      if (o.dryRun)
        for (const m of r.moves)
          process.stdout.write(
            `  ${m.action === 'move' ? ' ' : m.action[0]} ${m.from} → ${m.to}\n`,
          );
      for (const n of r.report) process.stdout.write(`• ${n}\n`);
    },
  );

program
  .command('update')
  .description(
    're-apply the packaged harness; ask before overwriting hand-edited files; move 0.x installs to 0.3',
  )
  .option('--dry-run', 'show what would change')
  .option('--yes', 'do not ask for confirmation (also deletes the listed 0.x working files)')
  .option('--force', 'overwrite generated files edited by hand')
  .option('--json')
  .action(async (o: { dryRun?: boolean; yes?: boolean; force?: boolean; json?: boolean }) => {
    // on a terminal, show the plan and ask first (design §9); otherwise run as before
    const confirm = !o.yes && !o.dryRun && !o.json && isInteractive();
    const r = await runUpdate({
      dryRun: o.dryRun,
      force: o.force,
      yes: o.yes,
      prompter: confirm ? await clackPrompter() : undefined,
      show: (plan) => process.stdout.write(formatUpdate(plan, true)),
    });
    if (o.json) {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      process.exit(r.refused ? 2 : r.handEdited.length && !o.dryRun ? 1 : 0);
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
    if (r.handEdited.length && !o.dryRun) process.exit(1);
  });

const config = program
  .command('config')
  .alias('configure')
  .description('settings: models and roles, agent tools, mode, audit; a screen on a terminal');

config
  .command('screen', { isDefault: true, hidden: true })
  .option('--json', 'print the effective settings as JSON (no screen)')
  .action(async (o: { json?: boolean }) => {
    process.exit(await runConfig({ json: o.json }));
  });

config
  .command('bindings')
  .description('change the model assignment without a screen')
  .option('--set <pairs...>', 'default|<group>|<group>.<role>=<model> or =<vendor>:<model>')
  .option('--models <pairs...>', '<pl|advisor>=<model>,<model>,… (several models)')
  .option('--off <groups...>', 'switch groups off (the PM does their work)')
  .option(
    '--fallback <pairs...>',
    '<group>|<group>.<role>=<model>|none — what to call when that model cannot be called',
  )
  .option('--mode <mode>', 'single | multi')
  .option('--audit <state>', 'on | off — the per-version audit')
  .option('--tools <pairs...>', '<tool>=on|off')
  .option('--detect', 'detect the agent tools again')
  .option('--local', 'write your own override to .loctx/bindings.local.yaml')
  .option('--show', 'print the effective settings')
  .option('--json')
  .action(
    async (o: {
      set?: string[];
      models?: string[];
      off?: string[];
      fallback?: string[];
      mode?: string;
      audit?: string;
      tools?: string[];
      detect?: boolean;
      local?: boolean;
      show?: boolean;
      json?: boolean;
    }) => {
      if (o.mode && o.mode !== 'single' && o.mode !== 'multi') {
        process.stderr.write(`reins config bindings: --mode must be single or multi\n`);
        process.exit(1);
      }
      if (o.audit && o.audit !== 'on' && o.audit !== 'off') {
        process.stderr.write(`reins config bindings: --audit must be on or off\n`);
        process.exit(1);
      }
      const r = await configureBindings({
        set: o.set,
        models: o.models,
        off: o.off,
        fallback: o.fallback,
        mode: o.mode as 'single' | 'multi' | undefined,
        audit: o.audit as 'on' | 'off' | undefined,
        tools: o.tools,
        detect: o.detect,
        local: o.local,
        show: o.show,
      });
      if (o.json) {
        process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        process.exit(r.refused ? (r.code ?? 2) : 0);
      }
      if (r.refused) {
        process.stderr.write(`reins config bindings: ${r.refused}\n`);
        process.exit(r.code ?? 2);
      }
      if (r.doc) process.stdout.write(`${formatBindings(r.doc)}\n`);
      if (!o.show)
        process.stdout.write(
          r.changed.length ? `changed: ${r.changed.join(', ')}\n` : 'no change\n',
        );
      if (r.localDelegation)
        process.stdout.write(`• ${LOCAL_DELEGATION_NOTE(r.localDelegation)}\n`);
      if (r.modeChanged)
        process.stdout.write(
          '• AGENTS.md has a mode-changed note — the PM checks the project sections in the next conversation\n',
        );
      const g = r.generated;
      if (g) {
        for (const p of g.written) process.stdout.write(`  ~ ${p}\n`);
        for (const p of g.removed) process.stdout.write(`  - ${p}\n`);
        for (const x of g.refused) process.stdout.write(`• left alone ${x.path}: ${x.why}\n`);
      }
    },
  );

config
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
      process.stderr.write(`reins config gates: ${r.refused}\n`);
      process.exit(r.code ?? 2);
    }
    for (const n of r.added) process.stdout.write(`added: ${n}\n`);
    if (!r.available.length) process.stdout.write('no more proposals\n');
    for (const g of r.available) process.stdout.write(`  ${g.name}  ${g.cmd}   (${g.from})\n`);
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  if (!(e instanceof NotARepository)) throw e;
  // no stack trace for a folder that is not a repository: say what to do (spec 019 ST-8)
  process.stderr.write(
    `reins ${process.argv[2] ?? ''}: ${e.message}\n`.replace(/^reins : /, 'reins: '),
  );
  process.exit(2);
});
