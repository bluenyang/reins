---
id: 2026-10-28_review-one-ticket-per-range
kind: decision
status: active
supersedes: null
topics: []
decisions: [review-one-ticket-per-range]
symptoms: []
applies_to: all
source: ".loctx/history/2026-10-28-0141_retro-note-review-range.md"
approved: { by: user, at: 2026-10-28 }
---
## 결정
코드 리뷰는 ticket 하나의 커밋 범위만 넘긴다. 다른 ticket의 커밋이 섞인 범위로 재리뷰하지 않는다.
## 이유
013-4 재리뷰에 013-5 커밋이 섞여, 013-5에서 허용·승인된 파일이 013-4의 허용 목록 밖이라는 C10 지적이 나왔다. 실제 문제가 아닌 지적에 판단과 토큰을 썼다.
## 적용
review.sh 범위는 그 ticket의 첫 커밋 부모..마지막 커밋. 다른 ticket이 고친 것은 그 ticket의 요청으로 리뷰한다.
## 바뀌면
bus 요청이 여러 ticket의 허용 목록을 함께 실을 수 있게 바뀌면 다시 본다.
