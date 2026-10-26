---
name: reins-roadmap
description: Update the public roadmap (docs/ROADMAP.md and docs/ROADMAP.ko.md) and pick the target version of the next work, as the pm role. Use when the user says to change the roadmap, reprioritise, add or drop a planned version, or asks what comes next. Does not write an intent (reins-intent) or any spec.
---

# reins-roadmap

pm role. Run the CLI as `npx @bluenyang/reins@<v>` where `<v>` is `version` in `.agents/harness/install.yaml` (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

1. **Check first.** `reins status` and `reins check --drift`. HOLD or STOP → follow it; do not edit the roadmap on top of drift.
2. Read the user's instruction, `docs/ROADMAP.md` and the open intents (`reins status`). Ask only what only the user knows (what moves, why); state defaults for the rest.
3. Edit `docs/ROADMAP.md` and its Korean twin `docs/ROADMAP.ko.md` together (R67), keeping the two linked. Show the diff and the target version for the next work.
4. Commit the roadmap change as its own unit. Nothing leaves the machine.

Next: `reins-intent` for the chosen work.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.
