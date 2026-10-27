---
name: reins-loop
description: Conduct an accepted spec through the reins loop by calling the stage skills in order — reins-spec, reins-implement, reins-review, reins-test, reins-release, reins-retro — and stopping where a check says. Use when an intent is approved, when the user says continue, next ticket or run the loop, or to resume where reins status points. Holds only the common rules; each stage's procedure lives in its skill.
---

# reins-loop

Roles judge, scripts enforce. Each stage skill starts with its own check, and **its verdict decides what happens next**:
CONTINUE → go on · HOLD → ask the user (one line: reason id + what you need) · STOP → do what `resume` says,
then re-run the same check · ESCALATE → the next role in the chain (pl → pm → advisor → user).
Exit codes 0/10/20/30. Run the CLI as `npx @bluenyang/reins@<v>` where `<v>` is `cli` in `.agents/harness/install.yaml` (no `cli` line: installed before 0.1.3, run `npx @bluenyang/reins@latest update` once) (inside the reins repository: `node cli/dist/reins.js`).

## Order
1. `reins-roadmap` (when the roadmap changes) → `reins-intent` → `reins-spec`
2. For each ticket: `reins-implement` → `reins-review` (back to implement on a failed verdict; next ticket until none is left)
3. `reins-test` → `reins-release` → `reins-retro`

Resume: `reins status` names the stage; call that stage's skill again. Stop on any HOLD or STOP and report; never cross the user's two decisions (intent approval, spec summary veto) alone.

**Models.** Take the model a role runs on from `reins status --json` (`bindings`: `{role, vendor, model, source}`) — your own override, else the team binding, else its fallback, else pm's model. Never read `bindings.yaml` for it and never use the default from the role file.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess. Tokens come from the vendor — Claude subagent: the Agent result's token count · `codex exec`: the "tokens used" line · `agy`, `cursor-agent` with `--output-format json`: the usage field when present. `reins check` and `reins gate` log themselves to `.loctx/reports/metrics.jsonl`; `reins metrics` summarises it.

On an interruption (G1) write where you are — ticket, step, last commit, open bus files, next command — to the ticket, so the same command resumes.
