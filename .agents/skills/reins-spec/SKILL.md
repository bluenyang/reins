---
name: reins-spec
description: Turn an approved intent into an accepted spec, a reviewed plan and ticket files — planner writes spec.md, pm and qa-design review it, the user may veto its summary, then pl writes plan.md and the tickets via reins new. Use when an intent is approved and has no accepted spec yet, or the user says write the spec or plan this. Does not write the intent (reins-intent) or implement.
---

# reins-spec

The point where a person decides (design §4): **the spec summary may be vetoed by the user** (R64). Run the CLI as `npx @bluenyang/reins@<v>` where `<v>` is `version` in `.agents/harness/install.yaml` (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

1. **Check first.** `reins check --drift`, then read the intent's frontmatter: it must be `status: approved`. No approved intent → HOLD: ask the user, or send them to `reins-intent`.
2. **planner:** copy `templates/spec.md`; every requirement is `S-n` with the intent sentence it comes from;
   invariants in AGENTS.md checked (conflict or none); `summary_for_user:` 3–5 lines in the user's language.
3. pm reviews against the intent; qa-design gives the first review (bus `kind: review`, `reins new request <ticket> review` when a ticket exists). Fix, then `status: reviewed`.
4. **Show `summary_for_user` and the acceptance criteria; the user may veto** (G2 → revise the spec). No veto →
   `status: accepted`, `approvals:` pm, qa-design and `{role: user, kind: summary}`; commit with `Approved-by:`.
5. **pl — plan:** copy `templates/plan.md` into the intent folder: files that change, **order of work (one item = one ticket)**, risks, proof, test checklist; `tickets: [<NNN>-1, …]`, `agents:` roles.
6. qa-design reviews the plan lightly (bus `kind: review`) → `status: reviewed`. Commit.
7. For each order-of-work item: `reins new ticket <intent> <step> <slug> [--title] [--depends] [--release] [--role]` creates `.loctx/ticket/<NNN>-<n>_<slug>.md`. Anything the ticket cannot decide alone goes in `asks:`.

Next: `reins-implement`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.
