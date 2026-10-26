#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { runCheck, STAGES, type Stage } from './commands/check.js';
import { runInstall, type Tier } from './commands/install.js';
import { runMigrate } from './commands/migrate.js';
import { acceptKnowledge, dismissKnowledge, proposeKnowledge } from './commands/knowledge.js';
import { formatRetro, runRetro } from './commands/retro.js';
import { runStatus } from './commands/status.js';
import { runUpdate } from './commands/update.js';
import { configureBindings, configureGates } from './commands/configure.js';
import { respondRefusal, runGates, writeResponse } from './commands/gate.js';
import { newIntent, newRequest, newTicket, type NewResult } from './commands/new.js';
import {
  collectMetrics,
  formatMetrics,
  logCheck,
  logGates,
  recordUsage,
} from './commands/metrics.js';
import { repoRoot } from './lib/git.js';
import { defaultsAsker, stdinAsker } from './lib/ask.js';
import { EXIT } from './lib/verdict.js';

// the version npm installed — cli/dist/reins.js sits two levels below package.json
const VERSION = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

const program = new Command()
  .name('reins')
  .description('agent harness — install, migrate, update; check keeps agents inside their roles')
  .version(VERSION)
  .enablePositionalOptions();

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

program
  .command('gate')
  .description(
    'run gates.yaml gates as declared; raw output goes to .loctx/reports/ as T3 evidence',
  )
  .argument('[names...]', 'gates to run (default: the declared order)')
  .option('--ticket <id>', 'name the reports after this ticket')
  .option('--all', 'keep going after a failure')
  .option(
    '--respond',
    'with --ticket: write the bus response for the open verify request (one line per gate on stdout)',
  )
  .option('--json')
  .action(
    (names: string[], o: { ticket?: string; all?: boolean; json?: boolean; respond?: boolean }) => {
      const refusal = o.respond ? respondRefusal(names) : null;
      if (refusal) {
        process.stderr.write(`reins gate: ${refusal}\n`);
        process.exit(2);
      }
      if (o.respond && !o.ticket) {
        process.stderr.write('reins gate: --respond needs --ticket <id>\n');
        process.exit(2);
      }
      const r = runGates({ names, ticket: o.ticket, all: o.all });
      logGates(r.runs, { ticket: o.ticket });
      const resp =
        o.respond && o.ticket && !r.refused
          ? writeResponse(repoRoot(process.cwd()), o.ticket, r.runs)
          : null;
      if (o.json)
        process.stdout.write(`${JSON.stringify(resp ? { ...r, respond: resp } : r, null, 2)}\n`);
      else if (r.refused) process.stderr.write(`reins gate: ${r.refused}\n`);
      else
        for (const g of r.runs)
          process.stdout.write(
            `  ${g.skipped ? '-' : g.exit === 0 ? 'ok' : 'FAIL'} ${g.gate.padEnd(10)} ${g.skipped ?? `exit ${g.exit} → ${g.report}`}\n`,
          );
      if (resp && !o.json) {
        for (const [gate, s] of Object.entries(resp.summaries))
          process.stdout.write(`    ! ${gate}: ${s}\n`);
        if (resp.response) process.stdout.write(`response: ${resp.response} (${resp.verdict})\n`);
        else process.stderr.write(`reins gate: no response written — ${resp.refused}\n`);
      }
      process.exit(r.refused ? 2 : resp?.refused ? 1 : r.runs.every((g) => g.exit === 0) ? 0 : 1);
    },
  );

const done = (r: NewResult) => {
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exit(r.code);
};

const nw = program
  .command('new')
  .description(
    'create an intent, ticket or bus request from the templates (no prompts, never overwrites)',
  );
nw.command('intent')
  .argument('<slug>')
  .option('--version <v>', 'target version')
  .option('--origin <o>', 'user | agent | incident')
  .action((slug: string, o: { version?: string; origin?: string }) =>
    done(newIntent(process.cwd(), slug, o)),
  );
nw.command('ticket')
  .argument('<intent>')
  .argument('<step>', "the plan's order-of-work step")
  .argument('<slug>')
  .option('--title <t>')
  .option('--depends <ids>', 'comma separated ticket ids')
  .option('--role <r>')
  .option('--release <r>', 'planned | stabilization')
  .action(
    (
      intent: string,
      step: string,
      slug: string,
      o: { title?: string; depends?: string; role?: string; release?: string },
    ) => done(newTicket(process.cwd(), intent, step, slug, o)),
  );
nw.command('request')
  .argument('<ticket>')
  .argument('<kind>', 'implement | verify | review | question | stop-report')
  .option('--from <r>')
  .option('--to <r>')
  .action((ticket: string, kind: string, o: { from?: string; to?: string }) =>
    done(newRequest(process.cwd(), ticket, kind, o)),
  );

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

const metrics = program
  .command('metrics')
  .enablePositionalOptions()
  .description(
    'what the loop cost and where it stopped: counts, tokens by role and vendor, per ticket and intent',
  )
  .option('--intent <NNN>', 'only this intent')
  .option('--json')
  .action((o: { intent?: string; json?: boolean }) => {
    const m = collectMetrics({ intent: o.intent });
    process.stdout.write(o.json ? `${JSON.stringify(m, null, 2)}\n` : formatMetrics(m));
  });
metrics
  .command('record')
  .description(
    'append a usage line: tokens a role run used (the caller reports; reins calls no model)',
  )
  .requiredOption('--role <role>', 'a role in bindings.yaml')
  .requiredOption('--tokens <n>', 'whole number ≥ 0')
  .option('--ticket <id>', 'the ticket the run served (fills the intent)')
  .option('--intent <NNN>', 'the intent, when there is no ticket')
  .option('--vendor <v>', 'default: the binding of --role')
  .option('--model <m>', 'default: the binding of --role')
  .option('--note <text>')
  .option('--json')
  .action(
    (o: {
      role: string;
      tokens: string;
      ticket?: string;
      intent?: string;
      vendor?: string;
      model?: string;
      note?: string;
      json?: boolean;
    }) => {
      const r = recordUsage(o);
      if (r.refused) {
        process.stderr.write(`reins metrics record: ${r.refused}\n`);
        process.exit(2);
      }
      const u = r.record!;
      process.stdout.write(
        o.json
          ? `${JSON.stringify(u, null, 2)}\n`
          : `recorded: ${u.role} (${u.vendor}/${u.model}) ${u.tokens} tokens${u.ticket ? ` · ticket ${u.ticket}` : ''}${u.intent ? ` · intent ${u.intent}` : ''}\n`,
      );
    },
  );

program
  .command('retro')
  .description(
    'what repeated: stop ids, review reasons, decisions, failed rounds, tokens; knowledge candidates',
  )
  .option('--release <v>', 'only the intents whose version is v')
  .option('--json')
  .action((o: { release?: string; json?: boolean }) => {
    const r = runRetro({ release: o.release });
    process.stdout.write(o.json ? `${JSON.stringify(r, null, 2)}\n` : formatRetro(r));
  });

const knowledge = program
  .command('knowledge')
  .description('promote a repeated key to a knowledge entry');
const knowledgeDone = (verb: string, r: { path?: string; refused?: string }) => {
  if (r.refused) {
    process.stderr.write(`reins knowledge ${verb}: ${r.refused}\n`);
    process.exit(1);
  }
  process.stdout.write(`${r.path}\n`);
};
knowledge
  .command('propose')
  .description('write a draft to .loctx/knowledge-proposals/ (records no approval)')
  .argument('<key>', 'a retro key (decision:<slug>) or a slug')
  .option('--from <history...>', 'history pages that back it')
  .action((key: string, o: { from?: string[] }) =>
    knowledgeDone('propose', proposeKnowledge(key, o)),
  );
knowledge
  .command('accept')
  .description('after the user approves: write .agents/knowledge/<date>_<slug>.md with approved')
  .argument('<draft>', 'the draft slug')
  .action((draft: string) => knowledgeDone('accept', acceptKnowledge(draft)));
knowledge
  .command('dismiss')
  .description('record that a candidate is not a lesson; it returns when it repeats further')
  .argument('<key>', 'a candidate key as reins retro prints it')
  .requiredOption('--reason <text>', 'why it is not a lesson')
  .action((key: string, o: { reason: string }) =>
    knowledgeDone('dismiss', dismissKnowledge(key, o)),
  );

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
      // S-8: the verdict code is set before anything is printed, so a closed pipe cannot change it
      process.exitCode = EXIT[r.verdict];
      process.stdout.on('error', (e: NodeJS.ErrnoException) => {
        if (e.code === 'EPIPE') process.exit(process.exitCode ?? 0);
        throw e;
      });
      logCheck(r, { ticket: o.ticket });
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
