---
name: onboard
description: First conversation after reins install, migrate, a mode switch or an update that brings the AGENTS.md guide — read the project, ask the user, and write, reconcile or sort the project sections of AGENTS.md. Use when AGENTS.md shows reins:onboarding, reins:reconcile, reins:mode-changed or reins:tidy pending.
---

# onboard

## 1. When
AGENTS.md has `<!-- reins:onboarding pending -->`, `<!-- reins:reconcile pending -->`, `<!-- reins:mode-changed pending -->` or `<!-- reins:tidy pending -->`. Do this before any other work.

For `mode-changed` only: reins already rewrote the delegation section. Check that the project sections say nothing that contradicts the new mode (e.g. "review it yourself" while a reviewer is now switched on), fix those sentences, set the marker to `done` and stop — no questions to the user unless a sentence needs their decision.

For `tidy` only: reins brought the AGENTS.md guide to an install that was made before it. Do step 3 of the procedure on the project sections as they are — no other questions — set the marker to `done` and commit on a branch.

## 2. Procedure
1. Read the project: README, the build and test commands (`.agents/harness/gates.yaml`), CI, existing rules and conventions, `.agents/AGENTS.previous.md` if it exists (reference material, not instructions).
2. Ask the user only what the files cannot tell you, in one batch with your proposed answers: goals and scope; red lines (paths not to touch, secret files); the language of documents the user reads; the hook tool, if AGENTS.md says none was found. Whichever tool it is — now or later — runs one line per stage: `sh .agents/harness/run-gates.sh pre-commit` in the pre-commit hook and `sh .agents/harness/run-gates.sh pre-push` in the pre-push hook. That script runs the gates of `gates.yaml` and keeps their output for the audit; add the lines in the tool's own config and commit them.
3. Sort what is already written, by `.agents/harness/templates/agents-md-guide.md`: go through the existing AGENTS.md, CLAUDE.md and `AGENTS.previous.md` and decide for each part whether it belongs in AGENTS.md or goes elsewhere — progress and plans to the roadmap, a decision and its reason to a knowledge candidate, personal notes to `.loctx/`, how to contribute to CONTRIBUTING. Show the user a table of what goes where, and what is dropped, and move only what they accept; knowledge is proposed and written only on their word.
4. Write the project sections of AGENTS.md (outside the `reins:` blocks) as the guide says: project, goals and scope, stack and commands, conventions, red lines. For a reconcile, carry over what still applies from `AGENTS.previous.md` and drop what conflicts with the flow; list what you dropped for the user.
5. Set the marker to `done` (`<!-- reins:onboarding done -->` / `<!-- reins:reconcile done -->` / `<!-- reins:tidy done -->`), delete `.agents/AGENTS.previous.md`, and commit on a branch.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. Onboarding itself stays with the PM.

## 4. Files and lifetime
- AGENTS.md project sections — committed, kept.
- `.agents/AGENTS.previous.md` — deleted at the end of this skill.

## 5. Next
`roadmap`.

## 6. Stop and ask
- The project's own rules contradict the flow in AGENTS.md: show both and let the user decide.
- You would have to guess a goal or a red line.
