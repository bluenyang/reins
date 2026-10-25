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
### Common red lines C1–C10 — every role, enforced by the verifier
C1 implementing "to pass" (hard-coding, making things merely look right) · C2 editing `AGENTS.md` managed blocks, `policy/` or `roles/` (PM and `update` only) · C3 editing one's own permission file or generated output · C4 reading secrets · C5 bypassing hooks or massaging gate output (`| tail`) · C6 push/PR/merge/release/tag (deploy role only) · C7 reversing a past decision without the user · C8 re-raising a rejected proposal · C9 touching production servers or clusters · C10 changes outside intent and plan (open a new ticket instead)

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
| A irreversible | A1 force push · tag deletion · main rewrite / A2 stable release / A3 data · production / A4 leaving the machine outside the pre-release loop | intent |
| B decision | B1 open `asks:` / B2 invariant change without a decision / B3 conflict with intent or spec / B4 roadmap silent or contradictory / B5 external assumption broken, scope changes | intent |
| C premise | C1 rationale collapsed (fix plan and ticket first) / C2 diff departs from plan with no update (R45) | knowledge |
| D failure | D1 two rounds in the same unit (ticket before rc.1, rc after) / D2 red check twice / D3 flaky → isolate, continue, report / D4 suspected false pass / D5 pass without evidence | knowledge |
| E cost | E1 80% warning (not a stop) / E2 scope budget 100% STOP / E3 rc or session 100% HOLD — warning only when no value is set | knowledge |
| F violation | F1 red-line attempt / F2 drift / F3 rejected proposal re-raised | knowledge |
| G interrupt | G1 chat · Ctrl+C · session end → record resume info / G2 user vetoes the spec summary | intent |
`kind` is the distinction kept from the spike: **intent** (a person's call, never automated) / **knowledge** (learned away over time). Metric: knowledge stops per item. Counters (D1·D2) reset on a pass.
Of these, the surveyed repositories had only A, B1, D1 and D2 — everything else is new.

### Budget scopes — the narrower scope wins
project default (install, `policy/budget`) < version (PM, plan.md) < **user-defined scopes** (shipped: ticket · rc · session · role; `configure budget`). Unit: tokens. Without defaults, measure on first use.

### The verifier = `reins check` — six transition points
T1 before a ticket starts (B1 · dependencies · budget · bindings · **`asks:` against `decisions:` to stop the same question recurring**) · T2 before commit (C2·C10·F2·C4·C5) · T3 at judgement (D1–D5 · evidence) · T4 before leaving the machine (A · C6 · loop stage) · T5 at rc close (E3 · zero open tickets · history written · plan-agreement S7) · T6 always (G1·F1).
Verdicts CONTINUE / HOLD / STOP / ESCALATE → bus `stop-report` (reason · resume info · one line in the user's language). Exit codes 0/10/20/30.
Loop tier: fewer roles, same T and conditions. Harness tier: T2·T4·T6 only.

## 4. The five files people and agents exchange (D5·D6·D2)
Common: YAML frontmatter (machine, schema-validated) + Markdown body (people). Body in the user's language, keys and the bus in English. Empty sections read `—`. **Approval = frontmatter `approvals:` plus the `Approved-by:` trailer on the status-changing commit** — no separate ledger.

| File | Where | Sections | Approval |
|---|---|---|---|
| **intent.md** | `.agents/intent/<NNN>_<slug>/` | problem · desired outcome · impact · constraints · open questions · **questionnaire record** · **not doing** | user |
| **spec.md** | same | reading of requirements (`S-n`) · design (invariant conflicts mandatory) · concerns · acceptance criteria · out of scope. Frontmatter `summary_for_user:` 3–5 lines | pm + qa-design first → **user summary veto** (R64) |
| **plan.md** | same | files that change · **order of work (→ tickets)** · risks · proof · test checklist · **departure log** (R45). `agents:` roles only, `budget:` | qa-design, light |
| **ticket** | `.loctx/ticket/<intent>-<n>_<slug>.md` | the surveyed repos' seven work sections unchanged (purpose · current code · tasks · decisions · expected · caveats · verification). Frontmatter `release: planned\|stabilization` · `asks:` · `budget:` · `depends:` | — |
| **bus** | `.loctx/bus/*.{request,response}.yaml` | request: changes · why · tried · not_tried · deadline · revert · errors (raw output) / response: verdict · grounds · fixes · may_proceed · major_issues · evidence · suggested_next | — |

State transitions: T1 passes only when intent is `approved` ∧ spec `accepted` ∧ plan `reviewed`. One item in plan §order of work = one ticket. Ticket `done` → one line in history → deleted. Bus files are deleted once the response is summarised in history.

### Version and rc convention (maintainer)
A version is a bundle of intents. **rc.1 = everything planned is complete.** rc.N = stabilisation only (bugs, adjustments, small additional intents). An rc is the pre-release stage for human verification. Keep versions small. Ticket `release:` says planned or stabilisation.

## 5. The boundary between the project's files and the tool's (D7·D8·D9)
### `AGENTS.md` managed blocks
`<!-- reins:begin <block> v=X -->`…`<!-- reins:end <block> -->`, four of them: notice · workflow · skills · language. Outside is the project's. Hand edits → F2; to change one, `reins:override`. **Read markers** `<!-- reins:read invariants|secrets|gates -->` let the verifier read project-owned sections. Hook files get one line, `npx @bluenyang/reins check --stage …`, also inside markers. Nested AGENTS.md: only the installed directory.
**Two update paths**: the script `reins update` (managed blocks, upstream files, generated output; idempotent) and the skill `reins-update` (the PM proposes → user approves → applies changes that project sections need). The change notes say when the skill is needed.

### `gates.yaml`
`gates.<name>.cmd` (**one** command; no pipes or `&&`) · `order` · `optional+needs` (marked manual when unmet) · `mutating_forbidden: true` · `evidence: raw` · `secrets:`. The PM's discovery procedure: read (package.json, Makefile, hooks, CI) → classify (drop mutating commands) → prefer what hooks and CI already call → user confirmation (report in auto mode) → `--dry-run`. The loop reads gates.yaml only.

### `bindings`
`roles.<r>: {vendor, model, fallback, parallel}` · `vendors.<v>.detected` · `escalation` · `limits` (per-role caps). **A role bound to an undetected vendor uses its fallback, else the pm model** → all twelve roles on Claude alone. manual (pick vendors → default layout → adjust) / auto (detect → apply). `configure bindings` = file plus regenerated output. Model IDs are checked once against the CLI at binding time (`unverified` allowed).

## 6. Generation and drift (D10)
Source → output: `skills/` → `.claude/skills/` **copied** (Codex, Gemini and Cursor read `.agents/skills/` directly) · `roles/` + bindings → `.claude/agents/<r>.md`, `.codex/agents/<r>.toml` + `config.toml` · `policy/` permissions → `.claude/settings.json` (plus SKILL `allowed-tools`), hooks → `settings.json#hooks` (T2·T4·T6). Permissions are generated as the **inverse of the red lines**. Header "generated — do not edit". Round one verifies Claude output only.
Drift `reins check --drift`, three layers: **format** (`skills-ref validate`) · **match** (regenerate, diff = 0; skill copies byte-identical) · **convention** (schemas · tier · permissions ≤ red lines · managed blocks · override versions · approvals ↔ trailers · no prose in the bus · `.loctx` gitignored). Failure = F2. Hooks and CI call the same script.

## 7. Generation detection and migrate (D11)
Signals (first match in order): none / 1st gen (`.ai/` only) / 2nd (AGENTS only) / 3rd (`.claude/commands/`) / 4th (10+ skills and `work-cicd-to|go-flow`) / reins (markers).
Mapping: history → `.loctx/history/` as is · open plans → intent folders as `draft` · open work → tickets (frontmatter converted) · ROADMAP.local as is, pub → `docs/ROADMAP.md` · release and pr as is · test reports → reports, **tool files listed only** (possible secrets) · verify/benchmark/artifacts listed only · conversation etc. → context · `<repo>-workflow` and commands **dropped** (project-specific procedures go on a keep list) · `.claude/memory` → knowledge · AGENTS sections kept, only Workflow·Skills·Language replaced (original preserved) · 1st gen = install + `_legacy/`.
Idempotent. One history page per run. **First target: this repository.**

## 8. knowledge (D12)
`.agents/knowledge/<date>_<slug>.md`: frontmatter `kind: decision|failure` · `status` · `supersedes` · `topics` · `decisions` · `symptoms` · `applies_to` · `source` · `approved`. A failure entry adds `symptom · cause · fix · check · verified`. Body in four sections — **decision · reason · applies (including when it does not) · revisit when** — never "how I did it".
Promotion: the same reason or decision **twice** (or `verified ≥ 2`) → PM proposes → user approves (summary plus veto) → commit → promote candidate if general. A changed decision is a new entry plus `superseded`. Per-stack failure **seeds** ship in `harness/knowledge-seeds/` as `source: preset`.
Search `reins recall`: grep on the three axes `decisions · topics · symptoms` → the most recent N → vector search as an optional slot.

## 9. CLI and plugin (D13·D14)
`npx @bluenyang/reins` — `install <tier> [--mode manual|auto]` · `migrate <tier>` · `update` · `configure bindings|budget|gates|language` · `check [--stage] [--drift]` · `recall` · `status` · `doctor`. All take `--dry-run` and `--json`. TypeScript, Node ≥ 20, no Python (R65). **The CLI never calls a model** — agent work belongs to skills (`reins-setup` and friends).
Install refuses over a 3rd/4th-generation harness and **points to `migrate`**. Over 1st/2nd generation it installs but leaves the old `.ai/` untouched and points to migrate. The version pin and settings live in `.agents/harness/install.yaml` (tier · version · mode · language).
Install questions (manual): vendors · binding adjustments · gate confirmation · secret patterns · hooks **proposal only** · public repository? · document language · budget (optional). Auto detects, defaults and reports.
The repository = plugin + npm package: `.claude-plugin/plugin.json` (`dependencies: []`, userConfig `language` · `default_mode`) · `skills/` (thin entry points) · `agents/` (generated) · `harness/` (the source of sources, plus templates, knowledge-seeds, VERSION) · `cli/` · `codex/ gemini/ cursor/` (unverified in round one) · `hooks/` · `docs/ test/ .agents/ .loctx/`. No `bin/` at the plugin root. Optional dependencies (humanize-korean, diagram-design) are detected and recommended only.

## 10. `spike/` (D15)
Ten ideas kept (must_not frontmatter · intent/knowledge stop kinds · failure catalog with verified · seeds · suggested_next · metrics.jsonl · counter reset, and so on — folded into §3, §4 and §8). All code and structure dropped (Python, the state.json state machine, dispatch, the eight stages, gate presets, TOML, Markdown handoffs). **The directory is deleted when implementation starts**, referenced by hash `9ebb597` — confirmed by the maintainer.

## 11. Implementation order for round one (proposal)
1. `cli/` skeleton plus `check` (verifier T2·T4 and drift format·match) — first, hooked into this repository.
2. `harness/` sources: 12 roles · policy (C1–C10, A–G) · schemas (5 files) · templates.
3. `install graph --mode manual` → self-install into this repository → `.agents/` and `.loctx/` created (S5).
4. `migrate` — this repository's `.ai/` to layout v4 (S1).
5. Generator (Claude) + `update` + `configure bindings`.
6. Skill entry points (`reins-setup` · `reins-intent` · `reins-loop`) → run the first intent **through the tool's own loop** (R66).
7. Measure cost with metrics.jsonl → carve down to the loop and harness tiers (round two).

## Appendix — defaults chosen by the author (confirmed together with the design on 2026-10-25)
Approval recording · generation table · three drift layers · generation signals · migrate mapping · knowledge format and promotion threshold · CLI surface and exit codes · install question table · plugin tree · spike disposal · implementation order.
