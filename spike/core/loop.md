# Loop policy

The rules every role follows. `AGENTS.md` of the project wins on conflict; this file wins over
any single role or skill file. Vendor-neutral: any agent that can read files and run commands
can take any role.

## Stages

```
analyze → design → work → verify → review → qa → write → release
            ▲        ▲      │        │        │
            │        │      fail     changes  fail → triage ┐
            │        └──────┴────────┴──────────────────────┘   (bounded rounds, see Limits)
            └── spec gap found by triage (decision request)
```

| Stage   | Role file           | Reads                                    | Writes                                   |
| ------- | ------------------- | ---------------------------------------- | ---------------------------------------- |
| analyze | `roles/analyst.md`  | user request, ROADMAP, history decisions | ROADMAP entries, decision requests       |
| design  | `roles/architect.md`| ROADMAP entry, code                      | `.ai/plan/`, `.ai/work/`, QA scenarios   |
| work    | `roles/developer.md`| work file, failure report                | code, commits, history                   |
| verify  | `roles/verifier.md` | gate output only                         | `.ai/handoff/<stamp>_verify.md`          |
| review  | `roles/reviewer.md` | diff, work file                          | `.ai/handoff/<stamp>_review.md`          |
| qa      | `roles/qa.md`       | plan scenarios, running app — no code    | `.ai/test/`, `.ai/handoff/<stamp>_qa.md` |
| triage  | `roles/triage.md`   | failing report, code, failure catalog    | root cause, new work items               |
| write   | `roles/writer.md`   | commits, history, test reports           | README, PR body, release notes, posts    |
| release | `roles/release.md`  | passed branch, writer drafts             | PR, tag, release (user-invoked only)     |

The orchestrator (main session) owns `.ai/loop/state.json`, picks the next stage, and dispatches
roles. A role never starts the next stage on its own; it writes its report and stops.

## State

`.ai/loop/state.json` (schema: `schemas/state.schema.json`) is the only source of the current
position. Update it with `python3 .harness/harness.py state set …` or by editing the JSON. A new
session resumes from it; a different agent resumes from it.

## Limits

| Loop                         | Max rounds | Then                                   |
| ---------------------------- | ---------- | -------------------------------------- |
| verify fail → work           | 3          | escalate to orchestrator               |
| review changes → work        | 2          | escalate to orchestrator               |
| qa fail → triage → work      | 2          | orchestrator analyzes root cause       |
| orchestrator root cause      | 1          | escalation model (bindings `escalate`) |
| escalation                   | 1          | **human** with a decision request      |

A round counter resets when its stage passes. Counters live in `state.json`.

## Stops

Two kinds. Name the kind in every stop.

- **knowledge stop** — the loop does not know what to do (unknown failure, ambiguous spec,
  missing convention). Write a decision request (`schemas/decision-request.md`) with options and
  a recommendation. After the human answers, the `learn` skill records it so the same question is
  not asked twice. These stops are expected to get rarer over time.
- **intent stop** — the decision belongs to a person by design: changing a design invariant, a
  stable release, deleting data or published artifacts, force-pushing shared history, spending
  money, anything hard to undo. Never automated, never learned away.

## Knowledge

- `.ai/knowledge/failures.md` — failure catalog (`schemas/failure-entry.md`). Before any retry,
  search it by **symptom** (the error signature), not only by keyword:
  `grep -n -i '<distinctive part of the error>' .ai/knowledge/failures.md`.
- `.ai/history/*` — first line `decisions: <keyword>, …`; search with
  `grep -l 'decisions:.*<keyword>' .ai/history/*`.
- Promotion: an entry fixed the same way `verified ≥ 2` times is proposed for promotion — into a
  role/skill rule, or, if it is mechanically checkable, into a hook, lint rule, or script.
  Promotion is proposed in a decision request; it is applied only after the human agrees.

## Independence

- The role that wrote the code never issues the final pass. verify judges tool output; review
  and qa run on a different model (preferably a different vendor) per `bindings`.
- qa does not read source code. It works from the plan's scenarios, public docs, and the running
  app. If a scenario cannot be judged without reading code, qa reports it as `manual`.

## Handoffs

Every role ends by writing exactly one report in `.ai/handoff/` using `schemas/handoff.md` and
updating `state.json`. Reports carry reproduction steps, expected vs actual, and paths — enough
for a role with no shared context to act. Keep them short; link files instead of pasting them.

## Metrics

Append one JSON line per finished stage to `.ai/loop/metrics.jsonl`:
`{"ts", "stage", "result", "round", "model", "asked_human": bool, "stop_kind"}`. The number of
knowledge stops per item is the measure of how autonomous the loop has become.
