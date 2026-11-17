---
id: 2026-11-10_stabilisation-via-roadmaps
kind: decision
status: active
supersedes: null
topics: [roadmap, stabilisation]
decisions: [roadmap-first]
symptoms: []
applies_to: all
source: ".agents/audit/0.3.0.md; .loctx/history/0.3.0.md; .agents/audit/0.3.3.md (1차 감사 비판 5, 재실행 비판 2)"
approved: { by: user, at: 2026-11-10, words: "B. 1, 2, 3, 4, 8 인용" }
updated: { by: user, at: 2026-11-17, words: "기존 항목 갱신해." / H-7 "ㅇㅋ" }
---
## 결정
안정화 항목(rc의 버그 수정 포함)도 `.loctx/ROADMAP.local.md`에 적고, 사용자와 정해지면 `docs/ROADMAP.md`에 올린 뒤 spec에 적는다. 급해도 로컬 → 공개 로드맵을 건너뛰지 않는다.
## 이유
0.3 초기의 공개 로드맵 선행 공개, intent 020(로컬 로드맵을 거치지 않음), 019 ST-8(로컬에만 적고 공개 로드맵 누락)로 세 번 지적되어 매번 사후 보완했다(감사 0.3.0, rc.3, rc.4). 0.3.3에서도 두 번(공개 로드맵 줄이 W-3에서야 들어감, 개정 1의 W-4도 구현 커밋에서) 났고 사용자가 수용했다.
## 적용
사용자가 안정화 항목을 정하면 같은 턴에 두 로드맵 줄과 spec 항목을 함께 쓴다. 공개 로드맵 줄은 그 버전의 릴리스 문서 PR이 아니라 구현 PR에 넣는다. intent·spec을 개정해 작업 단위를 더할 때도 같다: 개정 승인을 묻기 전에 로컬 로드맵에 채택을 적고, 공개 로드맵 줄은 개정과 같은 커밋에 넣는다(0.3.3 회고에서 더함).
## 바뀌면
—
