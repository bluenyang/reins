---
name: spec
description: Turn an approved intent into spec.md — interpretation, design, work units and checks — and get the user's 진행 or 수정 on its summary. Use when an intent is approved and has no accepted spec yet.
---

# spec

## 1. When
The intent is approved and has no accepted spec.

## 2. Procedure
1. Write `spec.md` from `.agents/harness/templates/spec.md`: interpretation (S-n, each naming the intent sentence it comes from), design, **work units** (W-n — each lands as one commit passing the gates), **checks** (V-n — what to run, the expected result, how a fail looks), concerns, out of scope.
2. Review it against the user's own words, the intent and the product boundary (pl/plan-reviewer and pl/qa-plan-reviewer if switched on; else review it yourself and say so).
3. Write `summary_for_user` (3–5 lines) and show it. Wait for 진행 or 수정 — every time, no auto-accept.
4. On 진행: add `{ role: user, by, at, words, rev, kind: summary }` to `approvals:`, set `status: accepted`, commit.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. Planner (spec-writer, qa-designer) does steps 1 when switched on.

## 4. Files and lifetime
- `spec.md` — committed, kept.

## 5. Next
`implement`.

## 6. Stop and ask
- The spec needs something the intent does not say: go back to the user (and `intent`).
