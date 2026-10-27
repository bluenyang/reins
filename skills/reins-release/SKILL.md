---
name: reins-release
description: Release a finished version as the deploy role — T5 rc-close check, then branch → PR → green CI → merge, then the configured release dispatch and ledger. Stable only on the user's explicit instruction. Use when the version is tested and the user says release, open the PR or cut the rc. Never pushes to the default branch directly.
---

# reins-release

deploy role, inside the pre-release loop only. Run the CLI as `npx @bluenyang/reins@<v>` where `<v>` is `cli` in `.agents/harness/install.yaml` (no `cli` line: installed before 0.1.3, run `npx @bluenyang/reins@latest update` once) (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

0. **Release documents.** If `.agents/harness/install.yaml` has `release.docs`, the docs role updates those files (roadmap row, CHANGELOG section, README status line) on the release branch and commits them before T5, so they ship in the release PR, for an rc and for stable. Details in deploy.md, "Release documents".
1. **Check first (T5).** `reins check --stage rc-close --release <version>`. Not CONTINUE → no dispatch; follow the verdict. T4 runs in the pre-push hook and holds a direct push to the default branch.
2. Follow the deploy role's procedures in `.agents/harness/roles/deploy.md`: **Merge procedure** (push the feature branch, `gh pr create`, `gh pr checks --watch`, `gh pr merge --rebase --delete-branch` on green only) and **rc procedure** (run the `dispatch:` lines T5 prints, watch the run, ledger line; a workflow with `approval: npm-staged` adds the steps deploy.md lists for it). The merge target is the repository's default branch. With no `release:` in `install.yaml`, stop after the merge and report "no release settings". If a dispatch is refused for permissions, hand the printed line to the user. Do not restate the procedures here; announce each step.
3. Stable is always the user's explicit call (A2); then set the intent `status: released` as deploy.md says.
4. Anything in stop group A → stop and report.

Next: `reins-retro`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.
