---
id: 2026-10-26_review-tooling-hid-sources
kind: decision
status: active
supersedes: null
topics: [review, diff]
decisions: [review-tooling-hid-sources]
symptoms: [review-tooling-hid-sources]
applies_to: all
source: ".loctx/history/2026-10-26-1900_retro-0.1.0-0.1.3.md"
approved: { by: user, at: 2026-10-26 }
---
## 결정
리뷰 diff에서 빼는 것은 설치본·생성물(.agents/harness, .agents/skills, .agents/SKILLS.md, .claude)뿐이다. 그것들은 diff --stat으로 덧붙이고 항상 허용한다.
## 이유
.agents/ 전체를 빼자 소스인 .agents/intent 변경이 리뷰어에게 안 보여, 범위 밖 변경·근거 없음으로 잘못 지적됐다(011-2_02).
## 적용
리뷰 프롬프트를 조립하는 스크립트·스킬.
## 바뀌면
설치본 경로가 바뀌면 제외 목록도 같이.
