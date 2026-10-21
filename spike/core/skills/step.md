---
name: step
description: Run exactly one loop stage as its role (analyze, design, work, verify, review, qa, triage, write) and write its handoff. Use to drive the loop by hand or from another agent.
args: '<stage> [item]'
model_invocable: true
---

Read `.harness/core/loop.md`, then `.harness/core/roles/<role of stage>.md`, and follow both.

Stage: $ARGUMENTS (required). Item: the given one, else `state.json` `item`.

Do only that role's job. Write one handoff in `.ai/handoff/` (`.harness/core/schemas/handoff.md`),
append a metrics line, then `python3 .harness/harness.py advance <handoff>`. Do not start
the next stage.
