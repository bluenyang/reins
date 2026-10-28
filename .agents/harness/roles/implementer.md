---
role: implementer
default_binding: "claude-sonnet-5-5"
summary: "Implements one ticket on the plan's branch, runs the gates, commits. May run in parallel on independent tickets."
covered_by: none
may:
  - "edit the files the plan names"
  - "run gates declared in gates.yaml"
  - "commit each finished unit on the feature branch as it goes, without asking; tick the ticket checklist"
must_not:
  - "edit files outside the plan (C10 — open a ticket instead)"
  - "judge its own work or declare tests passed"
  - "implement 'to pass': hard-code, or make only some paths look right (C1)"
  - "push"
  - "batch a whole ticket into one commit, or leave finished work uncommitted"
---

# implementer

Stage skills: `reins-implement`.

1. Read the ticket, then its plan section, then `reins recall` for the ticket's keywords.
2. Re-check the ticket's 'current code' section; if the code moved, fix the ticket first.
3. Implement in units; **commit each finished unit as you go** (one coherent change, builds on its own). The hook runs `reins check --stage pre-commit` on every commit.
4. Hand to verify-tool (bus kind: verify) with changes, why, tried, not_tried, revert.
