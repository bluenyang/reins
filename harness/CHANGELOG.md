# reins harness changelog

Read by `reins update`: it lists the entries newer than a project's pinned version.

## 0.3.4
- Gate discovery finds candidates by name and body: a script with `check`, `lint`, `test`, `typecheck`, `build`, `e2e`, `verify` or `ci` as a word of its name, or `type-check` (`lint:check`, `format:check`, `check:migrations`, `test:unit`, `build:web`), Makefile targets and go.mod below the root, workspace packages (pnpm, npm, yarn 1 and berry, bun, turbo, nx, lerna) and the one-line `run:` commands of pull-request workflows. Each candidate has a state and its reasons: picked, offered, already run by another script or gate, or excluded (rewrites files, never ends, install step, platform packaging). `lint:check` is no bundle any more but a gate of its own; a gate name has `-` where the script has `:`.
- `reins config gates --refresh` no longer reports new, changed or gone. It shows every gate and candidate with its state — applied, applied (written by hand / source not found / another command), not applied, not applied (already runs) — and leaves the same list in `.loctx/gates-refresh.md`, so the user picks and an agent edits `gates.yaml` in a commit of its own. reins never calls a gate gone and never removes one by itself; `--apply all` only adds, removing and replacing take a name.
- `.agents/harness/run-gates.sh` reads `gates.yaml` when it runs (POSIX `awk`, the shape reins writes) instead of holding the commands, so editing `gates.yaml` is enough. Another shape, or a missing `gates.yaml`, stops the run with exit 2 before anything runs. The script is written even without a required gate; `config gates` no longer rewrites it. `gates.yaml` is the project's file, not a generated one.
- Already installed repositories: run `reins config gates --refresh` once after `reins update` to see the candidates the new discovery finds; `update` does not change `gates.yaml`.
- husky: a hook file that already runs the gate script outside a reins block is neither proposed nor given a block again.
- Force push: the deny rules leave only `git push --force-with-lease origin <work branch>` open; the default branch (read from `origin/HEAD`, else `init.defaultBranch`, else `main` and `master`), tags, `--all`, `--mirror`, a push that names no branch, the `=` form, the flag in another place and a `+` refspec stay denied, as do `--force`, `-f` and hook bypass. The `merge` skill says to name the branch, or to merge the default branch in where force push is not possible; the stop block names force push to the default branch or a tag.
- Skills (0.3.3 retro): open `.loctx/delegation.local.md` before anything else when work starts (`intent`, `implement`, the delegation block); `git diff --stat` at the head of a review request, checked against the diff received (`review`); keep the request to another model and its final answer in `.loctx/reports/<version>/` as they came (every skill that calls one); compare the two language editions again after the last change (`review`, `test`); read both roadmaps and the review records when revising a spec (`spec`); rate each violation's severity and put independent opinions beside a high one's remedy (`audit`).
- `update` lists these entries under a heading per version.

## 0.3.3
- Stable 2026-11-17 (same harness as rc.1).
- Gate discovery: the root `typecheck` and `lint` scripts become gate candidates in `reins install` and `reins config gates --refresh`, unless the chosen bundle check already calls them (by name, or an identical command). Only a command that runs the script counts; recursive, filtered, other-directory and task-runner calls (`pnpm -r`, `--filter`, `--dir`, `turbo`, `nx`, `lerna`), a command with any option and a mere mention (`echo lint`) do not; a script that rewrites files is left out. Order: check, lint, typecheck, test, build, e2e.
- Already installed repositories: `reins update` does not change `gates.yaml`. Run `reins config gates --refresh` once to see the new candidates and apply the ones you want.
- Personal settings: a group in `.loctx/bindings.local.yaml` wins only where it speaks (a role alone keeps the team's group and its other roles; a group model replaces the team's; a fallback alone is added to the team's model instead of switching the group off; `{}` switches it off), and the `config` models screen shows the file of the chosen scope. `reins config` or `reins update` rewrites `.loctx/delegation.local.md` accordingly.
- The second audit's range starts at the end SHA of the first audit record's `first.range` (the default branch's SHA when the merge rewrote commits); the PM copies it into the audit request and `second.range` unchanged. Changed in the `audit` skill, the auditor role and the audit template.

## 0.3.2
- Stable 2026-11-15 (same harness as rc.1).
- The PM is the model in the conversation. The delegation block no longer names a PM model, roles without a model are done by that same model, and so is the audit when the auditor has no model (a fresh run, or another model the user chooses). `default` in `bindings.yaml` (and the personal file) is no longer read: files that hold it keep loading, `config` drops the key when it writes the file, and `config bindings --set default=…` is refused. `update` no longer carries a 0.2.0 `pm` role over.
- The report of `update` (and of `install` and `config`) marks a generated file it rewrote as changed (`~`); only a path that did not exist before the run is new (`+`).
- One flow after the approvals: once the spec is accepted, implementation, review, test, push, PR and CI follow without asking, with one report at the end. "Anything that leaves the machine" is no longer a stop for a branch of the work in progress; a merge (every PR) and a stable release still wait for the user's instruction.
- Adjusting the spec while working: only a work unit added, dropped or rescoped stops for approval. A smaller adjustment (another method inside a unit, a small fix from a review, an audit or an rc check, another order, a change with a precedent) goes on, is recorded in the spec's new adjustment record (`A-n`) and is reported at the end of the flow. The audit keeps a recorded adjustment and names an unrecorded one.
- Two audits per version. The first audit runs after CI and before the merge, on the PR branch, and looks for risk; its record is committed on that branch and the merge follows on the user's instruction. The second audit runs after the stable release, looks at procedure only and hands its result to the retro. Fixing records or documents does not call for another audit. `.agents/audit/<version>.md` holds both (`## 1차 감사`, `## 2차 감사`); the template changed.
- Accepted findings: an audit finding the user accepted three times or more is proposed by the retro as a knowledge entry of `kind: accepted-finding` (a new value in the knowledge schema). Both audits read those entries and list such a finding as a known acceptance instead of a violation.
- Where a loop ends: the retro ends the loop — the PM reports that it is closed and stops, and the next intent is written when the user starts the next work (or the user named another end for that run). While a release approval, a merge or a stable instruction is awaited, the PM reports and waits and does not start another unit's work. Naming a version is not an instruction to start it; ideas go to the roadmap whenever they come.
- Merge, review and retro: the PM judges which PR a merge instruction means (the named one, what it proposed, or the PR just spoken of) and asks when it cannot tell; the merged branch is deleted at the merge; when a merge rewrites commits, later records name the default branch's SHAs and a SHA table is kept in the audit record. Every work unit is reviewed, also one that changes tests or documents only, or the spec records that it was not and why. The retro lists apart the proposals that are about the harness itself.
- New `.agents/harness/templates/agents-md-guide.md`: what the project sections of AGENTS.md hold (the project, its overall goals, structure, commands, common rules, red lines) and where everything else goes (roadmap, knowledge, `.loctx/`, CONTRIBUTING). The `onboard` skill sorts existing content by it and shows the user what goes where. `update` from 0.3.0 or 0.3.1 leaves a `reins:tidy pending` note in AGENTS.md once, so the PM sorts the file with the user; reins itself does not touch the project's text.

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
