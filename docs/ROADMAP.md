# Roadmap

Korean edition: [ROADMAP.ko.md](ROADMAP.ko.md). Where the two disagree, the Korean file wins.

A version is a bundle of intents. rc.1 means everything planned for the version is done; later rcs only stabilise. An rc is checked by a person, and a stable release is cut only on the maintainer's explicit instruction.

## 0.1 — graph design, self-install and self-migrate

The first target is this repository itself.

| Version | State | Content |
|---|---|---|
| 0.1.0 | published | the verifier (`reins check`), the harness sources (twelve roles, stop conditions, schemas, templates), self-install and `migrate`, generated agent files and `update`, the loop checks and `reins gate`, three entry skills, `reins status`, metrics, the violation scenarios, README in two languages |
| 0.1.1 | done | stabilisation: fixes the loop found in 0.1.0 (drift detection of managed blocks, evidence paths, sealed tests, model id checks, stop id collisions, bus response schema) |
| 0.1.2 | done | Claude Code plugin: `/plugin marketplace add bluenyang/reins`; the plugin carries `reins-setup` only, the other skills are installed into the project |
| 0.1.3 | published | stage skills, release flow, retro and knowledge, loop fixes (below) |
| 0.1.4 | published | readiness for large repositories: release flow as a repository setting, gate discovery in monorepos and Go, migrate ticket ids, carrying memory files on install, `*.env` secrets |
| 0.1.5 | published | enforced versus advised, documents updated with every rc, CI on more platforms (below) |

### 0.1.3

- **Stage skills.** The loop is split into ten skills, one per workflow stage; `reins-loop` stays as the conductor that calls them in order.
- **Release flow.** The publish summary and version sync are corrected, and the deploy role's rc flow is written down as a skill.
- **Retro and knowledge.** Recurring reasons are counted and promoted to knowledge through proposal, approval and commit; `reins recall` is the lookup.
- **Loop fixes.** Tickets and bus requests are created by `reins new` instead of by hand, `--respond` writes the verify response, and `status` no longer asks to close an already released intent.

### 0.1.5

- **Enforced versus advised.** The README promises control, but role permissions, the scope of a change and budgets still rely on the agent's cooperation. Every rule gets one line that says how it is held: blocked by a script or hook, checked at a transition, or written in a role or skill only. The table goes into the README (both editions) and the design document, and the rules that are only advised become the input for 0.2. Model bindings get two layers: the committed `bindings.yaml` is the team default, and a git-ignored `.loctx/bindings.local.yaml` holds each user's overrides and detected vendors; the CLI resolves the model a role actually runs on, instead of the skill text asking the agent to fall back.
- **Documents with every rc.** An rc ends up on the default branch, so its documents should be current there too: the roadmap state, the CHANGELOG section and the README status line move in the same release PR as the code, and T5 warns when they still describe the previous state.
- **CI on more platforms.** The package declares Node 20 or later, but CI runs only Ubuntu with Node 24. CI runs `pnpm check` on Node 20, 22 and 24 and on Windows and macOS as well, and what fails there is fixed in the same version.

## 0.2 — restructure the loop, carve the loop and harness out of the graph, heterogeneous agents

Input: the metrics recorded in 0.1, and an incident in a repository that uses reins. There an agent skipped the harness entirely: no intent, ticket, approval, review or history, and model bindings bypassed, while pre-commit passed every commit. The cause was structural, not a missing rule: entering the loop, the transition checks, the approval record, the review and the record all depended on the controlled agent calling them itself.

Order set by the maintainer (revised 2026-10-28): **restructuring the loop comes first**, then readiness for adoption, enforcement, budgets and vendors, and the carving last, when its figures exist. No 0.3 rollout before 0.2.1–0.2.3 are done.

| Version | State | Content |
|---|---|---|
| 0.2.0 | rc; stable on the maintainer's instruction | `reins config` TUI (models and roles, local or team scope, roles on and off), install and update as screens |
| 0.2.1 | planned | loop enforcement: reins owns the unit of work and its transitions, a commit without a unit of work stops, agent runtime hooks, approvals redesigned, records written by the CLI, the easy tier |
| 0.2.2 | planned | work tiers and the docs loop: common and complex tiers, one approval per bundle, an evidence-first docs loop, independent review as a closing condition, re-checks at merge and release |
| 0.2.3 | planned | discussion and leadership: a discussion stage before the roadmap, PM and PL lead together, cross-checks between PLs |
| 0.2.4 | planned | readiness for adoption: release documents before the merge also for stable, Python gate discovery, migrate splitting work into intents per version, a `.loctx` retention policy and `reins prune` |
| 0.2.5 | planned | remaining enforcement: the `.env` read block, push, PR, merge and release by the deploy role only (C6), changes outside the plan (C10), T1 refusing tickets of a role that is off |
| 0.2.6 | planned | budgets and T6: budget stops E1–E3 from `metrics.jsonl`, `configure budget`, the interruption record (G1) and F1 |
| 0.2.7 | planned | heterogeneous agents: generated files and runtime hooks for Codex, Gemini (Antigravity) and Cursor with drift checks; the command line each role runs on its vendor |
| 0.2.8 | planned | carving: loop and harness tiers cut out of the graph by cost and stop figures; `reins recall`, `reins doctor`, `configure language`; rehearsed migration of older harness generations |

For 0.2.1–0.2.3 the design (`docs/design.md` and its Korean edition) changes first, then the code: principle 1 (portability kept apart from independent verification), principle 2 (state-based rules), principle 3 (scripts own execution, transitions and evidence), §4 approval format, §6 generated files, §8 record inputs. "The CLI never calls a model" stays.

### 0.2.1 — loop enforcement

- **reins owns the unit of work.** The CLI records the active unit of work and its transitions; hooks, T2, T4, T5 and CI read the same state. Reading and analysis that write nothing to the repository need no unit.
- **A commit without a unit of work stops.** T2 checks the active unit, a valid approval and the scope of the change. Review is required when the unit closes, not at every commit.
- **Agent runtime hooks.** The hooks design §6 named but generation never wrote: state injected at session start and on each prompt; before a tool call, writes without a unit, subagents other than `reins-*` or on a model other than the binding, and approval writes by the agent are refused; a unit cannot end without its review. Claude Code in this version; other vendors in 0.2.7.
- **Approvals redesigned.** An approval is only `reins approve`, which runs after the person allows it in the permission prompt. The proof is tied to the revision, scope, person and time it approves; old trailers cannot be reused. Delegated acceptance (spec summaries) uses its own `Accepted-by:`.
- **The CLI writes the record.** The CLI and hooks append the start, commits, refusals, review and close of each unit; a commit without a unit is recorded as `off-loop` and counted by retro. Agents write only the history narrative, from that record. On close the CLI checks that the history summary exists and deletes the unit's bus files; today agents are meant to delete them, and the bus files of closed tickets piled up.
- **The easy tier.** A small change opens a unit with one command, and the request itself is the permission. A report afterwards, an independent review and the user's veto remain. It ships with the enforcement: a stop with only the heavy path available pushes agents to go around it.

### 0.2.2 — work tiers and the docs loop

- **easy / common / complex.** The agent only proposes the tier. The CLI checks it at T2 and at close against objective signals (files and paths changed, schema, harness or public API changes, diff size) and raises it on a mismatch; the user can change it at any time. complex is today's intent → spec → plan → ticket; common is lighter.
- **One approval per bundle.** An approval is given once per intent and plan; parallel tickets inherit it.
- **The docs loop.** Verifying a document means finding evidence: scope and audience → claims extracted → each claim tied to evidence (code path:line, test, commit, knowledge) → another model locates the evidence again → defects found on the way go to a ledger and tickets → polishing last.
- **Independent review closes a unit.** Configuration picks the reviewer and reins records the run (vendor, model, commit reviewed). A review on the author's model does not close the unit; without another vendor, another model reviews and the run is recorded as "degraded independence".
- **Re-checks at merge and release.** T4, T5 and PR CI check approval, review and the final diff again. The enforcement table names the vendors each rule holds on and the ways around it.

### 0.2.3 — discussion and leadership

- **A discussion stage.** Requirements do not arrive ready; they emerge as people explain and discuss. A discussion stage comes before the roadmap: ideas, options, grounds, and what was accepted, rejected or deferred and why. Rejections feed C8, and a similar topic later brings the record back up.
- **PM and PL lead together.** Simple work: the PM alone. Complex work: the PM weighs the views of several PLs, each of which takes exploration and research from other agents. Agents may propose other directions, methods and possibilities before following the user's instruction; the user accepts or rejects.
- **Cross-checks between PLs.** On complex work the PLs judge independently without seeing each other's results; the user sees each view and where they differ. Scores surface disagreement and never decide on their own.

### 0.2.4 — readiness for adoption

- **Release documents before the merge, also for stable.** A docs-only stable PR (intent `released`, CHANGELOG `[V]` with its date, roadmap row, README status line) is merged before the stable dispatch. The publish workflow accepts stable when everything changed since the last rc tag is a `release.docs` file or the version's intent status, instead of requiring HEAD to be that tag.
- **Python gates.** Gate discovery finds `pytest`, `pyproject.toml` and `requirements.txt` projects (proposals, as for subdirectories).
- **Migrate per version.** `migrate` splits open work into one draft intent per version instead of a single intent 000.
- **A `.loctx` retention policy.** A policy file gives each path its lifetime (until its unit closes, until the version's stable, permanent) and `reins prune` applies it: `--dry-run` lists, deleting asks first. Gate logs go once the version's stable is out; history, metrics and the release ledger are permanent. Paths reins did not create (another skill's workspace) are listed, never deleted.

### 0.2.5 — remaining enforcement

The advised rules from 0.1.5 (the [table](../README.md#enforced-versus-advised), source [`enforcement.yaml`](../harness/policy/enforcement.yaml)) that 0.2.1–0.2.2 do not cover become enforced: the `.env` read block (examples stay readable), C6, the plan comparison of C10, and T1 refusing a ticket whose role is off. The table moves with each rule.

### 0.2.7 — the CLI still calls no model

The design invariant stays (maintainer, 2026-10-28): reins generates each vendor's files and runtime hooks and prints the exact command line a role runs on its vendor; the agent runs it. reins does not start vendor CLIs itself.

## 0.3 — rollout

- Application to Team Croffle repositories, repository by repository with the owner's permission.
- Migration of the remaining `.ai/` harnesses.

## 1.0 — not scheduled

reins stays on 0.x and gains features until the maintainer considers the system settled; stabilising alone does not make it 1.0. Until then the file formats (schema `@1`) may change in a minor version, and `update` or `migrate` moves existing installs.
