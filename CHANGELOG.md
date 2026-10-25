# Changelog

All notable changes to `@bluenyang/reins` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). A version is a bundle of intents; `rc.1` means
everything planned for it is done, later `rc.N` are stabilisation only (see
[docs/design.md](docs/design.md) §4).

This file is about the package. The harness that `reins update` re-applies to installed projects
has its own notes in [harness/CHANGELOG.md](harness/CHANGELOG.md); an entry there tagged `[skill]`
needs the `/reins-update` skill.

## [Unreleased] — 0.1.0, round one

Not published yet. Round one: the graph design, self-install and self-migrate of this repository,
and the verifier.

### Added
- `reins check`, the harness verifier. Stages `ticket-start` (T1), `pre-commit` (T2), `verdict` (T3),
  `pre-push` (T4) and `rc-close` (T5), and `--drift` in three layers (format, convention, match).
  Verdicts CONTINUE, HOLD, STOP and ESCALATE as exit codes 0, 10, 20 and 30; every stop names a
  reason id from A1 to G2 and how to resume.
- Harness sources in `harness/`: twelve roles with their `must_not` lists, red lines C1–C10,
  24 stop conditions, budget scopes and transition points, JSON Schemas for intent, spec, plan,
  ticket, knowledge and bus files, templates, and Node knowledge seeds.
- `reins install harness|loop|graph` with `--mode manual|auto`, `--hooks` and `--dry-run`. It refuses
  over a 3rd or 4th generation harness and points to `migrate`.
- `reins migrate` — moves an existing `.ai/` workspace onto the layout, converts open work into
  tickets and swaps the AGENTS.md sections reins owns for managed blocks, keeping the originals.
- Generator for Claude Code: `.claude/agents/reins-<role>.md` per Claude-bound role,
  `.claude/settings.json` deny rules derived from the red lines, and `.claude/skills/` copies.
  Generated files are tracked in a manifest; a hand edit is caught as C3.
- `reins update` — re-applies the packaged harness, keeps project-owned bindings, gates and sections.
- `reins configure bindings` — `--set role=model` or `--vendors`, then regenerates vendor files.
- `reins gate` — runs `gates.yaml` exactly as declared and keeps the raw output (`$ cmd` … `exit N`)
  in `.loctx/reports/` as the evidence T3 reads.
- `reins status` — read-only view of the harness, intents with their next action, open tickets with
  their next check, bus files and the last history entry. Built through this repository's own loop
  as intent 001.
- Skills `reins-setup`, `reins-intent` and `reins-loop`, installed to `.agents/skills/` and indexed in
  `.agents/SKILLS.md`.
- GitHub Actions CI: `pnpm check`, build, `reins check --drift`.
- README in English and Korean, LICENSE (MIT), CONTRIBUTING.

### Known issues
- `check` fails in a repository without any commit.
- Hand edits inside AGENTS.md managed blocks are not reported as drift yet.
- Generated files exist for Claude Code only; Codex, Gemini and Cursor arrive in 0.2.
- `recall`, `doctor` and `configure budget|gates|language` are not implemented.

[Unreleased]: https://github.com/bluenyang/reins/commits/master
