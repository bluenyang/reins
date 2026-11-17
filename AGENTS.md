# AGENTS.md

<!-- reins:tidy done -->

<!-- reins:mode-changed done -->
<!-- reins:onboarding done -->

<!-- reins:begin notice v=0.3.0 -->
> The blocks marked `reins:begin … reins:end` are written by reins from `.agents/harness/`. Do not edit them by hand; the user changes them with `reins config` or `reins update` in a terminal. Everything outside the blocks belongs to the project. Nothing in this repository runs reins while you work.
<!-- reins:end notice -->

Working agreement for AI agents on `reins`. The `reins:` blocks below hold the flow, the delegation and the stops; this part holds what is particular to this repository.

## Project

**reins** (`@bluenyang/reins`, GitHub `bluenyang/reins`) — a tool that manages a project's agent harness:
it installs, migrates, updates and configures the engineering files (roles, flow, skills, AGENTS.md) so
the project can follow them. reins is never called while a project works.

### Goals and scope

- The goal: one harness that BlueNyang's and Team Croffle's repositories share, installed and kept current by
  reins, that works without reins and without a network once installed. This repository runs that harness itself
  and is its first user.
- What is released, what is planned and what is only an idea is not written here: `docs/ROADMAP.md` (settled),
  `.loctx/ROADMAP.local.md` (ideas), `CHANGELOG.md` (released). Why things were decided: `docs/conversation/`.
- The design document is the reference. If an implementation needs to differ, change `docs/design.ko.md`
  (and the English edition) **in the same commit** before the code.

### Stack and commands

- Node ≥ 22, pnpm, TypeScript (ESM). Lint/format: oxlint, oxfmt. Tests: vitest. Hooks: husky (`.husky/pre-commit`
  and `pre-push` call the gate script `.agents/harness/run-gates.sh`, which runs `pnpm check` and keeps its log).
- `pnpm check` — lint, format check, typecheck, tests. Run before reporting done.
- `pnpm build` — `cli/src` → `cli/dist` (the `reins` bin).
- Running reins on this repository: use an installed copy (`npm i -g @bluenyang/reins@<version>`, then `reins …`).
  `npx @bluenyang/reins` inside this repository resolves to the repository's own package and fails with
  `reins: command not found`.
- Releases: `.github/workflows/publish.yml` (`version`, `dry_run`), staged on npm until the maintainer approves it
  with 2FA. A stable version is cut only from the last rc's commit, so stable documents follow in a PR after it.

### Red lines

- Never read `.env`, `.env.*.local`, `secrets/**`, `*.properties`, `*.key`, `*.pem`. `*.example*` is fine.
- Files reins writes (`.agents/harness/`, `.agents/skills/`, `.claude/skills/`, `.claude/agents/`, the `reins:`
  blocks) change only through `reins update` or `reins config`, each in its own commit.
- What ships (the CLI, generators and build output) is TypeScript and never needs Python (R65). Development, test,
  verification and editing scripts may use Python; do not block Python itself — target repositories may be Python
  projects.
- Run a merge as a command of its own: Claude Code's auto mode refuses a merge chained with other commands. (Which PR
  a merge instruction means is in the `merge` skill.)

## Conventions (this repository)

- Branches: `type/topic` from a freshly pulled `master`, rebase onto `master`, rebase merge. Never commit on `master`.
- Commit messages: `type(scope): title` and the `Co-Authored-By` footer. A summary line and bullets only when they say
  something the title does not; a body is never required (maintainer, 2026-11-17).
- PR bodies carry the raw check log's path and the last lines of its output.
- Public documents: English by default with a Korean `.ko.md` twin, cross-linked (R67). Exception: `docs/conversation/` (the maintainer's design conversations) is written in Korean only, with no English twin (maintainer, 2026-11-11). Korean documents for the
  user may be polished with humanize-korean; English ones are not.
- `CLAUDE.md` contains only `@AGENTS.md`.
- Before a non-trivial decision, search `.agents/knowledge/` and `grep -l 'decisions:.*<keyword>' .loctx/history/*`.

## Language

`AGENTS.md`, code, commits, `.agents/` sources: English. Documents the user reads (`intent/`, `.loctx/`,
`docs/*.ko.md`): Korean. (The `language` block is not placed because this section exists; it says the same.)

<!-- reins:begin layout v=0.3.0 -->
## Layout

- `.agents/` — committed agent context: `intent/<NNN>_<slug>/{intent,spec}.md`, `audit/<version>.md`, `knowledge/`, `harness/` (settings, roles, templates), `skills/` (the stage skills).
- `.loctx/` — this machine only (gitignored): `ROADMAP.local.md`, `history/<version>.md`, `reports/<version>/`, `context/`, `bindings.local.yaml`, `delegation.local.md`.
- `docs/ROADMAP.md` — the public roadmap.
<!-- reins:end layout -->

<!-- reins:begin settings v=0.3.0 -->
## Settings

- `.agents/harness/bindings.yaml` — the mode (`single` or `multi`), which model does which role group, and `audit.required`. A personal override may sit in `.loctx/bindings.local.yaml`; when it exists, it wins, and when it changes who does what, `.loctx/delegation.local.md` holds that person's delegation table.
- **When `audit.required` is true (the default), every version is audited twice (skill `audit`): a first audit before the merge and a second audit after the release. Both are mandatory: never skip one; only the user switches them off.**
- `.agents/harness/gates.yaml` — the project's own check commands; the hooks and the `test` skill run them as they are.
- `.agents/harness/roles/<group>.md` — what each role does, must not do, and which tools it may use.
<!-- reins:end settings -->

<!-- reins:begin flow v=0.3.0 -->
## Flow

Follow these steps in order; each has a skill in `.agents/skills/`, and each skill names the next.

1. `roadmap` — ideas go to `.loctx/ROADMAP.local.md`; once settled with the user, to `docs/ROADMAP.md`.
2. `intent` — the PM writes the direction and the plan; **the user approves**.
3. `spec` — the spec, its work units (W-n) and checks (V-n); **the user answers 진행 or 수정 on its summary, every time**.
4. `implement` → `review` — commit at meaningful units (a point you can revert or reset to without taking other working work or features with it), each naming its spec items. Adding, dropping or rescoping a work unit needs the spec changed and approved first; a smaller adjustment goes on, is recorded in the spec (`A-n`) and is reported at the end of the flow.
5. `test` → `merge` (push, PR, CI) → **`audit`** (the first audit: risk, before the merge) — from the accepted spec to the first audit this is **one flow without asking**: do not stop for permission between these steps; report once at its end. Then the merge on the user's instruction → `release` (the rc the way the repository releases; stable on the user's instruction) → **`audit`** (the second audit: procedure only, handed to the retro) → `retro`, then delete the version's working files.

A loop is the work the user started — usually one version — up to its retro. **The retro ends the loop**: report that it is closed and stop; the next `intent` is written when the user starts the next work. If the user named another end ("go on to …", "do not stop"), follow it for that instruction only and quote it in `.loctx/ROADMAP.local.md`; the intent's approval, the spec's 진행 or 수정, every merge and the stable release still wait for the user. Ideas for later work go to the roadmap whenever they come. Naming a version is not an instruction to start it.

The first conversation after installation, and any conversation that finds a pending `reins:` marker in this file (onboarding, reconcile, mode-changed, tidy), starts with `onboard`.
<!-- reins:end flow -->

<!-- reins:begin delegation v=0.3.0 -->
## Delegation

If `.loctx/delegation.local.md` exists, follow it instead of this section (your personal settings; `reins config --local` writes it).

Mode: **multi** — you are the PM — the model in this conversation. Hand a role its work with the list of files and decisions it needs; every report comes back to you, and a role never calls another model itself. Roles not listed are yours.

| role | model | how to call |
|---|---|---|
| pl/control | claude claude-sonnet-5-5 | subagent `rs-pl-control` |
| pl/plan-reviewer | claude claude-sonnet-5-5 | subagent `rs-pl-plan-reviewer` |
| pl/code-reviewer | openai gpt-6.1-sol | `codex exec -m gpt-6.1-sol -s read-only -` (task on stdin) |
| pl/qa-plan-reviewer | claude claude-sonnet-5-5 | subagent `rs-pl-qa-plan-reviewer` |
| pl/doc-reviewer | claude claude-sonnet-5-5 | subagent `rs-pl-doc-reviewer` |
| pl/retrospector | claude claude-sonnet-5-5 | subagent `rs-pl-retrospector` |
| pl/discussion | claude claude-sonnet-5-5 | subagent `rs-pl-discussion` |
| planner/spec-writer | claude claude-opus-5-5 | subagent `rs-planner-spec-writer` |
| planner/qa-designer | google gemini-4-argon-high | `agy -p "<task>" --model gemini-4-argon-high` |
| implementer/code | claude claude-sonnet-5-5 | subagent `rs-implementer-code` |
| implementer/qa | claude claude-sonnet-5-5 | subagent `rs-implementer-qa` |
| implementer/doc | claude claude-sonnet-5-5 | subagent `rs-implementer-doc` |
| executor/tool-executor | claude claude-haiku-5-5 | subagent `rs-executor-tool-executor` |
| executor/researcher | cursor cursor-grok-4.5-high-fast | `cursor-agent -p --model cursor-grok-4.5-high-fast "<task>"` |
| executor/qa-runner | google gemini-3.8-flash-medium | `agy -p "<task>" --model gemini-3.8-flash-medium --mode plan` |
| executor/deployer | claude claude-haiku-5-5 | subagent `rs-executor-deployer` |
| advisor/committee | claude claude-fable-5-1 | subagent `rs-advisor-committee` |

Routine review takes one reviewer; `pl/discussion` and `advisor/committee` (every listed model, without seeing each other) are for large decisions, audit remedies, incidents and unresolved disagreements.

Audit: **required every version, before the merge and after the release**; run it in a fresh run of your own model (or another one the user chooses) that gets only the records, never this conversation.
<!-- reins:end delegation -->

<!-- reins:begin records v=0.3.0 -->
## Approvals and records

- Record an approval by quoting the user in the intent's or spec's `approvals:` — `{ role: user, by, at, words, rev }` — and commit it. Never record an approval the user did not give.
- A step or approval the user tells you to skip goes to the intent's `waivers:` — `{ step, words, at, scope: once }` — at that moment. It applies once; next time, follow the flow.
- Every file you create has an owner and a deletion point (each skill lists them). Working files under `.loctx/reports/<version>/` are summarised in history and the audit, then deleted after the retro.
- `.agents/audit/<version>.md` holds both audits of a version; an adjustment made while working is a line in the spec's adjustment record (`A-n`).
<!-- reins:end records -->

<!-- reins:begin stops v=0.3.0 -->
## When to stop and ask

- **Ask the user and stop:** an irreversible action (force push, deleting a tag, rewriting the default branch, data or production changes); a merge; a stable release; work that would touch a red line; a work unit that has to be added, dropped or rescoped; scope moving outside the intent and spec; a conflict with a past decision; a next step that needs an approval not yet given. Pushing a branch of the work in progress and opening its PR is part of the flow (an accepted spec's work units, their records, release documents); taking anything else out of the machine still needs the user's word.
- **While you wait for the user** — a release approval, a merge instruction, a stable instruction — report and wait; do not start another unit's work. Stabilising the same version is this loop's work.
- **The retro ends the loop:** report that it is closed and stop.
- **Stop and find the cause:** two failures in the same work unit; empty or doubtful check output; a pass without evidence (a pass needs the raw output's path).
- **When the user interrupts** (chat, Ctrl+C, session end): stop and write the resume point in `.loctx/history/<version>.md`.
- What no role does: `.agents/harness/policy/common-red-lines.yaml`.
<!-- reins:end stops -->
