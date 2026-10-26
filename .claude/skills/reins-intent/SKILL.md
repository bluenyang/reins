---
name: reins-intent
description: Turn a request into an approved intent and an accepted spec — runs the questionnaire with the user, writes .agents/intent/NNN_slug/intent.md, holds for the user's approval, then has the planner write spec.md and shows its summary for the user's veto. Use when the user brings a new feature, change or problem, says new intent or plan this, or before any spec, plan or code exists for the work.
---

# reins-intent

The two points where a person decides (design §4): **the intent is approved by the user**, and **the spec
summary may be vetoed by the user** (R64). Everything here leads to one of them; never cross either alone.

## Intent — pm role
1. Search what was already decided or rejected: `reins recall <keywords>` (until it ships:
   `grep -l 'decisions:.*<keyword>' .loctx/history/*` and `.agents/knowledge/`). A rejected proposal is not
   raised again (C8).
2. Next id = highest `.agents/intent/NNN_*` + 1, three digits; slug in kebab-case.
3. **Questionnaire — ask only what only the user knows**, in one batch: the problem, the desired outcome,
   constraints, what not to do. State your defaults for everything else instead of asking.
4. Copy `.agents/harness/templates/intent.md` to `.agents/intent/<NNN>_<slug>/intent.md`; write it in the
   user's words and language; record the questions and answers under the questionnaire section;
   `status: draft`, `origin: user`, `version:` the release it targets.
5. Show it and **ask for approval. Never set `approved` yourself.** On the user's explicit yes:
   `status: approved`, `approvals: [{role: user, at: <date>}]`, and commit only that change with the trailer
   `Approved-by: <the user's name>` (`git commit -m "docs(intent): approve <NNN> <slug>" -m "Approved-by: …"`).

## Spec — planner, then pm and qa-design
6. planner: copy `templates/spec.md`; every requirement is `S-n` with the intent sentence it comes from;
   invariants in AGENTS.md checked (conflict or none); `summary_for_user:` 3–5 lines in the user's language.
7. pm reviews against the intent; qa-design gives the first review (bus `kind: review`). Fix, then
   `status: reviewed`.
8. **Show `summary_for_user` and the acceptance criteria; the user may veto** (G2 → revise the spec). No veto →
   `status: accepted`, `approvals:` pm, qa-design and `{role: user, kind: summary}`; commit with
   `Approved-by:`. Then hand over to `reins-loop`.

**Metrics.** After each role run, report what it cost with one call: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`. No token count from the vendor → record nothing, never guess.

A role bound to a vendor with no generated files yet (round one generates Claude only) runs on Claude with
its role file as instructions; say so in the history line.
