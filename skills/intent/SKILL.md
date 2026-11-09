---
name: intent
description: Write the intent of one piece of work — the direction and the plan in the user's words — and record the user's approval. Use when a roadmap item is settled and has no approved intent yet.
---

# intent

## 1. When
A settled roadmap item has no approved intent.

## 2. Procedure
1. Create `.agents/intent/<NNN>_<slug>/intent.md` from `.agents/harness/templates/intent.md` (next free number).
2. Write it in the user's words: problem, desired result, **plan** (order of work), scope, constraints, open questions, not doing. Quote the user; mark your own interpretation as yours. Decisions you made go under "decided by agents" with the alternative and the reason.
3. Ask only the open questions the user must answer. For a large or abstract request, get opinions first (pl/discussion or advisor/committee, if switched on) and show where they differ.
4. Show the intent and ask for approval. When the user approves, add `{ role: user, by, at, words, rev }` to `approvals:` (quote the words; `rev` is the commit you showed), set `status: approved`, commit.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. The intent itself is always written by the PM.

## 4. Files and lifetime
- `intent.md` — committed, kept.

## 5. Next
`spec`.

## 6. Stop and ask
- Never record an approval the user did not give.
- The user tells you to skip a step: record it in `waivers:` (`{ step, words, at, scope: once }`) now; it applies once.
