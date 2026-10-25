# AGENTS.md

Working agreement for AI agents on `reins`.

## Project

**reins** (`@bluenyang/reins`, GitHub `bluenyang/reins`) — a reusable agent harness and loop (roles, loop policy, handoffs, knowledge,
gates) for BlueNyang's and Team Croffle's repositories, installable in new repositories and
migratable from the harnesses those repositories already use.

### Current phase

The project runs **survey → planning → design → implementation**, in that order.

- Current phase: **survey** — inventory the harnesses already in use (public and local
  repositories, their `.ai/` workspaces) before deciding anything. See `.ai/README.md`.
- `spike/` is a prototype built before the survey. It is **reference only**: do not treat its
  structure or recorded decisions as the design, do not extend it, and do not cite it as a reason
  for a planning or design decision. The design phase decides what, if anything, it keeps.
- Do not write design documents or implementation code until the phase that owns them.

### Rules for the survey

- Describe what exists; do not propose the target structure while surveying. Proposals go to a
  "notes for planning" section, not into the findings.
- Never read `.env`, `.env.*.local`, `secrets/**`, `*.properties`. Company repositories only with
  the user's explicit go-ahead per repository.
- Do not modify surveyed repositories. Read only.

## Workflow

- Local, gitignored workspace: `.ai/` (layout in `.ai/README.md`). Session start:
  `.ai/README.md` → latest `.ai/plan/` → latest `.ai/work/`.
- Work from the current `.ai/work/` checklist; write `.ai/history/` and delete the work file when
  finished. Before a non-trivial decision: `grep -l 'decisions:.*<keyword>' .ai/history/*`.
- Branches: never commit on `master`; `type/topic` branches, rebase onto `master`.
- Commits: `type(scope): title`, one-line summary, bullets, `Co-Authored-By` footer only.

## Language

- `AGENTS.md`, code, commits: English. `CLAUDE.md` contains only `@AGENTS.md`.
- `.ai/` notes: Korean.
