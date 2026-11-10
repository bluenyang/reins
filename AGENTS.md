# AGENTS.md

<!-- reins:onboarding pending -->
> **Onboarding — do this first in the next conversation.** Run the `onboard` skill: read the project, ask the user, and write the project sections of this file: goals and scope; stack and commands; existing rules and conventions; red lines (paths not to touch, secret files); the language of documents the user reads. Then change the marker above to `<!-- reins:onboarding done -->`.

<!-- reins:begin notice v=0.3.0 -->
> The blocks marked `reins:begin … reins:end` are written by reins from `.agents/harness/`. Do not edit them by hand; the user changes them with `reins config` or `reins update` in a terminal. Everything outside the blocks belongs to the project. Nothing in this repository runs reins while you work.
<!-- reins:end notice -->


Working agreement for AI agents on `reins`.

## Project

**reins** (`@bluenyang/reins`, GitHub `bluenyang/reins`) — a tool that manages a project's agent harness:
it installs, migrates, updates and configures the engineering files (roles, flow, skills, AGENTS.md) so
the project can follow them. reins is never called while a project works.

### Current phase

**0.3, intent 019** (`.agents/intent/019_harness-only/`, approved; spec accepted). 0.2.1–0.2.8 were
cancelled (`docs/ROADMAP.md`). During 0.3 development this repository runs **without the reins harness**:
the 0.2.0 install was taken out (spec W-1) and the flow below is followed by hand until 0.3 is released
and this repository migrates itself with `reins update`.

- The design document is the reference. If an implementation needs to differ, change
  `docs/design.ko.md` (and the English edition) **in the same commit** before the code. Until W-2 lands,
  intent 019 and its spec win over the design document where they differ.
- What ships (the CLI, generators and build output) is TypeScript and never needs Python (R65). Development, test, verification and editing scripts may use Python; do not block Python itself — target repositories may be Python projects.

### Stack and commands

- Node ≥ 22, pnpm, TypeScript (ESM). Lint/format: oxlint, oxfmt. Tests: vitest. Hooks: husky.
- `pnpm check` — lint, format check, typecheck, tests. Run before reporting done; the husky hooks run it.
- `pnpm build` — `cli/src` → `cli/dist` (the `reins` bin).
- Never read `.env`, `.env.*.local`, `secrets/**`, `*.properties`, `*.key`, `*.pem`. `*.example*` is fine.

## Flow (0.3 development, by hand)

Single-agent mode: one agent (the PM) does the work. It may use subagents of the same model for
read-heavy work (research, log summaries, review, audit) and urgent parallel work on independent units;
large decisions get an outside review (another vendor's model, read-only) when the maintainer asks.

1. Ideas go to `.loctx/ROADMAP.local.md`; once settled with the maintainer, to `docs/ROADMAP.md`.
2. **intent** (direction and plan) → the maintainer approves → **spec** (work units W-n, checks V-n) →
   the maintainer answers 진행 or 수정 on the summary. Approvals are recorded by quoting the maintainer:
   `{ role: user, by, at, words, rev }`. A step the maintainer tells you to skip is recorded in the intent's
   `waivers:` and applies once.
3. Implement the spec's work units in order. Commit at meaningful units: each commit is a point you can revert or reset to without taking other working work or features with it,
   and passes `pnpm check`; a unit may take several commits (review fixes), unrelated work never shares one.
   Changing the spec's work units needs the spec changed and the summary approved first.
4. Test, merge, then an **audit** of the version (before the rc): were these steps followed?
5. Release, then a retro, then delete the version's working files in `.loctx/`.

- Each commit unit passes `pnpm check` on its own. Never commit on `master`; never bypass hooks.
- Search past decisions with `grep -l 'decisions:.*<keyword>' .loctx/history/*` and `.agents/knowledge/`.
- Anything that leaves the machine (push, PR, release) happens only on the maintainer's explicit instruction.

## Conventions (this repository)

- Branches: `type/topic` from `master`, rebase onto `master`, fast-forward merge.
- Commit messages: `type(scope): title`, one-line summary, bullets, `Co-Authored-By` footer only.
- Public documents: English by default with a Korean `.ko.md` twin, cross-linked (R67). Korean
  documents for the user may be polished with humanize-korean; English ones are not.
- `CLAUDE.md` contains only `@AGENTS.md`.
- Spec summaries wait for the maintainer's 진행 or 수정 every time; there is no standing auto-accept (maintainer, 2026-10-30: a one-time 2026-10-27 instruction had been recorded as standing). Intent approval, knowledge promotion and stable releases stay explicit.

## Language

`AGENTS.md`, code, commits, `.agents/` sources: English. Documents the user reads (`intent/`, `.loctx/`, `docs/*.ko.md`): the project's user language.

<!-- reins:begin layout v=0.3.0 -->
## Layout

- `.agents/` — committed agent context: `intent/<NNN>_<slug>/{intent,spec}.md`, `audit/<version>.md`, `knowledge/`, `harness/` (settings, roles, templates), `skills/` (the stage skills).
- `.loctx/` — this machine only (gitignored): `ROADMAP.local.md`, `history/<version>.md`, `reports/<version>/`, `context/`, `bindings.local.yaml`, `delegation.local.md`.
- `docs/ROADMAP.md` — the public roadmap.
<!-- reins:end layout -->

<!-- reins:begin settings v=0.3.0 -->
## Settings

- `.agents/harness/bindings.yaml` — the mode (`single` or `multi`), which model does which role group, and `audit.required`. A personal override may sit in `.loctx/bindings.local.yaml`; when it exists, it wins, and when it changes who does what, `.loctx/delegation.local.md` holds that person's delegation table.
- **When `audit.required` is true (the default), every version ends with an audit (skill `audit`). It is mandatory: never skip it; only the user switches it off.**
- `.agents/harness/gates.yaml` — the project's own check commands; the hooks and the `test` skill run them as they are.
- `.agents/harness/roles/<group>.md` — what each role does, must not do, and which tools it may use.
<!-- reins:end settings -->

<!-- reins:begin flow v=0.3.0 -->
## Flow

Follow these steps in order; each has a skill in `.agents/skills/`, and each skill names the next.

1. `roadmap` — ideas go to `.loctx/ROADMAP.local.md`; once settled with the user, to `docs/ROADMAP.md`.
2. `intent` — the PM writes the direction and the plan; **the user approves**.
3. `spec` — the spec, its work units (W-n) and checks (V-n); **the user answers 진행 or 수정 on its summary, every time**.
4. `implement` → `review` — commit at meaningful units (a point you can revert or reset to without taking other working work or features with it), each naming its spec items; changing the spec's work units needs the spec changed and approved first.
5. `test` → `merge` → **`audit`** (after the merge, before the rc) → `release` → `retro` (after stable), then delete the version's working files.

The first conversation after installation (or after a reconcile or mode-changed marker appears in this file) starts with `onboard`.
<!-- reins:end flow -->

<!-- reins:begin delegation v=0.3.0 -->
## Delegation

If `.loctx/delegation.local.md` exists, follow it instead of this section (your personal settings; `reins config --local` writes it).

Mode: **single** — you are the PM (claude claude-opus-5-5) and do every role yourself, stage by stage. You may use subagents of your own model for read-heavy work (research, large log summaries, review, audit) and, when urgent, for parallel work on independent units; keep connected work (plan and implementation of one feature) in one run. Switching to multi is the user's choice.

Audit: **required every version**; run it on claude claude-opus-5-5 in a fresh run that gets only the records, never this conversation.
<!-- reins:end delegation -->

<!-- reins:begin records v=0.3.0 -->
## Approvals and records

- Record an approval by quoting the user in the intent's or spec's `approvals:` — `{ role: user, by, at, words, rev }` — and commit it. Never record an approval the user did not give.
- A step or approval the user tells you to skip goes to the intent's `waivers:` — `{ step, words, at, scope: once }` — at that moment. It applies once; next time, follow the flow.
- Every file you create has an owner and a deletion point (each skill lists them). Working files under `.loctx/reports/<version>/` are summarised in history and the audit, then deleted after the retro.
<!-- reins:end records -->

<!-- reins:begin stops v=0.3.0 -->
## When to stop and ask

- **Ask the user and stop:** an irreversible action (force push, deleting a tag, rewriting the default branch, data or production changes); a stable release; anything that leaves the machine (push, PR, release) unless the settings or the user allow it; scope moving outside the intent and spec; a conflict with a past decision; a next step that needs an approval not yet given.
- **Stop and find the cause:** two failures in the same work unit; empty or doubtful check output; a pass without evidence (a pass needs the raw output's path).
- **When the user interrupts** (chat, Ctrl+C, session end): stop and write the resume point in `.loctx/history/<version>.md`.
- What no role does: `.agents/harness/policy/common-red-lines.yaml`.
<!-- reins:end stops -->
