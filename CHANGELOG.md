# Changelog

All notable changes to `@bluenyang/reins` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/). A version is a bundle of intents; `rc.1` means
everything planned for it is done, later `rc.N` are stabilisation only (see
[docs/design.md](docs/design.md) §4).

This file is about the package. The harness that `reins update` re-applies to installed projects
has its own notes in [harness/CHANGELOG.md](harness/CHANGELOG.md); an entry there tagged `[skill]`
needs the `/reins-update` skill.

## [Unreleased] — 0.2.0

Planned; see the roadmap.

## [0.1.5] — 2026-10-27

Enforced versus advised, per-user binding overrides, documents with every rc, CI on more platforms.

- `harness/policy/enforcement.yaml` says how each rule is held (blocked, checked or advised), and the README and design tables are rendered from it (`pnpm docs:enforcement`) (intent 013).
- Node ≥ 22 (commander 14), `.gitattributes` with LF endings, and CI on Ubuntu, Windows and macOS with Node 22 and 24 (intent 013).
- Bindings in two layers: the committed `bindings.yaml` no longer records `detected`; `.loctx/bindings.local.yaml` holds detection and your own `configure bindings --local --set` overrides, `reins status` and `--show` print the resolved model per role, and roles on another vendor also get a Claude fallback agent file (intent 013).
- `install.yaml` `release.docs` lists the documents a release must update (roadmap row, CHANGELOG section, README status line); T5 warns for each one that still describes the previous state, and deploy updates them on the release branch before T5 (intent 013).
- `reins check --stage rc-close --release <V> --stable` prints the stable dispatch lines (user's instruction only) and warns when no rc is recorded; without it T5 only hints at `--stable` (intent 013).

### rc.2
- Every command, not only `check`, ends quietly when its output is cut (`reins update | head`); before, it crashed with EPIPE.
- `reins update` moves `vendors.<v>.detected` (and its timestamp) from a 0.1.4-style `bindings.yaml` into `.loctx/bindings.local.yaml`, keeping comments and every other key; a vendor the local file already has is kept (intent 013).

## [0.1.4] — 2026-10-27

Readiness for large repositories (intent 012).

- `install.yaml` `release:` sets the release workflows; T5 prints their `gh workflow run` lines and deploy dispatches them (merge target is the default branch); `update` keeps `release:` and unknown keys.
- Gate discovery also finds subdirectory candidates (`package.json` scripts, `Makefile` targets, `go.mod`; depth 3). `install` offers them in manual mode and reports them in auto mode; `reins configure gates [--add <name>…]` lists and appends them.
- `migrate` numbers open work `000-1…000-N` in path order (no more repeated `000-1`), remaps `depends` inside a version and records the rest in `asks:`, writes intent 000 as a draft, and takes `--legacy committed` (secret-pattern files stay in `.loctx/_legacy/`).
- `install` and `migrate` no longer touch `.claude/memory/*`; each file gets a draft `.loctx/knowledge-proposals/memory-<name>.md` to accept with `reins knowledge accept`. `*.env` joins the C4 secret patterns (`*.example*` and `*.sample` stay allowed).
- `update` deletes harness files the tier no longer installs (e.g. `.agents/harness/CHANGELOG.md` from a 0.1.0 install) and lists them; `--dry-run` only lists. Drift compares only the files the tier installs and warns about such leftovers instead of stopping with F2.
- `status` names the CLI version next to the harness version (`cli <pinned> (running <package>)`, JSON `cliInstalled`/`cliPackage`) and its next action for an intent with open tickets follows the first ticket (`implementer: <id>`, `reins-review: close <id>`, `pl: unblock <id>`); `update` opens with `cli vA → vB, harness vX → vY` and says `already up to date` when nothing changed.

### rc.2
- `publish.yml` pushes the release commit and tag with the `PUBLISH_DEPLOY_KEY` deploy key when the secret is set, so the default branch can require PRs with deploy keys as the only bypass.
- `reins migrate --dry-run` also lists the subdirectory gate proposals and `.claude/memory` drafts the install step would produce (it used to skip that step).
- `install` and `migrate` propose a `release:` draft (printed in the notes, never written) from `.github/workflows` files that have a `workflow_dispatch` trigger, when `install.yaml` has no `release:` key.

## [0.1.3] — 2026-10-27

The workflow the maintainer laid out, end to end (intents 008–011). Harness 0.1.2.

### Added
- Stage skills: reins-roadmap, reins-intent, reins-spec, reins-implement, reins-review (ticket and ticketless modes), reins-test, reins-release, reins-retro; reins-loop conducts them. Each runs its stage check first and pins the CLI to the installed version.
- Release flow: master only through PR → CI → rebase merge (T4 holds direct pushes, A4); when a version's plan is done and T5 passes, the deploy role stages `<V>-rc.N` automatically; stable only on the maintainer's instruction and only from the last rc tag commit.
- `reins new intent|ticket|request` scaffolds schema-valid files; `reins gate --respond` runs every declared gate and writes the bus response (verification in one call).
- `reins retro` counts repeated reasons and decisions; `reins knowledge propose|accept` promotes lessons only after the user approves; an unapproved knowledge entry stops the verifier. First five lessons promoted.
- Public roadmap `docs/ROADMAP.md` (+ .ko); a stage-skills line in every role.
- Repository workflows: labeler, trufflehog, CODEOWNERS, issue forms, a PR template; staged npm publishing.

### Changed
- Intent status `released`; 001–007 marked released; status shows no next action for them.
- sync-version changes only the version string; the publish summary no longer calls `npm stage list`.

### Fixed (rc.2)
- `reins new ticket` takes the ids the plan reserved before numbering past them.
- `reins knowledge dismiss <key> --reason` records a candidate that is not a lesson; retro and status stop counting it until it repeats further.
- Tests remove every temp dir they create (a run had left about 10,000 under /tmp).
- The flaky e2e control test: one test file rebuilt `cli/dist` while others ran the CLI.

### Fixed (rc.3)
- Stage skills ran the CLI at the harness version (0.1.2, which lacks `new`, `retro`, `knowledge` and `gate --respond`). `install.yaml` now records `cli:`, the package version that wrote the install, and the skills read it.

## [0.1.2] — 2026-10-26

A Claude Code plugin (intent 007).

### Added
- The repository is a Claude Code plugin and marketplace: `/plugin marketplace add bluenyang/reins`, `/plugin install reins@bluenyang`, then `/reins:reins-setup`.
- `sync-version` keeps `.claude-plugin/plugin.json` and the `reins-setup` SKILL.md pin equal to the package version (run by the `version` script).
- CI runs `claude plugin validate .`.

### Changed
- The publish workflow builds first, sets the version through `npm version`, runs `reins update`, asserts every version pin, and commits the version files and updated installs together with the tag.

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
[0.1.2]: https://www.npmjs.com/package/@bluenyang/reins/v/0.1.2
[0.1.1]: https://www.npmjs.com/package/@bluenyang/reins/v/0.1.1
[0.1.0]: https://www.npmjs.com/package/@bluenyang/reins/v/0.1.0
