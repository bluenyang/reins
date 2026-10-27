---
intent: "012"
status: active
approvals:
  - { role: qa-design, at: 2026-10-27, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
branch: feat/012-large-repo-readiness
tickets: ["012-1", "012-2", "012-3", "012-4", "012-5", "012-6", "012-7", "012-8", "012-9"]
---
## 바뀌는 파일
- 012-1: `harness/schemas/install.schema.json`(새), `cli/src/lib/release.ts`(새), `cli/src/commands/stages.ts`(T5 dispatch 줄), `cli/src/commands/install.ts`(install.yaml 키 보존), `harness/roles/deploy.md`, `skills/reins-release/SKILL.md`, 이 저장소 `.agents/harness/install.yaml`(release), 설치본, 테스트, `docs/design*.md` §4·§9
- 012-2: `cli/src/lib/detect.ts`(proposals), `cli/src/commands/install.ts`(manual 선택·auto notes), `cli/src/commands/configure.ts`·`cli/src/reins.ts`(`configure gates`), 테스트, `docs/design*.md` §5·§9
- 012-3: `cli/src/lib/migrate-plan.ts`(번호·idMap·intent 000·legacy 대상), `cli/src/commands/migrate.ts`(`--legacy`), `cli/src/reins.ts`, 테스트, `docs/design*.md` §7·§9
- 012-4: `cli/src/lib/secrets.ts`, `harness/policy/common-red-lines.yaml`(C4 `*.env`), memory 초안(`planMemoryProposals`, install·migrate), migrate의 memory→knowledge 이동 제거, 생성 settings, 테스트, `docs/design*.md` §7
- 012-5: `cli/src/commands/update.ts`·`install.ts`(retired 파일 삭제, `applied.removed`), `cli/src/commands/check.ts`(driftMatch 설치 대상만, 잔존 파일 WARN), 테스트, `docs/design*.md` §6
- 012-6: `cli/src/commands/status.ts`(cli 버전, `nextForIntent` 열린 ticket), `cli/src/reins.ts`(update 출력 첫 줄·already up to date), 테스트, README 양판의 status 예시가 바뀌면 함께
- 모든 ticket: 설계서 양판은 그 ticket의 코드와 같은 커밋(AGENTS.md), CHANGELOG `[Unreleased] — 0.1.4`에 한 줄
## 작업 순서
1. release 설정과 deploy·T5 dispatch (S-1~S-4, S-17 일부) → ticket 012-1
2. 하위 디렉터리 게이트 제안과 `configure gates` (S-5~S-7) → ticket 012-2
3. migrate ticket 번호·intent 000·`--legacy` (S-8~S-10) → ticket 012-3
4. memory 제안 초안과 `*.env` (S-11·S-12) → ticket 012-4
5. update의 retired 파일 정리와 drift 대상 (S-13·S-14) → ticket 012-5
6. status·update 버전 출력과 다음 할 일 (S-15·S-16) → ticket 012-6
## 위험
- 012-1·012-2·012-4·012-5가 `install.ts`를 함께 고친다 → 순서대로 진행(병렬 금지), 각 ticket은 앞 ticket 위에서 시작.
- install.yaml 키 보존(S-4)이 빠지면 update가 `release:`를 지운다 → 012-1에서 먼저, C-1로 확인.
- `--legacy committed`가 비밀을 커밋 경로로 옮길 수 있다 → 패턴 파일 제외(S-10)와 보고서 경고, 리뷰에서 확인.
- croffle `migrate --dry-run`(사용자)이 fixture와 다르면 012-2·012-3 fixture를 고친다 → 이탈 기록에 남김.
- 이 저장소의 release 설정이 publish 흐름을 바꾼다 → 012-1 뒤 rc.1을 이 설정으로 실제 dispatch해 확인.
## 증명
- vitest: spec C-1~C-14 각각의 fixture 테스트, 기존 테스트 전부 통과.
- `reins check --drift` ok, 이 저장소에서 `reins update` 뒤 `release:` 유지(C-15).
- rc.1 스모크 테스트를 npm 패키지로 빈 저장소에서(knowledge cli-pin-follows-harness-version).
## 테스트 체크리스트
- [ ] spec C-1~C-15
- [ ] npm rc 스모크: install(하위 게이트 제안), migrate fixture(id 겹침), 0.1.0·0.1.3 설치본 update
## 이탈 기록
- 2026-10-27 (pl, rc.1 뒤 사용자 지시 "a, b rc.2, c는 0.2"): croffle `migrate --dry-run` 결과에서. 012-7 dry-run이 게이트 제안·memory 초안 예정을 보여 줌 · 012-8 `workflow_dispatch` 워크플로에서 `release:` 초안 제안 · 012-9 publish가 deploy key로 push(사용자가 master 보호 규칙을 거는 중). 모두 release: stabilization. 버전별 intent 분리는 0.2.
- 2026-10-27 (pl, 버전 e2e): `--legacy committed`인데 보고서가 `.loctx/_legacy/`라고 적음 → 012-3 후속 커밋으로 수정(review 012-3_04 approve). 그 밖의 e2e는 통과: 모노레포 제안·configure gates·memory 초안·`*.env` deny·버전 출력·0.1.0 설치본 update·migrate id/intent 000/재실행.
