---
name: loop
description: Run the role loop toward a target (work item, rc, or version) — dispatches each stage to its bound role and model, bounded by the loop limits, and stops on knowledge or intent stops. Never releases.
args: '<target> [--from <stage>]'
model_invocable: false
---

Read `.harness/core/loop.md` first and follow it.

Target: $ARGUMENTS (required; if empty, show `harness.py state show` and stop).

1. `python3 .harness/harness.py state show`. If a state exists for another target, ask whether
   to resume it or replace it. If `blocked_on` points at an open decision request, stop and show it.
2. Set the target: `harness.py state set --target <target> --stage <first stage needed>`.
   First stage: `design` if the target has no plan, `work` if work files exist, otherwise ask.
3. Repeat:
   - `python3 .harness/harness.py next` prints the next stage, its role file, and the bound
     agent. Run it: in-session for bindings on this agent (use a sub-agent with the bound model
     when the agent supports it), or `harness.py dispatch <stage>` for other agents.
   - Read the handoff the stage wrote; `harness.py advance <handoff path>` applies the limits and
     moves the state.
   - Stop when `state.stage` is `human`, `release`, or the target is reached.
4. On a knowledge stop, write the decision request (`/decide`) and stop. After the user
   answers, run `/learn` before resuming.

Report: stages run (stage, result, round, model), where it stopped and why, next command.
