---
name: retro
description: Look back on a released version — the audit and the release — propose changes to AGENTS.md, skills and the harness, apply only what the user accepts, then clean up the version's working files. Use after stable, or when the user closes a version.
---

# retro

## 1. When
After stable, or when the user declares a version without stable closed.

## 2. Procedure
1. Read the audit record, the release, and history. Find repeats: the same violation, the same failure, the same question asked twice.
2. Propose changes to AGENTS.md, skills and the harness, and whether the role groups switched on paid for themselves (pl/retrospector if switched on).
3. Propose knowledge candidates: decisions and failures repeated (twice or more) in history and the audit. For each one give a title, how often and where it appeared (file paths), and a draft of the decision, the reason and where it applies. First look for an entry that already covers it (`grep -l 'decisions:.*<keyword>' .agents/knowledge/*`); if there is one, propose updating that entry instead of a new one. If nothing repeated, write "knowledge candidates: none" so that an empty list is not mistaken for a skipped step.
4. Apply only what the user accepts: project sections of AGENTS.md and `.agents/knowledge/` entries (`approved: {by, at, words}`) by you; harness sources by the user with `reins config` / `reins update`.
5. Write `.loctx/history/<version>.md` from `.agents/harness/templates/history.md`: decisions, verdicts, skipped steps, the audit and retro summary, and a summary of the logs about to be deleted (commits, check commands and results, exceptions).
6. Delete `.loctx/reports/<version>/`.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you.

## 4. Files and lifetime
- `.loctx/history/<version>.md` — local, kept.
- `.agents/knowledge/` — committed, kept.
- `.loctx/reports/<version>/` — deleted here.

## 5. Next
`roadmap`.

## 6. Stop and ask
- Never edit harness sources or generated files by hand.
