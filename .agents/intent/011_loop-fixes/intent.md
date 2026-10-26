---
id: "011"
slug: loop-fixes
version: 0.1.3
status: released
origin: user
approvals:
  - { role: user, at: 2026-10-26 }
supersedes: null
---
## 문제
0.1.1~0.1.2를 돌리며 남은 작은 문제들:
- ticket·버스 요청을 손으로 쓴다 — 007에서 생성 명령이 깨져 잘못된 ticket이 생겼다. metrics 기록도 수동이다.
- `status`가 이미 릴리스된 intent(001~007)에 "pm: close the rc"를 계속 띄운다.
- verify-tool이 게이트 한 번 돌리는 데 약 5만 토큰을 쓴다.
- publish 요약의 `npm stage list`가 OIDC로는 E401을 낸다. sync-version이 plugin.json 형식까지 바꿔 버전 외 diff가 생긴다.
- 설계서 §9가 sync-version 경로를 옛 위치(`scripts/`)로 적고 있다.

## 바라는 결과
- `reins new intent|ticket|request` 같은 명령이 템플릿에서 올바른 파일을 만든다(스키마 통과). 역할 실행 토큰 기록을 스킬이 한 줄로 남긴다.
- 릴리스가 끝난 intent는 status에서 "released"로 보이고 할 일로 뜨지 않는다.
- verify-tool의 게이트 실행이 가벼워진다(토큰 크게 감소).
- publish 요약 단계 정리, plugin.json 형식 보존(버전 한 줄만 diff), 설계서 경로 정정.

## 영향 범위
`cli/`(new 명령, status), 스키마(intent 상태 또는 릴리스 기록), verify-tool 역할 절차, publish 워크플로, sync-version, 설계서 §9 양판.

## 제약
- 기존 파일 형식은 깨지 않는다(새 상태는 추가만).

## 열린 질문
—

## 질의서 기록
pm 관찰 + 사용자 지시 "0.1.3으로 넣어봐"(2026-10-26).

## 하지 않을 것
- 0.2 항목(loop·harness 깎기, 벤더 생성물, recall, 예산, .env 훅)
