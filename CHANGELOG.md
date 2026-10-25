# Changelog

All notable changes to `@bluenyang/reins` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). A version is a bundle of intents; `rc.1` means
everything planned for it is done, later `rc.N` are stabilisation only (see
[docs/design.md](docs/design.md) §4).

This file is about the package. The harness that `reins update` re-applies to installed projects
has its own notes in [harness/CHANGELOG.md](harness/CHANGELOG.md); an entry there tagged `[skill]`
needs the `/reins-update` skill.

## [Unreleased]

0.1.2 — a Claude Code plugin (intent 007).

## [0.1.1] — 2026-10-26

Stabilisation: the known issues of 0.1.0 that the loop found (intents 004–006). Harness 0.1.1.

### Fixed
- pre-commit checks what is staged (the index), including schemas, paired installed files and generator inputs — not the working tree.
- T3 validates the last bus exchange against its schemas, reports unparsable bus files as F2, reads absolute evidence paths inside the repository (outside: D5), and warns (D4) on empty gate output.
- Hand-edited or deleted AGENTS.md managed blocks are F2 (`reins:override` and a project section of the same heading are respected); pushing a tag deletion is A1 HOLD.
- `check` no longer crashes in a repository without commits; output cut by `| head` exits quietly with the verdict code.
- One vendor inference for install and configure (`cursor-` models included); model ids checked against `agy models` and `cursor-agent models` (listing only, never blocking).
- qa-design and qa-run default to model ids agy offers; generated settings deny `git commit -n`.
- Tests never read the developer's `.loctx/` or spawn a real vendor CLI.

### Changed
- Premise stop conditions C1/C2 are now P1/P2 (red lines C1–C10 unchanged); old metrics records still read.
- Code review sees only the change: the review request carries each change's intent, requirement and evidence; `skills/reins-loop/references/vendor-cli.md` has the vendor CLI recipes.
- Violation scenarios: 25/25 stopped.

### Known issues
- `.env.*` read denial stays a fixed list (Claude Code permission globs have no negation); an exact check via a hook comes in 0.2.


## [0.1.0] — 2026-10-26

Round one: the graph design, self-install and self-migrate of this repository, and the verifier.
Published to npm while the rc was still under verification; fixes go to 0.1.1.

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
- `reins metrics` — every `check` and `gate` run appends a `reins/metric@1` line to
  `.loctx/reports/metrics.jsonl`; `reins metrics record` adds the tokens of a role run; the summary
  gives tokens by role, vendor, ticket and intent and knowledge stops per ticket (intent 002).
- Violation scenarios: `test/e2e/violations.test.ts` runs eighteen deliberate violations against the
  built CLI (`violations: 18/18 stopped`), and [docs/violations.md](docs/violations.md) lists who
  catches each red line and stop condition, gaps included (intent 003).
- Skills `reins-setup`, `reins-intent` and `reins-loop`, installed to `.agents/skills/` and indexed in
  `.agents/SKILLS.md`.
- GitHub Actions CI: `pnpm check`, build, `reins check --drift`.
- README in English and Korean, LICENSE (MIT), CONTRIBUTING.

### Known issues
- Of the 34 red lines and stop conditions, 12 have no detection yet and 6 only partial; see
  [docs/violations.md](docs/violations.md) (Gaps).
- `check` fails in a repository without any commit.
- Hand edits inside AGENTS.md managed blocks are not reported as drift yet.
- Generated files exist for Claude Code only; Codex, Gemini and Cursor arrive in 0.2.
- `recall`, `doctor` and `configure budget|gates|language` are not implemented.

[Unreleased]: https://github.com/bluenyang/reins/commits/master
[0.1.1]: https://www.npmjs.com/package/@bluenyang/reins/v/0.1.1
[0.1.0]: https://www.npmjs.com/package/@bluenyang/reins/v/0.1.0
