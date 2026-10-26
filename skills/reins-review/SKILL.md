---
name: reins-review
description: Verify and review a finished ticket — verify-tool runs the gates and answers the bus request, T3 gives the verdict, code-review checks the diff against plan and spec, pl decides, then the ticket is closed. Also reviews a range the user edited without a ticket (drift and review only). Use after implementation, when the user says verify, review or close the ticket. Does not implement.
---

# reins-review

Nobody judges their own work. Run the CLI as `npx @bluenyang/reins` (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

## With a ticket
1. **Check first.** `reins check --drift`. Then verify: `reins new request <id> verify` creates `.loctx/bus/<id>_<nn>.request.yaml`; fill changes · why · tried · not_tried · revert. verify-tool runs
   `reins gate --ticket <id> --respond`, which runs the gates, keeps the raw reports and writes `<id>_<nn>.response.yaml` (report paths as `evidence:`) for the open verify request.
   Bus values that contain `: ` or ` #`, or start with one of `- [ { * & ! | > ' " % @`, go in double quotes; an unquoted one breaks the YAML and the check stops with F2.
2. **T3** `reins check --stage verdict --ticket <id>`. Fail → back to `reins-implement` (a second failure escalates, D1).
3. **Review.** `reins new request <id> review`. code-review gets the diff against plan and spec and proposes fixes only. Build the prompt and call it as in `../reins-loop/references/vendor-cli.md` (the diff excludes only installed copies and appends their `git diff --stat`). After a fix, re-review gets the fix commit's diff only. pl decides fix or proceed.
4. **Close.** `status: done`; one history page or line in `.loctx/history/` naming the ticket id, its commits and a `decisions:` line; then delete the ticket file and its bus files.

## Without a ticket (a range the user edited)
Run `reins check --drift` only. Skip the verify exchange and T3. Leave a review-only bus pair (`kind: review`, the range in the ticket slot), review the range's diff as above, report to the user. Do not close a ticket or write history.

Next: another ticket → `reins-implement`; none left → `reins-test`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess. Claude role runs: the Agent result's token count.
