---
name: decide
description: Write a decision request when the loop cannot proceed — options, recommendation, kind (knowledge or intent) — and block the loop on it.
args: '<question>'
model_invocable: true
---

Read `.harness/core/schemas/decision-request.md`.

1. Before writing, search for an earlier answer: `.ai/knowledge/failures.md` by symptom,
   `grep -l 'decisions:.*<keyword>' .ai/history/*`, answered files in `.ai/decisions/`.
   A match that fits → apply it and do not ask.
2. Write `.ai/decisions/<stamp>_<slug>.md` with 2–4 options, consequences, and a recommendation.
   `kind: intent` for anything listed under intent stops in `loop.md`.
3. `python3 .harness/harness.py state set --stage human --blocked-on <path>`.

Show the question, options, and recommendation in the reply, short enough to answer in a minute.
