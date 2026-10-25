---
name: reins-loop
description: Run an accepted spec through the reins loop — plan, tickets, implement, verify, review, history — calling reins check at every transition (T1 ticket-start, T2 pre-commit, T3 verdict, T5 rc-close) and stopping where it says. Use when an intent's spec is accepted, when the user says continue, next ticket or run the loop, or to resume a stopped ticket.
---

# reins-loop

Roles judge, scripts enforce. After every step run the named check; **its verdict decides what happens next**:
CONTINUE → go on · HOLD → ask the user (one line: reason id + what you need) · STOP → do what `resume` says,
then re-run the same check · ESCALATE → the next role in the chain (pl → pm → advisor → user).
Exit codes 0/10/20/30. Use `npx @bluenyang/reins` (inside the reins repository: `node cli/dist/reins.js`).

## Plan — pl
1. From the accepted spec: copy `templates/plan.md` to the intent folder — files that change, **order of work
   (one item = one ticket)**, risks, proof, test checklist; `tickets: [<NNN>-1, …]`, `agents:` roles.
2. qa-design reviews it lightly (bus `kind: review`) → `status: reviewed`. Commit.
3. For each order-of-work item: `.loctx/ticket/<NNN>-<n>_<slug>.md` from `templates/ticket.md`. Anything
   the ticket cannot decide alone goes in `asks:`.

## Each ticket
4. **T1** `reins check --stage ticket-start --ticket <id>`. Open `asks:` hold for the user; the check also
   names recorded decisions that may already answer them.
5. Branch `type/<NNN>-<slug>` from the default branch. implementer (`reins-implementer` subagent):
   ticket → plan section → `reins recall` → implement, **one commit per finished unit** (the hook runs **T2**).
   A diff outside the plan updates plan.md's departure log in the same commit (C2), or opens a new ticket (C10).
6. **Verify.** Write `.loctx/bus/<id>_<nn>.request.yaml` (`kind: verify`); verify-tool runs
   `reins gate --ticket <id>` and answers in `<id>_<nn>.response.yaml` with the report paths as `evidence:`.
   **T3** `reins check --stage verdict --ticket <id>`. Fail → back to 5 (a second failure escalates, D1).
7. **Review.** code-review gets the diff against plan and spec (`kind: review`) and proposes fixes only;
   pl decides fix or proceed. Nobody judges their own work.
8. **Close.** `status: done`; one history page or line in `.loctx/history/` naming the ticket id, its commits,
   and a `decisions:` line; then delete the ticket file and its bus files.

## Release
9. When every planned ticket is done: **T5** `reins check --stage rc-close --release <version>`. Report to
   the user. Push, PR and release happen only on the user's instruction, in the deploy role (T4 runs in the
   pre-push hook); a stable release is always the user's explicit call (A2).

On an interruption (G1) write where you are — ticket, step, last commit, open bus files, next command — to
the ticket, so the same command resumes.
