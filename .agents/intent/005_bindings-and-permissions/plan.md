---
intent: "005"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-26, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["005-1", "005-2"]
---
## 바뀌는 파일
- 005-1: `cli/src/lib/detect.ts`, `cli/src/commands/{install,configure}.ts`, 단위 테스트
- 005-2: `harness/roles/{qa-design,qa-run}.md`, `cli/src/lib/generate.ts`, `test/e2e/violations.test.ts`(V18), `docs/violations*.md` C4·C5, 필요하면 `docs/design*.md` §5, 이 레포 `reins update`

## 작업 순서
1. `vendorOf` 하나로·모델 목록 확인(주입 가능한 실행기) (S-2·S-3) → ticket 005-1
2. 기본 바인딩, `.env.*` 여집합 glob·`git commit -n`, V18·violations, update (S-1·S-4~S-7) → ticket 005-2. **첫 단위는 실현성 확인**: 이 레포의 Claude Code 세션에서 `[!…]` glob deny가 동작하는지 가짜 `.env.zz`·`.env.example`로 확인. 안 되면 HOLD(B5)로 사용자에게.

## 위험
- glob 매처 미지원 → 위 확인 후 HOLD.
- 실제 CLI를 테스트에서 띄우지 않기 → 실행기 주입.

## 증명
- `reins gate` 보고서, C-5 정규식 판정 테스트, 이 레포 재생성 후 `bindings.yaml` diff 없음.

## 테스트 체크리스트
- [ ] C-1~C-7

## 이탈 기록
—
