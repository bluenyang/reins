# reins design — v2.0 (2026-11-09)

> English edition of [`design.ko.md`](design.ko.md); where the two disagree, the Korean file wins. The design for the requirements in [`proposal.md`](proposal.md) v1.2.
> v2.0 is the design of 0.3 (intent 019). What changed from v1.0 (2026-10-25) and from what 0.1–0.2.0 added on top is collected in §10. The v1.0 text is in git history (tag `v0.2.0`).

## 0. Principles
1. **reins only manages the harness.** It has four commands: `install`, `migrate`, `update`, `config`. Once installed, no hook, skill or agent runs reins while the project works; the installed harness works without reins and without a network. (R5, R7, R20, R30)
2. **Checks belong to the project.** Stage checks run in the project's hook tool (lefthook, husky, …), which calls a script inside the project (`.agents/harness/run-gates.sh`, §6). The script calls the project's check commands only. reins only proposes or sets them up. (R7, R23)
3. **Compliance is judged by an audit.** Instead of blocking at run time, an audit judges every version for whether the stages were followed. The audit is mandatory; only the user switches it off. (R5, R9)
4. **A single agent is the default.** One agent (the PM) carries out the stages. Multi-agent work is switched on by assigning a model to a role group; a group without a model is done by the PM. (R12, R14) Basis: Anthropic, "Building agents: When to fold subagents into your main agent loop" (2026-10-22) and "Building multi-agent systems: When and how to use them" (2026-01-23).
5. **Every file gets a lifetime when it is created.** No file is created without who deletes it and when. (R15, R35)
6. **Follow the standard where there is one.** Instructions in `AGENTS.md`, procedures in `SKILL.md`. Only role agent files are generated. (R31, R32)
7. **The commit boundary is in the name.** `.agents/` = committed agent context, `.loctx/` = this machine only. (R34, R35)

## 1. Layout
```
<project>/
├── AGENTS.md                 committed · managed blocks (reins) + project sections
├── .agents/                  committed
│   ├── intent/<NNN>_<slug>/{intent,spec}.md
│   ├── audit/<version>.md    version audit record
│   ├── knowledge/            explicit knowledge
│   ├── harness/              bindings.yaml (settings) · gates.yaml · run-gates.sh (the gate script) · install.yaml · generated.yaml · roles/ · templates/
│   └── skills/<name>/SKILL.md   eleven stage skills
├── .claude/agents/rs-*.md    committed · generated (only roles switched on in multi mode)
├── docs/                     ROADMAP.md and others
└── .loctx/                   gitignored · ROADMAP.local.md · history/<version>.md · reports/<version>/ · reports/gates/ · context/ · bindings.local.yaml · delegation.local.md
```
`AGENTS.previous.md` exists in `.agents/` only while a reconcile is pending (§5).

## 2. Roles
### 2-1. What a model assignment means
Assigning a model to a role group or a role says which vendor's model does that work. It is not a number of agents: whether that model runs once or in parallel is separate. Roles run headless, so each run starts from a fresh context, and every handoff loses detail. The PM therefore lists the files and decisions it hands over in the instruction, and a role marks any assumption beyond what it received.

### 2-2. Role groups
All groups except the PM are optional. Work of a group that is not switched on is done by the PM.

| Group | Roles | Work |
|---|---|---|
| **PM** | — | Talks with the user (PO); asks what is essential and decides the rest; writes the intent (direction and plan); records approvals; assigns and reassigns; owns the flow. Every report goes through the PM |
| **PL** | control | Coordinates and orders sub-tasks, collects and analyses their reports and research → PM. Switched on for parallel work or when the PM's context degrades |
| | plan-reviewer · code-reviewer · qa-plan-reviewer · doc-reviewer · retrospector | Reviews the plan (against the user's words, the intent and the product boundary), code, QA plan and documents; the retro. Routine review takes one reviewer |
| | discussion | For large decisions and disagreements, every assigned model gives an opinion without seeing the others; the PM combines them with the originals attached, keeping grounds, counterexamples and minority views |
| **Planner** | spec-writer · qa-designer | Approved intent → spec and work units / test methods and checklists (may read code) |
| **Implementer** | code · qa · doc | Code, test code and scripts, documents (both roadmaps, standard documents, `.loctx` documents; the document language is an input). One run may carry code, tests and documents of the same feature |
| **Executor** | tool-executor · researcher · qa-runner · deployer | Summaries of large tool logs → PL / research (read-only) / test runs / releases (stable only on the user's instruction) |
| **Advisor** | committee | Several high-capability models. Requirements that are large, complex or abstract; remedies for major problems such as a procedure not followed |
| **Auditor** | — | An independent group of one. Audits on the harness and engineering practice only (§3-3) |

- With several PL models, the first is control. The reviewer is one model (the first that is not control, else the control model); the control model's review counts as independent. Discussion and the committee use every assigned model.
- A role never calls another model itself. It returns its result with a reason to the PM, and the PM reassigns.
- Discussion and the committee are called for: a large decision before an intent is settled, the remedy after an audit finds a violation, an incident of the procedure not being followed, an unresolved disagreement. Never for ticket-level review.

### 2-3. Single mode
There is no standing delegation. The PM carries out the work above as stages. The PM may use subagents of the same model for read-heavy work (research, large log summaries, review, audit) and, when urgent, for parallel implementation of independent features. "The same model" is the model in the conversation: the harness does not set the PM's model (§5). Connected work such as planning and implementation stays in one run. When the PM's context grows heavy, a new session picks up from the files. For audits and large decisions the user may ask for an outside review in a separate session or on another vendor. Self-review fills a table of spec item ↔ commit ↔ evidence path, also looks for defects, and states that it is not an independent review.

### 2-4. Role files and what no role does
Seven files `harness/roles/<group>.md` (pm, pl, planner, implementer, executor, advisor, auditor). The frontmatter gives every role a `does` (one-sentence goal), `must_not` and `tools` (whether it may write, run a shell, push). Models may be inherited per group, but tool permissions are fixed per role (researcher read-only, only the deployer ships). What a role document forbids and what the host actually prevents (the generated agent file's `tools`) are written apart.

What no role does (the former C1–C10): implement "to pass" · edit AGENTS.md managed blocks, harness sources or generated files by hand (the user changes them with `config` and `update`) · read secrets · bypass hooks or reshape gate output · push, open PRs, merge, release or tag without the user's instruction (the deployer within its set scope) · reverse a past decision without the user · re-propose a rejected proposal · touch production · change anything outside the intent and spec.

## 3. Flow, stopping, audit
### 3-1. Flow and stage skills
`ROADMAP.local.md` (ideas) → settled with the user → `ROADMAP.md` → intent → approval → spec → approval → implementation and commits → review → test → merge → **audit** → rc → (stable) → **retro** → cleanup

| Skill | Work | Next |
|---|---|---|
| `onboard` | first-conversation onboarding, AGENTS.md reconcile (§5) | `roadmap` |
| `roadmap` | local ideas → settled with the user → public roadmap | `intent` |
| `intent` | direction and plan, approval record | `spec` |
| `spec` | spec, work units, checks, 진행/수정 on the summary, approval record | `implement` |
| `implement` | work units, tests, commits at meaningful units (a point you can revert or reset to without taking other working work or features with it; changing the spec's work units needs the spec changed and approved first), self-review table | `review` |
| `review` | review (multi: one reviewer / single: self-review); Discussion for large decisions | `implement` or `test` |
| `test` | run the checks, raw logs | `merge` |
| `merge` | PR → CI → merge (per the user's instruction or setting) | `audit` |
| `audit` | version audit → `.agents/audit/<version>.md` | `release` |
| `release` | rc; stable on the user's instruction | `retro` |
| `retro` | retro, proposals, cleanup | `roadmap` |

There is no conductor skill. AGENTS.md's default block holds the order and each skill names the next. Every skill has the same six sections: ① when to use ② procedure ③ delegation (its first sentence: "check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md"; the group's model if one is assigned, else do it yourself; read-heavy or urgent parallel work may use same-model subagents; the files and decisions to hand over) ④ files made and their lifetime ⑤ next skill ⑥ when to stop and ask. Skills are plain text and never call reins. Single and multi mode share the skills, so switching modes does not regenerate them.

### 3-2. When to stop and ask
With no verifier, stop conditions are plain rules the agent keeps and the audit judges (from the former `stops.yaml`, keeping only those that apply during work). They are written in AGENTS.md's default block and in each skill's ⑥.
- **Ask the user and stop**: an irreversible action (force push, deleting a tag, rewriting the default branch, data or production changes), a stable release, anything that leaves the machine (push, PR, release; unless set up or instructed), scope moving outside the intent and spec, a conflict with a past decision, a next step that needs an approval not yet given.
- **Stop and find the cause**: two failures in the same work unit (PL or Advisor opinions by severity, else options for the user), empty or doubtful gate output, a pass without evidence.
- **User interrupt**: on chat, Ctrl+C or session end, stop and write the resume point in history.

### 3-3. Audit
- **When**: after the merge, before the rc (so the merge is audited). The release itself is looked at in the retro.
- **Reads**: AGENTS.md and the harness settings as they were, the intent, spec, `ROADMAP.md` and `ROADMAP.local.md`, git history, history, gate and test logs, the gate log of each commit (`.loctx/reports/gates/<tree>.log`), and the PR and CI records. Before handing the audit over, the PM collects for every PR merged in the version its number, who merged it and when, the merge commit and head SHA, the CI checks and results, and the gate output in the PR body, as the repository host's CLI prints them, unedited (e.g. `gh pr view <n> --json …`, `gh pr checks <n>`), into `.loctx/reports/<version>/`. At the same time the PM fills the gaps in the gate logs: for every commit of the version on the default branch, the log of its tree should hold a run with `worktree: clean` and `exit: 0`; for a commit without one (made again by a rebase, on another machine, or past the hook) the PM checks it out in a clean work tree and runs `sh .agents/harness/run-gates.sh audit`. A commit's content does not change, so a later run gives the same answer. A failing run is passed on as it is, not fixed. The auditor runs without a network; a record it lacks is "cannot confirm" and is asked of the PM. It receives minimal context and never the working conversation.
- **Judges**: whether §3-1's flow was followed, against the rules and approved exceptions in force at each action. Commits are judged too: each should be a meaningful unit — a point you can revert or reset to without taking other working work or features with it. Several commits for one work unit (implementation, review fixes) are fine, and small pieces of work that may be reverted together may share one commit; a commit mixing unrelated work, or a change to the spec's work units without approval, is a violation (nothing blocks it). A generated or harness file changed during the version by a commit that is not an `update` or `config` commit is a violation (drift). Gates are judged too: for each commit, the log of its tree holds a run with `worktree: clean` and `exit: 0` — the record says whether it was left at commit time or filled in before the audit (`stage: audit`). No such run is "cannot confirm"; a clean run that ends with another `exit:` is a violation. No evidence path means "cannot confirm", never a pass.
- **Skipped steps**: a step or approval the user told the agent to skip passes when it was recorded in the intent's `waivers:` at the time. It applies once.
- **Violations**: fixed, or accepted by the user. Either way the audit and the retro criticise them precisely and, by severity, give a remedy with PL or Advisor opinions.
- **Record**: `.agents/audit/<version>.md` (committed). The audit run is read-only: the auditor returns the whole record as its answer, and the PM keeps that answer as it came under `.loctx/reports/<version>/` and writes it to the record file unchanged (no verdict reworded or shortened). The user's decision (fixed or accepted) is added in its own section. The version's closing report states the audit status.
- **Mandatory**: `audit.required: true` in `bindings.yaml` by default; only the user switches it off, through `config`. In single mode the user chooses the audit's session and model (recommended: a new run on another vendor, or a new run on the same vendor's top model).
- Passing a procedural audit does not vouch for direction or code quality; direction is for the plan-reviewer and the user.

### 3-4. Approvals and retro
- **Approvals**: the PM quotes the user and writes `{ role: user, by, at, words, rev }` into the intent's or spec's `approvals:` and commits it; `rev` is the revision approved. The user may do it directly. A spec summary waits for 진행 or 수정 every time (no auto-accept).
- **Retro**: after stable (for a version without stable, when the user declares it closed). The retrospector (or the PM) reads the audit and the release and proposes changes to AGENTS.md, skills and the harness, including whether the groups switched on paid for themselves. Decisions and failures that appear twice or more in history and the audit are proposed as knowledge candidates (§8; when there are none, the retro says so). Only what the user accepts is applied: project sections and knowledge by the PM, harness sources by the user through `config` and `update`. The cleanup (§4-2) follows.

## 4. Files
### 4-1. Formats
YAML frontmatter + Markdown body. The body is in the user's language, keys in English. An empty section is `—`.

| File | Location | Sections |
|---|---|---|
| **intent.md** | `.agents/intent/<NNN>_<slug>/` | problem · desired result · **plan** (order of work) · scope · constraints · open questions · questionnaire record · decided by agents · not doing. Frontmatter `status: draft\|approved\|released\|superseded`, `approvals`, `waivers: [{step, words, at, scope: once}]` |
| **spec.md** | same | interpretation (`S-n`, with grounds) · design · **work units** (`W-n`, checkboxes, finishing commit) · **checks** (`V-n`) · concerns · out of scope. Frontmatter `status: draft\|accepted`, `approvals`, `summary_for_user` |
| **audit** | `.agents/audit/<version>.md` | range (commits) · what was read · verdict per stage (kept, violated, cannot confirm, skipped on the user's instruction; evidence paths) · criticism · remedy · the user's decision |
| **history** | `.loctx/history/<version>.md` | one page per version: decisions (`decisions:` line), verdicts, skipped steps, audit and retro summary, a summary of deleted logs (commits, check commands and results, exceptions) |

There is no plan.md, ticket file or bus file. Commit messages name spec items (`S-n`/`W-n`) to tie the plan to the commits.

### 4-2. Lifetimes
| File | Created by | Deleted by, when |
|---|---|---|
| intent, spec, audit, knowledge | PM, Planner (the audit: the auditor's answer, written by the PM as it came) | never (committed) |
| `.loctx/history/<version>.md` | PM | never (local know-how) |
| `.loctx/reports/<version>/` (raw gate and test logs, sub-reports) | the role that ran the stage | the PM after the retro, after summarising them in history and the audit record |
| `.loctx/reports/gates/<tree>.log` (check output per commit) | `run-gates.sh` called by the hooks, and the PM before the audit | the PM in the retro: those written before the version's stable tag (logs of later work stay) |
| `.agents/AGENTS.previous.md` | install, migrate, config | the PM when the reconcile is done |
| `.loctx/delegation.local.md` (a person's own delegation table) | config (either scope), install, update | the same commands, once the personal settings are gone or delegate as the team's do |
| `.loctx/context/`, `ROADMAP.local.md` | user, PM | the user |

install and update never write history. Each skill's ④ follows this table.

## 5. Project versus tool
### `AGENTS.md`
Managed blocks `<!-- reins:begin <block> -->`…`<!-- reins:end <block> -->`: ① folder layout ② settings (`.agents/harness/bindings.yaml`; with `audit.required: true` an audit is mandatory every version and only the user switches it off) ③ flow and skill order ④ delegation table (its first line: "if `.loctx/delegation.local.md` exists, follow it instead of this section"; models of the roles switched on; for another vendor's model, that CLI's command line, e.g. `codex exec -m <model> -s read-only`) ⑤ rules for recording approvals and skips ⑥ when to stop and ask (§3-2). Outside the blocks belongs to the project. The blocks state the flow firmly so agents follow it without blocking.

**Onboarding marker.** install and migrate put `<!-- reins:onboarding pending -->` and a to-do list (goals and scope, stack and commands, existing rules and conventions, red lines, document language; choosing a hook tool when none exists) above the project sections. **Reconcile marker.** On a migrate conflict or a move from 0.x, `<!-- reins:reconcile pending -->` is added and the previous body moves to `.agents/AGENTS.previous.md` (reference material, not instructions), with the resume point of any work in progress. The copy `update` makes when it moves an install of 0.2.0 or earlier starts with one paragraph saying that it is a copy of the instructions from 0.2.0 or earlier and that the reins commands it names (`reins status`, `reins check` and others) do not exist in 0.3 and must not be run (that body still holds the old reins command lines; migrate's copy is another harness's text and gets no such paragraph). **Mode-changed marker.** A mode switch through `config` changes only the delegation block, so no copy is made: `<!-- reins:mode-changed pending -->` asks the PM to check that the project sections say nothing contradicting the new mode. For any marker, the PM handles it with the `onboard` skill in the next first conversation and sets it to `done`.

### `gates.yaml`
`gates.<name>.cmd` (one command) · `order` · `optional`. Discovery and subdirectory proposals are as in v1.0. Hooks and the `test` skill call these commands as they are.

### `bindings.yaml` (version 2)
```yaml
schema: reins/bindings@2
mode: single            # single | multi
audit: { required: true }
tools: { claude: { cli: claude, use: true }, openai: { cli: codex, use: true } }
groups:                 # a group not listed is off (done by the PM)
  pl:
    models: [ { vendor: claude, model: claude-sonnet-5-5 }, { vendor: openai, model: gpt-6.1-terra } ]
    roles: { doc-reviewer: { vendor: claude, model: claude-sonnet-5-5 } }
  implementer: { vendor: claude, model: claude-sonnet-5-5, fallback: { vendor: openai, model: gpt-6.1-terra } }
  auditor: { vendor: openai, model: gpt-6.1-sol }
```
**The PM's model is not written down.** The PM is the model in the conversation: the delegation section says only "you are the PM — the model in this conversation", roles without a model are done by that model (a fresh run or a subagent), and the audit, when the auditor has no model, is a fresh run of that model (or of another one the user chooses). The `default` key, the PM's model up to 0.3.1, is no longer read. It stays in the schema so that existing files keep loading, and `config` drops it, saying so, when it writes that file.

Inheritance: role > group > off. An empty group (`{}`) in the local file switches a team group off for that person only. vendor and model are inherited as one pair. `models` is for pl and advisor only. No key needs interpreting at run time (`escalation`, `limits`, `parallel` are gone). **A fallback model** — `fallback`, one `{vendor, model}` on a group (`groups.<g>.fallback`) or on a role (`roles.<r>.fallback`); one level only, none for the PM — is not resolved by reins at run time either: when `config` writes, it goes to the end of that role's cell in the delegation table as `; fallback: <vendor> <model> — <call line>` (the audit line names the model), and when a role's call cannot be made (its CLI is missing, the model is refused or over its limit — not when the answer is disliked) the PM uses that line once and says that it did, and why, in the report to the user and in the record of that step. Without a fallback, or when the fallback cannot be called either, the PM stops and asks. A fallback is inherited as one with its model: a role with a model of its own uses only its own fallback, and a role on the group's model uses the group's (a group with several models has one fallback too). It can be written only where a model stands beside it in the same file (a personal file with a fallback and no model would switch that group off) and must differ from that model. A Claude fallback has no `rs-*` file of its own; the table says "a general subagent on that model, given the role's section of the role file". Settings without any fallback get a delegation section that does not mention fallbacks. `config` resolves inheritance when it writes and puts the result into the generated files and the delegation table. The local override `.loctx/bindings.local.yaml` (same shape, wins per key) differs per person, so it never reaches generated files. When a person's delegation differs from the team's, whatever writes the delegation block (`config` at either scope, `install`, `update`) writes that person's table to `.loctx/delegation.local.md` with the same renderer, and removes it once they match again (compared as rendered text). A Claude role there names its `rs-*` file when the team generated one with the same name and model, otherwise "a general subagent on that model, given the role's section of `.agents/harness/roles/<group>.md`" (no local `rs-*` files — `.claude/agents/` is the team's). Following it rests on documents, not blocking: the first sentence of each skill's ③, the delegation section's first line, and `config` saying "tell a running agent session to re-read it, or start a new one" when it writes or removes the table (intent 020).

## 6. Generation and drift
Sources → generated files: `harness/roles/` + bindings → `.claude/agents/rs-<group>-<role>.md` (Claude roles switched on in multi mode only; model and `tools` written in) · `skills/` → `.agents/skills/` (copied to `.claude/skills/` for Claude) · templates → AGENTS.md managed blocks. Generated files start with "generated — do not edit". A role assigned to another vendor's model gets a command line in the delegation table instead of an agent file. Its command is `tools.<vendor>.cli` from the settings and, when that is not recorded, the default command reins knows for the vendor (`codex` for openai, `agy` for google, `cursor-agent` for cursor). Several Claude models on one role (discussion, committee) get one numbered file each (`rs-advisor-committee-1` …). Single mode has no agent files. install never overwrites a same-named file not listed in `generated.yaml`: it skips that file, says so, and installs the rest.

**`.claude/settings.json` is merged.** reins shares this file with the user, so it is the exception to the rule above. Only the `permissions.deny` rules made from the red lines are reins' (`$schema` is added only when missing); every other key and entry (`allow`, lines the user added to `deny`, `hooks`, `env` …) stays as it is, in order. The rules reins wrote last are listed under `owned:` in `generated.yaml`; on regeneration the current rules go to the end of `deny` (those already there stay put) and only rules that were on the list and are no longer generated are removed. An install without the list (0.3.0 or earlier) counts the whole file as reins' when it is exactly what reins wrote, and is only added to when it was touched. The file is merged even when it holds the user's entries or reins never wrote it, and `--force` makes no difference for it. If it is not JSON, or `permissions` or `deny` has another shape, it is not written and reins says so (the other generated files are still written).

**The gate script.** `.agents/harness/run-gates.sh` (POSIX sh) runs the required check commands of `gates.yaml` in order and keeps their output on the terminal and in `.loctx/reports/gates/<tree>.log`. It stops at the first failure and returns that exit code. reins writes the commands into the script (it reads no YAML when it runs): `install` and `update` rewrite it from the current `gates.yaml` every time, `config gates` when it changes `gates.yaml`. Like the other generated files it is hashed in `generated.yaml`, so a hand edit is noticed. Without a required check there is no script and no hook line. It never calls reins or npx and changes no environment variable. `<tree>` is the tree hash of what is checked — in the pre-commit stage `git write-tree` (the index git prepared for that commit, so also right for `commit -a` and `commit <paths>`), in any other stage `HEAD^{tree}`. A commit's log is found with `git rev-parse <commit>^{tree}`. Every run appends a header `== <time> stage: <stage> worktree: clean|dirty`, the commands and their output, and a last line `exit: <code>`. The checks run in the work tree, so when the work tree differs from that tree (a partly staged commit, or a file git neither tracks nor ignores) the run is `dirty` and is no evidence for the tree.

**Hooks.** install detects the project's hook tool (lefthook config, `.husky/`, pre-commit config) and proposes one line per stage — `sh .agents/harness/run-gates.sh pre-commit`, `… pre-push`. For husky it asks on a terminal and, when the user confirms, adds the line inside a `# reins:begin hooks` block (auto mode asks too; non-interactive only with `--hooks`). A block that is already there and holds something else (0.3.0 wrote the check commands themselves) is rewritten to that one line by `install` and `update`, which print what it held. A husky file without a block is not touched without that confirmation. For lefthook and pre-commit it only proposes the line in that tool's form; the user adds it to that config. Without a hook tool it becomes an onboarding to-do, but the script is written all the same, so a tool chosen later needs the same one line. On Windows, `sh` (it comes with Git for Windows) must be on the hook tool's PATH.

**Drift** is a generated file out of step with its source (edited by hand, or not regenerated). ① The audit uses git history to tell whether a commit that changed a generated or harness file during the version was an `update` or `config` commit. ② `update` compares `generated.yaml` hashes with the files, shows hand-edited files and asks before overwriting (non-interactive: lists them, does not overwrite, exits 1; `--force` overwrites). Hooks and CI do not check drift. In `.claude/settings.json` a change to the user's own entries is not drift; only a deny rule of reins' removed or changed by hand is (the next `update` or `config` puts it back).

## 7. Generations, migrate, moving from 0.x
Generation signals and the `.ai/` mapping are as in v1.0, except that open work moves into intent 000's plan list instead of ticket files. An AGENTS.md conflict is handled by the reconcile in §5.

**0.1.x and 0.2.0 → 0.3** (detected by `update`, idempotent): delete the `reins-*` skills and install the new ones · remove the `reins:begin hooks` blocks from hook files (keeping the user's lines) and make §6's hook proposal · remove reins hook entries from `.claude/settings.json` (keeping the user's entries) · delete `.claude/agents/reins-*.md` · bindings version 1 → 2 (roles → groups: pm is not moved — the PM is the model in the conversation, planner and pl→pl/planner, implementer→implementer, code-review→pl.code-reviewer, verify-tool, qa-run, deploy, lookup→executor, qa-design→planner.qa-designer, docs→implementer.doc, advisor→advisor; confirmed by the user) · remove `tier` from `install.yaml` · reconcile AGENTS.md · list bus, ticket, dispatch, hook-state, journal, reports and metrics under `.loctx` and delete them after confirmation (history, context and ROADMAP.local stay). A run stopped half-way continues when run again.

## 8. Knowledge
The format of `.agents/knowledge/<date>_<slug>.md` (decision · why · applies to · if it changes) is as in v1.0. Promotion happens in the retro (the `retro` skill): the retrospector or the PM finds decisions and failures repeated (twice or more) in history and audits and proposes them — or, when an entry already covers one, an update of that entry; when the user accepts, the PM writes the entry (`approved: {by, at, words}`). Lookup is `grep -l 'decisions:.*<keyword>' .loctx/history/* .agents/knowledge/*`. No CLI counts.

## 9. CLI and plugin
`npx @bluenyang/reins` — four commands. `install`, `migrate` and `update` take `--dry-run`; all four take `--json`. TypeScript, Node ≥ 22, nothing shipped needs Python (R65). The CLI never calls a model.
- `install [--mode manual|auto] [--hooks]`: place the harness, detect tools, confirm gates, propose hooks, add the onboarding marker. Default mode single. Refuses on 3rd- and 4th-generation harnesses and points to `migrate`.
- `migrate [--legacy local|committed]`: detect the generation, move it, add the reconcile marker.
- `update [--yes] [--force]`: sources → generated files, confirm hand edits, move 0.x installs.
- `config`: on a TTY a screen — `models and roles` (simple or detailed assignment, models per group and per role, groups on and off with when to switch one on: the PM's context degrading, independent work in parallel, review or audit on another model) · `agent tools` (re-detect claude, codex, agy, gemini, copilot, cursor agent and choose which to use) · `mode` (single/multi; switching adds the mode-changed marker) · `audit` (switching the requirement off asks once more) · `gates` (shows the gates as they are — name, command, source, order — with the hook tool and the gate script, and offers the refresh and adding subdirectory proposals). Two scopes: project (the team, the committed `bindings.yaml`) and local (you only, `.loctx/bindings.local.yaml`, plus `.loctx/delegation.local.md` when you delegate differently from the team); there are no PC-wide defaults. Writing project regenerates the generated files. In single mode, group assignments are shown as used in multi only and the auditor as the recommended audit model. Model lists come from a vendor's CLI where it gives one, else from the known list in `harness/models.yaml`. Without a TTY, flags (`config bindings --set …`, `config bindings --fallback <group>[.<role>]=<model|vendor:model|none>`, `config gates --add …`, `config gates --refresh [--apply <name…|all>]` and so on; today's `configure` flags are accepted as they are). **Finding the gates again** — `config gates --refresh` runs the discovery of installation again (root and subdirectories) and reports how `gates.yaml` differs from it. Pairing goes in this order: the same source (`from`) and command is the same gate → the same source and name is **changed** → the same name is **changed** (the root `check` now points at another script) → what is left of the discovery is **new**, and what is left of the file is **gone** (the discovery no longer proposes it; the reason says whether its source file is missing or another gate covers it). A gate without `from` was written by hand: it is shown as "yours" and never touched. Nothing is written automatically: on a terminal only what the user picks from the list, otherwise only the names given to `--apply` (`all` for every one) — a new gate is appended to `gates` and `order`, a changed one gets its command and source, a gone one is removed. Comments, other keys and the order stay. One unknown name writes nothing and exits 1. When `gates.yaml` changes, the gate script (§6) is rewritten and the hook line stays as it is. On the screen, `fallback (optional)` in a group's screen sets or removes a fallback.
- Fetching reins with npx at installation time is fine. Generated files may tell a person how to change settings ("run `npx @bluenyang/reins config` in a terminal"), but no sentence tells an agent to run reins.
- The repository is an npm package and a Claude Code plugin. The plugin carries only installation guidance (it shows the user `npx @bluenyang/reins install`).

## 10. What changed from v1.0
| v1.0 / 0.1–0.2.0 | v2.0 | Why |
|---|---|---|
| Verifier `reins check` T1–T6; hooks run `npx @bluenyang/reins check` | none; checks are the project's hooks and scripts, compliance is the audit | applied repositories depended on reins while working (offline, supply chain). User 2026-11-07 |
| `gate`, `new`, `status`, `metrics`, `retro`, `knowledge`, `recall`, `doctor` | none | same |
| three tiers harness/loop/graph | none; single/multi and groups switched on | user 2026-11-09 |
| 12 roles, fixed roles, `covered_by`, escalation chain | 7 groups (all but the PM optional), the PM covers groups that are off, PM as hub | user 2026-11-08 |
| plan.md, tickets, bus, metrics.jsonl | plan inside the intent, work units and checks inside the spec, sub-reports under reports | same; file lifetimes |
| approval = `approvals` + `Approved-by:` trailer | the user's words quoted `{by, at, words, rev}` | user 2026-11-09 |
| stop grades (HOLD, STOP, ESCALATE), ids A1–G2, enforcement table | plain stop rules (§3-2), audit criteria | no verifier |
| qa-design does not read code (R53) | may read code | user 2026-11-09 |
| drift checked by hooks and CI | audit + update confirmation | user 2026-11-09 |
| ten `reins-*` stage skills + conductor | eleven skills without a prefix, no conductor | user 2026-11-09 |
