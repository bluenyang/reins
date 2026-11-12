<!-- reins:begin notice v=0.3.0 -->
> The blocks marked `reins:begin … reins:end` are written by reins from `.agents/harness/`. Do not edit them by hand; the user changes them with `reins config` or `reins update` in a terminal. Everything outside the blocks belongs to the project. Nothing in this repository runs reins while you work.
<!-- reins:end notice -->

<!-- reins:begin layout v=0.3.0 -->
## Layout

- `.agents/` — committed agent context: `intent/<NNN>_<slug>/{intent,spec}.md`, `audit/<version>.md`, `knowledge/`, `harness/` (settings, roles, templates), `skills/` (the stage skills).
- `.loctx/` — this machine only (gitignored): `ROADMAP.local.md`, `history/<version>.md`, `reports/<version>/`, `context/`, `bindings.local.yaml`, `delegation.local.md`.
- `docs/ROADMAP.md` — the public roadmap.
<!-- reins:end layout -->

<!-- reins:begin settings v=0.3.0 -->
## Settings

- `.agents/harness/bindings.yaml` — the mode (`single` or `multi`), which model does which role group, and `audit.required`. A personal override may sit in `.loctx/bindings.local.yaml`; when it exists, it wins, and when it changes who does what, `.loctx/delegation.local.md` holds that person's delegation table.
- **When `audit.required` is true (the default), every version is audited twice (skill `audit`): a first audit before the merge and a second audit after the release. Both are mandatory: never skip one; only the user switches them off.**
- `.agents/harness/gates.yaml` — the project's own check commands; the hooks and the `test` skill run them as they are.
- `.agents/harness/roles/<group>.md` — what each role does, must not do, and which tools it may use.
<!-- reins:end settings -->

<!-- reins:begin flow v=0.3.0 -->
## Flow

Follow these steps in order; each has a skill in `.agents/skills/`, and each skill names the next.

1. `roadmap` — ideas go to `.loctx/ROADMAP.local.md`; once settled with the user, to `docs/ROADMAP.md`.
2. `intent` — the PM writes the direction and the plan; **the user approves**.
3. `spec` — the spec, its work units (W-n) and checks (V-n); **the user answers 진행 or 수정 on its summary, every time**.
4. `implement` → `review` — commit at meaningful units (a point you can revert or reset to without taking other working work or features with it), each naming its spec items. Adding, dropping or rescoping a work unit needs the spec changed and approved first; a smaller adjustment goes on, is recorded in the spec (`A-n`) and is reported at the end of the flow.
5. `test` → `merge` (push, PR, CI) → **`audit`** (the first audit: risk, before the merge) — from the accepted spec to the first audit this is **one flow without asking**: do not stop for permission between these steps; report once at its end. Then the merge on the user's instruction → `release` (the rc the way the repository releases; stable on the user's instruction) → **`audit`** (the second audit: procedure only, handed to the retro) → `retro`, then delete the version's working files.

A loop is the work the user started — usually one version — up to its retro. **The retro ends the loop**: report that it is closed and stop; the next `intent` is written when the user starts the next work. If the user named another end ("go on to …", "do not stop"), follow it for that instruction only and quote it in `.loctx/ROADMAP.local.md`; the intent's approval, the spec's 진행 or 수정, every merge and the stable release still wait for the user. Ideas for later work go to the roadmap whenever they come. Naming a version is not an instruction to start it.

The first conversation after installation (or after a reconcile or mode-changed marker appears in this file) starts with `onboard`.
<!-- reins:end flow -->

<!-- reins:begin delegation v=0.3.0 -->
{{DELEGATION}}
<!-- reins:end delegation -->

<!-- reins:begin records v=0.3.0 -->
## Approvals and records

- Record an approval by quoting the user in the intent's or spec's `approvals:` — `{ role: user, by, at, words, rev }` — and commit it. Never record an approval the user did not give.
- A step or approval the user tells you to skip goes to the intent's `waivers:` — `{ step, words, at, scope: once }` — at that moment. It applies once; next time, follow the flow.
- Every file you create has an owner and a deletion point (each skill lists them). Working files under `.loctx/reports/<version>/` are summarised in history and the audit, then deleted after the retro.
- `.agents/audit/<version>.md` holds both audits of a version; an adjustment made while working is a line in the spec's adjustment record (`A-n`).
<!-- reins:end records -->

<!-- reins:begin stops v=0.3.0 -->
## When to stop and ask

- **Ask the user and stop:** an irreversible action (force push, deleting a tag, rewriting the default branch, data or production changes); a merge; a stable release; work that would touch a red line; scope moving outside the intent and spec; a conflict with a past decision; a next step that needs an approval not yet given. Pushing a branch of the work in progress and opening its PR is part of the flow (an accepted spec's work units, their records, release documents); taking anything else out of the machine still needs the user's word.
- **While you wait for the user** — a release approval, a merge instruction, a stable instruction — report and wait; do not start another unit's work. Stabilising the same version is this loop's work.
- **The retro ends the loop:** report that it is closed and stop.
- **Stop and find the cause:** two failures in the same work unit; empty or doubtful check output; a pass without evidence (a pass needs the raw output's path).
- **When the user interrupts** (chat, Ctrl+C, session end): stop and write the resume point in `.loctx/history/<version>.md`.
- What no role does: `.agents/harness/policy/common-red-lines.yaml`.
<!-- reins:end stops -->

<!-- reins:begin language v=0.3.0 -->
## Language

`AGENTS.md`, code, commits, `.agents/` sources: English. Documents the user reads (`intent/`, `.loctx/`, `docs/*.ko.md` if any): {{LANGUAGE}}.
<!-- reins:end language -->
