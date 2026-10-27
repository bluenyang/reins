# reins

[한국어](docs/README.ko.md)

reins installs, migrates and updates an agent harness for a repository: roles for coding agents, a
loop policy, schema-checked handoff files, a knowledge store and gates. A script, `reins check`,
decides at fixed points whether the loop may continue, so an agent stays inside the role it was
given and does what was specified. People make the gate decisions.

It exists because twelve repositories of BlueNyang and Team Croffle share one harness lineage and
share its problems: agents stepping outside the request, one session that implements and also
judges, knowledge lost in gitignored space, no rule for stopping, copies that drift apart, and a
loop that works only with Claude. The full list (P1–P6) is in [docs/proposal.md](docs/proposal.md).

## Status

Version 0.1.5 is on npm: `npx @bluenyang/reins <command>`. It is round one of the plan — the graph
tier, with generated vendor files verified for Claude Code only; the loop and harness tiers are
carved out of it in 0.2. 0.1.3 split the loop into stage skills with a PR → CI → rc release flow,
0.1.4 prepares large repositories (release settings, monorepo gates, migrate fixes), and 0.1.5
states which rules are enforced and which are only advised, splits model bindings into a team
and a per-user layer, and runs CI on Ubuntu, Windows and macOS with Node 22 and 24. What
changed in each version is in [CHANGELOG.md](CHANGELOG.md); what comes next is in the roadmap.

reins develops itself through its own loop: intents 001 (`reins status`), 002 (`reins metrics`) and
003 (violation scenarios) each went intent → spec → plan → tickets, with the checks at T1 to T5
passing and Codex doing the code review. Roles bound to other vendors ran through their CLIs
(`codex exec`, `agy -p`): the lead agent called them following the `reins-loop` skill. The CLI does
not dispatch to vendors by itself yet.

## The ladder

There are three tiers. Each one contains the one below it, and the tiers share one source.

| Tier | What it has |
|---|---|
| harness | the verifier at commit and push (T2, T4, T6), red lines, generated permissions |
| loop | the plan → work → test → release cycle with fewer roles; same transition points and stop conditions |
| graph | all twelve roles, schema-checked handoff files and per-role model bindings |

`reins install <tier>` takes any of the three. Round one targets the graph tier; the plan is to
carve the loop and harness tiers out of it in 0.2, using measured cost as input.

## How it works

**Roles.** There are twelve: pm, planner, pl, implementer, lookup, verify-tool, code-review,
qa-design, qa-run, deploy, docs and advisor. Each role file lists what the role must not do. Role
separation is not model separation: every role can run on one model, and `bindings.yaml` assigns a
vendor and model per role. By design, a role bound to a vendor that is not detected falls back to its
fallback, else to the pm model, so all twelve roles can run on Claude alone.

**Red lines.** Ten rules (C1–C10) apply to every role, for
example: no implementing "to pass" (C1), no editing managed blocks, policy or roles (C2), no
editing one's own permission file (C3), no reading secrets (C4), no bypassing hooks (C5), and no
push, PR, merge or release outside the deploy role (C6). The list is in [docs/design.md](docs/design.md) section 2. How
each rule is actually held is in [Enforced versus advised](#enforced-versus-advised) below: some are blocked, some are checked at a
transition, and some are only written in a role or skill.

**The verifier.** `reins check` runs at transition points and prints one verdict. It does not call
a model; roles write their judgement to a handoff file and the verifier applies it.

| Verdict | Exit code | Meaning |
|---|---|---|
| CONTINUE | 0 | go on |
| HOLD | 10 | the user must answer |
| STOP | 20 | fixable without a person; the stop records where, why (an id from A1 to G2) and how to resume |
| ESCALATE | 30 | the failure chain: pl → pm → advisor → user |

The 24 stop conditions A1–G2 cover irreversible actions, open decisions, collapsed premises,
repeated failure, cost, rule violations and user interruption.

**The chain and the two human decisions.** Work moves through four files:
`intent.md` → `spec.md` → `plan.md` → tickets. A person decides at two points: the user approves
the intent, and the user may veto the three-to-five-line summary of the spec. Everything else is
reviewed by roles. Verification output is pasted as produced; a bare "passed" is not a pass.

**Layout.**

| Path | Committed | Holds |
|---|---|---|
| `AGENTS.md` | yes | managed blocks written by the tool, project sections written by you |
| `.agents/` | yes | `intent/`, `knowledge/`, `harness/` (roles, policy, schemas, templates, `bindings.yaml`, `gates.yaml`), `skills/` |
| `.claude/` | yes | generated from `.agents/`; do not edit |
| `.loctx/` | no (gitignored) | tickets, reports, handoff `bus/`, `history/`, local roadmap |

## Enforced versus advised

Not every rule is enforced. Each one is held in one of three ways, and `harness/policy/enforcement.yaml` says which, one line per rule.

- **blocked**: a script, hook or permission deny stops the action before it happens.
- **checked**: a transition check, the drift check or CI catches it afterwards.
- **advised**: it is written in a role or skill only; nothing in code catches it.

The grade is the strongest part that really holds, and the `gap` column says what is left open. Hooks apply only when they are installed, and deny rules and agent tool limits exist for Claude Code only. Rule ids are in [docs/design.md](docs/design.md) sections 2 and 3, and the evidence is in [docs/violations.md](docs/violations.md). The advised rules are the input for [0.2](docs/ROADMAP.md).

<!-- enforcement:begin -->
| id | held | by | gap |
|---|---|---|---|
| C1 | advised | `role` | judged by reviewers only; nothing detects a hard-coded pass |
| C2 | blocked | `hook:pre-commit`, `check:drift` | only when the hook is installed; the edit itself is not prevented |
| C3 | blocked | `hook:pre-commit`, `check:drift` | only when the hook is installed; no deny rule covers .claude/settings.json itself |
| C4 | blocked | `deny`, `hook:pre-commit` | Claude Code only; .env.* is a finite list, so names such as .env.custom have no deny rule; the hook sees staged paths, not reads |
| C5 | blocked | `deny`, `gate`, `check:verdict` | combined or later-position forms such as git commit -nm are not denied |
| C6 | advised | `role` | pre-push holds pushes to the default branch (A4) and the deny rules stop force and --no-verify pushes; any other push, PR, merge, release or tag is not blocked |
| C7 | advised | `role` | — |
| C8 | advised | `role` | — |
| C9 | advised | `role` | — |
| C10 | advised | `role` | T2 lists it but the pre-commit check does not compare the diff with plan.md |
| A1 | blocked | `deny`, `hook:pre-push` | moving a published tag forward to a descendant passes the ancestry test |
| A2 | advised | `role` | — |
| A3 | advised | `role` | — |
| A4 | blocked | `hook:pre-push` | only a push to the default branch is held; other ways of leaving the machine are not detected |
| B1 | checked | `check:ticket-start` | — |
| B2 | advised | `role` | — |
| B3 | advised | `role`, `check:ticket-start` | the scope conflict is a role's judgement; ticket-start checks only the approval chain |
| B4 | advised | `role` | — |
| B5 | advised | `role` | — |
| P1 | advised | `role` | — |
| P2 | checked | `check:ticket-start`, `check:rc-close` | only ticket-in-plan; a diff is not compared with plan.md |
| D1 | checked | `check:verdict` | does not tell a ticket before rc.1 from an rc after |
| D2 | advised | `role` | no memory across runs |
| D3 | advised | `role` | no alone-versus-full-run comparison |
| D4 | blocked | `gate`, `check:verdict` | an empty gate output is only a WARN |
| D5 | checked | `check:verdict` | — |
| E1 | advised | `role` | nothing reads a budget or a token count |
| E2 | advised | `role` | nothing reads a budget or a token count |
| E3 | advised | `role` | T5 lists it but nothing reads a budget or a token count |
| F1 | advised | `role` | the deny rules stop some attempts in Claude Code, but no stop is recorded |
| F2 | blocked | `hook:pre-commit`, `check:drift`, `check:ticket-start`, `check:rc-close` | — |
| F3 | advised | `role` | — |
| G1 | advised | `role` | no signal handler and no resume record on an interrupt |
| G2 | advised | `role` | — |
| T1 | checked | `check:ticket-start` | budget-left is not implemented |
| T2 | blocked | `hook:pre-commit` | only when the hook is installed; the P2 and C10 diff checks do not exist |
| T3 | checked | `check:verdict` | — |
| T4 | blocked | `hook:pre-push` | implements A1 and the default-branch push (A4); A2, A3, C6 and the loop-step check do not exist |
| T5 | checked | `check:rc-close` | E3 is not implemented |
| T6 | advised | `role` | no code runs on an interrupt or a violation signal |

| role | blocked | checked | advised | blocked items |
|---|---|---|---|---|
| advisor | 0 | 0 | 2 | — |
| code-review | 1 | 0 | 2 | edit code |
| deploy | 1 | 0 | 2 | force-push, delete or move tags, rewrite main |
| docs | 0 | 0 | 3 | — |
| implementer | 0 | 0 | 5 | — |
| lookup | 3 | 0 | 0 | write any file; produce reports or context files; run gates or tests |
| planner | 0 | 0 | 3 | — |
| pl | 0 | 0 | 3 | — |
| pm | 0 | 1 | 2 | — |
| qa-design | 0 | 0 | 3 | — |
| qa-run | 0 | 0 | 2 | — |
| verify-tool | 0 | 2 | 1 | — |
| budget scopes | 0 | 0 | 6 | — |
<!-- enforcement:end -->

The tables are rendered by `pnpm docs:enforcement` and a test keeps them equal to the YAML.

## Quick start

In Claude Code, install the plugin and let it set the repository up:

```
/plugin marketplace add bluenyang/reins
/plugin install reins@bluenyang
/reins:reins-setup
```

For Codex, Antigravity, Cursor or a plain terminal, use the CLI. It requires Node 22 or later. Run it from the root of the repository you want to set up; the repository
needs at least one commit (`check` fails on an empty history in 0.1.0):

```sh
npx @bluenyang/reins install graph --dry-run   # show what would be written
npx @bluenyang/reins install graph --mode auto # place files, detect CLIs, take defaults
npx @bluenyang/reins check --drift             # prints "drift: ok" when sources and output match
npx @bluenyang/reins status                    # intents, tickets, bus, last history entry
```

`install` refuses over a 3rd or 4th generation harness and points to `migrate`. Hooks are proposed
in the install notes and added only with `--hooks`.

After the install, work goes through the agent: in Claude Code run `/reins-setup` once, then
`/reins-intent` for each new request; Codex, Antigravity and Cursor read the same skills from
`.agents/skills/`. The skills call the CLI themselves.

To work on reins itself: `git clone https://github.com/bluenyang/reins.git`, then `pnpm install`,
`pnpm build`, and run `node cli/dist/reins.js <command>` (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## Commands

| Command | State | Does |
|---|---|---|
| `install <harness\|loop\|graph>` | implemented | places the harness; `--mode manual\|auto`, `--hooks`, `--dry-run`, `--json` |
| `migrate <tier>` | implemented | moves an existing harness or `.ai/` workspace to this layout |
| `update` | implemented | re-applies the packaged harness without touching project sections |
| `configure bindings` | implemented | `--set role=model ...` or `--vendors claude,openai`; no options asks |
| `gate [names...]` | implemented | runs `gates.yaml` as declared and keeps the raw output in `.loctx/reports/` |
| `status` | implemented | read-only view of harness, intents, tickets, bus and last history |
| `check` | implemented | `--stage ticket-start\|pre-commit\|verdict\|pre-push\|rc-close`, or `--drift` |
| `metrics` | implemented | summary of `.loctx/reports/metrics.jsonl`: tokens by role, vendor, ticket and intent, knowledge stops per ticket; `metrics record` adds a role run's tokens |
| `recall` | not implemented | search past decisions by symptom |
| `doctor` | not implemented | — |
| `configure gates` | implemented | lists subdirectory gate proposals; `--add <name>...` appends them to gates.yaml |
| `configure budget\|language` | not implemented | — |

`install`, `migrate`, `update`, `gate`, `status`, `check` and `metrics` take `--json`. Every `check` and `gate` run also appends a line to `.loctx/reports/metrics.jsonl`. `check` stages map to
T1 (`ticket-start`), T2 (`pre-commit`), T3 (`verdict`), T4 (`pre-push`) and T5 (`rc-close`).

## Skills

Ten skills follow the `SKILL.md` standard: `reins-setup` bootstraps, `reins-loop` conducts, and eight stage skills each take one stage and can be called alone.

| Skill | Use when |
|---|---|
| `reins-setup` | installing reins, or moving an existing harness onto it |
| `reins-roadmap` | updating the public roadmap and picking the target version |
| `reins-intent` | a new request arrives: questionnaire and approved intent |
| `reins-spec` | an intent is approved: accepted spec, plan and tickets |
| `reins-implement` | a ticket is ready: implement it in committed units |
| `reins-review` | a ticket is finished: verify, review and close it |
| `reins-test` | all tickets of a version are done: scenarios and build |
| `reins-release` | a version is tested: PR, CI, merge and rc |
| `reins-retro` | a version is released: retrospective and knowledge proposals |
| `reins-loop` | a spec is accepted: calls the stage skills in order |

## Roadmap

The full plan is in [docs/ROADMAP.md](docs/ROADMAP.md) ([한국어](docs/ROADMAP.ko.md)).

## Documents

- [docs/proposal.md](docs/proposal.md): problems, goal, requirements, success criteria
- [docs/design.md](docs/design.md): layout, roles, stop conditions, file formats, CLI
- Korean editions: [proposal.ko.md](docs/proposal.ko.md), [design.ko.md](docs/design.ko.md). Where an English and a Korean edition disagree, the Korean file wins.

## License

MIT
