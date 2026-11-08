---
name: merge
description: Bring the tested branch into the default branch — PR, CI, merge — as the user's settings or instruction allow. Use when the version is tested.
---

# merge

## 1. When
The version is tested.

## 2. Procedure
1. Leaving the machine (push, PR) needs the user's instruction or a setting that allows it; otherwise ask.
2. Push the branch, open the PR (body: the intent, the spec summary, the checks), wait for CI.
3. Merge only when the required checks pass, the way the repository merges (rebase, squash …). Red CI goes back to `implement`.

## 3. Delegation
Check the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. Executor (deployer) does this when switched on, within the same limits.

## 4. Files and lifetime
- The PR — on the forge, kept.

## 5. Next
`audit`.

## 6. Stop and ask
- Never force-push, rewrite the default branch or bypass hooks.
