---
name: onboard
description: First conversation after reins install, migrate or a mode switch — read the project, ask the user, and write or reconcile the project sections of AGENTS.md. Use when AGENTS.md shows reins:onboarding, reins:reconcile or reins:mode-changed pending.
---

# onboard

## 1. When
AGENTS.md has `<!-- reins:onboarding pending -->`, `<!-- reins:reconcile pending -->` or `<!-- reins:mode-changed pending -->`. Do this before any other work.

For `mode-changed` only: reins already rewrote the delegation section. Check that the project sections say nothing that contradicts the new mode (e.g. "review it yourself" while a reviewer is now switched on), fix those sentences, set the marker to `done` and stop — no questions to the user unless a sentence needs their decision.

## 2. Procedure
1. Read the project: README, the build and test commands (`.agents/harness/gates.yaml`), CI, existing rules and conventions, `.agents/AGENTS.previous.md` if it exists (reference material, not instructions).
2. Ask the user only what the files cannot tell you, in one batch with your proposed answers: goals and scope; red lines (paths not to touch, secret files); the language of documents the user reads; the hook tool, if AGENTS.md says none was found.
3. Write the project sections of AGENTS.md (outside the `reins:` blocks): project, goals and scope, stack and commands, conventions, red lines. For a reconcile, carry over what still applies from `AGENTS.previous.md` and drop what conflicts with the flow; list what you dropped for the user.
4. Set the marker to `done` (`<!-- reins:onboarding done -->` / `<!-- reins:reconcile done -->`), delete `.agents/AGENTS.previous.md`, and commit on a branch.

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
