---
name: release
description: Cut the rc and, on the user's explicit instruction only, the stable release, as the repository's release setup allows. Use when the version is audited.
---

# release

## 1. When
The version is audited (or the user accepted its findings).

## 2. Procedure
1. Update the release documents (changelog, roadmap state, README status) in the release PR.
2. Cut the rc the way the repository releases (its workflow, tags). Never stable without the user's explicit instruction.
3. After the rc, fixes are stabilisation work units; then the next rc.

## 3. Delegation
Check `.loctx/delegation.local.md` if it exists, otherwise the delegation table in AGENTS.md. If the role group named here has a model, hand it the work with the list of files and decisions it needs and wait for its report; otherwise do it yourself. Read-heavy work (research, large log summaries, review) or urgent parallel work on independent units may go to subagents of your own model. A role never calls another model; it returns to you. Executor (deployer) does this when switched on, within the same limits.

## 4. Files and lifetime
- Tags, release notes — on the forge, kept.

## 5. Next
`retro` (after stable, or when the user declares the version closed).

## 6. Stop and ask
- Stable, force-pushing, deleting tags: ask the user every time.
