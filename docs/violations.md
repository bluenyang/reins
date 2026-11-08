# reins — who catches which violation

> English edition. The Korean original is [`violations.ko.md`](violations.ko.md); where the two disagree, the Korean file wins. Companion to [`design.md`](design.md) §3.

Until 0.2.0, a verifier (`reins check`) ran at fixed points and stopped a violation as it happened; the
scenario suite that backed this table (V1–V25) is in git history (tag `v0.2.0`). In 0.3 nothing runs reins
while a project works (design §0), so the question is no longer "which stage stops it" but "who notices it":

| kind | caught by | when |
|---|---|---|
| reading a secret file (`.env`, `secrets/**`, keys) | the agent's host, through the generated deny rules (`.claude/settings.json`) | before the read (Claude Code) |
| force push, `--no-verify` | the generated deny rules | before the command (Claude Code) |
| a check that fails | the project's own hooks and CI (`gates.yaml` commands) | at commit, push and PR |
| a step of the flow skipped (no intent, no approval, no spec, no review, no test, no audit) | the **audit** of the version | after the merge, before the rc |
| an approval the user did not give | the audit (approvals quote the user's words and name a revision) and the user reading the audit report | after the merge |
| a generated or harness file edited by hand (drift) | the audit (git history) and `reins update` (asks before overwriting) | after the merge; at update |
| implementing "to pass", a change outside the spec, a reversed decision | review (one reviewer, or Discussion for large decisions) and the plan-reviewer | during review |
| the direction drifting from what the user wanted | the user, the plan-reviewer and the retro | at every approval; after the release |

The audit judges each step as kept, violated, cannot confirm (no evidence path) or skipped on the user's
instruction; a violation is fixed or accepted by the user, and criticised in the audit and the retro either way.
A passing audit does not vouch for direction or code quality.
