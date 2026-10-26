---
intent: "009"
status: done
approvals:
  - { role: qa-design, at: 2026-10-26, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["009-1", "009-2"]
---
## 바뀌는 파일
- 009-1: `harness/roles/deploy.md`, T4 검사(`cli/src/commands/check.ts`), `docs/design*.md` §3 T4 줄·§4 PR 흐름, `CONTRIBUTING*.md` PR 흐름 절, `skills/reins-release`(008) PR 절차, 테스트
- 009-2: `.github/workflows/publish.yml`(stable 게이트), T5 검사(`cli/src/commands/stages.ts`, 다음 rc 번호 계산·중복 F2), `docs/design*.md` §3 T5 줄·§4 rc 규칙, `CONTRIBUTING*.md` Releases 절, deploy 역할의 rc 단계, 로컬 장부 `.loctx/release/<V>.md`(gitignore, 커밋 안 함), 테스트

## 작업 순서
1. PR → CI → merge 규칙: deploy 역할 절차, T4가 master 직접 push를 A4로 막음(릴리스 커밋 예외), 설계서·CONTRIBUTING의 PR 부분 (S-1, S-2, S-7 일부) → ticket 009-1
2. rc 자동·rc.N·stable 승격: T5(`--release <V>`) 통과 → deploy가 `version=<V>-rc.N`으로 publish(staged), 로컬 rc 장부, stable 게이트(같은 커밋의 rc 태그 필요), 설계서·CONTRIBUTING의 릴리스 부분 (S-3~S-6, S-7 일부) → ticket 009-2

## 위험
- master 보호 규칙은 사용자가 GitHub에서 설정(에이전트가 바꾸지 않음) — T4는 실수 방지용.
- 0.1.3이 이 흐름의 첫 릴리스 — 009가 merge되기 전까지는 지금 방식.

## 증명
- `reins gate` 보고서, T4·T5 단위·e2e 테스트, publish dry_run.

## 테스트 체크리스트
- [ ] spec C-1~C-6

## 이탈 기록
—
