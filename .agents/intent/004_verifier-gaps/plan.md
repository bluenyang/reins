---
intent: "004"
status: done
approvals:
  - { role: qa-design, at: 2026-10-26, kind: light-review }
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
2. T3: 버스 스키마(F2), 저장소 안 절대 경로, 빈 출력 D4 WARN (S-2~S-4) + V20~V23, 설계서 §3 D4 "빈 출력 = WARN"(양판, 같은 커밋) → ticket 004-2
3. 관리 블록 비교(F2, override 존중), 태그 삭제 A1 (S-5·S-6) + V24·V25, violations 행 (S-9), 설계서 §3 A1 "태그 삭제 = HOLD"(양판, 같은 커밋) → ticket 004-3

## 위험
- S-5가 이 레포 AGENTS.md를 멈출 수 있음 → spec의 정규화 규칙대로 구현한 뒤, 커밋 전에 이 레포 `check --drift`가 통과하는지 먼저 확인.
- S-1 인덱스 읽기가 훅을 느리게 함 → staged 경로만 `git show :path`로.
- intent 006(먼저 진행)이 stages.ts의 사유 id를 C2 → P2로 바꾼다 — 004는 그 위에서 작업한다.

## 증명
- `reins gate` 보고서 + `violations: 25/25 stopped`.
- C-7(커밋 0개 저장소)·C-8(EPIPE)은 `test/e2e/robustness.test.ts`에서 빌드된 CLI를 자식 프로세스로 실행해 stderr·종료 코드로 확인한다.

## 테스트 체크리스트
- [ ] C-1~C-9 (V19~V25, 빈 저장소, EPIPE, 기존 18개 유지)

## 이탈 기록
—
