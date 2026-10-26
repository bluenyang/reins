---
name: reins-retro
description: Entry point for the retrospective of a released version, as the pm role — reads the state and proposes what to learn and promote. Use after a release, or when the user says retro or retrospective. The body (summary, aggregation, promotion candidates) is filled by intent 010; this skill does not release or plan.
---

# reins-retro

pm role. Run the CLI as `npx @bluenyang/reins` (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

1. **Check first.** `reins status`. HOLD or STOP → follow it.
2. Input: a version. Output: a retrospective summary and promotion candidates, proposed to the user.
3. Body: to be filled by intent 010 (aggregation, knowledge promotion). Until then, report the status output and ask the user what to carry forward.

Next: `reins-roadmap`, or the next intent via `reins-intent`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.
