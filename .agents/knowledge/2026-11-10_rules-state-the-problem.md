---
id: 2026-11-10_rules-state-the-problem
kind: decision
status: active
supersedes: null
topics: [rules, audit]
decisions: [rule-wording]
symptoms: []
applies_to: all
source: ".agents/audit/0.3.0.md; .loctx/history/0.3.0.md"
approved: { by: user, at: 2026-11-10, words: "B. 1, 2, 3, 4, 8 인용" }
---
## 결정
감사 지적이나 사용자 피드백을 규칙 문장으로 옮길 때는 원래 문제(무엇이 왜 나빴나)를 쓴다. 그 문제가 한 번 드러난 겉모양(예: 커밋 수)을 규칙으로 만들지 않는다. 규칙 문장을 쓰면 원래 지적 사례와 정상 사례(예: 리뷰 수정) 둘 다에 대어 본다.
## 이유
rc.2 감사의 지적은 "무관한 단위 넷을 한 커밋에 묶어 하나만 되돌릴 수 없다"였는데, 020 W-2에서 "작업 단위 하나 = 커밋 하나, 나누려면 spec 승인"으로 옮겼다. 감사자는 그 문장대로 리뷰 수정 커밋을 위반으로 판정했고, 사용자가 "왜 위반이야"로 교정했다(W-4).
## 적용
규칙을 새로 쓰거나 고치는 spec 단위에서, 그 규칙이 막으려는 문제와 막지 말아야 할 정상 사례를 검증 기준(V-n)에 함께 적는다.
## 바뀌면
—
