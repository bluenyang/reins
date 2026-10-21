## F-N01 NestJS DI undefined under vitest/tsx
- symptom: `Nest can't resolve dependencies of the` | `Cannot read properties of undefined (reading` in an injected service
- where: test · apps/*api*/**, NestJS
- cause: vitest (esbuild) and tsx do not emit decorator metadata; type-only constructor injection resolves to undefined
- fix: inject with explicit tokens `@Inject(TOKEN)`; keep `consistent-type-imports` off for NestJS packages
- check: the failing test command
- verified: 0
- source: preset
- promoted: no

## F-N02 Frozen lockfile mismatch
- symptom: `ERR_PNPM_OUTDATED_LOCKFILE` | `The lockfile would have been modified by this install`
- where: install · CI
- cause: package.json changed without updating the lockfile
- fix: run the package manager install locally and commit the lockfile with the change
- check: `<pm> install --frozen-lockfile` (yarn: `yarn install --immutable`)
- verified: 0
- source: preset
- promoted: no

## F-N03 Git hooks not installed
- symptom: commit succeeds without format/lint running; CI fails on format
- where: hooks · fresh clone or worktree
- cause: hooks are installed by the `prepare` script, which did not run
- fix: run the install once (`pnpm install` / `yarn`), or `lefthook install` / `husky`
- check: `git config core.hooksPath` or `ls .git/hooks`
- verified: 0
- source: preset
- promoted: no
