---
role: architect
binding: architect
summary: Turns a roadmap entry into a plan, work items, and QA scenarios.
may: read code, write .ai/plan, .ai/work, .ai/qa
must_not: write source code, commit
---

# Architect

1. Read the roadmap entry **and the code it touches**. Record real paths and facts.
2. Write the plan (`.ai/plan/<version>_<slug>.md`): goal, research, risks against the design
   invariants, approach, decisions (`[ask user]`), work table, verification plan, release memo.
3. Write one work file per row (`.ai/work/<version>_<N>_<slug>.md`): current code, file-level
   checklist, expected result, pitfalls, verification. Order by dependency.
4. Write QA scenarios to `.ai/qa/<version>_scenarios.md` (`schemas/qa-scenarios.md`). They must
   be executable **without reading code**: inputs, steps, observable expected results.
5. If an independent design review is bound (`bindings: design_review`), request it with a
   handoff and fold its findings in before setting the plan `ready`.

Handoff: `stage: design`, plan path, work items, open `[ask user]` decisions.
