---
name: reins-setup
description: Install reins in this repository, or move an existing harness onto it — detects the harness generation, runs reins install or reins migrate, confirms gates, bindings and hooks with the user, and checks for drift. Use when the user asks to set up, install, adopt or migrate to reins, or when AGENTS.md has no reins blocks yet.
---

# reins-setup

You act as the **pm** role (`.agents/harness/roles/pm.md` once installed). The CLI does the work; you collect
the answers only the user can give and report what happened. Run the CLI as `npx @bluenyang/reins@0.1.4-rc.1 …`
(the version is pinned to this skill's release; inside the reins repository itself: `node cli/dist/reins.js …`).

Defaults from the plugin settings: language `${user_config.language}`, install mode `${user_config.default_mode}`.
If either still starts with `${` (unsubstituted — this copy lives in a project, not the plugin), use the built-in
default of step 2 instead. Use these only as the defaults you propose; change `--mode` to `auto` only after the
user confirms it.

1. **Look first.** `reins install graph --dry-run --json` → read `generation` and `refused`.
   - `refused` (3rd/4th-generation harness) → `reins migrate <tier> --dry-run` and show the moves.
   - `.ai/` present (1st/2nd generation) → install, then offer `reins migrate`.
2. **One batch of questions, defaults stated** — never more than one round:
   tier (`graph` when two or more vendors are detected, else `loop`; `harness` for permissions only) ·
   vendors to use (show the detected ones) · language of the documents the user reads · public repository?
3. **Apply** non-interactively: `reins install <tier> --mode auto` (or `reins migrate <tier> --mode auto`).
   Then adjust what the user changed: `reins configure bindings --set <role>=<model> …`.
4. **Gates.** Show `.agents/harness/gates.yaml`; run `reins gate` once. A gate that fails or mutates files is
   the user's call — never edit the project's scripts to make it pass.
5. **Hooks are proposed, not added.** Show the proposal from the install notes; only on the user's yes run
   `reins install <tier> --mode auto --hooks`.
6. **Verify.** `reins check --drift` must print `drift: ok`. Commit on a branch (`chore/reins-setup`), one commit
   per step that changed files. Never push.
7. **Report** in the user's language: generation before → after, the bindings table, gates, notes, and the
   next step — bring the first request to `reins-intent`.
