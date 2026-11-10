---
id: 2026-11-10_offline-audit-records
kind: decision
status: active
supersedes: null
topics: [audit, ci]
decisions: [audit-input]
symptoms: []
applies_to: all
source: ".agents/audit/0.3.0.md; .loctx/history/0.3.0.md"
approved: { by: user, at: 2026-11-10, words: "B. 1, 2, 3, 4, 8 인용" }
---
## 결정
감사자는 네트워크 없는 새 실행(읽기 전용)으로 돌린다. 감사를 맡기기 전에 PM이 버전에 머지된 PR마다 `gh pr view <n> --json number,mergedBy,mergedAt,mergeCommit,headRefOid,body`와 `gh pr checks <n>`의 출력을 고치지 않고 `.loctx/reports/<version>/`에 모아 넘기고, 사용자 지시(push·PR·머지·배포)를 인용한 기록을 함께 둔다. PR 본문에는 대상 SHA, 검사 로그 경로, 검사 결과의 마지막 줄을 붙인다.
## 이유
0.3.0·rc.2 감사는 GitHub를 읽지 못해 머지·CI를 "확인 불가"로 판정했다. 사용자 결정 "감사자 부분은 a로"(intent 020 ST-7). 이후 rc.3·rc.4 감사에서 머지·CI가 확인됐고, PR 본문의 게이트 출력은 rc.3 감사 지적 3으로 더했다.
## 적용
audit 스킬 ② 1단계. 감사 요청에는 기록 파일 경로만 넘기고 작업 대화는 넘기지 않는다.
## 바뀌면
감사자에게 네트워크를 열기로 하면(사용자 결정) 다시 본다.
