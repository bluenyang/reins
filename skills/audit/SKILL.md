---
name: audit
description: Audit a merged version against the flow in AGENTS.md, from the records alone, and commit the audit record under .agents/audit/. Use after the merge and before the rc; mandatory while audit.required is true.
---

# audit

## 1. When
After the merge, before the rc. While `audit.required` in `.agents/harness/bindings.yaml` is true, this is mandatory — never skip it.

## 2. Procedure
1. Before handing the audit over, the PM collects for every PR merged in the version — its number, who merged it and when, the merge commit and head SHA, each CI check and its result, and the gate output in the PR body — as the repository host's CLI prints them, unedited (e.g. `gh pr view <n> --json number,mergedBy,mergedAt,mergeCommit,headRefOid,body`, `gh pr checks <n>`), into files under `.loctx/reports/<version>/`, and passes their paths to the audit. Do not summarise or rewrite them.
2. Run in a fresh context that gets only the records, never the working conversation (auditor if switched on; in single mode, a new run — another vendor, or the same vendor's top model — chosen by the user).
3. Read: AGENTS.md and the harness settings as they were, the intent, spec, `docs/ROADMAP.md`, `.loctx/ROADMAP.local.md`, git history, history, gate and test logs, the PR and CI records the PM collected (`.loctx/reports/<version>/`). The audit runs without a network; a record it lacks is "cannot confirm" and is asked of the PM.
4. Judge each step: local roadmap → roadmap → intent → approval → spec → approval → implementation and commits → review → test → merge. Kept, violated, cannot confirm (no evidence path), or skipped on the user's instruction (recorded in `waivers:`). Judge against the rules in force at the time. Commits against work units: a commit that holds several units, a unit split without approval, or units reordered without approval is a violation. A generated or harness file changed by a commit that is not an `update`/`config` commit is a violation.
5. Write `.agents/audit/<version>.md` from `.agents/harness/templates/audit.md`: criticise each violation precisely and give a remedy (pl or advisor opinions by severity).
6. The PM reports to the user: fix it, or the user accepts it. Commit the record with the user's decision.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. The audit never runs inside the working conversation.

## 4. Files and lifetime
- `.agents/audit/<version>.md` — committed, kept.
- `.loctx/reports/<version>/` PR and CI records — deleted after the retro, once summarised in the audit record.

## 5. Next
`release`.

## 6. Stop and ask
- A passing audit does not vouch for direction or code quality; say so in the report.
