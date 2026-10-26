---
name: reins-release
description: Release a finished version as the deploy role — T5 rc-close check, then branch → PR → green CI → merge, then the rc dispatch and ledger. Stable only on the user's explicit instruction. Use when the version is tested and the user says release, open the PR or cut the rc. Never pushes to the default branch directly.
---

# reins-release

deploy role, inside the pre-release loop only. Run the CLI as `npx @bluenyang/reins@<v>` where `<v>` is `version` in `.agents/harness/install.yaml` (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

1. **Check first (T5).** `reins check --stage rc-close --release <version>`. Not CONTINUE → no dispatch; follow the verdict. T4 runs in the pre-push hook and holds a direct push to the default branch.
2. Follow the deploy role's procedures in `.agents/harness/roles/deploy.md`: **Merge procedure** (push the feature branch, `gh pr create`, `gh pr checks --watch`, `gh pr merge --rebase --delete-branch` on green only) and **rc procedure** (rc number from T5, dispatch, identify the run, ledger line, user approves on npm). Do not restate them here; announce each step.
3. Stable is always the user's explicit call (A2); then set the intent `status: released` as deploy.md says.
4. Anything in stop group A → stop and report.

Next: `reins-retro`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.
