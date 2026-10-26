---
name: reins-intent
description: Turn a request into an approved intent — runs the questionnaire with the user, writes .agents/intent/NNN_slug/intent.md and holds for the user's approval. Use when the user brings a new feature, change or problem, says new intent, or before any spec, plan or code exists for the work. Stops at the approved intent; the spec is reins-spec.
---

# reins-intent

The point where a person decides (design §4): **the intent is approved by the user.** Never cross it alone. pm role. Run the CLI as `npx @bluenyang/reins@<v>` where `<v>` is `cli` in `.agents/harness/install.yaml` (no `cli` line: installed before 0.1.3, run `npx @bluenyang/reins@latest update` once) (inside the reins repository: `node cli/dist/reins.js`). Verdicts: CONTINUE (exit 0) go on · HOLD (10) ask the user, one line: reason id + what you need · STOP (20) do what `resume` says, then re-run the same check · ESCALATE (30) next role in the chain (pl → pm → advisor → user).

1. **Check first.** `reins check --drift`. HOLD or STOP → follow it.
2. Search what was already decided or rejected: `reins recall <keywords>` (until it ships:
   `grep -l 'decisions:.*<keyword>' .loctx/history/*` and `.agents/knowledge/`). A rejected proposal is not
   raised again (C8).
3. **Questionnaire — ask only what only the user knows**, in one batch: the problem, the desired outcome,
   constraints, what not to do. State your defaults for everything else instead of asking.
4. `reins new intent <slug> [--version <v>] [--origin user]` creates `.agents/intent/<NNN>_<slug>/intent.md` from the template with the next id. Write it in the
   user's words and language; record the questions and answers under the questionnaire section;
   `status: draft`, `origin: user`, `version:` the release it targets.
5. Show it and **ask for approval. Never set `approved` yourself.** On the user's explicit yes:
   `status: approved`, `approvals: [{role: user, at: <date>}]`, and commit only that change with the trailer
   `Approved-by: <the user's name>` (`git commit -m "docs(intent): approve <NNN> <slug>" -m "Approved-by: …"`).

Next: `reins-spec`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.
A role bound to a vendor with no generated files yet runs on Claude with its role file as instructions; say so in the history line.
