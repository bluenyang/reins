---
intent: "006"
status: done
approvals:
  - { role: qa-design, at: 2026-10-26, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["006-3", "006-1", "006-2"]
---
## 바뀌는 파일
- 006-3: `harness/roles/code-review.md`, `harness/roles/pl.md`, `harness/templates/bus/request.yaml`, `skills/reins-loop/SKILL.md`, `skills/reins-loop/references/vendor-cli.md`(새)
- 006-1: `harness/policy/{stops,transitions}.yaml`, `harness/VERSION`, `harness/CHANGELOG.md`, `cli/src/commands/stages.ts`, `cli/src/lib/metrics.ts`, 테스트 3개, `docs/design*.md`, `docs/violations*.md`, `skills/reins-loop/SKILL.md`
- 006-2: `cli/test/harness.test.ts`, `harness/templates/bus/*.yaml`, `skills/reins-loop/SKILL.md`, 버스를 읽는 check 코드
- 각 ticket 끝에 `reins update`(설치본·생성물)

## 작업 순서
1. 리뷰는 변경분만 — pl 요청 형식·code-review 절차·프롬프트 구성·vendor-cli.md (S-7~S-10) → ticket 006-3. **가장 먼저**: 이후 0.1.1의 모든 리뷰가 이 방식을 쓴다.
2. 전제 정지 C1·C2 → P1·P2, 하네스 0.1.1, metrics 별칭 (S-1~S-3) → ticket 006-1
3. 비밀폐 테스트·버스 인용 규칙·버스 파싱 F2 (S-4~S-6) → ticket 006-2 (006-1에 의존: 같은 파일)

## 위험
- id 변경이 기존 시나리오(V11)와 metrics 테스트를 깬다 → 같은 커밋에서 기대값을 바꾼다.
- 004와 같은 파일(stages.ts·violations.md) → 006을 먼저 끝내고 004는 그 위에서.

## 증명
- `reins gate --ticket <id>` 보고서. 006-3은 이 ticket 자신의 리뷰를 새 방식으로 돌려 토큰을 기록한다(이전 리뷰 평균 약 3.2만과 비교).

## 테스트 체크리스트
- [ ] C-1~C-3 id·버전·별칭
- [ ] C-4 `.loctx` 유무와 무관
- [ ] C-5·C-6 인용 규칙·파싱 F2
- [ ] C-7~C-10 요청 형식·절차·프롬프트·레시피

## 이탈 기록
—
