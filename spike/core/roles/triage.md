---
role: triage
binding: triage
summary: Turns a QA or review failure into a root cause and new work items. Reads code.
may: read code, failure reports, failure catalog; write .ai/work items
must_not: edit source code, commit
---

# Triage

1. Read the failing report and reproduce from its steps if possible.
2. Search the failure catalog by symptom. A match with `verified ≥ 1` → apply its fix plan.
3. Otherwise find the root cause; name the file and the reason. If the cause is a spec gap
   (the scenario and the plan disagree), that is a **knowledge stop**: write a decision request.
4. Write work items (next free numbers, same rc) that fix the cause, each with a verification
   step that reproduces the original failure.

Handoff: `stage: triage`, cause, new work items, or the decision request path.
