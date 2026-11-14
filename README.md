# reins

[한국어](docs/README.ko.md)

reins manages an agent harness for a repository: it installs, migrates, updates and configures the
files that tell coding agents how to work there — `AGENTS.md`, roles, stage skills and the model
assignment. That is all it does. Nothing reins installs runs reins while the project works: the
project's own hook tool runs the project's own checks, and an audit at the end of every version
judges whether the flow was followed.

It exists because twelve repositories of BlueNyang and Team Croffle share one harness lineage and
its problems: agents stepping outside the request, one session that implements and also judges,
knowledge lost in gitignored space, copies that drift apart. The full list is in
[docs/proposal.md](docs/proposal.md).

## Status

**0.3.2 is the latest release** (intents 019–022): `npx @bluenyang/reins install`. Up to 0.2.0, skills and hooks called `npx @bluenyang/reins` during work; 0.3 removes that, and `reins update` moves a 0.1.x or 0.2.0 install over. What changed in each version is in [CHANGELOG.md](CHANGELOG.md); what comes next is in the [roadmap](docs/ROADMAP.md).

## How it works

- **Single agent by default.** One agent, the PM, carries out every stage. It may use subagents of its own
  model for read-heavy work (research, review, audit) and urgent parallel work. Multi-agent work is switched
  on by assigning models to role groups — PM, PL, Planner, Implementer, Executor, Advisor, Auditor; a group
  without a model is done by the PM. The basis is Anthropic's
  [Building agents: When to fold subagents into your main agent loop](https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop) (2026-10-22).
- **A flow written down, not enforced at run time.** `docs/ROADMAP.md` → intent → spec → implement →
  review → test → PR and CI → first audit → merge → release → second audit → retro. Each stage is a skill in `.agents/skills/`; `AGENTS.md`
  holds the order and the rules for stopping and asking.
- **The user approves.** The intent and every spec summary wait for the user; the PM records approvals by
  quoting the user. A step the user tells the agent to skip is recorded once.
- **Two audits for every version.** After CI and before the merge, a first audit reads the records (intent,
  spec, git history, logs) and looks for risk; after the release a second audit looks at procedure only and
  hands its result to the retro. They are mandatory unless the user switches them off, and their record is
  committed to `.agents/audit/`.
- **Onboarding.** After installation, the first conversation reads the project, asks the user, and writes the
  project sections of `AGENTS.md`.
- **Every file has a lifetime.** Working files are summarised and deleted after the retro.

The design is in [docs/design.md](docs/design.md).

## Quick start

Run it from the root of the repository you want to set up (Node 22 or later):

```sh
npx @bluenyang/reins install --dry-run   # show what would be written
npx @bluenyang/reins install             # ask, then place the harness
npx @bluenyang/reins config              # models and roles, agent tools, mode, audit
```

Then open your agent in the repository: the onboarding note in `AGENTS.md` starts the first conversation.
In Claude Code the plugin shows the same commands:

```
/plugin marketplace add bluenyang/reins
/plugin install reins@bluenyang
/reins:reins-setup
```

To work on reins itself: `git clone https://github.com/bluenyang/reins.git`, then `pnpm install`,
`pnpm build`, and run `node cli/dist/reins.js <command>` (see [CONTRIBUTING.md](CONTRIBUTING.md)).

## Commands

| Command | Does |
|---|---|
| `install` | places the harness, detects agent tools, confirms gates, writes the gate script `.agents/harness/run-gates.sh` (it runs the project's gate commands and keeps their output for the audit) and proposes the one hook line that calls it (`--hooks` adds it to husky), adds the onboarding note; `--mode manual\|auto`, `--dry-run`, `--json` |
| `migrate` | moves an older harness or an `.ai/` workspace onto this layout and keeps the previous `AGENTS.md` aside for the PM to reconcile; `--legacy local\|committed`, `--dry-run` |
| `update` | re-applies the packaged harness; asks before overwriting a generated file edited by hand (`--force`); moves a 0.1.x or 0.2.0 install to 0.3 and lists its old working files (`--yes` deletes them) |
| `config` | a screen on a terminal: models and roles, agent tools, mode (single or multi), audit; `config bindings` and `config gates` take flags (`configure` is an alias). `config gates --refresh` finds the project's checks again, shows what differs from `gates.yaml` (new, changed, gone) and applies only what you pick (`--apply <name…|all>` without a terminal); the screen has a `gates` item for the same. A group or a role may name a fallback model (`config bindings --fallback <group>[.<role>]=<model>`): its call line goes into the delegation table, for when the first model cannot be called |

## Skills

`onboard`, `roadmap`, `intent`, `spec`, `implement`, `review`, `test`, `merge`, `audit`, `release`, `retro` —
one per stage, plain text, the same in single and multi mode. Each names the files it creates and when they
are deleted, and the next skill.

## Documents

- [docs/proposal.md](docs/proposal.md): problems, goal, requirements
- [docs/design.md](docs/design.md): layout, roles, flow, audit, file formats, CLI
- [docs/ROADMAP.md](docs/ROADMAP.md): versions
- [docs/conversation/](docs/conversation/): the maintainer's design conversations — what was weighed and why, not rules (in Korean only)
- Korean editions: [proposal.ko.md](docs/proposal.ko.md), [design.ko.md](docs/design.ko.md), [ROADMAP.ko.md](docs/ROADMAP.ko.md). Where an English and a Korean edition disagree, the Korean file wins.

## License

MIT
