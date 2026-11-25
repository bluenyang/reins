---
id: 2026-11-25_record-the-served-model
kind: decision
status: active
supersedes: null
topics: [delegation, audit, records]
decisions: [record-the-served-model]
symptoms: ["별칭으로 부른 모델의 실제 버전을 기록하지 않음", "위임 표의 모델과 실제 응답한 모델이 같은지 확인 불가"]
applies_to: all
source: ".agents/audit/0.3.1.md (추가 감사, claude-fable-5-2 unrecognized_model); .loctx/reports/0.3.4/committee-1-fable.md 머리; .agents/audit/0.3.4.md (재감사 '정확한 모델 버전 일치는 확인 불가', 2차 감사 회고 6)"
approved: { by: user, at: 2026-11-25, words: "K-3. 수용" }
---
## 결정
위원회·감사·리뷰를 다른 모델로 부른 기록에는 별칭이나 세션 설정이 아니라 응답이 알려 준 실제 모델 ID를 적는다. 알 수 없으면 "별칭 <이름>, 실제 모델 확인 불가"라고 적는다.
## 이유
두 번 있었다. 0.3.1에서 위임 표의 `claude-fable-5-2`가 호출에서 거부됐고, 0.3.4에서 위원회 Fable을 Agent 도구의 별칭으로 불러 위임 표의 버전과 같은지 감사가 확인하지 못했다. 세션 설정은 서빙 모델의 증거가 아니다.
## 적용
advisor/committee, auditor, 다른 벤더의 리뷰어를 부른 기록(`.loctx/reports/<version>/`)과 감사 기록의 auditor 줄.
## 바뀌면
호출 도구가 서빙 모델 ID를 돌려주고 그것이 기록에 자동으로 남으면 지운다.
