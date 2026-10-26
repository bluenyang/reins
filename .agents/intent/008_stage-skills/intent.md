---
id: "008"
slug: stage-skills
version: 0.1.3
status: draft
origin: user
approvals: []
supersedes: null
---
## 문제
스킬이 `reins-setup`·`reins-intent`·`reins-loop` 셋뿐이고 `reins-loop` 하나에 plan·구현·검증·리뷰·릴리스가 다 들어 있다. 사용자가 중간 단계 하나(예: 내가 고친 코드만 다시 검증·리뷰)를 부를 수 없고, 에이전트도 단계를 건너뛰거나 섞는다(007에서 T1을 보지 않고 구현을 시작).

## 바라는 결과
사용자 workflow(`로드맵 > 버전 식별 > intent > 승인 > spec > 2차 승인 > ticket > implement > check/test > review > e2e 시나리오 > e2e test > build test > PR > CI 검증 > merge > rc release > retrospect > 자동 개선`)의 단계마다 스킬이 있고, **사용자와 에이전트 모두** 부를 수 있다.
- `reins-roadmap` — 로드맵을 언제든 고치고 버전을 식별한다
- `reins-intent` — intent 작성·승인(지금 것에서 spec을 뗀다)
- `reins-spec` — spec 작성·검토·요약 확인(2차 승인), plan·ticket까지
- `reins-implement` — ticket 구현·check
- `reins-review` — 추가 검증·리뷰 요청(사용자가 직접 고친 변경 포함)
- `reins-test` — e2e 시나리오 설계(qa-design)·실행(qa-run)·build test
- `reins-release` — PR → CI → merge → rc(stable은 수동)
- `reins-retro` — 회고·자동 개선 제안(intent 010)
- `reins-loop`는 위 스킬을 순서대로 부르는 지휘자로 남는다.
각 스킬은 시작할 때 자기 단계의 check(T1 등)를 부르고 결과를 따른다.

## 영향 범위
`skills/*`(새 스킬, reins-loop·reins-intent 정리), install의 스킬 목록·SKILLS.md, `harness/roles` 절차의 스킬 참조, README 양판, 플러그인은 계속 setup만.

## 제약
- 스킬은 얇은 입구 — CLI 기능을 다시 구현하지 않는다. 판단은 역할, 강제는 스크립트.
- 하나만 불러도 그 단계가 완결된다(앞 단계 산출물이 없으면 해당 check가 HOLD/STOP으로 알려 준다).

## 열린 질문
—

## 질의서 기록
사용자 지시(2026-10-26): workflow 단계와 명령 세분화 목록. 회고는 별도 스킬(사용자 선택).

## 하지 않을 것
- CLI가 모델·벤더를 직접 부르는 것(0.2 이후)
- 다른 벤더용 플러그인
