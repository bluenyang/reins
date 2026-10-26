---
id: 2026-10-26_review-diff-only
kind: decision
status: active
supersedes: null
topics: [review, tokens]
decisions: [review-diff-only]
symptoms: [review-diff-only]
applies_to: all
source: ".loctx/history/2026-10-26-1900_retro-0.1.0-0.1.3.md"
approved: { by: user, at: 2026-10-26 }
---
## 결정
코드 리뷰어에게는 역할 금지선·절차, 변경마다 의도·요구 문장·증거를 적은 버스 요청, 범위 전체 diff만 넘긴다. 리뷰어는 저장소를 탐색하거나 게이트를 다시 돌리지 않는다. 재검토는 수정 diff만.
## 이유
요청이 얇아 리뷰어가 소스 전체를 다시 읽고 게이트를 재실행해 Codex 리뷰 12번에 약 38만 토큰, 한도가 소진됐다. 변경분만 넘기자 평균 3.2만 → 1.1만 토큰, 품질(실제 버그 검출)은 유지됐다.
## 적용
모든 벤더의 code-review 역할. 레시피는 skills/reins-loop/references/vendor-cli.md.
## 바뀌면
리뷰가 diff 밖 맥락 부족으로 같은 종류를 반복해서 놓치면 범위를 넓힌다.
