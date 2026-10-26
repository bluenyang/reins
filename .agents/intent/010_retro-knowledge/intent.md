---
id: "010"
slug: retro-knowledge
version: 0.1.3
status: approved
origin: user
approvals:
  - { role: user, at: 2026-10-26 }
supersedes: null
---
## 문제
자가 개선이 설계(§8)에만 있고 돌지 않는다. 기록(history·metrics·정지 사유)은 쌓이지만 반복을 세는 것이 없고, knowledge 승격 절차가 없으며(knowledge/에는 seed 2개뿐), 승격 후보 3건이 history 메모에만 있다. 개선은 지금까지 사람(과 pm 세션)이 손으로 다음 intent를 만든 것이다.

## 바라는 결과
- rc 배포 뒤(또는 언제든) `reins-retro`가 회고한다: 이번 버전의 정지 사유·리뷰 지적·실패 라운드·토큰을 모아 요약한다.
- 같은 사유·결정이 **두 번 이상**이면 승격 후보로 자동 표시된다(스크립트가 센다). `reins status`에도 후보 수가 보인다.
- pm이 후보를 knowledge 항목으로 제안하고, 사용자가 승인하면 `.agents/knowledge/`에 커밋된다. 일반적인 것은 다음 intent 후보로도 남는다.
- 이번까지 쌓인 후보 3건(버스 YAML 인용, 권한 glob 부정 미지원, 리뷰는 변경분만)이 첫 승격 대상이다.

## 영향 범위
`reins-retro` 스킬, 반복을 세는 CLI(예: `reins retro` 또는 status 확장), knowledge 템플릿·스키마 사용, pm 역할 절차, history 형식(결정·사유 줄).

## 제약
- 승격은 언제나 사용자 승인 후(설계 §8). 스크립트는 세고 제안만 한다.
- `reins recall`(검색)은 0.2 — 이번에는 쌓고 승격하는 것까지.

## 열린 질문
—

## 질의서 기록
사용자 질문(2026-10-26) "자가 개선은 나중 버전? 지금 없는 거야?" → 설계만 있고 실행 부분이 빠짐. 회고는 별도 스킬(사용자 선택).

## 하지 않을 것
- 벡터 검색·recall(0.2)
- 승인 없는 자동 승격
