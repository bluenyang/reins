---
intent: "014"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-28, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
branch: feat/014-tui-config
tickets: ["014-1", "014-2", "014-3", "014-4"]
---
## 바뀌는 파일
- 014-1: `package.json`(+`@clack/prompts`)·lockfile, `cli/src/lib/prompter.ts`(새: `Prompter`, `clackPrompter`, `scriptedPrompter`, `askerPrompter`), `cli/src/commands/config.ts`(새, 메인 화면 뼈대와 비TTY 출력), `cli/src/reins.ts`(`config`), 테스트, `docs/design*.md` §9, README 양판 표
- 014-2: `cli/src/lib/bindings.ts`(`enabled`, 고정 역할, local 우선, `setRoleEnabled`), 스키마(bindings·bindings-local), `harness/roles/*.md`(`covered_by`), `cli/src/lib/generate.ts`(팀이 끈 역할 생성 안 함), `status.ts`, `stages.ts`(T1 WARN), `configure.ts`·`reins.ts`(`--disable`/`--enable`), reins-loop 스킬, 설치본(`reins update`), 테스트, `docs/design*.md` §2·§5·§6·§9
- 014-3: `cli/src/commands/config.ts`(models and roles 화면, 역할 화면, 벤더·모델 고르기), `cli/src/lib/detect.ts`(알려진 모델 목록 함수), 테스트(`scriptedPrompter`), `docs/design*.md` §9
- 014-4: `cli/src/commands/install.ts`(타입 있는 질문, TTY manual 화면), `cli/src/commands/update.ts`·`reins.ts`(계획 표시와 확인, `--yes`), reins-setup 스킬, 설치본, 테스트, `docs/design*.md` §9, README 양판
- 모든 ticket: 설계서 양판은 코드와 같은 커밋, CHANGELOG `[Unreleased] — 0.2.0`에 한 줄
## 작업 순서
1. Prompter 인터페이스·@clack/prompts·`reins config` 진입과 비TTY 출력 (S-1, S-2) → ticket 014-1
2. 역할 ON/OFF 저장·고정 역할·local 우선·`covered_by`·생성물·T1 경고·`--disable/--enable` (S-4, S-6, S-7, S-11) → ticket 014-2
3. models and roles 화면과 역할·벤더·모델 화면 (S-3, S-5) → ticket 014-3
4. install·update의 TUI (S-8, S-9) → ticket 014-4
## 위험
- 실제 터미널 렌더링은 CI에서 볼 수 없다 → 화면 로직은 `scriptedPrompter`로 테스트, 렌더링은 C-13 수동 시나리오(OS별 1회).
- 역할 OFF가 생성물·drift에 미치는 영향 → 014-2에서 팀 값만 생성에 반영, local은 생성물 무관(C-7).
- 014-2·014-3·014-4가 `bindings.ts`·`reins.ts`·`install.ts`를 함께 고친다 → 순서대로(병렬 금지).
- `@clack/prompts`의 Windows 동작 → CI 매트릭스(Windows)와 C-13.
## 증명
- vitest: spec C-1~C-12, 기존 테스트 전부, CI 3 OS × Node 22·24 녹색.
- C-13 수동: Linux·macOS·Windows에서 `reins config` 탐색·모델 변경·역할 끄고 켜기·install 화면·update 확인(결과 `.loctx/reports/`).
- npm rc 스모크(빈 저장소, 0.1.5 설치본 update).
## 테스트 체크리스트
- [ ] spec C-1~C-13
- [ ] CI matrix 녹색
- [ ] npm rc 스모크
## 이탈 기록
—
