---
name: reins-retro
description: Entry point for the retrospective of a released version, as the pm role — reads the state and proposes what to learn and promote. Use after a release, or when the user says retro or retrospective. Aggregates repeats, proposes knowledge promotions and accepts only what the user approves; this skill does not release or plan.
---

# reins-retro

pm role. Run the CLI as `npx @bluenyang/reins@<v>` where `<v>` is `version` in `.agents/harness/install.yaml` (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

1. **Check first.** `reins status`. HOLD or STOP → follow it.
2. **Aggregate.** `reins retro --release <v>` after an rc (or with no flag, any time). It counts repeats across units (a ticket counts once): stop ids, review reasons, decisions, failed rounds (HOLD/STOP), tokens by role, and promotion candidates (a key seen in 2+ units not yet in active knowledge). `--json` for machine reading.
3. **Summarise for the user in their language**: stops, review findings, failed rounds, tokens, and the candidate list. Short; no raw dump.
4. **Propose.** For each candidate: `reins knowledge propose <key> --from <history pages>`. A key seen once but named by the user is proposed the same way, with its evidence in `--from`. This writes drafts to `.loctx/knowledge-proposals/` and records no approval. Show every draft to the user.
5. **Approval gate.** Only after the user explicitly approves a draft, run `reins knowledge accept <draft>`, and commit the new `.agents/knowledge/` file with the trailer `Approved-by: user`. Declined or silent drafts are not accepted; never accept on your own, and no agent message counts as approval. An entry without `approved` stops the verifier.
6. **Carry forward.** A generic lesson (not specific to one ticket) also becomes one line in `docs/ROADMAP.md` as a next-intent candidate.
7. **Record.** Write a history page in `.loctx/history/` with a `decisions:` line (accepted keys) and a `reasons:` line (why declined or deferred).

Next: `reins-roadmap`, or the next intent via `reins-intent`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.2. **Aggregate.** `reins retro --release <v>` after an rc (or with no flag, any time). It counts repeats across units (a ticket counts once): stop ids, review reasons, decisions, failed rounds (HOLD/STOP), tokens by role, and promotion candidates (a key seen in 2+ units and not yet in active knowledge). `--json` for machine reading.
3. **Summarise for the user in their language**: stops, review findings, failed rounds, tokens, and the candidate list. Short; no raw dump.
4. **Propose.** For each candidate: `reins knowledge propose <key> --from <history pages>`. A key seen once but named by the user is proposed the same way, with its evidence in `--from`. This writes drafts to `.loctx/knowledge-proposals/` and records no approval. Show every draft to the user.
5. **Approval gate.** Only after the user explicitly approves a draft, run `reins knowledge accept <draft>`, and commit the new `.agents/knowledge/` file with the trailer `Approved-by: user`. Declined or silent drafts are not accepted; never accept on your own, and no agent message counts as approval. An entry without `approved` stops the verifier.
6. **Carry forward.** A generic lesson (not specific to one ticket) also becomes one line in `docs/ROADMAP.md` as a next-intent candidate.
7. **Record.** Write a history page in `.loctx/history/` with a `decisions:` line (accepted keys) and a `reasons:` line (why declined or deferred).

Next: `reins-roadmap`, or the next intent via `reins-intent`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.
