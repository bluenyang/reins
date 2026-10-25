---
intent: "001"
status: draft
approvals: []
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["001-1", "001-2"]
---
## 바뀌는 파일
- `cli/src/commands/status.ts` (새), `cli/src/commands/stages.ts` (승인 사슬 export), `cli/src/reins.ts` (status 명령), `cli/test/status.test.ts` (새)
- `AGENTS.md` 프로젝트 절 (Conventions 첫 항목)

## 작업 순서
1. `reins status` — 수집·출력·`--json`, 테스트 (S-1~S-7) → ticket 001-1
2. AGENTS.md 임시 규칙을 `reins status`로 교체, 이 레포에서 실행 확인 (S-8) → ticket 001-2 (001-1에 의존)

## 위험
- 승인 사슬을 status용으로 바꾸다 T1 동작이 달라질 수 있음 → T1 테스트(stages.test.ts)를 그대로 통과해야 한다.

## 증명
- `reins gate --ticket <id>`의 보고서(`.loctx/reports/`)를 T3 증거로 쓴다.
- 001-2는 이 레포에서 `reins status` 실제 출력을 history에 남긴다.

## 테스트 체크리스트
- [ ] intent 없음
- [ ] draft intent → user 할 일
- [ ] 승인 사슬 + todo ticket → ticket-start
- [ ] `--json`이 텍스트와 같은 데이터
- [ ] 파일을 쓰지 않음 (실행 전후 git status 동일)

## 이탈 기록
—
