---
id: 2026-11-17_twin-check-after-last-change
kind: decision
status: active
supersedes: null
topics: [docs, verification, audit]
decisions: [twin-check-after-last-change]
symptoms: ["양판 대조를 마지막 문서 변경 뒤에 하지 않음", "PM이 직접 확인하고 통과로 적음"]
applies_to: all
source: ".agents/audit/0.3.2.md (1차 감사 비판 2·4); .agents/audit/0.3.3.md (1차 감사 비판 1, 2차 감사 'A-11 뒤 V-5 검증 절차'); .loctx/history/0.3.3.md"
approved: { by: user, at: 2026-11-17, words: "양판 대조는 승인" }
---
## 결정
설계서 양판(영어·한국어)이나 그것과 같은 말을 해야 하는 문서(CHANGELOG 두 개, 로드맵 양판)를 바꾼 커밋이 있으면, 그 버전의 양판 대조는 **마지막 변경 뒤의 본문으로** 다시 한다. 대조는 작업 대화를 받지 않은 새 실행(같은 모델의 서브에이전트 등)이 한다. PM이 직접 본 것은 대조가 아니다. 재감사를 생략한 waiver는 이 검사를 생략하지 않는다.
## 이유
세 번 반복됐다. 0.3.2에서 경계 사례가 남은 대조를 통과로 적었다(1차 감사 비판 2). 0.3.3에서 PM이 직접 다시 보고 통과로 적었다(1차 감사 비판 1). 0.3.3의 마지막 문서 변경(A-11) 뒤에도 PM 확인으로 끝냈다(2차 감사). 사후에 독립 실행으로 대조하자 문서가 코드 규칙 둘을 적지 않은 것이 나왔다(A-13).
## 적용
`test` 스킬의 양판 대조 검사(V-n), 그리고 리뷰나 감사 뒤의 보완 커밋이 문서에 닿을 때.
## 바뀌면
양판을 두지 않거나, 기계로 대조하는 도구가 생기면 다시 본다.
