# reins — design document, v1.0 (2026-10-25)

> English edition. The Korean original is [`design.ko.md`](design.ko.md); where the two disagree, the Korean file wins. This is the design for the planning document [`proposal.md`](proposal.md) v1.1 — structure and formats, no code.

## 0. Principles — five lines that run through the whole design
1. **Roles are independent of models.** Any role runs on any model; everything works on Claude alone. (R14·R57)
2. **Prohibitions are enumerated, permissions are described.** The verifier enforces only the "must not" list — which is what keeps it deterministic. (R4·R7)
3. **Roles judge, scripts enforce.** Neither the verifier nor the CLI reasons. A role writes its verdict to the bus; the verifier applies it. (R5·R7)
4. **The commit boundary is in the name.** `.agents/` is committed agent context, `.loctx/` is this machine only; the rest of the root is for people and code. (R34·R35)
5. **Where a standard exists, follow it.** `AGENTS.md` and `SKILL.md` are standards; only roles, permissions and hooks are generated. (R31·R32)

## 1. Layout (= layout v4)
```
<project>/
├── AGENTS.md                 committed · managed blocks (tool) + project sections
├── .agents/                  committed · agent context
│   ├── intent/<id>_<slug>/{intent,spec,plan}.md
│   ├── knowledge/  harness/{policy,roles,schemas,templates, bindings.yaml, gates.yaml, install.yaml}  SKILLS.md  skills/
├── .claude/ .codex/ .gemini/ .cursor/   committed · generated
├── docs/  (ROADMAP.md, planning and design documents, shared benchmarks and research)   test/  (unit · integration · e2e)
└── .loctx/                   gitignored (plus its own .gitignore) · ROADMAP.local.md ticket/ reports/ pr/ release/ context/ bus/ test/ history/
```
Know-how (`.loctx/history/`) differs per person and stays local; only the explicit knowledge distilled from it (`knowledge/`) is committed (R54).

## 2. Roles and red lines (D1)
### Common red lines C1–C10 — every role
C1 implementing "to pass" (hard-coding, making things merely look right) · C2 editing `AGENTS.md` managed blocks, `policy/` or `roles/` (PM and `update` only) · C3 editing one's own permission file or generated output · C4 reading secrets · C5 bypassing hooks or massaging gate output (`| tail`) · C6 push/PR/merge/release/tag (deploy role only) · C7 reversing a past decision without the user · C8 re-raising a rejected proposal · C9 touching production servers or clusters · C10 changes outside intent and plan (open a new ticket instead)

How each is held (`held`): **blocked** by a script, hook or deny before it happens · **checked** at a transition or by the drift check · **advised** in role and skill text only. The source is `policy/enforcement.yaml` (one line per rule: C1–C10, A1–G2, T1–T6, every role `must_not` item as `<role>#<n>`, budget scopes); the grade is the strongest part that really holds, and `gap` names what is left open. The table is rendered from it; details in [`violations.md`](violations.md).

<!-- enforcement:begin redlines -->
| id | held | by | gap |
|---|---|---|---|
| C1 | advised | `role` | judged by reviewers only; nothing detects a hard-coded pass |
| C2 | blocked | `hook:pre-commit`, `check:drift` | only when the hook is installed; the edit itself is not prevented |
| C3 | blocked | `hook:pre-commit`, `check:drift` | only when the hook is installed; no deny rule covers .claude/settings.json itself |
| C4 | blocked | `deny`, `hook:pre-commit` | Claude Code only; .env.* is a finite list, so names such as .env.custom have no deny rule; the hook sees staged paths, not reads |
| C5 | blocked | `deny`, `gate`, `check:verdict` | combined or later-position forms such as git commit -nm are not denied |
| C6 | advised | `role` | pre-push holds pushes to the default branch (A4) and the deny rules stop force and --no-verify pushes; any other push, PR, merge, release or tag is not blocked |
| C7 | advised | `role` | — |
| C8 | advised | `role` | — |
| C9 | advised | `role` | — |
| C10 | advised | `role` | T2 lists it but the pre-commit check does not compare the diff with plan.md |
<!-- enforcement:end -->

### Twelve roles — default bindings are reference values
| Role | Default | Does | Must never |
|---|---|---|---|
| pm | Opus | talks with the user, proposes intent confirmation, first spec approval plus the user summary, sets budgets, project sections of AGENTS, roadmap | edit code · confirm an intent without the user |
| planner | Opus | questionnaires, refining intent, **spec.md** | edit code · add out-of-scope requirements |
| pl | Sonnet | **plan.md**, plan→ticket, directs implementers, judges from results | push/PR/release · judge tests · merge own code |
| implementer (parallel) | Sonnet | implements a ticket, runs gates, commits | files outside the plan · judge own work |
| lookup | Haiku | finds decisions, code, docs and hands them over | **write any file** |
| verify-tool | Haiku | runs gates and scenarios, attaches raw output (R46), summarises failures so the PL grasps them (R51) | edit code · report a failure as a pass · claim a run that did not happen |
| code-review | GPT | checks diff against plan and spec, **proposes** fixes | edit code · decide merges |
| qa-design | Gemini Pro | designs scenarios, first review of spec, light review of plan | **read code** · implement |
| qa-run | Gemini Flash | runs scenarios and judges | pass anything ambiguous (always fail, R17) |
| deploy | Haiku→Sonnet→Opus | push, PR, rc, publish notes | stable release (explicit request only) · production · force push |
| docs | Sonnet/Haiku | README and public docs (en + .ko), PR and release-note drafts, the polishing slot | edit code · state unverified behaviour as fact |
| advisor | Fable | root-cause analysis at the end of the chain | widen its authority without the user |
Role file `harness/roles/<r>.md`: frontmatter `must_not:` (the enforced source) · `may:` (descriptive) · body procedure.

## 3. Stop conditions and the verifier (D3·D4)
### Four grades
**HOLD** needs the user's answer · **STOP** fixable without a person, resumable · **ESCALATE** the failure chain (pl→pm→advisor→user, R18) · **ABORT** revert — a role's action, not a verifier verdict.
Every stop records ① where ② why (`reason: <ID>`) ③ how to resume (R48). Re-running the same command continues from that point.

### Twenty-four conditions in seven groups (full table in the draft, D3)
| Group | IDs | kind |
|---|---|---|
| A irreversible | A1 force push · tag deletion (pre-push: HOLD) · main rewrite / A2 stable release / A3 data · production / A4 leaving the machine outside the pre-release loop | intent |
| B decision | B1 open `asks:` / B2 invariant change without a decision / B3 conflict with intent or spec / B4 roadmap silent or contradictory / B5 external assumption broken, scope changes | intent |
| P premise | P1 rationale collapsed (fix plan and ticket first) / P2 diff departs from plan with no update (R45) | knowledge |
| D failure | D1 two rounds in the same unit (ticket before rc.1, rc after) / D2 red check twice / D3 flaky → isolate, continue, report / D4 suspected false pass (gate output that is empty is a WARN, not a STOP) / D5 pass without evidence | knowledge |
| E cost | E1 80% warning (not a stop) / E2 scope budget 100% STOP / E3 rc or session 100% HOLD — warning only when no value is set | knowledge |
| F violation | F1 red-line attempt / F2 drift / F3 rejected proposal re-raised | knowledge |
| G interrupt | G1 chat · Ctrl+C · session end → record resume info / G2 user vetoes the spec summary | intent |
`kind` is the distinction kept from the spike: **intent** (a person's call, never automated) / **knowledge** (learned away over time). Metric: knowledge stops per item. Counters (D1·D2) reset on a pass.
Metrics: the stage skills end every role run with one `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>` call, and record nothing when the vendor gives no token count. Every `reins check` and `reins gate` run appends a `reins/metric@1` line to `.loctx/reports/metrics.jsonl`; token usage is added by the caller with `reins metrics record`. `reins metrics` summarises tokens by role, vendor, ticket and intent, and knowledge stops per ticket.
Of these, the surveyed repositories had only A, B1, D1 and D2 — everything else is new.

### How each condition is held
Same source and columns as the red lines above (`held`: blocked · checked · advised), for the stop conditions and the six transition points. A stop whose `detect:` says `verifier` can still be `advised` here, because `held` records what the code does today, not what the design intends.

<!-- enforcement:begin stops -->
| id | held | by | gap |
|---|---|---|---|
| A1 | blocked | `deny`, `hook:pre-push` | moving a published tag forward to a descendant passes the ancestry test |
| A2 | advised | `role` | — |
| A3 | advised | `role` | — |
| A4 | blocked | `hook:pre-push` | only a push to the default branch is held; other ways of leaving the machine are not detected |
| B1 | checked | `check:ticket-start` | — |
| B2 | advised | `role` | — |
| B3 | advised | `role`, `check:ticket-start` | the scope conflict is a role's judgement; ticket-start checks only the approval chain |
| B4 | advised | `role` | — |
| B5 | advised | `role` | — |
| P1 | advised | `role` | — |
| P2 | checked | `check:ticket-start`, `check:rc-close` | only ticket-in-plan; a diff is not compared with plan.md |
| D1 | checked | `check:verdict` | does not tell a ticket before rc.1 from an rc after |
| D2 | advised | `role` | no memory across runs |
| D3 | advised | `role` | no alone-versus-full-run comparison |
| D4 | blocked | `gate`, `check:verdict` | an empty gate output is only a WARN |
| D5 | checked | `check:verdict` | — |
| E1 | advised | `role` | nothing reads a budget or a token count |
| E2 | advised | `role` | nothing reads a budget or a token count |
| E3 | advised | `role` | T5 lists it but nothing reads a budget or a token count |
| F1 | advised | `role` | the deny rules stop some attempts in Claude Code, but no stop is recorded |
| F2 | blocked | `hook:pre-commit`, `check:drift`, `check:ticket-start`, `check:rc-close` | — |
| F3 | advised | `role` | — |
| G1 | advised | `role` | no signal handler and no resume record on an interrupt |
| G2 | advised | `role` | — |
| T1 | checked | `check:ticket-start` | budget-left is not implemented |
| T2 | blocked | `hook:pre-commit` | only when the hook is installed; the P2 and C10 diff checks do not exist |
| T3 | checked | `check:verdict` | — |
| T4 | blocked | `hook:pre-push` | implements A1 and the default-branch push (A4); A2, A3, C6 and the loop-step check do not exist |
| T5 | checked | `check:rc-close` | E3 is not implemented |
| T6 | advised | `role` | no code runs on an interrupt or a violation signal |
<!-- enforcement:end -->

### Budget scopes — the narrower scope wins
project default (install, `policy/budget`) < version (PM, plan.md) < **user-defined scopes** (shipped: ticket · rc · session · role; `configure budget`). Unit: tokens. Without defaults, measure on first use.

### The verifier = `reins check` — six transition points
T1 before a ticket starts (B1 · dependencies · budget · bindings · **`asks:` against `decisions:` to stop the same question recurring**) · T2 before commit (P2·C10·F2·C4·C5) · T3 at judgement (D1–D5 · evidence) · T4 before leaving the machine (A · C6 · loop stage · **a push to the default branch is A4 HOLD**, except the publish workflow's `release: v…` commits under `GITHUB_ACTIONS=true`) · T5 at rc close (E3 · zero open tickets, planned and stabilisation · history written · plan-agreement S7 · **reports the next rc number from `.loctx/release/<V>.md`, rc.1 when there is none, and stops F2 when that number is already recorded**) · T6 always (G1·F1).
Stage names for `reins check --stage`: `ticket-start --ticket <id>` (T1) · `pre-commit` (T2, hook) · `verdict --ticket <id>` (T3) · `pre-push` (T4, hook) · `rc-close --release <version> [--stable]` (T5). Checks without their own id (dependencies, plan agreement, history written) report as F2.
Verdicts CONTINUE / HOLD / STOP / ESCALATE → bus `stop-report` (reason · resume info · one line in the user's language). Exit codes 0/10/20/30.
Loop tier: fewer roles, same T and conditions. Harness tier: T2·T4·T6 only.
Who catches which of the 34 (red lines C1–C10, conditions A1–G2), by the code as it stands, and the scenarios that back it: [`violations.md`](violations.md).

## 4. The five files people and agents exchange (D5·D6·D2)
Common: YAML frontmatter (machine, schema-validated) + Markdown body (people). Body in the user's language, keys and the bus in English. Empty sections read `—`. **Approval = frontmatter `approvals:` plus the `Approved-by:` trailer on the status-changing commit** — no separate ledger.

| File | Where | Sections | Approval |
|---|---|---|---|
| **intent.md** | `.agents/intent/<NNN>_<slug>/` | problem · desired outcome · impact · constraints · open questions · **questionnaire record** · **not doing** | user |
| **spec.md** | same | reading of requirements (`S-n`) · design (invariant conflicts mandatory) · concerns · acceptance criteria · out of scope. Frontmatter `summary_for_user:` 3–5 lines | pm + qa-design first → **user summary veto** (R64) |
| **plan.md** | same | files that change · **order of work (→ tickets)** · risks · proof · test checklist · **departure log** (R45). `agents:` roles only, `budget:` | qa-design, light |
| **ticket** | `.loctx/ticket/<intent>-<n>_<slug>.md` | the surveyed repos' seven work sections unchanged (purpose · current code · tasks · decisions · expected · caveats · verification). Frontmatter `release: planned\|stabilization` · `asks:` · `budget:` · `depends:` | — |
| **bus** | `.loctx/bus/*.{request,response}.yaml` | request: changes · why · tried · not_tried · deadline · revert · errors (raw output) / response: verdict · grounds · fixes · may_proceed · major_issues · evidence · suggested_next | — |

State transitions: T1 passes only when intent is `approved` ∧ spec `accepted` ∧ plan `reviewed`. One item in plan §order of work = one ticket. Intent status is `draft` → `approved` → `released`: the deploy role sets `released` once the stable version of the intent is out, and `reins status` then shows the intent as one `released` line with no next action; `superseded` stays as is. Ticket `done` → one line in history → deleted. Bus files are deleted once the response is summarised in history.

### Version and rc convention (maintainer)
A version is a bundle of intents. **rc.1 = everything planned is complete.** rc.N = stabilisation only (bugs, adjustments, small additional intents). An rc is the pre-release stage for human verification. Keep versions small. Ticket `release:` says planned or stabilisation.

**PR flow.** Work reaches the default branch only through a `type/topic` branch → PR → green CI → merge. The deploy role pushes the branch and opens the PR (body drafted by docs), waits with `gh pr checks --watch`, and merges with `gh pr merge --rebase --delete-branch` only when every required check is green; a red check is not merged but returned to the PL (D2). The PL and implementers never merge. T4 enforces this by holding a direct push to the default branch (`master`/`main`, A4); branch protection (PR required, check `ci`) is a repository setting the user turns on.

**Release settings.** How a repository releases is set in `.agents/harness/install.yaml` under `release:` (optional; `reins/install@1` is unchanged, the key is only added): `workflows:` is a list of `{file, inputs, stages: [rc, stable], approval: npm-staged|none}` (`stages` defaults to both; `{version}` inside an input value becomes the dispatched version). Without `release:` the deploy role stops after the merge and reports "no release settings". `reins install` and `reins update` keep `release:` and every key they do not know when they rewrite the file. When `install.yaml` has no `release:` key, `install` and `migrate` (and their dry runs) scan `.github/workflows/*.yml|yaml` for an `on: workflow_dispatch` trigger (string, list or map form) and print one draft per workflow in the notes: `{file, inputs, approval: none}`, with an input named `version` mapped to `"{version}"`, `tag` to `"v{version}"`, a boolean to `"false"` and any other to `"<fill in>"`. It is a proposal only; reins never writes it, the maintainer decides. **Release documents.** `release:` may also list `docs: [{file, check}]` (optional, no default, additive): `roadmap-row` (a table row whose first cell is `<V>` and whose state cell is not `planned`/`계획`), `changelog-section` (an `## [Unreleased] — <V>` or `## [<V>]` heading for an rc; `## [<V>]` for stable) and `mentions-version` (`<V>` appears in the file as a token of its own, e.g. the README status line). Before T5 the docs role updates these files on the release branch so the change ships in the release PR (rc and stable); T5 then emits one F2 WARN per file that still describes the previous state (`docs: <file> still describes the previous state (<check>)`), never a STOP, and nothing is checked without `release.docs`. This repository lists `docs/ROADMAP.md` and `docs/ROADMAP.ko.md` (roadmap-row), `CHANGELOG.md` (changelog-section), `README.md` and `docs/README.ko.md` (mentions-version). reins' own flow is the value `workflows: [{file: publish.yml, inputs: {version: "{version}", dry_run: "false"}, approval: npm-staged}]`. In this repository `publish.yml` checks out with the `PUBLISH_DEPLOY_KEY` secret when it is set, so its release commit and tag pass a default-branch ruleset whose only bypass is deploy keys; without the secret it falls back to the workflow token.

**rc and stable.** The deploy role's scope is the PR, the merge into the repository's default branch, and the configured workflow dispatch. When T5 passes for a version `<V>`, it also prints one `dispatch: gh workflow run <file> -f k=v …` line per workflow whose `stages` include rc (also in `--json`), built from `release:` with the number T5 reported, and the deploy role runs that line as printed; if the dispatch is refused for permissions it does not look for another way but hands the line to the user. It then appends one line (`- rc.<N> <commit> <stage id> <date>`) to `.loctx/release/<V>.md` (a local, git-ignored ledger). Fixes after an rc are tickets with `release: stabilization`; when all are closed, T5 passes again and the next rc is cut. A stable `<V>` is cut only on the user's instruction (A2): `reins check --stage rc-close --release <V> --stable` runs the same checks but prints the stable lines (`dispatch (stable — user's instruction only, A2): gh workflow run …`, also in `--json`) instead of the next rc, and warns `no rc recorded for <V>` when the ledger has none; without `--stable` T5 adds only the line `stable: rerun with --stable on the user's instruction`, so an agent cutting an rc never sees a stable line to run. Behaviour specific to `approval: npm-staged` applies only to workflows with that value: finding the run by its run-name, recording the "staged with id" line in the ledger, the user's approval of the staged version on npm (an rc is staged too and is public only after that approval), and the stable condition that a `v<V>-rc.*` tag sits exactly on the default branch's HEAD (the rc's own release commit; nothing may land between the last rc and stable).

### Stage skills
Ten skills, one per workflow stage; `reins-loop` is the conductor that calls the stage skills in order and holds only the common rules (verdict codes, metrics, interruption record). Each stage skill is a thin entry point: its first step is its own check, it follows the verdict (CONTINUE · HOLD · STOP · ESCALATE) and stops on HOLD or STOP, and called alone it still completes its stage. Judgement stays with the roles and enforcement with the scripts; a skill adds no verdict logic of its own. Stages without a `--stage` check (roadmap, intent, spec, test, retro, and review without a ticket) start with `reins check --drift` and `reins status`; a missing earlier artefact is a HOLD that asks the user.

| Skill | Role | First check | Output | Next |
|---|---|---|---|---|
| `reins-roadmap` | pm | status + drift | `docs/ROADMAP.md` (both editions), target version | `reins-intent` |
| `reins-intent` | pm | drift | approved `intent.md` | `reins-spec` |
| `reins-spec` | planner → pm, qa-design → pl | drift, intent approved | accepted `spec.md`, `plan.md`, tickets | `reins-implement` |
| `reins-implement` | implementer | **T1** | commits (hook **T2**) | `reins-review` |
| `reins-review` | verify-tool → code-review; pl decides | drift; with a ticket, verify exchange then **T3** | bus responses, ticket close | `reins-implement` or `reins-test` |
| `reins-test` | qa-design → qa-run, verify-tool | status + drift; no open ticket for the version | e2e scenarios, results, build | `reins-release` |
| `reins-release` | deploy | **T5** (hook **T4** on push) | PR, CI, merge, rc | `reins-retro` |
| `reins-retro` | pm | status | retrospective summary | `reins-roadmap` or the next intent |

`reins-review` without a ticket (a range the user edited) runs drift only and leaves a review-only bus pair; it neither calls T3 nor closes a ticket. The diff handed to a reviewer excludes only the installed copies (`.agents/harness`, `.agents/skills`, `.agents/SKILLS.md`, `.claude`) and appends their `git diff --stat`; installed copies are always allowed to change.

## 5. The boundary between the project's files and the tool's (D7·D8·D9)
### `AGENTS.md` managed blocks
`<!-- reins:begin <block> v=X -->`…`<!-- reins:end <block> -->`, four of them: notice · workflow · skills · language. Outside is the project's. Hand edits → F2; to change one, `reins:override`. **Read markers** `<!-- reins:read invariants|secrets|gates -->` let the verifier read project-owned sections. Hook files get one line, `npx @bluenyang/reins check --stage …`, also inside markers. Nested AGENTS.md: only the installed directory.
**Two update paths**: the script `reins update` (managed blocks, upstream files, generated output; idempotent) and the skill `reins-update` (the PM proposes → user approves → applies changes that project sections need). The change notes say when the skill is needed.

### `gates.yaml`
`gates.<name>.cmd` (**one** command; no pipes or `&&`) · `order` · `optional+needs` (marked manual when unmet) · `mutating_forbidden: true` · `evidence: raw` · `secrets:`. The PM's discovery procedure: read (package.json, Makefile, hooks, CI) → classify (drop mutating commands) → prefer what hooks and CI already call → user confirmation (report in auto mode) → `--dry-run`. **Subdirectories** (monorepos): discovery also reports *proposals* from `package.json`, `Makefile` and `go.mod` up to depth 3 (skipping node_modules, .git, dist, build, vendor, .loctx, .agents), each one command using the tool's own directory option (`pnpm --dir d s`, `make -C d t`, `go -C d test ./...`; runner from the directory's lock file, else the root's), named `<dir-slug>-<script>`, run from the repo root. Manual install lists them and records only the chosen names; auto records root gates and reports proposals in the notes; `reins configure gates [--add <name>…]` lists the ones not yet declared and appends chosen ones after the existing entries, keeping comments. The loop reads gates.yaml only.

### `bindings`
`roles.<r>: {vendor, model, fallback, parallel}` · `vendors.<v>: {cli, available}` · `escalation` · `limits` (per-role caps). **Two layers.** The committed `bindings.yaml` holds the team defaults; it no longer records `detected` (an old `detected:` key is accepted and ignored; `reins update` moves it, and its timestamp, into the local file — a vendor entry already there is kept — and removes just those keys from `bindings.yaml`, leaving comments and every other key as written; `--dry-run` only lists the move). The git-ignored `.loctx/bindings.local.yaml` (`reins/bindings-local@1`) holds `vendors.<v>: {detected, at}` — written only when install or `configure bindings` runs detection — and per-user `roles.<r>: {model}` overrides (`configure bindings --local --set role=model` writes `roles` only). **Resolver, per role:** local override → team binding (if its vendor is detected; claude is the floor) → the role file's `fallback_binding` (if its vendor is detected) → the pm model; the result is `{role, vendor, model, source: local|team|fallback|pm}`. A vendor missing from the local file is detected live and not written back. `reins status` (`bindings` in `--json`) and `configure bindings --show` print the resolved table → all twelve roles on Claude alone. manual (pick vendors → default layout → adjust) / auto (detect → apply). `configure bindings` = file plus regenerated output. Model IDs are checked once against the CLI at binding time (`unverified` allowed).

## 6. Generation and drift (D10)
Source → output: `skills/` → `.claude/skills/` **copied** (Codex, Gemini and Cursor read `.agents/skills/` directly) · `roles/` + bindings → `.claude/agents/<r>.md`, `.codex/agents/<r>.toml` + `config.toml` · `policy/` permissions → `.claude/settings.json` (plus SKILL `allowed-tools`), hooks → `settings.json#hooks` (T2·T4·T6). Permissions are generated as the **inverse of the red lines**. Header "generated — do not edit". Round one verifies Claude output only. Generated agent files are built from the committed team defaults only (never from the local file), so one user's override makes no drift for anyone else; a role whose team vendor is not Claude also gets a Claude agent file, on its `fallback_binding` (else the pm model), headed "fallback for <vendor>" — a user without that vendor runs the role from it. The loop skills take the model a role runs on from `reins status --json` (`bindings`).
Drift `reins check --drift`, three layers: **format** (`skills-ref validate`) · **match** (regenerate, diff = 0; skill copies byte-identical) · **convention** (schemas · tier · permissions ≤ red lines · managed blocks · override versions · approvals ↔ trailers · no prose in the bus · `.loctx` gitignored). The match layer compares only the files the tier installs; an upstream file the tier no longer installs (e.g. `CHANGELOG.md`) is a WARN pointing to `reins update`, not an F2 STOP. `reins update` deletes such files under `.agents/harness/` (in upstream, outside the tier, not project-owned — `bindings.yaml`, `gates.yaml`, `install.yaml`, `generated.yaml` and files upstream does not ship stay) and lists them; `--dry-run` only lists. Failure = F2. Hooks and CI call the same script.

## 7. Generation detection and migrate (D11)
Signals (first match in order): none / 1st gen (`.ai/` only) / 2nd (AGENTS only) / 3rd (`.claude/commands/`) / 4th (10+ skills and `work-cicd-to|go-flow`) / reins (markers).
Mapping: history → `.loctx/history/` as is · open plans → intent folders as `draft` · open work → tickets (frontmatter converted) · ROADMAP.local as is, pub → `docs/ROADMAP.md` · release and pr as is · test reports → reports, **tool files listed only** (possible secrets) · verify/benchmark/artifacts listed only · conversation etc. → context · `<repo>-workflow` and commands **dropped** (project-specific procedures go on a keep list) · `.claude/memory` stays in place; each file gets a draft in `.loctx/knowledge-proposals/memory-<name>.md` (accept with `reins knowledge accept`) · AGENTS sections kept, only Workflow·Skills·Language replaced (original preserved) · 1st gen = install + `_legacy/`.
Open work items are numbered `000-1…000-N` once per run, in path order, and written as `.loctx/ticket/000-<n>_<slug>.md` (original id as `migrated_id`, source path as `migrated_from`); `depends` is remapped only when exactly one open item in the same subfolder and version carries that id, a finished dependency is dropped, anything else is dropped and written to `asks:`. A ticket whose `migrated_from` already exists is never made again. A run that made tickets writes `.agents/intent/000_migrated/intent.md` as a `draft` listing them (version from `package.json`, else `0.0.0`) when no intent 000 exists; T1 then holds on "intent 000 is a draft" and `status` says "user: approve the intent". Legacy files go to `.loctx/_legacy/` (`--legacy local`, default) or `.agents/legacy/` (`--legacy committed`); files matching a secret pattern stay in `.loctx/_legacy/` either way and the report lists them, with "review before committing" for the rest.
`migrate --dry-run` (and `install --dry-run`) plans the install step too and writes nothing: the notes list the subdirectory gate proposals install would offer (name and command) and the memory drafts it would write (paths).
Idempotent. One history page per run. **First target: this repository.**

## 8. knowledge (D12)
`.agents/knowledge/<date>_<slug>.md`: frontmatter `kind: decision|failure` · `status` · `supersedes` · `topics` · `decisions` · `symptoms` · `applies_to` · `source` · `approved`. A failure entry adds `symptom · cause · fix · check · verified`. Body in four sections — **decision · reason · applies (including when it does not) · revisit when** — never "how I did it".
Promotion: the same reason or decision **twice** (or `verified ≥ 2`) → PM proposes → user approves (summary plus veto) → commit → promote candidate if general. A changed decision is a new entry plus `superseded`. Per-stack failure **seeds** ship in `harness/knowledge-seeds/` as `source: preset`.
Counting (`reins retro`, a script — it counts, the PM writes the sentences): a **key** is `stop:<id>` (stop reasons in `metrics.jsonl`), `reason:<slug>` (the optional `reasons: a, b` line of a history page, placed right after `decisions:`) or `decision:<slug>` (its `decisions:` line). A key seen in **two or more different tickets or history pages** is a candidate (repeats inside one ticket count once; a page with no ticket counts as one); keys already in the `decisions` or `symptoms` of a `status: active` knowledge entry (bare slug; a stop is its id) are left out, superseded entries do not hide them. `reins retro [--release <v>] [--json]` also shows stops per id, failed rounds (HOLD and STOP verdicts) and tokens per role, narrowed to the intents whose `version` is `v`; `reins status` shows the same candidate count. `reins knowledge propose <key|slug> [--from <history>…]` writes a draft from the template to `.loctx/knowledge-proposals/<slug>.md` (no `approved`); only `reins knowledge accept <slug>`, which the retro skill calls after the user answers, moves it to `.agents/knowledge/<date>_<slug>.md` with `approved: {by: user, at: <date>}`. A candidate the PM judges not to be a lesson is recorded with `reins knowledge dismiss <key> --reason <text>` (a line in `.loctx/knowledge-proposals/dismissed.jsonl` with the unit count at that time); retro and status leave it out until it appears in more units than that. A knowledge entry without `approved` (other than `source: preset`) is an F2 STOP in `reins check`.
Search `reins recall`: grep on the three axes `decisions · topics · symptoms` → the most recent N → vector search as an optional slot.

## 9. CLI and plugin (D13·D14)
`npx @bluenyang/reins` — `install <tier> [--mode manual|auto]` · `migrate <tier> [--legacy local|committed]` · `update` · `config` (no arguments: on a terminal — stdin and stdout both TTY — the settings screen: a main screen with `models and roles configuration` and `exit`, built on `@clack/prompts` behind an injectable `Prompter`, loaded only when a screen is drawn, Ctrl-C = exit without writing; without a terminal it prints the resolved bindings table — `configure bindings --show` — and a one-line hint naming the `configure …` flag commands, exit 0; `--json` prints `{bindings}`) · `configure bindings [--set r=m…] [--vendors …] [--local --set r=m…] [--show]|budget|gates [--add <name>…]|language` · `check [--stage] [--drift]` · `gate [<name>…] [--ticket] [--respond]` (runs gates.yaml as declared and keeps the raw output as `$ cmd` … `exit N` in `.loctx/reports/` — the evidence T3 reads; with `--ticket <id> --respond` it also writes the bus response `<id>_<nn>.response.yaml` for the newest `kind: verify` request that has none — verdict pass only when every gate ran and exited 0, `evidence:` the report paths, `may_proceed` — prints one pass/fail line per gate plus a failing gate's signature and file:line, never the raw output, and exits 1 without writing when no verify request is open; verify-tool is therefore `gate --respond` plus `check --stage verdict`) · `new intent <slug> [--version] [--origin]` · `new ticket <intent> <step> <slug> [--title] [--depends] [--release] [--role]` · `new request <ticket> <kind> [--from] [--to]` (create the file from the harness template — the next free number; a ticket first takes the plan's reserved `tickets:` ids that nothing uses yet, the output validated against its schema first, an existing file is never overwritten, exit 1 on refusal, the path on stdout; no prompts) · `metrics [--intent]` (summarises `.loctx/reports/metrics.jsonl`: tokens by role · vendor · ticket · intent, knowledge stops per ticket) with `metrics record --role --tokens [--ticket|--intent]` (the caller reports tokens a role run used; reins calls no model) · `retro [--release <v>]` (stop ids · review reasons · decisions · failed rounds · tokens, repeated keys as knowledge candidates; counts only) · `knowledge propose <key> [--from <history>…]` / `knowledge accept <draft>` (draft to `.loctx/knowledge-proposals/`; accept writes `.agents/knowledge/` with `approved`) / `knowledge dismiss <key> --reason <text>` (a candidate judged not to be a lesson) · `recall` · `status` (also the candidate count) · `doctor`. All take `--dry-run` and `--json`. TypeScript, Node ≥ 22; nothing that ships needs Python (R65 — development and test tooling may use it). **The CLI never calls a model** — agent work belongs to skills (`reins-setup` and friends).
Install refuses over a 3rd/4th-generation harness and **points to `migrate`**. Over 1st/2nd generation it installs but leaves the old `.ai/` untouched and points to migrate. The version pin and settings live in `.agents/harness/install.yaml` (tier · version · cli · mode · language, and the optional `release` — see §4 "Release settings"; the file is validated by `harness/schemas/install.schema.json` and unknown keys are kept): `version` is the harness version, `cli` the package version that wrote the install, and the stage skills run `npx @bluenyang/reins@<cli>`.
Install questions (manual): vendors · binding adjustments · gate confirmation · secret patterns · hooks **proposal only** · public repository? · document language · budget (optional). Auto detects, defaults and reports.
The repository = Claude Code plugin + marketplace + npm package. The repository root is both: `.claude-plugin/plugin.json` (name `reins`; `version` equals package.json; userConfig `language` default `ko` and `default_mode` default `manual`; no `skills`, hooks, agents, MCP or dependencies) and `.claude-plugin/marketplace.json` (marketplace `bluenyang`; one entry whose `skills` is `["./skills/reins-setup"]`, so the plugin exposes only `/reins:reins-setup` — the other nine skills live in the project copy that `reins install` writes for the loop and graph tiers, never twice). `skills/reins-setup/SKILL.md` pins the CLI as `npx @bluenyang/reins@<version>`; `cli/src/scripts/sync-version.ts` (run by the `version` lifecycle script) rewrites plugin.json and that pin from package.json, and a test checks that all three agree. Elsewhere: `skills/` · `agents/` (generated) · `harness/` (the source of sources, plus templates, knowledge-seeds, VERSION) · `cli/` · `codex/ gemini/ cursor/` (unverified in round one) · `hooks/` · `docs/ test/ .agents/ .loctx/`. No `bin/` at the plugin root. The npm package does not ship `.claude-plugin` (the marketplace is fetched through git). Optional dependencies (humanize-korean, diagram-design) are detected and recommended only.

## 10. `spike/` (D15)
Ten ideas kept (must_not frontmatter · intent/knowledge stop kinds · failure catalog with verified · seeds · suggested_next · metrics.jsonl · counter reset, and so on — folded into §3, §4 and §8). All code and structure dropped (Python, the state.json state machine, dispatch, the eight stages, gate presets, TOML, Markdown handoffs). **The directory is deleted when implementation starts**, referenced by hash `9ebb597` — confirmed by the maintainer.

## 11. Implementation order for round one (proposal)
1. `cli/` skeleton plus `check` (verifier T2·T4 and drift format·match) — first, hooked into this repository.
2. `harness/` sources: 12 roles · policy (C1–C10, A–G) · schemas (5 files) · templates.
3. `install graph --mode manual` → self-install into this repository → `.agents/` and `.loctx/` created (S5).
4. `migrate` — this repository's `.ai/` to layout v4 (S1).
5. Generator (Claude) + `update` + `configure bindings`.
6. Skill entry points (`reins-setup` and the nine loop-tier stage skills) → run the first intent **through the tool's own loop** (R66).
7. Measure cost with metrics.jsonl → carve down to the loop and harness tiers (round two).

## Appendix — defaults chosen by the author (confirmed together with the design on 2026-10-25)
Approval recording · generation table · three drift layers · generation signals · migrate mapping · knowledge format and promotion threshold · CLI surface and exit codes · install question table · plugin tree · spike disposal · implementation order.
