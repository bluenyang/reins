---
intent: "007"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-26, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["007-1", "007-2"]
---
## 바뀌는 파일
- 007-1: `docs/design.md`·`design.ko.md` §9(먼저, 같은 커밋), `.claude-plugin/plugin.json`·`marketplace.json`(새), `scripts/sync-version.ts`(새), `package.json`(version 스크립트), `skills/reins-setup/SKILL.md`, `cli/test/plugin.test.ts`(새), 이 레포 `reins update` 산출물
- 007-2: `.github/workflows/publish.yml`(빌드 → 버전 동기화 → update → 확인 → stage → 커밋), `.github/workflows/ci.yml`(validate 단계, 가능하면), `README.md`·`docs/README.ko.md`, `CHANGELOG.md`

## 작업 순서
1. 플러그인 본체: 매니페스트·마켓플레이스·sync-version·SKILL.md(고정 버전, userConfig 대체 규칙)·스키마 테스트 (S-2~S-6, S-4) → ticket 007-1
2. 릴리스·검증·문서: publish 워크플로의 동기화, CI validate(인증 필요하면 제외하고 기록), README 양판, CHANGELOG, 수동 설치 시나리오 C-2를 history에 (S-1, S-7, S-8) → ticket 007-2

## 위험
- SKILL.md 버전 변경 → 이 레포 설치본 드리프트: 워크플로가 `reins update`까지 하고 함께 커밋. dry_run으로 확인.
- `claude plugin validate`가 CI에서 인증을 요구할 수 있음 → 확인 후 빼고 기록.
- 마켓플레이스 항목의 `skills` 제한이 실제로 setup만 싣는지 → C-2 수동 시나리오로 확인.

## 증명
- `reins gate` 보고서, 스키마 테스트, publish dry_run 로그, C-2 수동 설치 기록.

## 테스트 체크리스트
- [ ] C-1~C-7

## 이탈 기록
—
