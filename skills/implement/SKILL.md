---
name: implement
description: Implement the spec's work units in order, committing at meaningful units, and fill the self-review table. Use when the spec is accepted, or the user says implement or continue.
---

# implement

## 1. When
The spec is accepted and has open work units.

## 2. Procedure
1. Work on a feature branch (`type/topic`), never the default branch.
2. Take the next open work unit. Implement it so the requirement holds everywhere it applies — never to pass.
3. Run the project's gates (`.agents/harness/gates.yaml`; the hooks run them too). Keep the raw output under `.loctx/reports/<version>/`.
4. Commit at meaningful units: each commit is a point you can revert or reset to without taking other working work or features with it. One work unit may take several commits (implementation, review fixes); small units that may be reverted together may share one; never mix unrelated work in one commit. Adding, dropping or rescoping a work unit is a change of the spec: stop, change the spec with the reason, and get the user's 진행 or 수정 on the summary. Anything smaller is an adjustment — another method inside the same unit, a small fix that a review, an audit or the check of an rc asks for, another order of the units, a change with a similar precedent in `.agents/knowledge/` or history: go on, record it in the spec's adjustment record (`A-n`: what, why, which commit), and list the adjustments in the report at the end of the flow. If you cannot tell which it is, stop and ask.
5. Commit: `type(scope): title` naming the spec items (S-n, W-n); a commit that makes an adjustment names its `A-n`. Tick the work unit in `spec.md` with the commit.
6. When the plan turns out wrong, update the intent or spec in the same commit, or stop and ask.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. Implementer (code, qa, doc) does the units when switched on; independent units may run in parallel; the code, tests and documents of one feature stay in one run.

## 4. Files and lifetime
- Commits — kept.
- `.loctx/reports/<version>/` gate logs — deleted after the retro, once summarised.

## 5. Next
`review`.

## 6. Stop and ask
- Two failures in the same work unit: stop, find the cause (pl or advisor opinions by severity), or bring options to the user.
- A work unit has to be added, dropped or rescoped: the spec changes and is approved first. A smaller adjustment does not stop the work (2.4); working across approved units that may be reverted together is fine.
- A user who does not accept an adjustment when it is reported: treat it as a change of the spec — revert it or get it approved.
