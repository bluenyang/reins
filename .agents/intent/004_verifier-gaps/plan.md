---
intent: "004"
status: draft
approvals: []
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["004-1", "004-2", "004-3"]
---
## 바뀌는 파일
- `cli/src/lib/git.ts`, `cli/src/commands/check.ts`, `cli/src/commands/stages.ts`, `cli/src/reins.ts`, 관련 단위 테스트, `test/e2e/violations.test.ts`, `docs/violations*.md`, `docs/design*.md` §3

## 작업 순서
1. 인덱스 기준 pre-commit, HEAD 없는 저장소, EPIPE (S-1·S-7·S-8) + V19 → ticket 004-1
2. T3: 버스 스키마(F2), 저장소 안 절대 경로, 빈 출력 D4 WARN (S-2~S-4) + V20~V23 → ticket 004-2
3. 관리 블록 비교(F2, override 존중), 태그 삭제 A1 (S-5·S-6) + V24·V25, violations 행·설계서 §3 (S-9) → ticket 004-3

## 위험
- S-5가 이 레포 AGENTS.md를 멈출 수 있음 → 비교 전 정규화(CRLF·끝 공백) 범위를 004-3 첫 단위에서 정하고 이 레포 `check --drift`로 먼저 확인.
- S-1 인덱스 읽기가 훅을 느리게 함 → staged 경로만 `git show :path`로.
- 006이 먼저 바꾼 stages.ts 위에서 작업(006-1 이후).

## 증명
- `reins gate` 보고서 + `violations: 25/25 stopped`.

## 테스트 체크리스트
- [ ] C-1~C-9 (V19~V25, 빈 저장소, EPIPE, 기존 18개 유지)

## 이탈 기록
—
