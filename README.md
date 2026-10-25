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

Version 0.1.0, pre-release, round one of the plan. It is not on npm yet and has no Claude Code
plugin manifest, so `npx @bluenyang/reins` does not work today; build it from source (see
[Quick start](#quick-start-from-source)). Generated vendor files are verified for Claude Code only.

reins develops itself through its own loop. Intent 001 (`reins status`) went intent → spec → plan →
tickets; the checks at T1 to T5 passed, and Codex did the code review. Roles bound to other vendors
ran through their CLIs (`codex exec`, `agy -p`) in that run: the lead agent called them following
the `reins-loop` skill. The CLI does not dispatch to vendors by itself yet.

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

## Quick start from source

Requires Node 20 or later and pnpm.

```sh
git clone https://github.com/bluenyang/reins.git
cd reins
pnpm install
pnpm build
```

Run the CLI from the root of the repository you want to set up. The repository needs at least one
commit (`check` fails on an empty history in 0.1.0):

```sh
node /path/to/reins/cli/dist/reins.js install graph --dry-run   # show what would be written
node /path/to/reins/cli/dist/reins.js install graph --mode auto # place files, detect CLIs, take defaults
node /path/to/reins/cli/dist/reins.js check --drift             # prints "drift: ok" when sources and output match
node /path/to/reins/cli/dist/reins.js status                    # intents, tickets, bus, last history entry
```

`install` refuses over a 3rd or 4th generation harness and points to `migrate`. Hooks are proposed
in the install notes and added only with `--hooks`. Once published, the same commands are meant to
run as `npx @bluenyang/reins <command>`.

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
| `recall` | not implemented | search past decisions by symptom |
| `doctor` | not implemented | — |
| `configure budget\|gates\|language` | not implemented | — |

`install`, `migrate`, `update`, `gate`, `status` and `check` take `--json`. `check` stages map to
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
| 0.1 | graph design, self-install and self-migrate of this repository, the verifier, three skills, README; 0.1.0 is published to npm |
| 0.2 | carve the loop and harness tiers out of the graph; generated files for Codex, Gemini and Cursor; `recall`, `doctor`, budget stops; trial migration of older harnesses |
| 0.3 | Claude Code plugin; application to Team Croffle repositories |
| 1.0 | not scheduled: reins stays on 0.x and gains features until the maintainer considers the system settled; stabilising alone does not make it 1.0 |

## Documents

- [docs/proposal.md](docs/proposal.md): problems, goal, requirements, success criteria
- [docs/design.md](docs/design.md): layout, roles, stop conditions, file formats, CLI
- Korean editions: [proposal.ko.md](docs/proposal.ko.md), [design.ko.md](docs/design.ko.md). Where an English and a Korean edition disagree, the Korean file wins.

## License

MIT
