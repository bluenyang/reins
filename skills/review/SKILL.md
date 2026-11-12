---
name: review
description: Review finished work units — one reviewer (or a self-review table in single mode), evidence for every finding; large decisions get a discussion. Use after implement, or when the user says review.
---

# review

## 1. When
Work units are done and not reviewed.

## 2. Procedure
1. Every work unit is reviewed, including one that changes tests or documents only. If a unit is not reviewed, record that and why in the spec's adjustment record; a unit left unreviewed without that record is a finding of the first audit.
2. Review the diff against the spec: does each S-n hold, with which commit and which evidence (test, log path)? Look for defects, not only for the checklist.
3. Multi mode: one reviewer (pl/code-reviewer, doc-reviewer …). Single mode: fill the table spec item ↔ commit ↔ evidence path yourself and state that it is not an independent review.
4. Findings go back to the PM, who sends fixes to `implement`. A small fix is an adjustment: it goes on and is recorded in the spec (`A-n`); a finding that needs a work unit added, dropped or rescoped changes the spec first.
5. A large decision or an unresolved disagreement: pl/discussion (every assigned model, without seeing each other); combine with the originals attached, keeping minority views.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you.

## 4. Files and lifetime
- Review notes under `.loctx/reports/<version>/` — deleted after the retro, once summarised.

## 5. Next
`implement` (fixes) or `test`.

## 6. Stop and ask
- A finding without evidence is "cannot confirm", never a pass.
