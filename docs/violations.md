# reins — who catches which violation (S3)

> English edition. The Korean original is [`violations.ko.md`](violations.ko.md); where the two disagree, the Korean file wins. Companion to [`design.md`](design.md) §3.

The design lists 10 common red lines (C1–C10) and 24 stop conditions (A1–G2). This table says, for each of the 34, who catches a violation **in the code as it stands**, not as the design intends. It is the S3 table of intent 003.

`test/e2e/violations.test.ts` backs it. It breaks a rule on purpose in a throwaway git repository, runs the built `cli/dist/reins.js` as a child process, and reads the stop report and the exit code. It currently prints `violations: 18/18 stopped`. Scenarios are numbered V1–V18; a row with `—` has no scenario because no code path exists to exercise (or, for a role's judgement, because the scenarios do not automate it).

Columns:

- **caught by** — `verifier` (`reins check` / `reins gate`; the stage is named), `settings deny` (the generated `.claude/settings.json` deny rules; Claude Code only), `role` (a role's judgement; `stops.yaml` says `detect: role`, `pm` or `runtime`, or the red line is only written into the role's `must_not`), or `none (gap)` (nothing in the code catches it). When a row has two, the first is the main one.
- **where** — the stage or command, or the file. The `pre-commit` and `pre-push` stages run only if the hooks are installed (`install` proposes them and adds them with `--hooks`); the other stages run when a role calls them.

| id | what | caught by | where | scenario |
|---|---|---|---|---|
| C1 (red line) | implementing "to pass" — hard-coding, or only some paths look right | role | reviewers' judgement; text in the roles' `must_not` | — |
| C2 (red line) | editing `AGENTS.md` managed blocks, `harness/policy/` or `harness/roles/` | verifier | `check --stage pre-commit` (when files under `.agents/harness/` are staged) and `check --drift`, match layer, reported as F2. Managed blocks: none (gap) | V4 |
| C3 (red line) | editing one's own permission file or a generated vendor file | verifier | `check --stage pre-commit` (when `.claude/` or `.agents/harness/` is staged) and `check --drift`, `generated.yaml` hashes | V5 |
| C4 (red line) | reading secret files | settings deny, verifier | `.claude/settings.json` `Read`/`Edit` rules; `check --stage pre-commit` rejects a staged secret path | V1, V18 |
| C5 (red line) | bypassing hooks, or massaging gate output | verifier, settings deny | `reins gate` refuses a non-single-command gate; `check --stage verdict` rejects piped evidence; `.claude/settings.json` denies `git commit --no-verify` and `git push --no-verify` | V13, V17, V18 |
| C6 (red line) | push, PR, merge, release, tag outside the deploy role | none (gap) | — | — |
| C7 (red line) | reversing a recorded decision without the user | role | text in the roles' `must_not` | — |
| C8 (red line) | re-raising a rejected proposal | role | text in the roles' `must_not` (see F3) | — |
| C9 (red line) | touching running servers, clusters or network devices | role | text in the roles' `must_not` | — |
| C10 (red line) | changing files or behaviour outside the intent and plan | none (gap) | — | — |
| A1 | force push to a shared branch, moving or deleting a published tag, rewriting main | verifier, settings deny | `check --stage pre-push` (remote commit not an ancestor of the pushed one); `.claude/settings.json` denies `git push --force`, `-f`, `--force-with-lease` | V8, V18 |
| A2 | stable (non-rc) release | none (gap) | — | — |
| A3 | irreversible data change, touching running servers or clusters | none (gap) | — | — |
| A4 | anything leaving the machine outside the pre-release loop | none (gap) | — | — |
| B1 | a ticket with open `asks:` | verifier | `check --stage ticket-start` | V10 |
| B2 | a design invariant changes without a recorded decision | none (gap) | — | — |
| B3 | a change conflicts with the intent or spec | role, verifier | the scope conflict itself is a role's judgement; `check --stage ticket-start` checks only the approval chain (intent approved with an `Approved-by:` commit, spec accepted) | V9 |
| B4 | the roadmap is silent or contradicts itself | role | pm | — |
| B5 | an external API or environment contradicts a design assumption | role | the role that finds it, then `spec.md` | — |
| C1 (stop) | the rationale for the work no longer holds | role | the roles that read plan and ticket | — |
| C2 (stop) | the diff departs from `plan.md` and the plan was not updated | verifier | `check --stage ticket-start` (ticket not in the plan's `tickets:`) and `rc-close` (open ticket of the intent not in the plan) | V11 |
| D1 | two failed verification rounds in a row | verifier | `check --stage verdict` | V15 |
| D2 | a red check twice with no fix in history or knowledge | none (gap) | — | — |
| D3 | flaky: passes alone, fails in the full run | none (gap) | — | — |
| D4 | suspected false pass: no exit code, empty output, piped gate | verifier | `check --stage verdict`; `reins gate` | V13, V14, V17 |
| D5 | a pass without evidence | verifier | `check --stage verdict` | V12 |
| E1 | 80% of the narrowest budget | none (gap) | — | — |
| E2 | 100% of a ticket or scope budget | none (gap) | — | — |
| E3 | 100% of an rc or session budget | none (gap) | — | — |
| F1 | a role attempts an action on its `must_not` list or a red line | none (gap) | — | — |
| F2 | drift between the harness sources and generated files, or a convention violation | verifier | `check --stage pre-commit` and `check --drift` (format, convention, match, generated layers); also the plan and ticket checks of `ticket-start` and `rc-close` | V2, V3, V4, V6, V7, V16 |
| F3 | a rejected proposal re-raised | role | `stops.yaml` `detect: role` | — |
| G1 | the user interrupts: chat, Ctrl+C, session end | none (gap) | — | — |
| G2 | the user vetoes a spec summary | role | pm (`stops.yaml` `detect: pm`) | — |

`C1` and `C2` exist twice: as common red lines (design §2) and as stop conditions (design §3). The table keeps both and marks them `(red line)` and `(stop)`. The stop report's `reason: C1` or `reason: C2` is the stop condition. `reason: C3`, `C4` and the other red-line ids are red lines. The collision is a naming problem, not a code one.

## Notes on rows

- **C2 (red line)**: the match layer compares `.agents/harness/` with the packaged upstream and reports F2. When the pinned version differs from the packaged one, it only warns. `AGENTS.md` managed blocks are not compared with anything; `reins check` does not read `blocks.ts`. The project-root `harness/` source is not checked.
- **C3**: the stop report carries `reason: C3`. The generated `.claude/settings.json` deny rules do not stop an edit of `.claude/settings.json` itself.
- **C4**: `settings deny` stops the read inside Claude Code only. Other vendors get no deny rules; the verifier then catches the file only at staging.
- **C5**: the deny rules match `git commit --no-verify *` and `git push --no-verify *` exactly; short forms such as `-n` are not covered.
- **C6**: the deny rules cover force and `--no-verify` pushes only. A plain `git push`, a PR, a merge, a release or a tag is blocked by nothing. `pre-push` only checks that the remote commit is an ancestor (A1).
- **A1**: the design adds tag deletion and rewriting main. `pre-push` skips ref lines for a new branch or a deletion, and does not look at tags.
- **A2, A3, A4**: `stops.yaml` says `detect: verifier` and T4 lists them, but `prePush` implements only A1.
- **B2**: `stops.yaml` says `detect: verifier`; no code compares a design invariant with a recorded decision.
- **B3**: the ticket-start approval chain reports `reason: B3`, although `stops.yaml` marks B3 as `detect: role`.
- **C1 (stop)**: `stops.yaml` says `detect: role`; no code evaluates a rationale.
- **C2 (stop)**: only the ticket-in-plan check exists. There is no comparison of a diff with `plan.md`, so T2's C2 and C10 checks do not exist either.
- **D1**: counts consecutive failed `verify` exchanges of one ticket (1 warns, 2 escalates); it does not tell "ticket before rc.1" from "rc after".
- **D2, D3**: `stops.yaml` says `detect: verifier`; there is no cross-run memory and no alone-versus-full-run comparison.
- **E1, E2, E3**: `budget.yaml` has no defaults, and nothing reads a budget or a token count. T1's `budget-left` and T5's E3 do not exist.
- **F1, G1**: T6 ("always") is listed in `transitions.yaml` and has no code. The CLI has no signal handler and writes no resume record on an interrupt. F1 is partly blocked in Claude Code by the deny rules, but no stop is recorded.
- **F2**: T1's other checks (dependencies, bindings, plan status) and T5's (open tickets, history) also report as F2.
- **F3, G2**: no scenario. Both are a role's call and are out of scope for automated scenarios.

## Gaps (feed the 0.1.0 stabilisation list)

The `none (gap)` rows; nothing in the code catches them. This document does not fix them.

- C6 (red line): push, PR, merge, release and tag are not blocked; only force and `--no-verify` pushes are.
- C10 (red line): no check that the diff stays within the intent and plan (T2 lists it).
- A2: stable release.
- A3: irreversible data change, running servers and clusters.
- A4: leaving the machine outside the pre-release loop.
- B2: a design invariant changes without a recorded decision.
- D2: a red check twice with no fix recorded.
- D3: flaky test detection.
- E1: budget warning at 80%.
- E2: scope budget at 100%.
- E3: rc or session budget at 100%.
- F1: a role's red-line attempt is not recorded as a stop (T6).
- G1: interrupt handling and resume record (T6).

Partial gap, kept in its row: C2 (red line), hand edits to `AGENTS.md` managed blocks.
