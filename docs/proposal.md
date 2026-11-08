# reins — planning document, v1.2 (2026-11-09)

> English edition. The Korean original is [`proposal.ko.md`](proposal.ko.md); where the two disagree, the Korean file wins.
> Phase-2 output. It holds requirements, scope and success criteria only. File formats, schemas and code structure belong to **design (phase 3)**.
> Confirmed by the maintainer on 2026-10-25. Later changes are recorded as decisions in `knowledge/` and bump the version.
> v1.1: added R67 (public documents in English by default, with a `.ko.md` twin).
> **v1.2 (2026-11-09, intent 019):** reins only manages the harness and is never called during work. Changed requirements are marked **v1.2**; removed wording is struck through. The design is [`design.md`](design.md) v2.0.

## 1. The problem

Twelve repositories of BlueNyang and Team Croffle share one harness lineage, yet:

| Problem | Evidence |
|---|---|
| P1 **Agents step outside the harness** | The dominant failure is misreading, dropping or over-reaching the request. 14 of 225 trck-mock history entries are "corrected by the user"; one reverts changes nobody asked for |
| P2 **Verification is weak** | One session implements, verifies and judges. Verification assets rot in gitignored space in 11 of 12 repositories. No independent verifier |
| P3 **Knowledge does not accumulate** | `.ai/` is entirely gitignored. Search is `decisions:` noun grep only — no search by symptom. One committed channel in 12 |
| P4 **No self-correction** | Stop conditions are "irreversible action" and "two failures" only. No cost threshold, no user-interrupt signal. Flaky tests never terminate under the rule |
| P5 **Repositories diverge** | Propagation is manual copy. The same skill differs by 10–49 lines between copies. One repository is a generation behind |
| P6 **Claude only** | The loop lives in `.claude/` alone. The target is four vendors (Claude, Codex, Gemini, Cursor) |

## 2. Goal

Build **a tool that installs, migrates, updates and configures a project's agent harness** (v1.2: single or multi instead of tiers; never called during work).
Agents do **only what their role permits, exactly what was specified**; people make **gate decisions** only.

Non-goals (not this project):
- Feature work on any particular project (croffle and the rest)
- Replacing or wrapping the vendor CLIs
- Automatic model-selection optimisation (bindings are chosen by people)

## 3. Requirements

### 3-1. Structure — the ladder
- **R1** ~~Three tiers (harness / loop / graph)~~ → **v1.2: there are no tiers.** A single agent is the default; assigning models to role groups switches multi-agent work on. Work of a group that is off is done by the PM.
- **R2** ~~Design the graph first and carve down~~ → **v1.2:** the multi-agent setup is the source; single mode is the PM following the same skills alone (switching modes keeps the skills).
- **R3** A small project works **without** role groups or delegation (single mode). **v1.2:** there is no bus.

### 3-2. Harness — control (top priority)
- **R4** An agent does **only what its role permits**. Every role lists what it must not do.
- **R5** ~~A harness verifier~~ → **v1.2: an audit.** Every version, after the merge and before the rc, it judges whether the stages were followed; mandatory unless the user switches it off. There is no run-time verifier.
- **R6** Stop conditions include a **cost threshold** and a **user-interrupt signal**, besides irreversible actions, `[ask user]` and repeated failure.
- **R7** Wherever determinism is needed (gates, install), **scripts** do it, not agents, and they are idempotent. **v1.2:** gate scripts belong to the project and its hook tool runs them; reins's scripts are install, migrate, update and config only and are never called during work.
- **R8** The harness mounts on standalone, loop or graph alike. Where it must differ, it is **composed from fragments**.
- **R9** The path by which an agent **edits its own permission files** is exposed. **v1.2:** the audit tells hand edits from git history, and `update` asks before overwriting them.

### 3-3. Loop
- **R10** Given a version or target point, it **self-iterates** intent → spec → implementation → test → merge → audit → release → retro.
- **R11** Verification and judgement run in a **party separate from** implementation.
- **R12** ~~Sub-agents are used liberally~~ → **v1.2: a single agent is the default.** Subagents serve read-heavy work (research, review, audit, large log summaries) and urgent parallel work; multi-agent work is switched on by assigning models to role groups (Anthropic, 2026-10-22 and 2026-01-23).

### 3-4. Graph
- **R13** Role groups: PM · PL (control, review, discussion) · Planner (spec-writer, qa-designer) · Implementer · Executor (tool-executor, researcher, qa-runner, deployer) · Advisor (committee) · Auditor. **v1.2**
- **R14** **Role separation ≠ model separation.** Every role can run on one model. Vendors and models are swapped by bindings.
- **R15** ~~Schema-enforced handoff files~~ → **v1.2:** every report goes through the PM. Sub-reports live in `.loctx/reports/<version>/` and are deleted after the retro. There is no bus.
- **R16** The research role (researcher) writes no files — it only gives the PM information. **v1.2**
- **R17** QA judges anything ambiguous, even near the threshold, as **fail**.
- **R18** Two QA failures → the PM, by severity, asks PL or Advisor opinions → still failing → options for the user. A role never calls another model itself. **v1.2**
- **R19** Planning/design produces questionnaires and analysis reports so the user **understands and oversees** the process.

### 3-5. The tool
- **R20** `install | migrate | update | config`. **v1.2:** no tier argument.
- **R21** Install has **two stages**: ① the CLI deterministically places files, asks for bindings and declares gates; ② a PM agent reads the project and fills in context.
- **R22** Bindings are asked **according to the user's subscriptions**. Installation works with Claude alone.
- **R23** Gate commands are never hard-coded. The project **declares** them and the loop reads only the declaration.
- **R24** `migrate` **detects the starting generation** (2nd, 3rd, 4th) and knows what to carry over.
- **R25** `update` **does not break project adjustments**: file ownership (upstream / project / mixed), managed blocks, override declarations, a version pin.
- **R26** The goal is **one mixed file — `AGENTS.md`**.
- **R27** promote (project → upstream) is a human decision. The tool shows the list of overrides.
- **R28** ~~The drift check runs in both hooks and CI~~ → **v1.2:** drift is caught by the audit and by `update`'s confirmation before overwriting.
- **R29** **The first migrate target is this repository itself.**
- **R30** Written in TypeScript, **installed and managed** via `npx`. Independent of the target project's stack. **v1.2:** the installed harness works during work without reins, npx or a network.

### 3-6. Formats — standards
- **R31** Instructions follow `AGENTS.md`, procedures follow `SKILL.md` (Agent Skills). No new format is invented.
- **R32** Only what has no standard (roles, permissions, hooks) is **generated** per vendor from our source. Generated files are committed and never hand-edited.
- **R33** ~~The tier is written in `metadata`~~ → **v1.2:** permissions are written in the role files and in the generated agent files' `tools`.

### 3-7. Directories
- **R34** The commit boundary is **visible in the name**: for names we choose, no dot = committed, dot = gitignored. Vendor-named directories are committed generated output.
- **R35** `.loctx/` (formerly `.ai/`) is the only gitignored space — reports · context · history (one page per version) · ROADMAP.local · bindings.local. All committed agent context lives in `.agents/` (intent · audit · knowledge · harness · skills). **v1.2:** no ticket, bus, pr, release or test; every file gets a lifetime when it is created.
- **R36** Verification assets are **committed**. There are promotion criteria and a rule against real values leaking in.
- **R37** Long-term knowledge accumulates in a committed space **separate** from the harness (the harness gets replaced; knowledge piles up).

### 3-8. Documents
- **R38** Documents for AI (`AGENTS.md`, context, memory) are in English. Documents shared with the user (plans, work, reports, handoffs) are in Korean, written by the role responsible for that stage.
- **R39** User-facing documents carry **only the essentials, so reading never becomes the bottleneck** (the three-second test, diagrams).
- **R40** Public documents, PRs, release notes and blog posts are written by the designated role and polished with `im-not-ai`.
- **R41** Critical documents such as `AGENTS.md` are edited by the lead role only.
- **R67** Public documents are **English by default** (`README.md`, `docs/*.md`) with a Korean twin as **`.ko.md`**, cross-linked. For documents the user writes in Korean, the Korean file is the original and the English one the translation (maintainer, 2026-10-25).

### 3-9. Knowledge
- **R42** There is a **committed channel** through which decisions and lessons leave gitignored space. Secrets, hosts and personal data are filtered out.
- **R43** Past decisions can be found **by symptom**, not only by noun index.
- **R44** There is a path by which repeated mistakes are **promoted** into rules (after human confirmation).

### 3-10. Traceability · evidence (added 2026-10-24, from the playbook survey)
- **R45** When implementation departs from the plan, **the intent and spec are updated in the same commit**. Commit messages name spec items and the audit checks the match. **v1.2**
- **R46** Verification evidence is guaranteed by **form**, not by rule: toolchain output (tests, builds, screenshots) is **pasted as is**. A summary or the word "passed" alone is not a pass.

### 3-11. Added from the questionnaire (2026-10-25, `2_questions.md`)
- **R47** **Implementing "to pass" the request is forbidden.** Hard-coding, or making a few screens merely **look** right, is banned for every role. Only a design and implementation that applies the understood requirement at its root is allowed (common red line from Q1).
- **R48** User interruption is supported on **all three channels — chat, Ctrl+C, session end**. On interruption, work stops and **the information needed to resume is recorded** (Q3-a·b).
- **R49** The cost threshold is counted in **tokens** and **set by the PM role to fit the project** (Q3-d).
- **R50** Stop conditions are **explicitly enumerated**, not scattered through prose as today (Q3-f).
- **R51** The verification-tooling role **summarises failures so the PL and implementers grasp them at once**. If the summary falls short, the PL may verify and analyse further (Q1).
- **R52** The code-review role goes **as far as proposing fixes (direction)**. It may not edit directly or decide merges (Q1).
- **R53** ~~The QA-design role designs without reading code~~ → **v1.2:** QA design (qa-designer) works from the architecture, ROADMAP and intent but may read code (user, 2026-11-09).
- **R54** `.loctx/history/` is **know-how (tacit, differs per person, local)**; `.agents/knowledge/` is the **explicit knowledge distilled from it (decisions, notes, committed)**. Know-how keeps its autonomy; only explicit knowledge is shared. A knowledge entry says "what was decided, why, and where it applies" — not "how I did it" (maintainer, 2026-10-25).
- **R55** Questionnaires **ask the big things first and refine**. Answers can come as an md file or in chat, **either**; when asking, offer to show the questions in chat too (Q9-e).
- **R56** Prevent agents from **asking the same decision again** — decision search must work at the scale of dozens of files. A vector/semantic search tool is used if one exists, or built if not (Q7-a).

### 3-12. Freedom of bindings (maintainer, 2026-10-25)
- **R57** The default model per role is the layout in §3-5 / C-5, but at install time **any role may take any model, vendor-agnostic**. Fable as PM, no GPT, GPT only — all must be possible. (The operational form of R14, "role separation ≠ model separation".)
- **R58** Bindings can be changed after install **with a single command** (`configure bindings` or similar).
- **R59** Both install and binding changes have **two modes: manual (interactive questions) and auto (detect installed CLIs and subscriptions, apply the default layout)**.

### 3-13. Language · dependencies (maintainer, 2026-10-25)
- **R60** The tool and harness are **language-agnostic**. AI-facing documents are English; the language of user-facing documents is a setting. No Korean-only assumption goes into code or templates.
- **R61** Steps that need an external skill, such as polishing (R40), are **per-language slots**. Korean uses `humanize-korean`; other languages use their own tool or skip the step.
- **R62** **No dependency on other skills or plugins.** Everything is optional: detected at install and **recommended**; when absent, the feature is simply missing rather than broken. The plugin manifest's `dependencies` (hard dependencies) stays empty.
- **R63** There are two `ROADMAP`s: `.loctx/ROADMAP.local.md` (scattered ideas, unconfirmed) → after a feasibility check, **`docs/ROADMAP.md`** (confirmed, public).
- **R64** Approval chain: intent = **approved by the user** / spec = after review, **a summary for the user, 진행 or 수정 every time**. The PM records approvals quoting the user (`{by, at, words, rev}`). The plan is part of the intent. **v1.2**

### 3-14. This repository itself (maintainer, at confirmation 2026-10-25)
- **R65** **What ships does not use Python**: the published package — its CLI, generators, checks and build output — is TS/Node and never needs Python at runtime; shell is limited to one-line hook calls. Scripts used while developing, testing, verifying or editing may use Python, and often should when it is the safer or more exact tool. reins never forbids Python itself: the repositories it is installed in may be Python projects. (Maintainer's preference, scope clarified 2026-10-27.)
- **R66** This repository **improves itself through its own flow**. **v1.2:** during 0.3 development it follows the flow by hand without the harness, and migrates itself with `update` once 0.3 is out.

## 4. Scope

| Round | Content |
|---|---|
| **1st** | **Graph design** (roles, handoffs, stop conditions, bindings) + directory/format decisions + `install graph` + self-migrate of this repository |
| 2nd | Loop and harness carved down from the graph, `migrate` (generation detection), `update` |
| 3rd | Plugin distribution, application to croffle, AI-GW, croffle-play |

Not in the 1st round:
- Live integration with Codex, Antigravity and Cursor — when the CLIs are installed. Generated formats follow the documentation.
- Measuring graph cost — measured after the first application, consulted when carving down in the 2nd round.
- Moving all eleven repositories from `.ai/` to `.loctx/` — this repository only.

## 5. Success criteria

| Criterion | Measurement |
|---|---|
| S1 This repository moves its own `.ai/` with `migrate graph` and runs the next piece of work in that state | one success |
| S2 Zero drift | checks pass in hooks and CI |
| S3 Out-of-role actions are caught by the verifier | N deliberate-violation scenarios, all stopped |
| S4 Human intervention narrows to **gate decisions** | "watch and stop" count per item falls below today's baseline (trck-mock 14/225) |
| S5 `install graph` works and runs with Claude alone | one success |
| S6 `update` does not break project adjustments | after update on a project with overrides, the diff stays inside managed blocks |
| S7 Plan departures are caught | merged diff ↔ plan agreement recorded every rc; commits with a mismatch but no plan update: 0 |
| S8 Every "pass" carries evidence | every pass row in a test report has toolchain output; passes without it: 0 |

## 6. Constraints
- Stacks differ per project (TS, Go, Kotlin, Python, Java, C++, Flutter are all possible). Gates are declared.
- The company PC is Windows (Git Bash), home is Linux. Syncthing sync. Symlinks deferred.
- The only agent CLI running today is Claude Code: `claude remote-control` server mode plus the web UI / desktop app.
- Model identifiers are confirmed in the environment at binding time (`claude-opus-5-5` confirmed).

## 7. Open questions — outcome of the questionnaire (`2_questions.md`)
| Question | Status |
|---|---|
| Per-role "must not" list (R4) | **Answered** → R51·R52·R53 plus the common red line R47. The rest of the table: confirmed as proposed |
| Required contents of a handoff file (R15) | **Answered** — changes · intent · related intent · what was tried · what was not · deadline · how to revert / verdict · grounds · fixes needed · may it proceed. Summary goes to history, decisions to knowledge |
| Stop and exit conditions, "watch and stop" (R5·R6) | **Answered** → R48·R49·R50. The list itself is design |
| Generation detection (R24) | Default adopted (signals measured in the survey) → design |
| `AGENTS.md` managed block (R26) | Default adopted — tool-owned Workflow·Skills·Language, invariants project-owned, one line in hook files |
| CLI question list (R22) | Default adopted — pick vendors → default layout → adjust; detectable facts are not asked; `configure bindings` |
| Search by symptom (R43) | **Answered** → R56. `symptoms:` line plus merging the two axes (default) |
| Knowledge promotion (R37·R44) | Default adopted. Name fixed as **`knowledge/`** (decisions, lessons, facts, preferences) |
| Adopting intent (R19) | **Answered — adopt, commit, track.** Q9-c **closed (2026-10-25)**: spec and plan separated, bundled as `intent/<id>/{intent,spec,plan}.md`, approval of intent and spec, plan by the PL. work kept, renamed `ticket/` |
| 1st-round scope | Default adopted |

### Handed to design
Full list of stop conditions · bus schema · implementation of generation signals · implementation of the managed-block boundary · `knowledge/` and `history/` formats · questionnaire format (R55) · templates for intent/spec/plan

## 8. Next
Maintainer confirmation → **polish with `im-not-ai` (humanize-korean)** (public-document rule R40) → commit to `docs/` (Korean) → phase-3 design plan.
