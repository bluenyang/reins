# AGENTS.md

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
3. Implement the spec's work units in order; each finished unit is its own commit and passes `pnpm check`.
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
