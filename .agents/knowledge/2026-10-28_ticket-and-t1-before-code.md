---
id: 2026-10-28_ticket-and-t1-before-code
kind: decision
status: active
supersedes: null
topics: []
decisions: [ticket-and-t1-before-code]
symptoms: []
applies_to: all
source: ".loctx/history/2026-10-28-0140_retro-note-t1-order.md"
approved: { by: user, at: 2026-10-28 }
---
## 결정
안정화 수정이라도 ticket을 먼저 만들고 T1을 통과한 뒤 코드를 쓴다. plan이 done이면 먼저 active로 되돌린다.
## 이유
0.1.4~0.1.5에서 세 번(011-6·013-5·013-8) 코드를 먼저 쓰고 ticket·T1을 뒤에 만들었다. 두 번은 T1이 STOP(의존 ticket이 열림, plan이 done)해서 순서가 어긋난 것이 기록으로만 남았다.
## 적용
발견 → plan 이탈 기록·tickets 추가(status active) → `reins new ticket` → T1 → 구현. implementer brief에 T1 결과를 넣는다.
## 바뀌면
T1이 커밋 시점(T2)에 열린 ticket을 요구하게 바뀌면 다시 본다.
