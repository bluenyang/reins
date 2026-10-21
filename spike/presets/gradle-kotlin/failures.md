## F-K01 ktlint format drift
- symptom: `Lint error >` | `ktlintCheck FAILED`
- where: lint
- cause: code not formatted by the configured formatter
- fix: run the format task (`./gradlew ktlintFormat` or `spotlessApply`), never hand-format
- check: the lint task
- verified: 0
- source: preset
- promoted: no

## F-K02 Spring context fails in tests
- symptom: `Failed to load ApplicationContext`
- where: test
- cause: missing bean/profile/env for the test slice
- fix: read the first `Caused by:`; use the narrowest test slice or a test profile, never real secrets
- check: the failing test task
- verified: 0
- source: preset
- promoted: no
