---
intent: "003"
status: done
approvals:
  - { role: qa-design, at: 2026-10-25, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["003-1", "003-2"]
---
## 바뀌는 파일
- `vitest.config.ts`, `test/e2e/build.ts` (새), `test/e2e/violations.test.ts` (새), `package.json`(lint·fmt 대상에 `test/` 추가)
- `docs/violations.md`, `docs/violations.ko.md` (새), `docs/design.md`·`docs/design.ko.md` §3 링크 한 줄

## 작업 순서
1. 시나리오 V1~V18 + globalSetup 빌드 + "N/N stopped" (S-1~S-3, S-5) → ticket 003-1
2. 검출 주체 표 양판 + 설계서 링크 + 공백을 안정화 목록에 (S-4·S-5) → ticket 003-2 (003-1에 의존)

## 위험
- 빌드가 테스트마다 돌면 느림 → globalSetup 1회.
- 시나리오가 실제 공백을 드러내면 003-1에서 그 행을 표로 넘기고 계속(고치지 않음).
- CI에서 git 사용자 설정이 없으면 커밋 실패 → 테스트가 `-c user.name/email`을 준다.

## 증명
- `reins gate --ticket <id>` 보고서(테스트 출력에 "18/18 stopped" 포함)를 T3 증거로.

## 테스트 체크리스트
- [ ] C-1 18/18
- [ ] C-2 자식 프로세스 실행·globalSetup
- [ ] C-3 34행 표, 시나리오 번호 대응, 양판 링크
- [ ] C-4 공백 기록

## 이탈 기록
—
