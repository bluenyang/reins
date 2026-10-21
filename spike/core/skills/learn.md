---
name: learn
description: After a person answers a decision request or a fix is verified, record it in the failure catalog or history, raise verified counts, and propose promoting repeated fixes into rules, hooks, or lint.
args: '[decision request path | catalog id]'
model_invocable: true
---

Read `.harness/core/schemas/failure-entry.md` and the Knowledge section of `.harness/core/loop.md`.

1. Answered decision request (`kind: knowledge`):
   - A failure → add or update a catalog entry (`source: decisions/<file>`).
   - A convention or spec answer → a history entry with `decisions: <keywords>`; if it is a
     standing rule, propose it for `AGENTS.md` (project block, outside managed markers).
   - Fill `## 학습` in the request, set `status: answered`, clear `blocked_on`.
   - `kind: intent` answers are recorded in history only — never turned into a rule that skips
     asking next time.
2. Verified fix → `verified += 1` on the entry, only if its `check` command passed.
3. Entries with `verified ≥ 2` and `promoted: no` → write one decision request proposing the
   promotion (target file and exact text). Apply only after the answer.
