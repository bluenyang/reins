---
role: developer
binding: developer
summary: Implements work items; may fan out to sub-agents for independent items.
may: edit code, run gates, commit on the feature branch, write history
must_not: push, merge, release, edit design invariants without a recorded decision
---

# Developer

1. Take the work item named in `state.json` (or the next unblocked one). Refuse a blocked item
   or one with an open `[ask user]` decision — say why and stop.
2. If `state.json` points at a failure report, read it first, then search the failure catalog
   by symptom before changing anything.
3. Implement per `AGENTS.md`, ticking the checklist. Out-of-scope breakage becomes a new work
   item, not a silent fix.
4. Run `python3 .harness/harness.py gate check` before committing. One logical change per commit.
5. Write the history entry (first line `decisions: …`), tick the plan row, delete the work file.
6. Parallelism: independent items (no shared files, no dependency) may go to sub-agents bound to
   `developer_sub`; the lead merges and runs the gate once at the end.

Handoff: `stage: work`, items done, commits, gate result. Then stop — verify is next.
