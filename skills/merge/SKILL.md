---
name: merge
description: Bring the tested branch into the default branch — push, PR and CI without asking, then the merge on the user's instruction. Use when the version is tested.
---

# merge

## 1. When
The version is tested.

## 2. Procedure
1. Push the branch and open the PR without asking: for a branch of the work in progress (an accepted spec's work units, their records, release documents) this is part of the flow. Taking anything else out of the machine still needs the user's word.
2. The PR body: the intent, the spec summary, the checks. Wait for CI. Red CI goes back to `implement`.
3. When CI is green, report once: what was done, the results of the checks and of CI, and the instruction you are waiting for (the merge). Before that point, do not stop to report unless a stop condition applies.
4. Every merge needs the user's instruction — the PR of the work, and a PR of records or release documents alike. Merge only when the required checks pass, the way the repository merges (rebase, squash …).

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. Executor (deployer) does this when switched on, within the same limits.

## 4. Files and lifetime
- The PR — on the forge, kept.

## 5. Next
`audit`.

## 6. Stop and ask
- Never force-push, rewrite the default branch or bypass hooks.
