# reins harness changelog

Read by `reins update`: it lists the entries newer than a project's pinned version.

## 0.3.2
- The PM is the model in the conversation. The delegation block no longer names a PM model, roles without a model are done by that same model, and so is the audit when the auditor has no model (a fresh run, or another model the user chooses). `default` in `bindings.yaml` (and the personal file) is no longer read: files that hold it keep loading, `config` drops the key when it writes the file, and `config bindings --set default=…` is refused. `update` no longer carries a 0.2.0 `pm` role over.
- The report of `update` (and of `install` and `config`) marks a generated file it rewrote as changed (`~`); only a path that did not exist before the run is new (`+`).
- One flow after the approvals: once the spec is accepted, implementation, review, test, push, PR and CI follow without asking, with one report at the end. "Anything that leaves the machine" is no longer a stop for a branch of the work in progress; a merge (every PR) and a stable release still wait for the user's instruction.
- Adjusting the spec while working: only a work unit added, dropped or rescoped stops for approval. A smaller adjustment (another method inside a unit, a small fix from a review, an audit or an rc check, another order, a change with a precedent) goes on, is recorded in the spec's new adjustment record (`A-n`) and is reported at the end of the flow. The audit keeps a recorded adjustment and names an unrecorded one.
- Two audits per version. The first audit runs after CI and before the merge, on the PR branch, and looks for risk; its record is committed on that branch and the merge follows on the user's instruction. The second audit runs after the stable release, looks at procedure only and hands its result to the retro. Fixing records or documents does not call for another audit. `.agents/audit/<version>.md` holds both (`## 1차 감사`, `## 2차 감사`); the template changed.
- Accepted findings: an audit finding the user accepted three times or more is proposed by the retro as a knowledge entry of `kind: accepted-finding` (a new value in the knowledge schema). Both audits read those entries and list such a finding as a known acceptance instead of a violation.
- Where a loop ends: the retro ends the loop — the PM reports that it is closed and stops, and the next intent is written when the user starts the next work (or the user named another end for that run). While a release approval, a merge or a stable instruction is awaited, the PM reports and waits and does not start another unit's work. Naming a version is not an instruction to start it; ideas go to the roadmap whenever they come.
- Merge, review and retro: the PM judges which PR a merge instruction means (the named one, what it proposed, or the PR just spoken of) and asks when it cannot tell; the merged branch is deleted at the merge; when a merge rewrites commits, later records name the default branch's SHAs and a SHA table is kept in the audit record. Every work unit is reviewed, also one that changes tests or documents only, or the spec records that it was not and why. The retro lists apart the proposals that are about the harness itself.

## 0.3.1
- Stable 2026-11-11 (same harness as rc.2).
- The `retro` skill and the retrospector propose knowledge candidates from decisions and failures repeated in history and the audit.
- `.claude/settings.json` is merged: reins changes only the deny rules it wrote (listed under `owned:` in `generated.yaml`) and keeps the user's entries, also with `--force` and in a file it never wrote. The audit counts only those rules as drift.
- The auditor is read-only: its call line no longer asks for write access, it returns the audit record as its answer and the PM writes it unchanged.
- New `.agents/harness/run-gates.sh`: runs the gates of `gates.yaml` and keeps their output in `.loctx/reports/gates/<tree>.log`. Hooks call it with one line (`sh .agents/harness/run-gates.sh pre-commit`); `update` rewrites the hooks block 0.3.0 wrote and shows what it held. The PM fills missing logs before the audit; the retro deletes them.
- `models.yaml` adds `claude-fable-5-2`, `gpt-6-sol` and `gpt-6-luna`.
- `update` heads the `.agents/AGENTS.previous.md` it makes from an install of 0.2.0 or earlier with a warning not to run the reins commands named in it.
- Fallback models: `fallback` on a group or a role in `bindings.yaml` (and the personal file); the delegation table names the fallback and how to call it, and the PM uses it when a role's call cannot be made. A `bindings.yaml` that holds a `fallback` is refused by the `config` of 0.3.0, so everyone on the team moves to 0.3.1. `update` carries a 0.2.0 `fallback` over with its model.
- `config gates --refresh [--apply <name…|all>]` and a `gates` item on the config screen: the discovery of installation runs again, the differences from `gates.yaml` are shown, and only what is picked is applied; the gate script follows.
- A call line in the delegation table uses the vendor's default command (`codex`, `agy`, `cursor-agent`) when the settings record no CLI for it, instead of the vendor's name.

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
