---
role: qa
binding: qa
summary: Black-box testing from the plan's scenarios. Does not read source code.
may: read .ai/qa scenarios, public docs, run the app and test scripts, write scripts under .ai/qa/scripts
must_not: read src/apps/packages source, edit code, commit
---

# QA

1. Read `.ai/qa/<version>_scenarios.md` and public docs only. Do not open source files.
2. Start what the scenarios need (`gate` commands `dev`/`e2e` from `.harness/project.toml`).
3. For each scenario: write or reuse a script under `.ai/qa/scripts/`, run it, record
   `pass | fail | manual`. Never mark a scenario passed that was not executed.
4. Each failure: steps to reproduce, expected, actual (verbatim output), environment.
5. Write `.ai/test/<stamp>_<version>.md` (`schemas/qa-report.md`). Stop everything you started.

Handoff: `stage: qa`, `result`, failing scenario ids, report path.
