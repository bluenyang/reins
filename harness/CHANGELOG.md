# reins harness changelog

Read by `reins update`: it lists the entries newer than a project's pinned version.

## 0.3.1
- The `retro` skill and the retrospector propose knowledge candidates from decisions and failures repeated in history and the audit.
- `.claude/settings.json` is merged: reins changes only the deny rules it wrote (listed under `owned:` in `generated.yaml`) and keeps the user's entries, also with `--force` and in a file it never wrote. The audit counts only those rules as drift.
- The auditor is read-only: its call line no longer asks for write access, it returns the audit record as its answer and the PM writes it unchanged.
- New `.agents/harness/run-gates.sh`: runs the gates of `gates.yaml` and keeps their output in `.loctx/reports/gates/<tree>.log`. Hooks call it with one line (`sh .agents/harness/run-gates.sh pre-commit`); `update` rewrites the hooks block 0.3.0 wrote and shows what it held. The PM fills missing logs before the audit; the retro deletes them.
- `models.yaml` adds `claude-fable-5-2`, `gpt-6-sol` and `gpt-6-luna`.
- `update` heads the `.agents/AGENTS.previous.md` it makes from an install of 0.2.0 or earlier with a warning not to run the reins commands named in it.

## 0.3.0
- Stable 2026-11-10 (same harness as rc.4).
- rc.3: every skill's delegation section and the delegation block point to `.loctx/delegation.local.md` first; the flow block, `implement`, `spec`, `audit` and the implementer, planner and auditor roles commit at meaningful units (revertible without taking other work along) instead of one commit per unit; the audit reads PR and CI records the PM collects and stays offline.
- rc.2: `models.yaml` lists known models per vendor; a mode switch adds `reins:mode-changed` (no AGENTS.previous.md); the `onboard` skill handles it.
- Seven role groups replace the twelve roles; bindings.yaml version 2 (mode, audit, groups); `update` converts version 1.
- Eleven stage skills without the `reins-` prefix replace the ten `reins-*` skills; none calls reins.
- AGENTS.md blocks: notice, layout, settings, flow, delegation, records, stops, language; an onboarding or reconcile note for the PM.
- Templates: intent (plan, waivers), spec (work units, checks), audit, history. Gone: plan, ticket, bus, stops, enforcement, transitions, budget.

## 0.1.2
- Intent status gains `released` (set once a stable version of the intent is out); `reins status` folds such an intent into one line with no next action. Additive: existing values are unchanged.
- `reins gate --ticket <id> --respond` writes the bus response for the open verify request; verify-tool is now that call plus `reins check --stage verdict`.

## 0.1.1
- qa-design default binding is now gemini-4-argon-high and qa-run gemini-3.8-flash-medium (fallbacks unchanged).
- Generated settings deny `Bash(git commit -n *)` alongside `--no-verify`.
- Premise stops C1 and C2 are now P1 and P2, so a stop reason id has one meaning; red lines C1–C10 are unchanged. `metrics` still reads old C1/C2 records as P1/P2.

## 0.1.0
- First harness: twelve roles, red lines C1–C10, stop conditions A1–G2, schemas, templates, Node knowledge seeds.
- Workflow block: committing each finished unit as you go is part of the work.
- verify-tool runs gates through `reins gate` and cites its report files as evidence; `reins check` gains ticket-start (T1), verdict (T3) and rc-close (T5).
