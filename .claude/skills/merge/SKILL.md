---
name: merge
description: Bring the tested branch into the default branch — push, PR and CI without asking, the first audit, then the merge on the user's instruction. Use when the version is tested.
---

# merge

## 1. When
The version is tested.

## 2. Procedure
1. Push the branch and open the PR without asking: for a branch of the work in progress (an accepted spec's work units, their records, release documents) this is part of the flow. Taking anything else out of the machine still needs the user's word.
2. The PR body: the intent, the spec summary, the checks. Wait for CI. Red CI goes back to `implement`.
3. When CI is green, go on to the first audit (`audit`) without asking; a PR that goes without one says why in a line of its body. After the first audit — its record is committed on the branch and CI is green again — report once: what was done, the adjustments recorded in the spec (`A-n`), the results of the checks and of CI, what the audit found, and the instruction you are waiting for (the merge). Before that point, do not stop to report unless a stop condition applies.
4. Every merge needs the user's instruction — the PR of the work, and a PR of records or release documents alike. When the first audit found no violation, or its violations are fixed or accepted, and the user says to merge, merge at once. Merge only when the required checks pass, the way the repository merges (rebase, squash …).
5. Which PR: the PM judges which PR the instruction means — the PR it names; without a name, what the PM proposed to merge (one PR or several together) or the PR just spoken of. If you cannot tell, ask. A general "go on" is not a merge instruction. Keep the user's words with the PR's record; the second audit reads them.
6. Delete the merged branch, remote and local, in this step.
7. When the merge made the commits again (rebase, squash), a record written after the merge names the default branch's SHAs. Do not rewrite the first audit's record: right after the merge, write the table of branch SHAs and default-branch SHAs under `.loctx/reports/<version>/`, hand it to the second audit and commit it under `### SHA 대응` of the audit record. Correct the spec's ticks to the default branch's SHAs in the next record commit.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. Executor (deployer) does this when switched on, within the same limits.

## 4. Files and lifetime
- The PR — on the forge, kept.
- The work branch — deleted at the merge, remote and local.
- The SHA table under `.loctx/reports/<version>/` — deleted after the retro; kept in the audit record.

## 5. Next
After CI: `audit` (the first audit). After the merge: `release`.

## 6. Stop and ask
- Never force-push, rewrite the default branch or bypass hooks.
