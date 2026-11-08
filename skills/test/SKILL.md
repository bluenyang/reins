---
name: test
description: Run the spec's checks (V-n) exactly as written and judge each against its expected result, keeping the raw output. Use when every work unit of the version is reviewed.
---

# test

## 1. When
Every work unit of the version is reviewed.

## 2. Procedure
1. Build, then run every check V-n as written. Keep the raw output under `.loctx/reports/<version>/`.
2. Judge each against its expected result. Ambiguous is a fail.
3. A fail goes back to the PM → `implement`.

## 3. Delegation
Check the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. Executor (qa-runner) runs the checks when switched on; tool-executor summarises a large log.

## 4. Files and lifetime
- `.loctx/reports/<version>/` test logs — deleted after the retro, once summarised.

## 5. Next
`merge`.

## 6. Stop and ask
- Never change a check or its expected result to make it pass.
