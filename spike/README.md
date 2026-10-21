# loop-harness

A vendor-neutral agent loop for any repository: roles, loop limits, handoff reports, a failure
catalog that learns, and deterministic gates — installed with one command, upgraded without
touching your own files.

```
analyze → design → work → verify → review → qa → write → release
                    ▲      fail     changes   fail → triage
                    └─────────────────────────────┘   bounded rounds → escalate → human
```

- **Any agent, any role.** Roles are plain Markdown in `.harness/core/`. Claude Code, Codex,
  Antigravity, or Cursor can take any role; `bindings` decide which one does.
- **Independent checks.** The developer never issues the final pass: verify reads tool output,
  review and QA run on another model, QA never reads source code.
- **Stops that shrink.** A *knowledge stop* writes a decision request; the answer goes into the
  failure catalog, and fixes verified twice are proposed as rules or hooks. An *intent stop*
  (invariants, stable releases, anything hard to undo) always stays with a person.

## Install

Requires Python ≥ 3.11. No dependencies.

```bash
python3 harness.py migrate ../my-project --dry-run   # see what changes, plus a legacy report
python3 harness.py migrate ../my-project             # existing harness (.claude/, .ai/)
python3 harness.py install ../my-project             # fresh project
python3 harness.py update  ../my-project             # later template versions
```

What it writes:

| Path                                           | Committed | Owner                                   |
| ---------------------------------------------- | --------- | --------------------------------------- |
| `.harness/core/`, `.harness/harness.py`        | yes       | template — replaced on update           |
| `.harness/project.toml`                        | yes       | you — created once from stack detection |
| `AGENTS.md` block between `harness:core` marks | yes       | template — the rest of the file is yours |
| `.claude/skills/*`, `.claude/agents/loop-*`, `.cursor/commands/*` | yes | generated — `harness.py render` |
| `.ai/loop`, `handoff`, `decisions`, `knowledge`, `qa` | no (gitignored) | the loop                  |

Existing skills, commands, hooks, and `.ai/` files are kept. Name collisions are reported, not
overwritten.

## Use

```bash
python3 .harness/harness.py gate all --summary     # gates, failing tails, catalog matches
python3 .harness/harness.py state set --target 1.2.0-rc.1 --stage work
python3 .harness/harness.py next                   # next stage, role file, bound agent
python3 .harness/harness.py dispatch qa            # run a stage on its bound CLI
python3 .harness/harness.py advance .ai/handoff/<report>.md
python3 .harness/harness.py doctor
```

In Claude Code: `/loop <target>`, `/step <stage>`, `/decide`, `/learn`, `/verify`.

## Bindings

`bindings/models.example.toml` maps roles to agent CLIs and models. Override per user in
`~/.config/loop-harness/models.toml` or per project in `.ai/models.toml`.

## Stacks

Detection fills `project.toml` for Node (pnpm, yarn, npm, bun), Go, and Gradle Kotlin. Lint
scripts that rewrite files (`--fix`) are not used as gates; `check:*` scripts become gates.
Monorepos with several stacks get the root stack plus a list of the others to add by hand.

## Status

v0.1 — installer, gates, state machine, and rendering are tested; `dispatch` command lines for
CLIs other than Claude Code are unverified. See `README.ko.md` for the Korean version.
