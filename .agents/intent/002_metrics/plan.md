---
intent: "002"
status: draft
approvals: []
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["002-1", "002-2"]
---
## 바뀌는 파일
- `cli/src/lib/metrics.ts` (새), `cli/src/commands/metrics.ts` (새), `cli/src/reins.ts`, `cli/test/metrics.test.ts` (새)
- `skills/reins-loop/SKILL.md`, `docs/design.md`, `docs/design.ko.md`, 이 레포 설치본(`.agents/skills/reins-loop/`, `.claude/skills/reins-loop/`, generated.yaml — `reins update`)

## 작업 순서
1. 기록·요약 코드: metrics lib, check·gate 자동 기록, `metrics record`·요약 명령, 테스트 (S-1~S-4) → ticket 002-1
2. 스킬 안내·설계서 양판·이 레포 update, 이 intent의 토큰 기록 (S-5~S-7) → ticket 002-2 (002-1에 의존)

## 위험
- check 액션에 기록을 넣다 종료 코드 경로를 건드릴 수 있음 → 기록은 `process.exit` 직전, try/catch, C-2로 확인.
- 기존 테스트가 runCheck를 직접 부름 → 기록은 CLI 액션에만 두므로 영향 없음.

## 증명
- `reins gate --ticket <id>` 보고서를 T3 증거로.
- 002-2는 `reins metrics --intent 002` 실제 출력을 history에 남긴다.

## 테스트 체크리스트
- [ ] C-1 세 종류 기록·키·정지 종류, `.loctx` 없으면 무기록
- [ ] C-2 쓰기 실패해도 종료 코드·출력 동일
- [ ] C-3 record 기본값·거부
- [ ] C-4 요약 수치·깨진 줄·필터·json
- [ ] C-5 스킬·설계서·drift ok
- [ ] C-6 이 레포 수치

## 이탈 기록
—
