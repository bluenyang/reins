---
name: audit
description: Audit a merged version against the flow in AGENTS.md, from the records alone, and commit the audit record under .agents/audit/. Use after the merge and before the rc; mandatory while audit.required is true.
---

# audit

## 1. When
After the merge, before the rc. While `audit.required` in `.agents/harness/bindings.yaml` is true, this is mandatory — never skip it.

## 2. Procedure
1. Before handing the audit over, the PM collects for every PR merged in the version — its number, who merged it and when, the merge commit and head SHA, each CI check and its result, and the gate output in the PR body — as the repository host's CLI prints them, unedited (e.g. `gh pr view <n> --json number,mergedBy,mergedAt,mergeCommit,headRefOid,body`, `gh pr checks <n>`), into files under `.loctx/reports/<version>/`, and passes their paths to the audit. Do not summarise or rewrite them. Then fill in the gate logs: for every commit of the version on the default branch, `.loctx/reports/gates/<tree>.log` (`<tree>` is `git rev-parse <commit>^{tree}`) should hold a run with `worktree: clean` and `exit: 0`. Hooks leave these logs as you commit, but a commit made again by a rebase, on another machine or past the hook has none. For each commit without one, with a clean work tree: `git checkout --detach <commit>`, prepare it as the project needs (install dependencies), run `sh .agents/harness/run-gates.sh audit`, and return to your branch. Do not fix a run that fails; pass it on as it is. If the project has no `run-gates.sh`, say so instead.
2. Run in a fresh context that gets only the records, never the working conversation (auditor if switched on; without one, a new run of your own model, or another one the user chooses).
3. Read: AGENTS.md and the harness settings as they were, the intent, spec, `docs/ROADMAP.md`, `.loctx/ROADMAP.local.md`, git history, history, gate and test logs, the gate logs per commit (`.loctx/reports/gates/<tree>.log`), the PR and CI records the PM collected (`.loctx/reports/<version>/`). The audit runs without a network; a record it lacks is "cannot confirm" and is asked of the PM.
4. Judge each step: local roadmap → roadmap → intent → approval → spec → approval → implementation and commits → review → test → merge. Kept, violated, cannot confirm (no evidence path), or skipped on the user's instruction (recorded in `waivers:`). Judge against the rules in force at the time. Commits: each commit is a meaningful unit — a point you can revert or reset to without taking other working work or features with it; several commits for one work unit (implementation, review fixes) are fine, and small units that may be reverted together may share one. A commit that mixes unrelated work, so one part cannot be reverted alone, is a violation. Gates: for each commit, the log of its tree holds a run with `worktree: clean` and `exit: 0` — say whether it was left at commit time (`stage: pre-commit`, `pre-push`) or filled in before the audit (`stage: audit`); no such run is "cannot confirm", and a clean run whose last `exit:` is not 0 is a violation. Changing the spec's work units themselves (adding, dropping, scope, order) without approval is a violation. A generated or harness file changed by a commit that is not an `update`/`config` commit is a violation. In `.claude/settings.json` only reins' deny rules count (listed under `owned:` in `.agents/harness/generated.yaml`); the user's own entries there are not drift.
5. The audit run is read-only: it returns the record as its answer, in the form of `.agents/harness/templates/audit.md`, criticising each violation precisely and giving a remedy (pl or advisor opinions by severity). The PM keeps that answer as it came under `.loctx/reports/<version>/` and writes it unchanged to `.agents/audit/<version>.md` — never rewording, shortening or dropping a verdict.
6. The PM reports to the user: fix it, or the user accepts it. Add the user's decision in its own section of the record and commit.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. The audit never runs inside the working conversation.

## 4. Files and lifetime
- `.agents/audit/<version>.md` — committed, kept.
- `.loctx/reports/<version>/` PR and CI records, and the audit run's answer as it came — deleted after the retro, once summarised in the audit record.
- `.loctx/reports/gates/<tree>.log` — written by the hooks and by step 1; deleted in the retro.

## 5. Next
`release`.

## 6. Stop and ask
- A passing audit does not vouch for direction or code quality; say so in the report.
