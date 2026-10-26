---
name: reins-test
description: Test a version before release — qa-design designs e2e scenarios from the spec's acceptance criteria, qa-run executes them, verify-tool builds and reports. Use when every planned ticket of a version is done, or the user says test the version or run the e2e scenarios. Does not release (reins-release).
---

# reins-test

Run the CLI as `npx @bluenyang/reins@<v>` where `<v>` is `version` in `.agents/harness/install.yaml` (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

1. **Check first.** `reins status` and `reins check --drift`. The version must have no open ticket and every planned ticket done; anything left → HOLD (do not re-run T3 on a closed ticket).
2. **qa-design:** write the e2e scenarios from the version's spec acceptance criteria (call per `../reins-loop/references/vendor-cli.md`).
3. **qa-run:** execute the scenarios; keep raw output under `.loctx/reports/`.
4. **verify-tool:** `pnpm build` (or the build gate in gates.yaml) and report pass/fail with the raw output attached.
5. pl decides from the results. Failures go back as tickets (`reins new ticket …`, `release: stabilization` after an rc).

Next: `reins-release`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.
