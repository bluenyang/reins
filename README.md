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

Version 0.1.0 is on npm: `npx @bluenyang/reins <command>`. It is round one of the plan — the graph
tier, with generated vendor files verified for Claude Code only; the loop and harness tiers are
carved out of it in 0.2. Known issues are listed in [CHANGELOG.md](CHANGELOG.md); their fixes ship
as 0.1.1, and 0.1.2 adds a Claude Code plugin.

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

**Red lines.** Ten rules (C1–C10) apply to every role and are enforced by the verifier, for
example: no implementing "to pass" (C1), no editing managed blocks, policy or roles (C2), no
editing one's own permission file (C3), no reading secrets (C4), no bypassing hooks (C5), and no
push, PR, merge or release outside the deploy role (C6). The list is in [docs/design.md](docs/design.md) section 2.

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

## Quick start

Requires Node 20 or later. Run it from the root of the repository you want to set up; the repository
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
| `configure budget\|gates\|language` | not implemented | — |

`install`, `migrate`, `update`, `gate`, `status`, `check` and `metrics` take `--json`. Every `check` and `gate` run also appends a line to `.loctx/reports/metrics.jsonl`. `check` stages map to
T1 (`ticket-start`), T2 (`pre-commit`), T3 (`verdict`), T4 (`pre-push`) and T5 (`rc-close`).

## Skills

Three skills are the entry points for an agent; they follow the `SKILL.md` standard.

| Skill | Use when |
|---|---|
| `reins-setup` | installing reins, or moving an existing harness onto it |
| `reins-intent` | a new request arrives: questionnaire, approved intent, accepted spec |
| `reins-loop` | a spec is accepted: plan, tickets, implement, verify, review, history |

## Roadmap

| Version | Content |
|---|---|
| 0.1 | graph design, self-install and self-migrate of this repository, the verifier, three skills, metrics, violation scenarios. 0.1.0 published; 0.1.1 stabilisation (fixes the loop found); 0.1.2 Claude Code plugin (marketplace install) |
| 0.2 | carve the loop and harness tiers out of the graph; generated files for Codex, Gemini and Cursor; `recall`, `doctor`, budget stops; trial migration of older harnesses |
| 0.3 | application to Team Croffle repositories |
| 1.0 | not scheduled: reins stays on 0.x and gains features until the maintainer considers the system settled; stabilising alone does not make it 1.0 |

## Documents

- [docs/proposal.md](docs/proposal.md): problems, goal, requirements, success criteria
- [docs/design.md](docs/design.md): layout, roles, stop conditions, file formats, CLI
- Korean editions: [proposal.ko.md](docs/proposal.ko.md), [design.ko.md](docs/design.ko.md). Where an English and a Korean edition disagree, the Korean file wins.

## License

MIT
