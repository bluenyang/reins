---
intent: "011"
status: active
approvals:
  - { role: qa-design, at: 2026-10-26, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["011-1", "011-2", "011-3", "011-4", "011-5"]
---
## 바뀌는 파일
- 011-1: `cli/src/commands/new.ts`(새), `cli/src/reins.ts`, 테스트, `docs/design.md`·`docs/design.ko.md`(S-1~S-4 `reins new`, 같은 커밋)
- 011-2: `harness/schemas/intent.schema.json`(released), `cli/src/commands/status.ts`, `cli/src/commands/gate.ts`(--respond), `harness/roles/verify-tool.md`, `skills/reins-loop/SKILL.md`·`skills/reins-intent/SKILL.md`(S-5 metrics 한 줄), `.github/workflows/publish.yml`(요약 단계), `cli/src/scripts/sync-version.ts`, `docs/design*.md`(§9 경로와 S-5~S-9, 같은 커밋), intent 001~007 상태, `reins update`

## 작업 순서
1. `reins new intent|ticket|request` (S-1~S-4) → ticket 011-1
2. released 상태·`gate --respond`·스킬 metrics 줄·publish/sync/문서 정리·001~007 released (S-5~S-12) → ticket 011-2

## 위험
- 스키마 enum 추가 → 하네스 버전 노트, update로 설치본 이동.
- `gate --respond`가 엉뚱한 요청에 응답할 수 있다 → 열린 `kind: verify` 요청 중 응답 없는 최신 것만 고르고, 없으면 exit 1(S-9).
- stdout 요약이 C5 위반으로 읽힐 수 있다 → 원시 출력은 보고서 파일에 무손실로 남기고, 응답의 evidence는 보고서 경로만 가리킨다.
- 001~007 수동 변경 → C-5로 확인.

## 증명
- `reins gate` 보고서, 생성 파일이 스키마 통과, `gate --respond` 한 번으로 T3 통과(C-6·C-7).
- vitest: released 처리(C-4), 001~007 status 출력(C-5), sync-version fixture와 version 키 없는 경우(C-8).

## 테스트 체크리스트
- [ ] spec C-1~C-12

## 이탈 기록
- 2026-10-26 (pl, 0.1.3 rc.1 이후 안정화, 사용자 지시): 011-3 `reins new ticket`이 plan이 예약한 id를 씀 · 011-4 테스트가 만든 임시 디렉터리를 지움(/tmp/reins-* 약 1만 개가 쌓여 inode 100%) · 011-5 e2e control 테스트가 publish에서 간헐적으로 빈 stdout — 실패 시 stderr를 남기고 원인 제거. 모두 release: stabilization.
