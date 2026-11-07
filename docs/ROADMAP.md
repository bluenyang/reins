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

The 0.2 plan answered "agents do not follow the harness" by putting reins itself into the work: the verifier as the reins package called at every transition, skills that run `npx @bluenyang/reins`, and on the unreleased branch `feat/loop-enforcement` runtime hooks on every prompt and tool call, units of work, approvals and audits owned by the CLI. An applied repository then depends on the reins package while it works: offline it stops, and a compromised package runs in every applied repository. Volatile files (`.loctx/bus`, gate logs, run records) had no working deletion rule. Two independent audits (2026-11-07) traced this back to the first design, where the project-owned check script of the surveyed repositories became "`reins check` is that script".

The maintainer cancelled 0.2.1–0.2.8. The branch `feat/loop-enforcement` (intents 015–018) is kept as a record and is not merged.

## 0.3 — reset

Planned by the maintainer (2026-11-07) as the break from the 0.2 plan. Its content is written here once it is agreed (intent 019).

## 0.4 — rollout

- Application to Team Croffle repositories, repository by repository with the owner's permission.
- Migration of the remaining `.ai/` harnesses.

## 1.0 — not scheduled

reins stays on 0.x and gains features until the maintainer considers the system settled; stabilising alone does not make it 1.0. Until then the file formats (schema `@1`) may change in a minor version, and `update` or `migrate` moves existing installs.
