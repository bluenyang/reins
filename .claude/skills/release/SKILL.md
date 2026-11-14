---
name: release
description: Cut the rc and, on the user's explicit instruction only, the stable release, as the repository's release setup allows. Use when the version is merged after its first audit.
---

# release

## 1. When
The first audit is done (its findings fixed or accepted by the user) and the work is merged.

## 2. Procedure
1. Update the release documents (changelog, roadmap state, README status) in the release PR.
2. Cut the rc the way the repository releases (its workflow, tags). Never stable without the user's explicit instruction.
3. When a release waits for the user — an approval of the published package, the instruction for stable — report and wait. Do not start the work of another unit meanwhile; stabilising this version is this loop's work.
4. After the rc, a defect found while checking it is fixed in the same version, then the next rc. A small fix is an adjustment recorded in the spec (`A-n`); one that needs a new work unit changes the spec first and is approved.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. Executor (deployer) does this when switched on, within the same limits.

## 4. Files and lifetime
- Tags, release notes — on the forge, kept.

## 5. Next
`audit` (the second audit — after stable, or when the user declares the version closed), then `retro`.

## 6. Stop and ask
- Stable, force-pushing, deleting tags: ask the user every time.
- A release that waits for the user is not idle time to fill: no intent, spec or code of the next version before this one's retro, unless the user says so (then record a waiver).
