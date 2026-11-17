---
id: "023"
slug: gate-discovery-typecheck-lint
version: "0.3.3"
status: approved
origin: user
approvals:
  - { role: user, by: BlueNyang, at: 2026-11-16, words: "승인", rev: 231e4da }
  - { role: user, by: BlueNyang, at: 2026-11-16, words: "개정 승인 및 진행", rev: aa3207d, kind: revision-1 }
waivers:
  - { step: "first audit re-run after A-11", words: "감사는 패스", at: 2026-11-17, scope: once }
supersedes: null
---
## 문제
- **루트의 `typecheck`·`lint`가 게이트 후보가 되지 않는다.** 사용자 2026-11-16: "config gates에서 refresh 하면 pnpm typecheck가 감지되지 않는 버그가 있는데". `discoverGates`(`cli/src/lib/detect.ts`)는 루트 package.json에서 `check`/`verify`/`ci`/`lint:check`, `test`, `build`, `e2e`만 본다. `typecheck`·`lint`는 하위 디렉터리 후보(`NODE_SCRIPTS`)에만 있다. PM 재현(2026-11-16):
  1. `check` 없이 `typecheck`·`lint`·`test`·`build`만 있는 저장소 → 게이트는 test·build뿐.
  2. `check`가 있지만 typecheck를 부르지 않는 저장소 → 게이트는 check뿐.
  install과 `config gates --refresh`가 같은 탐색을 쓰므로 둘 다 해당한다. 이 저장소는 `check`가 typecheck를 부르므로 영향이 없다.
- **2차 감사의 범위 시작점이 정해져 있지 않다(0.3.2 회고 H1).** `audit` 스킬은 2차 감사가 "from the first audit's head"를 본다고만 적는다. 0.3.2에서 PM이 감사 요청에 범위 시작을 PR의 마지막 커밋으로 잘못 적었고, 2차 감사가 이를 짚었다(`.agents/audit/0.3.2.md` 회고에서의 처리 3, 사용자 2026-11-15 "둘 다 오케이.").

- **`reins config`의 모델 화면과 개인 설정의 병합(2026-11-16 추가).** 사용자 2026-11-16: "생각해보니까, config 할 때, local이랑 project를 바꿔도 모델 config가 안바뀌었던 거 같은데." PM 확인: ① 모델 화면(`cli/src/commands/config-models.ts` `modelsScreen`)은 scope와 상관없이 늘 팀과 개인을 합친 결과(`effectiveBindings`)를 보여 준다. scope는 어디에 쓸지만 바꾼다. ② 개인 파일의 그룹은 팀 그룹을 통째로 바꿔 끼운다(`mergeLocal`, `cli/src/lib/bindings.ts:201`; 테스트 `bindings-v2.test.ts:85`가 고정). 개인 파일에 `pl.code-reviewer`만 적어도 팀 `pl` 그룹의 모델과 다른 PL 역할이 그 사람에게서 사라진다. 이 기계의 `.loctx/delegation.local.md`가 그 결과다. 019 spec S-4는 "키 단위로 이긴다"라고만 적었다.

## 바라는 결과
- 루트 package.json의 `typecheck`·`lint`도 게이트 후보가 된다. 묶음 검사(`check` 등)가 이미 그 스크립트를 부르면 넣지 않는다. 지금 `test`를 다루는 방식과 같다(PM 안).
  - `lint`가 파일을 고치는 명령(`--fix`/`--write`)이면 지금처럼 제외한다.
  - install과 `config gates --refresh`가 같은 결과를 낸다.
  - 위 재현 두 모양이 테스트 표에 들어간다.
- `audit` 스킬과 감사 템플릿에서 2차 감사의 범위는 1차 감사 기록의 `first.range` 끝 SHA부터 시작한다. PM은 감사 요청에 그 값을 그대로 옮긴다. 머지가 SHA를 바꿨으면 SHA 대응 표의 기본 브랜치 SHA를 쓴다.
- 개인 설정은 **적은 곳만 이긴다**(사용자 2026-11-16 "말한 곳만 이김 (추천)"): 개인 그룹이 역할만 적으면 팀 그룹은 그대로 두고 그 역할만 덮어쓴다. 개인 그룹이 그룹 모델을 적으면 팀의 그룹 모델과 팀이 역할별로 정한 모델을 모두 덮어쓴다(개인이 역할을 따로 적은 것은 그 값). 빈 그룹 `{}`은 지금처럼 그 그룹을 끈다.
- 모델 화면은 scope에 따라 보여 준다(사용자 2026-11-16 "project=팀 파일, local=합친 결과 (추천)"): project에서는 팀 파일의 값, local에서는 실제로 적용되는 결과를 보여 주고 개인 파일에서 온 값에 표시를 단다.
- 설계서 양판의 게이트 탐색·감사 범위·개인 설정 병합 설명, `CHANGELOG.md`, `harness/CHANGELOG.md`가 같은 말을 한다.

## 계획
1. spec: 승인되면 `spec.md`를 쓰고 검토한 뒤 요약에 진행/수정을 받는다. 작업 단위 초안:
   - W-1 게이트 탐색: 루트의 `typecheck`·`lint` 후보, 묶음 검사가 부르면 제외(`cli/src/lib/detect.ts`, `cli/test/gate-proposals.test.ts`, 설계 양판)
   - W-2 2차 감사 범위(`skills/audit/SKILL.md`, `harness/templates/audit.md`, 설계 양판 §3-3)
   - W-4 `config` 모델 화면의 scope 표시와 개인 설정 병합(`cli/src/lib/bindings.ts`, `cli/src/commands/config-models.ts`, 테스트, 설계 양판 §5) — 2026-11-16 추가
   - W-3 문서(`CHANGELOG.md`, `harness/CHANGELOG.md`, `docs/ROADMAP.md`·`.ko.md`)
2. 구현 → 리뷰 → 테스트 → PR → CI → 1차 감사까지 이어서 한다.
3. 머지(사용자 지시) → 0.3.3-rc.1 → 멈춤 → stable(사용자 지시) → 2차 감사 → 이 저장소 자기 업데이트 → 회고 → 멈춤.

## 영향 범위
`cli/src/lib/detect.ts`, `cli/test/gate-proposals.test.ts`(필요하면 `config gates --refresh` 테스트), `skills/audit/SKILL.md`, `harness/templates/audit.md`, `docs/design.md`·`design.ko.md`, `CHANGELOG.md`, `harness/CHANGELOG.md`, `docs/ROADMAP.md`·`ROADMAP.ko.md`, `cli/src/lib/bindings.ts`, `cli/src/commands/config-models.ts`(필요하면 `configure.ts`), `cli/test/bindings-v2.test.ts`·`config.test.ts`.

## 제약
- reins는 작업 중에 불리지 않는다(0.3 원칙). 바뀌는 것은 설치·설정 때의 탐색과 하네스의 글이다.
- 이미 있는 `gates.yaml`을 reins가 저절로 바꾸지 않는다. 새 후보는 `config gates --refresh`가 보여 주고 사용자가 고른다.
- 이 저장소의 `.agents/` 생성 파일은 `reins update`로만, 따로 커밋해 바꾼다.

## 열린 질문
없음.

## 질의서 기록
- "새 세션에서 0.3.3 안정화로 할거임."(사용자 2026-11-16): 게이트 탐색 결함을 0.3.3 안정화로 예약.
- "v0.3.3 버그 픽스(안정화) 준비"(사용자 2026-11-16): 이 루프의 시작.
- 0.3.3 범위에 회고 H1·H2를 넣을지에 "결함 + H1 (추천)"(사용자 2026-11-16).
- 모델 화면 결함을 0.3.3에 넣을지에 "이번 버전이 아직 stable 릴리스가 안되었지? 포함하자"(사용자 2026-11-16). 병합 규칙에 "말한 곳만 이김 (추천)", 화면에 "project=팀 파일, local=합친 결과 (추천)". 그룹 통째 교체(019 S-4의 구현과 그 테스트)를 바꾸는 결정이다.

### 에이전트가 정한 것
- 루트의 `typecheck`·`lint`를 묶음 검사가 부르는지 가리는 방법은 지금 `test`에 쓰는 것과 같은 스크립트 본문 검사로 한다. 대안: 묶음 검사가 있으면 하위 스크립트를 아예 보지 않기(지금 동작, 재현 2가 그대로 남음). 이유: 이미 쓰는 규칙이고 재현 두 모양을 모두 고친다. 정확한 판정(예: `pnpm typecheck`·`run typecheck`·`tsc` 직접 호출)은 spec에서 정한다.

## 하지 않을 것
- H2(뒤처진 작업 브랜치의 갱신과 force-with-lease 허용 여부): 금지선·정지 블록·생성 settings의 deny를 바꾸는 정책 결정이라 다음 버전으로 둔다(사용자 2026-11-16 "결함 + H1").
- 다른 이름의 스크립트(`type-check`, `tsc`, `lint:ci` 등)까지 넓히기 — spec에서 필요하다고 판단하면 조정 기록으로 남긴다.
