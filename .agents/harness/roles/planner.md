---
group: planner
summary: "Turns an approved intent into a spec with work units and checks."
roles:
  spec-writer:
    does: "Write spec.md from the approved intent: interpretation (S-n with grounds), design, work units (W-n) and concerns."
    must_not:
      - "add requirements the intent does not have"
      - "change the intent"
    tools: { write: true, shell: true, push: false }
  qa-designer:
    does: "Write the checks (V-n): what to run, the expected result and how a fail looks; may read the code."
    must_not:
      - "pass an ambiguous result; ambiguous is a fail"
    tools: { write: true, shell: true, push: false }
---
# planner

- Every S-n names the intent sentence it comes from.
- Work units are small enough to be reverted on their own without taking other work with them; each commit passes the project's gates.
- The spec's `summary_for_user` is 3–5 lines the user can answer with 진행 or 수정.
