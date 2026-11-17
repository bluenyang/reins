---
id: 2026-10-26_review-tooling-hid-sources
kind: decision
status: active
supersedes: null
topics: [review, diff]
decisions: [review-tooling-hid-sources]
symptoms: [review-tooling-hid-sources]
applies_to: all
source: ".loctx/history/2026-10-26-1900_retro-0.1.0-0.1.3.md; .agents/audit/0.3.3.md (1차 감사 비판 4, 재실행 비판 1)"
approved: { by: user, at: 2026-10-26 }
updated: { by: user, at: 2026-11-17, words: "기존 항목 갱신해." / H-2 "승인" }
---
## 결정
리뷰 diff에서 빼는 것은 설치본·생성물(.agents/harness, .agents/skills, .agents/SKILLS.md, .claude)뿐이다. 그것들은 diff --stat으로 덧붙이고 항상 허용한다. 리뷰 요청 첫머리에 그 변경 전체의 `git diff --stat`을 두어 무엇이 들어갔고 빠졌는지 보이게 하고, intent·spec(조정 기록 포함)은 변경이 생길 때마다 뒤따르는 리뷰 요청에도 다시 넣는다. 요약은 diff를 대신하지 않는다(0.3.3 회고에서 더함).
## 이유
.agents/ 전체를 빼자 소스인 .agents/intent 변경이 리뷰어에게 안 보여, 범위 밖 변경·근거 없음으로 잘못 지적됐다(011-2_02). 0.3.3에서는 손으로 조립한 리뷰 요청에서 intent·spec과 테스트 fixture가 두 번 빠졌고(1차 감사 비판 4, 재실행 비판 1), 모든 소스를 넣은 재리뷰가 그전 리뷰가 놓친 결함을 찾았다.
## 적용
리뷰 프롬프트를 조립하는 스크립트·스킬.
## 바뀌면
설치본 경로가 바뀌면 제외 목록도 같이.
