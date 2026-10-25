# reins — who catches which violation (S3)

> English edition. The Korean original is [`violations.ko.md`](violations.ko.md); where the two disagree, the Korean file wins. Companion to [`design.md`](design.md) §3.

The design lists 10 common red lines (C1–C10) and 24 stop conditions (A1–G2). This table says, for each of the 34, who catches a violation **in the code as it stands**, not as the design intends. It is the S3 table of intent 003.

`test/e2e/violations.test.ts` backs it. It breaks a rule on purpose in a throwaway git repository, runs the built `cli/dist/reins.js` as a child process, and reads the stop report and the exit code. It currently prints `violations: 18/18 stopped`. Scenarios are numbered V1–V18; a row with `—` has no scenario because no code path exists to exercise (or, for a role's judgement, because the scenarios do not automate it).

Columns:

- **caught by** — `verifier` (`reins check` / `reins gate`; the stage is named), `settings deny` (the generated `.claude/settings.json` deny rules; Claude Code only), `role` (a role's judgement; `stops.yaml` says `detect: role`, `pm` or `runtime`, or the red line is only written into the role's `must_not`), or `none (gap)` (nothing in the code catches it). When a row has two, the first is the main one.
- **where** — the stage or command, or the file. The `pre-commit` and `pre-push` stages run only if the hooks are installed (`install` proposes them and adds them with `--hooks`); the other stages run when a role calls them.

| id | what | caught by | where | scenario |
|---|---|---|---|---|
| C1 (red line) | implementing "to pass" — hard-coding, or only some paths look right | role | reviewers' judgement; `implementer.md` `must_not`, and the common red-line instruction in every generated Claude agent | — |
| C2 (red line) | editing `AGENTS.md` managed blocks, `harness/policy/` or `harness/roles/` | verifier | `check --stage pre-commit` (when files under `.agents/harness/` are staged) and `check --drift`, match layer, reported as F2. Managed blocks: none (gap) | V4 |
| C3 (red line) | editing one's own permission file or a generated vendor file | verifier | `check --stage pre-commit` (when `.claude/` or `.agents/harness/` is staged) and `check --drift`, `generated.yaml` hashes | V5 |
| C4 (red line) | reading secret files | settings deny, verifier | `.claude/settings.json` `Read`/`Edit` rules for the listed patterns (`.env.*` is narrowed to a finite list; other names such as `.env.custom` have no rule); `check --stage pre-commit` rejects a staged secret path, not a read | V1, V18 |
| C5 (red line) | bypassing hooks, or massaging gate output | verifier, settings deny | `reins gate` refuses a non-single-command gate; `check --stage verdict` rejects piped evidence; `.claude/settings.json` denies `git commit --no-verify` and `git push --no-verify`; short forms such as `-n`: none (gap) | V13, V17, V18 |
| C6 (red line) | push, PR, merge, release, tag outside the deploy role | none (gap) | — | — |
| C7 (red line) | reversing a recorded decision without the user | role | `common-red-lines.yaml`; the common red-line instruction in every generated Claude agent | — |
| C8 (red line) | re-raising a rejected proposal | role | `common-red-lines.yaml`; the common red-line instruction in every generated Claude agent (see F3) | — |
| C9 (red line) | touching running servers, clusters or network devices | role | `common-red-lines.yaml`; the common red-line instruction in every generated Claude agent | — |
| C10 (red line) | changing files or behaviour outside the intent and plan | role | `code-review.md` (a diff outside the plan is C10) and the `implementer.md` `must_not`. No automatic diff-versus-plan check: none (gap) | — |
| A1 | force push to a shared branch, moving or deleting a published tag, rewriting main | verifier, settings deny | `check --stage pre-push` (remote commit not an ancestor of the pushed one, for every ref pair including tags); `.claude/settings.json` denies `git push --force`, `-f`, `--force-with-lease`. Deleting a tag, and moving one forward so that ancestry holds: none (gap) | V8, V18 |
| A2 | stable (non-rc) release | none (gap) | — | — |
| A3 | irreversible data change, touching running servers or clusters | none (gap) | — | — |
| A4 | anything leaving the machine outside the pre-release loop | none (gap) | — | — |
| B1 | a ticket with open `asks:` | verifier | `check --stage ticket-start` | V10 |
| B2 | a design invariant changes without a recorded decision | none (gap) | — | — |
| B3 | a change conflicts with the intent or spec | role, verifier | the scope conflict itself is a role's judgement; `check --stage ticket-start` checks only the approval chain (intent approved with an `Approved-by:` commit, spec accepted) | V9 |
| B4 | the roadmap is silent or contradicts itself | role | pm | — |
| B5 | an external API or environment contradicts a design assumption | role | the role that finds it, then `spec.md` | — |
| P1 (stop) | the rationale for the work no longer holds | role | the roles that read plan and ticket | — |
| P2 (stop) | the diff departs from `plan.md` and the plan was not updated | verifier | `check --stage ticket-start` (ticket not in the plan's `tickets:`) and `rc-close` (open ticket of the intent not in the plan) | V11 |
| D1 | two failed verification rounds in a row | verifier | `check --stage verdict` | V15 |
| D2 | a red check twice with no fix in history or knowledge | none (gap) | — | — |
| D3 | flaky: passes alone, fails in the full run | none (gap) | — | — |
| D4 | suspected false pass: no exit code, empty output, piped gate | verifier | `check --stage verdict` (no exit line, non-zero exit, no command line, compound command); `reins gate` (refuses a compound command). Empty command output: none (gap) | V13, V14, V17 |
| D5 | a pass without evidence | verifier | `check --stage verdict` | V12 |
| E1 | 80% of the narrowest budget | none (gap) | — | — |
| E2 | 100% of a ticket or scope budget | none (gap) | — | — |
| E3 | 100% of an rc or session budget | none (gap) | — | — |
| F1 | a role attempts an action on its `must_not` list or a red line | none (gap) | — | — |
| F2 | drift between the harness sources and generated files, or a convention violation | verifier | `check --stage pre-commit` and `check --drift` (format, convention, match, generated layers); also the plan and ticket checks of `ticket-start` and `rc-close` | V2, V3, V4, V6, V7, V16 |
| F3 | a rejected proposal re-raised | role | `stops.yaml` `detect: role` | — |
| G1 | the user interrupts: chat, Ctrl+C, session end | none (gap) | — | — |
| G2 | the user vetoes a spec summary | role | pm (`stops.yaml` `detect: pm`) | — |

Stop conditions P1 and P2 (premise) used to be called C1 and C2, which collided with the common red lines C1 and C2 (design §2). Since harness 0.1.1 the stops are P1 and P2 and a stop report's `reason: C1`..`C10` is always a red line. `metrics` still reads old records with `reason: C1` or `C2` as P1 and P2.

## Notes on rows

- **C2 (red line)**: the match layer compares `.agents/harness/` with the packaged upstream and reports F2. When the pinned version differs from the packaged one, it only warns. `AGENTS.md` managed blocks are not compared with anything; `reins check` does not read `blocks.ts`. The project-root `harness/` source is not checked.
- **C3**: the stop report carries `reason: C3`. The generated `.claude/settings.json` deny rules do not stop an edit of `.claude/settings.json` itself.
- **C4**: `settings deny` stops the read inside Claude Code only; other vendors get no deny rules, and the verifier looks at staged paths, never at reads. `denyRules` replaces the `.env.*` pattern with a fixed list (`.env.local`, `.env.*.local`, `.env.development`, `.env.production`, `.env.staging`, `.env.test`), so a name such as `.env.custom` can be read and edited with no deny rule, although the staging check still rejects it. V18 asserts three generated strings (`Read(**/.env)`, `Bash(git push --force *)`, `Bash(git commit --no-verify *)`), not the full pattern list.
- **C5**: the deny rules match `git commit --no-verify *` and `git push --no-verify *` exactly; short forms such as `-n` are not covered.
- **C7, C8, C9**: the prohibitions are written in `common-red-lines.yaml`, and every generated Claude agent carries the line "break any common red line in `common-red-lines.yaml`". They are not in the individual roles' `must_not` lists, and nothing checks them. F3 is also in `stops.yaml` as `detect: role`.
- **C10**: `code-review.md` step 1 treats a diff outside `plan.md` as C10, and `implementer.md` lists it in `must_not`; that is a review, done by a role. T2 lists C10 as a verifier check, but `preCommit` has no diff-versus-plan comparison.
- **C6**: the deny rules cover force and `--no-verify` pushes only. A plain `git push`, a PR, a merge, a release or a tag is blocked by nothing. `pre-push` only checks that the remote commit is an ancestor (A1).
- **A1**: `pre-push` applies the ancestry check to every ref pair git passes, tags included, so a tag moved to a commit that is not a descendant is held. It skips new refs and deletions (zero sha), so deleting a tag or branch is not caught. A tag moved forward to a descendant satisfies the ancestry test and is not rejected, although the design calls moving a published tag irreversible.
- **A2, A3, A4**: `stops.yaml` says `detect: verifier` and T4 lists them, but `prePush` implements only A1.
- **B2**: `stops.yaml` says `detect: verifier`; no code compares a design invariant with a recorded decision.
- **B3**: the ticket-start approval chain reports `reason: B3`, although `stops.yaml` marks B3 as `detect: role`.
- **P1 (stop)**: `stops.yaml` says `detect: role`; no code evaluates a rationale.
- **P2 (stop)**: only the ticket-in-plan check exists. There is no comparison of a diff with `plan.md`, so T2's P2 and C10 checks do not exist either.
- **D1**: counts consecutive failed `verify` exchanges of one ticket (1 warns, 2 escalates); it does not tell "ticket before rc.1" from "rc after".
- **D4**: `verdictCheck` needs a command line (`$ cmd`) and `exit 0` in the evidence; it does not look at what lies between. Evidence with only those two lines is accepted, and `reins gate` writes empty command output to its report without complaint. Missing evidence altogether is D5 (V12), which is a different case.
- **D2, D3**: `stops.yaml` says `detect: verifier`; there is no cross-run memory and no alone-versus-full-run comparison.
- **E1, E2, E3**: `budget.yaml` has no defaults, and nothing reads a budget or a token count. T1's `budget-left` and T5's E3 do not exist.
- **F1, G1**: T6 ("always") is listed in `transitions.yaml` and has no code. The CLI has no signal handler and writes no resume record on an interrupt. F1 is partly blocked in Claude Code by the deny rules, but no stop is recorded.
- **F2**: T1's other checks (dependencies, bindings, plan status) and T5's (open tickets, history) also report as F2.
- **F3, G2**: no scenario. Both are a role's call and are out of scope for automated scenarios.

## Gaps (feed the 0.1.0 stabilisation list)

The 12 `none (gap)` rows; nothing in the code catches them. This document does not fix them.

- C6 (red line): push, PR, merge, release and tag are not blocked; only force and `--no-verify` pushes are.
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

Partial gaps (the row has a working detector for the rest; the uncovered part is listed here too):

- C2 (red line): hand edits to `AGENTS.md` managed blocks.
- C4 (red line): reads of secret-like names outside the fixed deny list (for example `.env.custom`); the verifier checks staged paths only, and V18 asserts three strings.
- C10 (red line): no automatic check that the diff stays within the intent and plan (T2 lists it); the code-review role does it by hand.
- C5 (red line): `git commit -n` and other short or reordered forms of `--no-verify`, which the exact deny patterns do not match.
- A1: deleting a tag, and moving a published tag forward to a descendant commit.
- D4: command output that is empty is accepted by `reins gate` and by `check --stage verdict`.
