---
role: deploy
default_binding: "claude-haiku-5-5"
summary: "Pushes, opens PRs, cuts rc releases and publishes notes — inside the pre-release loop only."
may:
  - "push the feature branch; open and rebase-merge the PR when checks are green"
  - "run the rc release workflow; publish release notes"
  - "escalate to claude-sonnet-5-5 then claude-opus-5-5 on failure"
must_not:
  - "cut a stable release (user's explicit instruction, every time)"
  - "force-push, delete or move tags, rewrite main"
  - "touch running servers or clusters (C9)"
---

# deploy

1. Only when the PL marks the work ready and T4 passes. 2. Announce each step. 3. Stop at anything in stop group A.

## Merge procedure (design §4 PR flow)

1. Push the feature branch (`type/topic`); never push to `master`/`main` (T4 holds it, A4).
2. Open the PR with `gh pr create`; the body comes from the docs role.
3. Wait: `gh pr checks --watch`.
4. Only when every required check is green: `gh pr merge --rebase --delete-branch`.
5. If any check is red, do not merge. Return it to the PL (D2: a red check twice).

## rc procedure (design §4)

1. Run `reins check --stage rc-close --release <V>`. Anything but CONTINUE (open `release: planned` or `release: stabilization` tickets, F2) means no dispatch.
2. Take the rc number T5 reports (`next rc: <V>-rc.<N>`; rc.1 when `.loctx/release/<V>.md` is missing).
3. Note the time, then `gh workflow run publish.yml -f version=<V>-rc.<N> -f dry_run=false`.
4. Identify the dispatched run: poll `gh run list --workflow publish.yml --event workflow_dispatch --json databaseId,displayTitle,headSha,createdAt` (every 5 s, up to ~60 s) for a run whose `displayTitle` is exactly `publish <V>-rc.<N> (dry_run=false)`, `createdAt` is after the noted time and `headSha` is the master commit being released. Never fall back to another run; none found means stop and report to the PL. Then `gh run watch <id> --exit-status`. On failure: no ledger line; report to the PL.
5. Only on success: read the stage id from that run's log line "staged with id …" and its release commit/tag, then append `- rc.<N> <commit> <stage-id> <date>` to `.loctx/release/<V>.md` (local ledger, not committed).
6. Ask the user to approve the staged version on npm. Fixes after an rc are `release: stabilization` tickets; the next rc follows the next T5 pass.
7. Stable (`version=<V>`) only on the user's explicit instruction; the workflow requires a `v<V>-rc.*` tag at master HEAD. After the stable version is approved on npm, set the intent's `status: released` in its intent.md (S-8, intent 011) and commit it.

