---
name: reins-setup
description: Install reins in this repository, or move an existing harness onto it — shows the user the reins install, migrate or update command for their terminal and explains what it sets up. Use when the user asks to set up, install, adopt, update or migrate to reins.
---

# reins-setup

reins only manages the harness: it runs at installation, migration, update and configuration time, in the
user's terminal. Nothing installed by reins runs reins while the project works.

Defaults from the plugin settings: language `${user_config.language}`, install mode `${user_config.default_mode}`.
If either still starts with `${` (unsubstituted — this copy lives in a project, not the plugin), use `ko` and
`manual`.

1. **Look.** Is there an `.agents/harness/` (reins installed), an `.ai/` workspace, or an older harness
   (`.claude/commands/`, many skills)? Say which.
2. **Show the user the command** for their terminal, with the version pinned to this skill's release:
   - nothing installed: `npx @bluenyang/reins@0.3.0-rc.2 install --mode <mode>`
   - an older harness or `.ai/`: `npx @bluenyang/reins@0.3.0-rc.2 migrate --dry-run`, then without `--dry-run`
   - reins already installed: `npx @bluenyang/reins@0.3.0-rc.2 update`
   - to change models, the mode or the audit later: `npx @bluenyang/reins@0.3.0-rc.2 config` (the user can run `reins config`)
   Run it yourself only when the user asks you to, and only that command.
3. **Explain what follows.** reins writes AGENTS.md blocks with an onboarding note; the next conversation starts
   with the `onboard` skill, which reads the project, asks the user, and writes AGENTS.md's project sections.
   Hooks are only proposed: the project's own gate commands in the project's own hook tool.
