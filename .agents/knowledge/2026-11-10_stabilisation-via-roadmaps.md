---
id: 2026-11-10_stabilisation-via-roadmaps
kind: decision
status: active
supersedes: null
topics: [roadmap, stabilisation]
decisions: [roadmap-first]
symptoms: []
applies_to: all
source: ".agents/audit/0.3.0.md; .loctx/history/0.3.0.md; .agents/audit/0.3.3.md (1차 감사 비판 5, 재실행 비판 2); .agents/audit/0.3.4.md (1차 비판 2, 재감사 비판 4, 2차 회고 2 — A-20)"
approved: { by: user, at: 2026-11-10, words: "B. 1, 2, 3, 4, 8 인용" }
updated: { by: user, at: 2026-11-17, words: "기존 항목 갱신해." / H-7 "ㅇㅋ" }
---
## 결정
안정화 항목(rc의 버그 수정 포함)도 `.loctx/ROADMAP.local.md`에 적고, 사용자와 정해지면 `docs/ROADMAP.md`에 올린 뒤 spec에 적는다. 급해도 로컬 → 공개 로드맵을 건너뛰지 않는다.
## 이유
0.3 초기의 공개 로드맵 선행 공개, intent 020(로컬 로드맵을 거치지 않음), 019 ST-8(로컬에만 적고 공개 로드맵 누락)로 세 번 지적되어 매번 사후 보완했다(감사 0.3.0, rc.3, rc.4). 0.3.3에서도 두 번(공개 로드맵 줄이 W-3에서야 들어감, 개정 1의 W-4도 구현 커밋에서) 났고 사용자가 수용했다.
0.3.4에서 세 번 더 반복됐다(1차 감사 비판 2, 개정 1의 재감사 비판 4, rc.2의 A-20). A-20은 공개 로드맵 줄이 같은 PR 안에 있었지만 구현 커밋보다 뒤였고 로컬 채택 기록이 없었다(사용자 2026-11-25 "우용" — 갱신 수용).
## 적용
사용자가 안정화 항목을 정하면 같은 턴에 두 로드맵 줄과 spec 항목을 함께 쓴다. 공개 로드맵 줄은 그 버전의 릴리스 문서 PR이 아니라 구현 PR에 넣는다. intent·spec을 개정해 작업 단위를 더할 때도 같다: 개정 승인을 묻기 전에 로컬 로드맵에 채택을 적고, 공개 로드맵 줄은 개정과 같은 커밋에 넣는다(0.3.3 회고에서 더함).
같은 PR 안에서도 순서는 커밋 단위로 본다: 로드맵 커밋이 그 작업 단위·개정·안정화 조정의 구현 커밋보다 앞서거나 같은 커밋이어야 한다. 0.4에서 에이전트 훅이 이를 확인한다(F-1).
## 바뀌면
—
