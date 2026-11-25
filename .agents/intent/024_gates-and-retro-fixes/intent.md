---
id: "024"
slug: gates-and-retro-fixes
version: "0.3.4"
status: released
origin: user
approvals:
  - { role: user, by: BlueNyang, at: 2026-11-19, words: "승인", rev: e5afe70 }
waivers: []
supersedes: null
---
## 문제
- **`update`가 보여 주는 하네스 변경 목록에 버전 구분이 없다.** 다른 저장소의 `reins update --dry-run`(0.3.0-rc.1 → 0.3.3, 2026-11-18)에서 앞 버전의 "Stable 2026-11-15"(0.3.2)·"Stable 2026-11-11"(0.3.1) 줄이 0.3.3 항목 사이에 끼어 그 버전의 일처럼 읽혔다. PM 확인: `changesBetween`(`cli/src/commands/update.ts:83`)이 범위 안 `## <버전>` 절의 `- ` 줄만 모아 평평한 목록으로 내고 제목을 버린다. 0.3.3 자신의 stable 줄은 패키지를 낸 뒤 #47에서 넣어 배포본에 없다.
- **게이트 감지와 `config gates --refresh`가 실제 프로젝트에 맞지 않는다.** 사용자 2026-11-17: "지금의 refresh는 기존의 gate를 없다고 판단하지 않아? 그건 결함이지". croffle에서 0.3.3 update 뒤 refresh가 멀쩡한 게이트 5개를 `gone`, 기존 게이트와 겹치는 하위 디렉터리 후보 13개를 `new`로 냈다. PM 분석(2026-11-17, croffle·allot·pipit-bot·pipit-music을 읽기 전용으로): `gone`이 "출처에서 없어짐"이 아니라 "지금 제안되지 않음"으로 판정된다. reins가 만들지 않는 출처(`.github/workflows/…`, 옛 표기 `Makefile#check`)도 걸린다. 워크스페이스를 도는 루트 스크립트(`pnpm -r`, `--filter`)가 이미 덮는 패키지 후보가 다시 나온다. `lint:check`가 묶음 검사 자리에 들어가고, `format:check`·CI에만 있는 검사는 빠진다. 그리고 `run-gates.sh`는 명령을 박아 넣은 생성 파일이라 `gates.yaml`만 고치면 훅이 옛 명령을 돈다.
- **0.3.3 회고에서 다음 버전으로 넘긴 하네스 개선(`.loctx/history/0.3.3.md`, `.agents/audit/0.3.3.md`).**
  - H-9 husky 훅 감지 결함: 이미 있는 `run-gates.sh` 줄을 다시 제안하고, `--hooks`면 중복으로 넣는다(사용자 "고치고").
  - H-1 PM이 작업 시작 때 `.loctx/delegation.local.md`를 늦게 읽었다(0.3.3).
  - H-2 리뷰 요청 머리에 `git diff --stat`을 두고 소스와 대조한다(사용자 "승인").
  - H-3 모델 호출은 받은 프롬프트와 최종 보고만 받는 즉시 `.loctx/reports/<version>/`에 남기고 회고 뒤 지운다(사용자 "아예 .loctx에만 기록하고 끝나면 정리시키는건?"). knowledge `offline-audit-records`에는 반영됨, 스킬 문장이 남음.
  - H-5 양판을 바꾸면 대조를 다시 하고, waiver와 검사 생략은 별개다(사용자 "ㅇㅋ").
  - H-7 spec을 개정할 때 두 로드맵과 사전 검토 기록을 확인한다(사용자 "ㅇㅋ").
  - H-10 감사 해결안에 대한 위원회 의견을 audit 스킬의 단계로 둔다(사용자 "그렇게 해.").
- **뒤처진 작업 브랜치의 갱신(0.3.2 회고 H2, 0.3.3에서 제외).** 사용자 방식은 "rebase로 갱신 시, force push를 해놓고 PR을 그대로 가는 편"이다. 그런데 `merge` 스킬("Never force-push"), 정지 블록, 생성되는 `.claude/settings.json`의 deny(`git push --force-with-lease *`)가 이를 막는다.

## 바라는 결과
- `update`의 변경 목록이 버전마다 `## 0.3.x` 제목 아래 묶여 나온다. stable 줄은 그 버전의 제목 아래에 있어 다른 버전의 일로 읽히지 않는다.
- 게이트 감지와 refresh는 사용자가 정한 모양을 따른다(사용자 2026-11-17 "ㅇㅋ. 그렇게 하자."; `.loctx/ROADMAP.local.md` "정해짐" 항목).
  - 정해진 이름 목록 대신 패턴(`check`·`lint`·`test`·`typecheck`·`type-check`·`build`·`e2e`·`verify`가 든 이름)과 본문으로 찾는다. 고치는 것, 끝나지 않는 것(`dev`·`start`·`watch`·`serve`·`preview`·`--watch`), 설치 단계(`prepare`·`postinstall`), 플랫폼 패키징 변형은 뺀다. `check:*` 같은 확인용 스크립트는 각자 자기 이름의 후보다(사용자 "ㅇㅇ 그렇게 해").
  - 워크스페이스(pnpm·npm·yarn 1·berry·bun, turbo·nx·lerna)와 CI 워크플로의 `run:` 줄도 본다(사용자 "ㅇㅇ. CI workflow 읽는 것도 좋겠다"). 후보마다 근거를 단다("CI에도 있음", "루트 `-r`이 이미 돎" 등). 분명하지 않으면 거르지 않는다.
  - refresh는 `gone`/`new` 대신 감지한 전체와 적용 상태를 보여 주고, 같은 목록을 `.loctx/`에 파일로 남긴다. reins는 무엇도 "없어졌다"고 판정하지 않으며, 지우는 것은 사람이 고를 때만이다.
  - 사람이 고르고, 에이전트가 `gates.yaml`을 직접 고친다(따로 커밋). 터미널 화면에서 골라 바로 적용하는 길도 남긴다.
  - `run-gates.sh`가 실행할 때 `gates.yaml`을 읽어, `gates.yaml`이 하나뿐인 진짜 설정이 된다.
  - 기준 프로젝트 네 곳의 모양이 테스트 fixture에 들어간다.
- husky 훅 감지가 이미 있는 `run-gates.sh` 줄을 알아보고, 다시 제안하거나 중복으로 넣지 않는다(H-9).
- 스킬 문장: H-1(`implement`·흐름 시작에서 위임 표 먼저), H-2(`review` 요청 머리의 `diff --stat` 대조), H-3(모델 호출 기록), H-5(양판 대조 다시), H-7(`spec` 개정 때 로드맵·사전 검토 확인), H-10(`audit`의 위원회 의견 단계).
- H2(사용자 2026-11-19 "PM안으로"): 작업 브랜치에 한해 `git push --force-with-lease`를 허용하고, 기본 브랜치와 태그에는 계속 막는다. 생성 settings의 deny를 기본 브랜치 대상으로 좁히고, `merge` 스킬과 정지 블록 문장을 맞춘다. 강제 푸시를 쓸 수 없는 환경에서는 기본 브랜치를 머지해 갱신하고, rebase 머지에서 그 머지 커밋이 빠지는 것을 허용한다.
- 설계서 양판, `CHANGELOG.md`, `harness/CHANGELOG.md`, 로드맵 양판이 같은 말을 한다.

## 계획
1. spec: 승인되면 `spec.md`를 쓰고 검토한 뒤 요약에 진행/수정을 받는다. 작업 단위 초안:
   - W-1 `update` 변경 목록의 버전 제목(`cli/src/commands/update.ts`, 테스트)
   - W-2 게이트 감지: 패턴·본문, 워크스페이스, CI `run:` 줄, 근거(`cli/src/lib/detect.ts`, fixture 네 곳)
   - W-3 refresh: 감지 전체와 적용 상태, `.loctx/` 목록, 화면에서 골라 적용(`cli/src/lib/gate-refresh.ts`, `config` 화면)
   - W-4 `run-gates.sh`가 `gates.yaml`을 읽음, 생성물 경계 정리(`cli/src/lib/gate-script.ts`, `generated.yaml`, 설계 §5·§6)
   - W-5 husky 훅 감지(H-9)
   - W-6 스킬 문장 H-1·H-2·H-3·H-5·H-7·H-10
   - W-8 H2: 작업 브랜치의 `--force-with-lease`(생성 settings의 deny, `merge` 스킬, 정지 블록, 설계 양판)
   - W-7 문서(설계 양판, 두 CHANGELOG, 로드맵 양판)
2. 구현 → 리뷰 → 테스트 → PR → CI → 1차 감사까지 이어서 한다.
3. 머지(사용자 지시) → 0.3.4-rc.1 → 멈춤 → stable(사용자 지시) → 2차 감사 → 이 저장소 자기 업데이트 → 회고 → 멈춤.

## 영향 범위
`cli/src/commands/update.ts`, `cli/src/lib/detect.ts`, `cli/src/lib/gate-refresh.ts`, `cli/src/lib/gate-script.ts`, `cli/src/commands/install.ts`·`configure.ts`(게이트·훅 화면), 관련 테스트와 fixture, `skills/`의 `implement`·`review`·`spec`·`audit`·`merge`(H2), `harness/` 템플릿과 `generated.yaml`, `docs/design.md`·`design.ko.md`, `CHANGELOG.md`, `harness/CHANGELOG.md`, `docs/ROADMAP.md`·`ROADMAP.ko.md`.

## 제약
- reins는 작업 중에 불리지 않는다(0.3 원칙). refresh는 사람이 돌리고, 에이전트는 그 결과로 `gates.yaml`을 고친다.
- 이미 있는 `gates.yaml`을 reins가 저절로 바꾸지 않는다.
- 이 저장소의 `.agents/` 생성 파일은 `reins update`로만, 따로 커밋해 바꾼다.
- 기준 프로젝트(croffle, allot, pipit-hub)는 읽기만 하고, fixture에는 모양만 옮긴다.

## 열린 질문
없음.

## 질의서 기록
- 0.3.4 예약: 게이트 감지 결함에 사용자 2026-11-17 "0.3.4로", 모양에 "ㅇㅋ. 그렇게 하자."
- 범위: PM이 제안한 나눔(0.3.4에 결함 둘과 H-9, 스킬 문장 H-1·H-2·H-3·H-5·H-7·H-10, H2 결정 / 0.4로 H-4·H-6)에 사용자 2026-11-19 "그렇게 하자". 이 말을 이 루프의 시작으로 본다.
- H2에 PM 안(작업 브랜치만 force-with-lease 허용)을 제시하고 대안(0.4로)을 함께 물음 → 사용자 2026-11-19 "PM안으로". 금지선의 force push 항목을 좁히는 결정이다.
- 0.4(에이전트 훅과 루프)는 "일단 0.3 안정화 후 작업하자"(사용자 2026-11-19) — 0.3.4가 먼저다.

### 에이전트가 정한 것
- H-4(발언 즉시 기록)와 H-6(SHA 기록 줄이기)은 0.4로 넘긴다. 대안: 0.3.4에 넣기. 이유: 0.4가 1차 감사의 위치와 감사 입력, 훅의 기록 확인을 다시 짜므로 지금 고치면 다시 고치게 된다(사용자가 이 나눔에 "그렇게 하자").
- 0.3.3 사후 대조의 관찰(`detect.ts` `maskQuotes` 위 주석이 코드보다 좁음)은 W-2에서 그 파일을 고칠 때 주석만 맞춘다.

## 하지 않을 것
- 에이전트 훅, 루프 구조, 회고 제안 방식, 역할별 knowledge, D-5 — 0.4.
- H-4, H-6 — 0.4.
- 에이전트가 `reins config gates --refresh --apply`로 직접 적용하는 길(0.3 원칙의 예외) — 사용자가 고른 모양에 없음.
