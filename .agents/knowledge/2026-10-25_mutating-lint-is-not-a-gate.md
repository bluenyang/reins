---
id: 2026-10-25_mutating-lint-is-not-a-gate
kind: decision
status: active
supersedes: null
topics: [gates, lint, format]
decisions: [mutating-lint-excluded]
symptoms: ["lint passed but files changed", "format script rewrote files during the gate"]
applies_to: all
source: preset
---
## 결정
파일을 수정하는 명령(`lint --fix`, `format --write`)은 게이트가 될 수 없다. 검사 전용 변형(`lint:check`, `format:check`)만 게이트다.
## 이유
게이트는 판정이어야 한다. 수정형 명령은 통과 여부와 무관하게 트리를 바꿔 커밋 내용을 흐린다 (조사: pipit-bot `lint --fix` 사고).
## 적용
`gates.yaml` `mutating_forbidden: true`. PM의 게이트 발견 절차가 수정형을 제외한다.
## 바뀌면
없음.
