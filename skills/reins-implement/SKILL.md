---
name: reins-implement
description: Implement one ticket as the implementer role — runs the T1 ticket-start check, then implements on the feature branch with one commit per finished unit (the hook runs T2). Use when a ticket is ready, the user says implement, next ticket or continue, or to resume a stopped ticket. Does not verify or review (reins-review).
---

# reins-implement

implementer role. Run the CLI as `npx @bluenyang/reins` (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

1. **Check first (T1).** `reins check --stage ticket-start --ticket <id>`. Not CONTINUE → stop and follow the verdict; do not start. Open `asks:` hold for the user; the check also names recorded decisions that may already answer them.
2. Branch `type/<NNN>-<slug>` from the default branch (never commit on it). Launch the `reins-implementer` subagent: ticket → plan section → `reins recall` → implement.
3. **One commit per finished unit** (a coherent change that builds on its own). The hook runs **T2** on every commit; never bypass it.
4. A diff outside the plan updates plan.md's departure log in the same commit (P2), or opens a new ticket (C10).
5. Tick the ticket checklist. Do not judge your own work or declare tests passed.

Interrupted (G1): write ticket, step, last commit, open bus files and the next command into the ticket, so the same command resumes.

Next: `reins-review`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.
