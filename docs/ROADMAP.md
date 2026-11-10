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

## 0.2 — closed at 0.2.0

| Version | State | Content |
|---|---|---|
| 0.2.0 | published | `reins config` TUI (models and roles, local or team scope, roles on and off), install and update as screens |
| 0.2.1–0.2.8 | cancelled | replaced by 0.3 (maintainer, 2026-11-07) |

The 0.2 plan answered "agents do not follow the harness" by putting reins into the work. Since 0.1.0 skills and git hooks ran `npx @bluenyang/reins`, and the unreleased branch `feat/loop-enforcement` added runtime hooks on every prompt and tool call and units of work, approvals and audits owned by the CLI. An applied repository then depends on the reins package while it works: offline without a cache it stops, and a compromised package reaches every applied repository. Volatile files were only partly deleted and had no lifetime. `feat/loop-enforcement` (intents 015–018) is not merged.

## 0.3 — reins manages the harness, nothing more

State: 0.3.0-rc.4 (2026-11-10); stable on the maintainer's instruction. rc.3 carried intent 020 (a personal delegation table, commits at meaningful units, PR and CI records for the audit). rc.4 is stabilisation 019 ST-8: a clear message instead of a stack trace when reins runs outside a git repository, found while checking rc.3 (added here after the fact, as the rc.4 audit asked).

- **reins has four commands: `install`, `migrate`, `update`, `config`.** No hook, skill or agent calls reins while the project works; the installed harness works without reins and without a network. The commands used during work (`check`, `gate`, `new`, `status` and others) are removed.
- **Checks belong to the project.** Stage checks run in hook tools such as lefthook or husky, or in scripts inside the project; reins proposes or sets them up at installation.
- **A single agent is the default.** Multi-agent work is switched on by assigning models to role groups (PM, PL, Planner, Implementer, Executor, Advisor, Auditor); a group without a model is done by the PM. In single mode the PM may still use subagents of the same model for read-heavy work (research, review, audit) and urgent parallel work. Basis: Anthropic, [Building agents: When to fold subagents into your main agent loop](https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop) (2026-10-22).
- **Flow and stage skills.** `ROADMAP.local.md` → `ROADMAP.md` → intent (direction and plan) → spec → implementation → test → merge → audit → release → retro → cleanup. The skills are `onboard`, `roadmap`, `intent`, `spec`, `implement`, `review`, `test`, `merge`, `audit`, `release`, `retro`; single and multi mode use the same skills, and AGENTS.md holds the order.
- **An audit for every version.** After the merge and before the rc, an audit checks that the stages were followed and commits its result to `.agents/audit/`. It is mandatory unless the user switches it off. Approvals are recorded by the PM, quoting the user.
- **Onboarding.** After installation, the PM's first conversation reads the project, asks the user, and writes the project sections of AGENTS.md (goals, commands, rules, red lines, document language).
- **Every file has a lifetime when it is created.** Working records are deleted after the retro; history keeps one page per version.
- **Existing installs move with `update`.** reins calls in skills and hooks are removed, and accumulated `.loctx` files are deleted after the user confirms.

## 0.4 — rollout

- Application to Team Croffle repositories, repository by repository with the owner's permission.
- Migration of the remaining `.ai/` harnesses.

## 1.0 — not scheduled

reins stays on 0.x and gains features until the maintainer considers the system settled; stabilising alone does not make it 1.0. Until then the file formats (schema `@1`) may change in a minor version, and `update` or `migrate` moves existing installs.
