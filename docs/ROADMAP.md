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
| 0.1.3 | rc.3 published; stable on the maintainer's instruction | stage skills, release flow, retro and knowledge, loop fixes (below) |
| 0.1.4 | planned | readiness for large repositories: release flow as a repository setting, gate discovery in monorepos and Go, migrate ticket ids, carrying memory files on install, `*.env` secrets |

### 0.1.3

- **Stage skills.** The loop is split into ten skills, one per workflow stage; `reins-loop` stays as the conductor that calls them in order.
- **Release flow.** The publish summary and version sync are corrected, and the deploy role's rc flow is written down as a skill.
- **Retro and knowledge.** Recurring reasons are counted and promoted to knowledge through proposal, approval and commit; `reins recall` is the lookup.
- **Loop fixes.** Tickets and bus requests are created by `reins new` instead of by hand, `--respond` writes the verify response, and `status` no longer asks to close an already released intent.

## 0.2 — carve the loop and harness out of the graph, heterogeneous agents

Input: the metrics recorded in 0.1.

- Carve the loop and harness tiers out of the graph by cost and stop figures.
- Generated files for Codex, Gemini (Antigravity) and Cursor, with drift verification.
- `reins recall`, `reins doctor`, `configure budget|gates|language`.
- Budget stops and the remaining undetected violations.
- Trial migration of older harness generations, read-only rehearsal first.

## 0.3 — rollout

- Application to Team Croffle repositories, repository by repository with the owner's permission.
- Migration of the remaining `.ai/` harnesses.

## 1.0 — not scheduled

reins stays on 0.x and gains features until the maintainer considers the system settled; stabilising alone does not make it 1.0. Until then the file formats (schema `@1`) may change in a minor version, and `update` or `migrate` moves existing installs.
