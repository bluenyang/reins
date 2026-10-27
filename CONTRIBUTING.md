# Contributing to reins

[한국어](docs/CONTRIBUTING.ko.md)

reins is developed by BlueNyang for BlueNyang's and Team Croffle's repositories. Issues and pull
requests are welcome; this page says how work is done here, by people and by agents alike.

## The repository improves itself through its own loop

Every change goes through the chain reins itself implements (R66):

1. **Intent** — the problem and the desired outcome, in `.agents/intent/<NNN>_<slug>/intent.md`.
   Only the maintainer approves an intent. An issue is the usual way to propose one.
2. **Spec** — requirements `S-n` traced to the intent, acceptance criteria, and a 3–5 line summary
   the maintainer may veto.
3. **Plan** — files that change, order of work (one item = one ticket), risks, test checklist.
4. **Tickets** — implemented, verified with `reins gate` (raw output as evidence) and
   `reins check --stage verdict`, reviewed by a different role or person than the one who wrote it.

`reins status` shows where every intent and ticket stands. The skills `reins-intent` and
`reins-loop` walk an agent through the same steps.

Small fixes (a typo, a broken link) do not need an intent; anything that changes behaviour does.

## Setup

Node 22 or later and pnpm. Development (vitest 5) needs Node 22.12 or later; the CLI itself runs on any Node 22.

```sh
pnpm install     # also installs the husky hooks
pnpm check       # lint (oxlint), format check (oxfmt), typecheck, tests (vitest)
pnpm build       # cli/src → cli/dist
```

The hooks run `reins check --stage pre-commit` and `--stage pre-push`. Never bypass them
(`--no-verify` is red line C5); if a hook stops you, it names the reason id and how to resume.

## Conventions

- **Design first.** `docs/design.md` is the reference. If code needs to differ, change
  `docs/design.ko.md` and `docs/design.md` in the same commit (R45).
- **TypeScript only** for scripts — no Python (R65). ESM, Node ≥ 22.
- **Branches** `type/topic` from `master`, rebased, fast-forward merged. Never commit on `master`.
- **Commits** — one finished unit per commit, each passing `pnpm check` on its own. Message:
  `type(scope): title`, a one-line summary, then bullets. Stage explicit paths.
- **Harness sources** live in `harness/`. Files under `.agents/harness/`, `.claude/` and
  `.agents/skills/reins-*` are installed or generated copies — change the source, then run
  `node cli/dist/reins.js update`; `reins check --drift` must print `drift: ok`.
- **Documents** are English by default with a Korean twin (`*.ko.md`, cross-linked) (R67).
- **Secrets** — never read or commit `.env`, `.env.*.local`, `secrets/**`, `*.properties`, `*.key`,
  `*.pem`. The verifier stops a commit that stages one (C4).
- `.loctx/` is a local workspace and is never committed.

## Pull requests

Describe the intent or issue it serves, what changed, and how it was verified (paste the gate
output, do not summarise it). Work reaches `master` only through a `type/topic` branch and a PR; a direct push
to `master` is held by T4 (A4). The deploy role opens the PR, waits for `gh pr checks --watch`, and
merges with `gh pr merge --rebase --delete-branch` only when every required check is green. A red
check is not merged. Releases are the maintainer's call; a stable release is always an explicit
decision (A2).

## Releases

Releases go through GitHub Actions → **publish** (`.github/workflows/publish.yml`); update
`CHANGELOG.md` first. An rc is dispatched by the deploy role after T5 (`reins check --stage rc-close
--release <V>`) passes, with `version=<V>-rc.<N>`; fixes after an rc are `release: stabilization`
tickets, and the next rc follows the next T5 pass. A stable release is dispatched only on the
maintainer's instruction (`version=<V>`) and needs a `v<V>-rc.*` tag at the current `master` head
(`dry_run` checks and packs only). It runs the full gate, **stages** the version on npm through trusted publishing (no token), and
commits and tags it. The version is live only after the maintainer approves it with 2FA (npmjs.com →
Staged Packages, or `npm stage approve <stage-id>`). reins has no GitHub Releases.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
