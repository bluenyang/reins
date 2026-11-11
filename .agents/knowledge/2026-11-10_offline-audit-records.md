---
id: 2026-11-10_offline-audit-records
kind: decision
status: active
supersedes: null
topics: [audit, ci, records]
decisions: [audit-input, raw-records]
symptoms: []
applies_to: all
source: ".agents/audit/0.3.0.md; .loctx/history/0.3.0.md; .agents/audit/0.3.1.md; .loctx/history/0.3.1.md"
approved: { by: user, at: 2026-11-10, words: "B. 1, 2, 3, 4, 8 인용" }
updated: { by: user, at: 2026-11-11, words: "K1 받음. 대신, 작업 후에 꼭 정리하는 방향으로" }
---
## 결정
감사자는 네트워크 없는 새 실행(읽기 전용)으로 돌린다. 감사를 맡기기 전에 PM이 버전에 머지된 PR마다 `gh pr view <n> --json number,mergedBy,mergedAt,mergeCommit,headRefOid,body`와 `gh pr checks <n>`의 출력을 고치지 않고 `.loctx/reports/<version>/`에 모아 넘기고, 사용자 지시(push·PR·머지·배포)를 인용한 기록을 함께 둔다. PR 본문에는 대상 SHA, 검사 로그 경로, 검사 결과의 마지막 줄을 붙인다.

같은 원칙을 PR·CI 밖에도 쓴다(0.3.1 회고에서 넓힘): 서브에이전트의 보고, 웹에서 확인한 페이지, 도구의 응답처럼 나중에 근거가 될 것은 PM이 요약해 옮겨 적지 않고 **받은 그대로** 파일로 `.loctx/reports/<version>/`에 둔다. 옮겨 적을 수밖에 없는 것(파일로 떨어지지 않는 도구 응답)은 옮겨 적은 것이라고 밝힌다. 이 원본들은 작업이 끝나면 반드시 정리한다: 회고에서 history에 요약한 뒤 지운다.
## 이유
0.3.0·rc.2 감사는 GitHub를 읽지 못해 머지·CI를 "확인 불가"로 판정했다. 사용자 결정 "감사자 부분은 a로"(intent 020 ST-7). 이후 rc.3·rc.4 감사에서 머지·CI가 확인됐고, PR 본문의 게이트 출력은 rc.3 감사 지적 3으로 더했다. 0.3.1에서는 원본 없이 PM이 옮겨 적은 것이 세 번 "확인 불가"로 남았다: spec 검토 보고(첫 감사), 양판 대조 보고와 웹·세션 확인(추가 감사 A3).
## 적용
audit 스킬 ② 1단계. 감사 요청에는 기록 파일 경로만 넘기고 작업 대화는 넘기지 않는다. 서브에이전트나 외부 모델을 부를 때는 답을 파일로 받는다(출력을 파일로 돌리거나, 받은 보고를 바로 저장). 웹 확인은 받은 페이지를 시각·상태 코드와 함께 저장한다. 정리는 `retro` 스킬의 마지막 단계에서 한다.
## 바뀌면
감사자에게 네트워크를 열기로 하면(사용자 결정) 다시 본다.
