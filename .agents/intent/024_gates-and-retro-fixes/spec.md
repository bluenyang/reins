---
intent: "024"
status: accepted
approvals:
  - { role: user, by: BlueNyang, at: 2026-11-19, words: "진행", rev: e43297e, kind: summary }
summary_for_user: |
  W-1 `update` 변경 목록을 버전 제목 아래 묶음(`--json`은 `changes`를 두고 `changesByVersion` 추가). W-5 husky 파일에 같은 줄이 이미 있으면 다시 제안·추가하지 않음.
  W-2·W-3 게이트: 이름 패턴·본문·워크스페이스·CI(`pull_request`로 도는 워크플로의 `run:` 줄)로 후보를 찾고 근거를 담. refresh는 `gone`/`new` 대신 "감지 전체 + 적용 상태" 표를 화면과 `.loctx/gates-refresh.md`에 냄. 사람이 고르면 에이전트가 `gates.yaml`을 고치고(따로 커밋), 화면·`--apply`로 바로 적용하는 길도 남김. 빼기·명령 바꾸기는 이름으로 고를 때만. W-4 `run-gates.sh`가 실행 때 `gates.yaml`을 읽음(POSIX awk, reins가 쓰는 모양만; 파일이 없거나 못 읽으면 exit 2).
  W-8 강제 푸시: `git push --force-with-lease origin <작업 브랜치>` 한 형태만 열고, 기본 브랜치·태그·브랜치를 안 적은 형태·플래그 위치가 다른 형태·`=` 형태·`+` refspec은 막음. 한계: 명령 문자열 글롭이라 `git -C`·변수·별칭은 못 막고, 테스트는 Claude Code의 매칭을 흉내 낸 매처로 함(실제 매칭의 증거는 아님) — 정확한 차단은 0.4 에이전트 훅. W-6 스킬 문장 H-1·H-2·H-3·H-5·H-7·H-10. W-7 문서.
  확인 필요(PM 판단): ① install이 미리 고르는 후보는 지금의 핵심 이름에 `lint:check`·`format:check`·`type-check`를 더한 것, `check:*`·CI·하위 디렉터리는 고르지 않은 채 보여 줌 ② **이 저장소 AGENTS.md 금지선 문장("Files reins writes (`.agents/harness/` …)")에 `gates.yaml`은 예외라고 적음** ③ 0.3.3 자신의 stable 줄이 배포본에 없는 문제는 제목 묶음으로 충분하다고 봄 ④ 상태 "적용됨·다른 명령"과 그 바꾸기를 더함(사용자가 정한 다섯 상태 밖, 이름으로 고를 때만).
  검증 V-1~V-13: 고치기 전 실패 재현, 표 테스트, 기준 프로젝트 네 곳 fixture(기대값은 이 spec의 부록 표), 게이트 스크립트 sh 테스트, deny 매칭 표, 스킬 구절 표, 양판 대조, `pnpm check`와 CI. 릴리스 뒤 검증 R-1·R-2(rc 배포본 smoke, stable 뒤 자기 업데이트)는 머지 전 단계에서 판정하지 않음.
---
## 요구 해석
<!-- 각 S-n 끝의 ← 는 그것이 나온 intent 문장이다. "PM 판단"은 intent에 없는 것을 이 spec이 정한 곳이다. 2026-11-19 계획 검토(F-1~F-3, C-1~C-4)와 검증 계획 검토를 반영한 판이다. -->

### `update`의 변경 목록 (W-1)
- S-1 **버전 제목으로 묶음.** `changesBetween`(`cli/src/commands/update.ts:83`)은 범위 `(from, to]`의 절을 `{ version, items }[]`로 돌려준다. CHANGELOG 순서(새 버전이 위)를 따르고, 항목이 없는 버전은 넣지 않는다. 범위가 비면 빈 목록이다. 사람이 읽는 출력은 버전마다 제목 줄 `  0.3.3`을 내고, 그 아래 `    · <항목>`을 낸다. stable 줄은 자기 버전 제목 아래에 있다. 범위 판정(`newer`)은 그대로 둔다: `from=0.3.0-rc.1`이면 `0.3.0`은 범위 밖이다(`newer('0.3.0','0.3.0-rc.1')`이 거짓). 이 동작은 V-2가 고정한다. ← "변경 목록이 버전마다 `## 0.3.x` 제목 아래 묶여 나온다"
- S-2 **`--json`은 깨지 않는다(PM 판단).** 기존 `changes: string[]`(평평한 목록)는 그대로 두고 `changesByVersion: { version: string, items: string[] }[]`를 더한다.
- S-3 **0.3.3 자신의 stable 줄(PM 판단 ③).** stable은 rc 커밋에서 그대로 내므로 그 패키지의 CHANGELOG에는 자기 stable 줄이 없다. 제목으로 묶으면 다른 버전의 stable 줄이 섞여 보이는 문제가 사라지므로, stable 줄을 미리 넣거나 보고에서 빼는 일은 하지 않는다. ← intent의 첫 문제

### 게이트 감지 (W-2)
- S-4 **이름 패턴과 본문.**
  - 루트와 하위 디렉터리의 package.json에서, 이름을 `:`·`-`·`_`로 나눈 낱말 가운데 하나가 `check`·`lint`·`test`·`typecheck`·`type-check`(전체 이름)·`build`·`e2e`·`verify`·`ci`인 스크립트를 후보로 본다. 예: `lint:check`, `format:check`, `check:migrations`, `test:unit`, `build:web`, `type-check`. `contest`, `latest`, `prebuild`, `rebuild`처럼 낱말 안에 든 것은 아니다. `pre<x>`/`post<x>` 훅 스크립트는 후보가 아니다.
  - 다음은 뺀다(`excluded`에 이유와 함께 남음).
    - 고치는 것: 지금의 `MUTATING`
    - 끝나지 않는 것: 이름 낱말이나 본문 낱말에 `dev`·`start`·`watch`·`serve`·`preview`가 있거나, 본문에 `--watch`·` -w`(단독)가 있는 것. 예: `test:watch`
    - 설치 단계: `prepare`·`preinstall`·`install`·`postinstall`
    - 플랫폼 패키징 변형: 이름 낱말에 `win`·`windows`·`mac`·`macos`·`darwin`·`linux`·`dmg`·`exe`·`msi`·`appimage`·`deb`·`rpm`·`snap`·`pkg`가 있는 것
  - Makefile에서는 `check`·`lint`·`test`·`build`·`vet`·`verify` 대상(`^name:` 줄)을 본다. go.mod는 `test`·`vet`이다.
  - ← "정해진 이름 목록 대신 패턴 … 과 본문으로 찾는다", "고치는 것, 끝나지 않는 것 … 은 뺀다"
- S-5 **묶음 검사는 `check`·`verify`·`ci`만.**
  - `lint:check`는 더 이상 묶음 자리에 들어가지 않고 자기 이름의 후보가 된다(이름 `lint:check`). 0.3.3의 `lint:check`를 묶음으로 쓰던 테스트 기대는 **의도한 회귀**로 바꾼다(V-3에 표시).
  - 묶음이 이미 부르는 것의 판정은 0.3.3 규칙(023 S-2: 옵션 없는 이름 호출, 또는 본문이 글자 그대로 같음)을 모든 후보로 넓힌다. `test`도 이 규칙으로 옮긴다. 이유(PM 판단): `test:unit`이 따로 후보가 되므로, 낱말 `test`만 보면 `test:unit`을 부른 것으로 잘못 칠 수 있다.
  - ← "`check:*` 같은 확인용 스크립트는 각자 자기 이름의 후보"
- S-6 **한 디렉터리 안의 판정.** 다음 셋은 모두 "이미 도는 것"이다.
  - Makefile의 한 대상이 의존 목록에 적거나 본문에서 `$(MAKE) x`·`make x`로 부르는 대상(croffle `check: fmt-check vet test` → `test`·`vet`)
  - Makefile이 있는 디렉터리의 go.mod `test`·`vet` 가운데, 어느 대상 본문이 `go test`·`go vet`을 담은 것
  - 본문에 다른 후보의 본문을 `&&` 조각 하나로 글자 그대로 담은 경우의 그 다른 후보. 예: croffle web의 `build`=`vue-tsc --noEmit && vite build`가 `typecheck`=`vue-tsc --noEmit`을 담음

  ← "정해짐" 항목(③)
- S-7 **워크스페이스.**
  - 목록은 pnpm(`pnpm-workspace.yaml`의 `packages`), npm·bun·yarn(`package.json`의 `workspaces` 배열이나 `{ packages }`)에서 읽는다. 글롭(`apps/*`, `packages/**`)을 package.json이 있는 디렉터리로 펼치고, `!`로 시작하는 항목은 빼는 글롭으로 다룬다. 패키지 이름은 각 package.json의 `name`이다(`@scope/name` 포함).
  - 루트 스크립트 본문의 조각(또는 `gates.yaml`의 게이트 명령)이 아래 형태면, 해당 패키지들의 같은 이름 후보는 "이미 도는 것"이다. `[run]`은 있어도 없어도 되고, `--parallel`·`--stream`·`--if-present`처럼 대상을 바꾸지 않는 플래그는 함께 있어도 된다.

    | 형태 | 대상 |
    |---|---|
    | pnpm `-r`/`--recursive [run] X` | 모든 패키지 |
    | pnpm `--filter <name>` / `--filter ./<dir>` / `-F …` `[run] X` | 맞는 패키지(이름은 글자 그대로, `./dir`은 경로) |
    | npm `run X --workspaces`/`-ws` | 모든 패키지 |
    | npm `run X -w <name\|dir>`/`--workspace <…>` | 그 패키지 |
    | yarn 1 `workspaces run X` | 모든 패키지 |
    | yarn `workspace <name> [run] X` | 그 패키지 |
    | yarn berry `workspaces foreach [-A\|--all\|-p\|-v…] run X` | 모든 패키지(`--include`·`--from`·`--exclude`가 있으면 분명하지 않음) |
    | bun `--filter <pattern> [run] X` | 맞는 패키지(`*`만 글롭) |
    | `turbo run X`, `nx run-many -t X`, `lerna run X` | 모든 패키지 |
  - 자기 workspace 파일이나 lock 파일을 가진 하위 디렉터리는 루트 워크스페이스 밖이다(croffle `apps/server/web`). 위 표에 없는 형태, 이 밖의 플래그가 든 형태는 분명하지 않으므로 거르지 않는다.
  - ← "워크스페이스(pnpm·npm·yarn 1·berry·bun, turbo·nx·lerna) … 도 본다", "분명하지 않으면 거르지 않는다"
- S-8 **CI 워크플로의 `run:` 줄.**
  - `.github/workflows/*.yml|yaml` 가운데 `on:`에 `pull_request`가 있는 워크플로만 본다(릴리스·수동 워크플로는 뺀다; PM 판단). 각 step의 `run:`이 다음 조건을 모두 만족하면 후보로 본다.
    - 한 줄짜리이고 `${{`가 없다.
    - 한 명령이다(지금의 `compound`가 거짓).
    - 설치 명령(`<pm> install`, `npm ci`, `corepack enable`, `go mod download`)이 아니다.
    - S-4에서 빼는 것이 아니다.
  - 여러 줄(`run: |`)은 분명하지 않음으로 보고 내지 않는다.
  - step에 `working-directory: <dir>`가 있으면 `pnpm --dir <dir> …`·`yarn --cwd <dir> …`·`npm --prefix <dir> …`·`go -C <dir> …`·`make -C <dir> …`로 바꾼다. 바꿀 수 없는 도구면 내지 않는다.
  - 바꾼 명령이 다른 후보나 게이트의 명령과 같거나, 어느 스크립트의 본문과 같으면 새 후보가 아니라 그쪽의 근거 `CI에도 있음 (<파일>)`이 된다. 남은 것은 이름 `ci-<명령 낱말을 -로 이은 slug>`의 후보이고, 늘 고르지 않은 채 보인다.
  - ← "CI 워크플로의 `run:` 줄도 본다"
- S-9 **근거.** 후보와 게이트의 줄마다 근거 목록을 단다. 글은 다음 중 해당하는 것이다(테스트가 이 글을 그대로 단언한다).
  - `CI에도 있음 (<파일>)`
  - `<스크립트 또는 게이트>가 이미 돎 (<조각>)`
  - `<묶음>이 이미 부름`
  - `Makefile <대상>이 의존`
  - `본문이 <후보>를 담음`
  - `파일을 고침`, `끝나지 않음`, `설치 단계`, `플랫폼 패키징`
  - `워크스페이스 밖 (<파일>)`
  - `분명하지 않음 (<이유>)`

  ← "후보마다 근거를 단다"
- S-10 **install이 미리 고르는 것(PM 판단 ①).** install은 후보 전체를 근거와 함께 보여 준다.
  - 미리 고르는 것: 지금 자동으로 넣던 모양(묶음, `lint`, `typecheck`, `test`/`test:unit`, `build`, `e2e`는 optional)에 `lint:check`·`format:check`·`type-check`를 더한 것. 같은 일을 하는 둘(`lint`가 고치는 것이라 빠지고 `lint:check`가 있는 경우 등)은 남는 하나만 고른다.
  - 고르지 않는 것: "이미 도는 것".
  - 고르지 않은 채 보여 주는 것: `check:*`·CI 후보·하위 디렉터리 후보·그 밖의 패턴 후보(`build:unpack`, `typecheck:desktop`).
  - 대화형이 아니면 미리 고른 것만 쓴다.
  - 이유: 처음 설치의 결과가 지금과 크게 달라지지 않게 하면서, 0.3.3에서 빠지던 `format:check`·`lint:check`를 잡는다.

### refresh (W-3)
- S-11 **감지한 전체와 적용 상태.** `config gates --refresh`는 `gone`/`new`/`changed`를 내지 않는다. `gates.yaml`의 게이트 전체와 감지한 후보 전체를 짝지어, 줄마다 아래 상태 하나와 S-9의 근거를 보여 준다.

  | 상태 | 뜻 |
  |---|---|
  | 적용됨 | `gates.yaml`에 있고 `from`이 있으며, 감지한 후보와 짝지어짐 |
  | 적용됨·직접 적은 것 | `gates.yaml`에 있고 `from`이 없음(짝지어진 후보가 있으면 그 근거를 함께 보임) |
  | 적용됨·출처를 못 찾음 | `from`이 가리키는 파일에 그 스크립트·대상이 실제로 없음(package.json의 `scripts` 키, Makefile의 `^name:` 대상, go.mod 파일, 워크플로 파일) |
  | 적용됨·다른 명령 | 출처는 짝지어지는데 감지한 명령이 다름(PM 판단 ④) |
  | 미적용 | 감지했으나 `gates.yaml`에 없음 |
  | 미적용·이미 도는 것 | 감지했으나 다른 게이트나 스크립트가 이미 돌림 |

  - 짝짓기 순서는 다음과 같다. 먼저 명령이 같으면 같은 게이트다(출처가 달라도). 다음으로 출처가 같으면 같은 게이트다. `<path>#x`와 `<path>:x`(옛 표기)는 같은 출처다.
  - reins가 읽지 못하는 출처(`.github/workflows/…`가 아닌 낯선 파일 종류)를 가진 게이트는 "적용됨"이다.
  - reins는 무엇도 "없어졌다"고 판정하지 않는다. "출처를 못 찾음"은 표시일 뿐이고, 저절로 빼지 않는다.
  - ← "refresh는 `gone`/`new` 대신 감지한 전체와 적용 상태를 보여 주고", "reins는 무엇도 "없어졌다"고 판정하지 않으며"
- S-12 **`.loctx/gates-refresh.md`.**
  - 같은 표를 `.loctx/gates-refresh.md`에 쓰고, refresh마다 덮어쓴다.
  - 머리에는 셋을 둔다: 만든 시각(ISO), `gates.yaml` 내용의 sha256 앞 16자, 그리고 "사용자가 이 목록에서 고른 것을 에이전트가 `gates.yaml`에 반영하고 따로 커밋한다. 에이전트는 reins를 부르지 않는다".
  - 대화형이 아닌 refresh에서 `--apply`가 없으면 이 파일만 쓰고 `gates.yaml`은 그대로 두며 exit 0이다.
  - 수명: 다음 refresh가 덮어쓰고, 반영한 에이전트가 지운다(`.loctx/`라 커밋되지 않음).
  - ← "같은 목록을 `.loctx/`에 파일로 남긴다", "사람이 고르고, 에이전트가 `gates.yaml`을 직접 고친다", 하지 않을 것 "에이전트가 … 직접 적용하는 길"
- S-13 **화면과 `--apply`로 바로 적용.**
  - 터미널 화면은 표를 보여 준 뒤 세 가지를 고르게 한다: "미적용" 줄은 더하기, "적용됨" 계열 줄은 빼기, "적용됨·다른 명령"은 감지한 명령으로 바꾸기. 아무것도 고르지 않으면 쓰지 않는다.
  - 대화형이 아니면 `--apply <name…>`이 같은 일을 한다. `--apply all`은 "미적용" 더하기만 한다. 빼기와 바꾸기는 이름으로만 한다(C-2).
  - 빼기는 그 게이트를 `gates`와 `order`에서 지운다. 주석, 다른 키, 남은 순서는 그대로 둔다.
  - 모르는 이름이 하나라도 있으면 아무것도 쓰지 않고 exit 1이다.
  - ← "지우는 것은 사람이 고를 때만", "터미널 화면에서 골라 바로 적용하는 길도 남긴다"
- S-14 **이름.**
  - 더하는 게이트의 이름: 루트는 스크립트 이름, 하위는 `<dir-slug>-<script>`(`:`는 `-`로), CI는 S-8의 `ci-…`.
  - `gates.yaml`의 이름과 겹치면 `-2`, `-3`을 붙인다.
  - 더한 게이트는 `order` 끝에 들어간다(지금처럼).

### 게이트 스크립트 (W-4)
- S-15 **`run-gates.sh`가 `gates.yaml`을 읽는다.**
  - 스크립트는 명령을 박아 넣지 않는다. 실행할 때 `.agents/harness/gates.yaml`을 POSIX `awk`로 읽는다.
  - 순서는 0.3.3의 `requiredGates`와 같다. `order`가 있으면 그 순서대로(`gates`에 없는 이름은 건너뜀, `order`에 없는 게이트는 돌리지 않음), 없으면 `gates`에 적힌 순서다. `optional: true`(글자 그대로 `true`)인 게이트는 건너뛴다.
  - 명령마다 지금처럼 `sh -c "<cmd>"`로 돌린다. 그래서 파이프, `&&`, `$VAR`이 든 `cmd`도 0.3.3과 같은 뜻이다.
  - 로그 형식(`== … stage: … worktree: …`, `$ 명령`, 출력, `exit:`)은 그대로다.
  - ← "`run-gates.sh`가 실행할 때 `gates.yaml`을 읽어"
- S-16 **읽는 모양(PM 판단).**
  - 스크립트가 읽는 것은 reins가 쓰는 모양이다.
    - 최상위 `gates:` 아래 공백 두 칸의 `<name>:`, 그 아래 공백 네 칸의 `cmd:`·`optional:`(다른 키는 무시)
    - 최상위 `order:` 아래 `  - <name>`
    - `cmd` 값은 따옴표 없는 글, `'…'`(`''`는 `'`), `"…"`(`\"`·`\\`만 풂)
  - 줄 끝 CR은 지운다. 주석 줄과, 따옴표 밖의 ` #` 뒤 주석은 무시한다.
  - 다음 경우에는 아무것도 돌리지 않고 `run-gates: gates.yaml line <n>: <이유>`를 stderr와 로그에 남긴 뒤 exit 2다.
    - `gates:` 안에 그 밖의 모양이 있음: 흐름 표기 `{ }`·`[ ]`, 여러 줄 값 `|`·`>`, 앵커 `&`·`*`, 탭 들여쓰기
    - 빈 `cmd`
    - 같은 이름이 둘
  - `gates.yaml`이 없거나 읽을 수 없으면 exit 2다(F-2: 지우거나 이름을 바꾸면 검사 없이 통과하는 것을 막음).
  - 필수 게이트가 0개면 로그에 `no required gate`를 적고 `exit: 0`이다.
  - awk는 POSIX 기능만 쓴다. CI의 세 OS가 서로 다른 awk(ubuntu mawk, macOS BSD awk, Windows Git Bash gawk)로 V-6을 돌린다.
  - 이유: Node가 없는 프로젝트(Go, Python)에서도 돌아야 하고, 하네스는 reins 없이 동작해야 한다.
- S-17 **생성과 경계.**
  - 스크립트는 `gates.yaml`과 상관없이 늘 같은 글이다. `install`·`update`가 쓰고 `generated.yaml`이 해시한다.
  - 지금과 달리 필수 게이트가 없어도 스크립트는 쓴다. 훅 줄 제안은 지금처럼 필수 게이트가 있을 때만 한다.
  - `config gates`는 스크립트를 다시 쓰지 않는다.
  - `gates.yaml`은 프로젝트의 파일이다. reins는 install 때 쓰고 `config gates`로 고치며, 사람과 에이전트도 고칠 수 있다(따로 커밋). `generated.yaml`에 없고 drift가 아니다(지금도 없음 — 설계에 명시).
  - 이 저장소 AGENTS.md 금지선의 "Files reins writes (`.agents/harness/` …)" 문장에 `gates.yaml`이 예외라고 적는다(프로젝트 절의 글; PM 판단 ②).
  - ← "`gates.yaml`이 하나뿐인 진짜 설정이 된다", 제약 "이미 있는 `gates.yaml`을 reins가 저절로 바꾸지 않는다"
- S-18 **이전.** 0.3.3 이하의 스크립트(명령을 박은 것)는 `update`가 새 글로 바꾼다. 해시가 `generated.yaml`과 맞으면 그냥 바꾸고, 다르면(손으로 고침) 다른 생성 파일처럼 묻는다.

### husky 훅 (W-5)
- S-19 **이미 있는 줄.**
  - husky 파일에 `# reins:begin hooks` 블록이 없어도 그 단계는 이미 걸린 것으로 본다. 조건은 `#`로 시작하지 않는 줄 가운데, 앞뒤 공백을 걷은 글이 `sh <경로> <stage>`인 줄이 있는 것이다. `<경로>`는 `.agents/harness/run-gates.sh`, `./.agents/harness/run-gates.sh`, 또는 그것을 `'`·`"`로 감싼 것이다.
  - 그러면 제안하지 않고, `--hooks`나 확인을 받아도 블록을 더하지 않는다.
  - 다른 단계의 줄(`pre-commit` 파일에 `… pre-push`)과 주석 처리된 줄(`# sh …`)은 걸린 것으로 치지 않는다.
  - ← "husky 훅 감지가 이미 있는 `run-gates.sh` 줄을 알아보고, 다시 제안하거나 중복으로 넣지 않는다"

### 스킬 문장 (W-6)
- S-20~S-25 아래 표의 구절을 해당 스킬 소스(`skills/<name>/SKILL.md`)와 템플릿에 넣는다. V-9는 "구절" 열을 글자 그대로 찾는다.

  | S | H | 파일 · 위치 | 구절 |
  |---|---|---|---|
  | S-20 | H-1 | `skills/intent` ②의 1, `skills/implement` ②의 1, AGENTS.md 위임 블록 첫 줄(`harness/templates/agents-md-blocks.md`) | `open it before anything else and use its table` |
  | S-21 | H-2 | `skills/review` ② | `git diff --stat <base>..<head>` 와 `the files of the diff it received match that list` |
  | S-22 | H-3 | ③ Delegation에 "another model"을 부르는 단락이 있는 모든 스킬: `intent`, `spec`, `review`, `test`, `merge`, `audit`, `release`, `retro`, `implement`, `roadmap`, `onboard` | `keep the request sent to another model and its final answer in .loctx/reports/<version>/ as they came` |
  | S-23 | H-5 | `skills/review` ②, `skills/test` ② | `compare the two language editions again after the last change` |
  | S-24 | H-7 | `skills/spec` ②의 5 | `read both roadmaps and the review records of the version being revised` |
  | S-25 | H-10 | `skills/audit` 1차 ⑤ | `rate each violation's severity` 와 `opinions given without seeing each other` |

  ← H-1(F-3: intent의 "`implement`·흐름 시작에서"), H-2, H-3, H-5, H-7, H-10

### 작업 브랜치의 강제 푸시 (W-8)
- S-26 **deny: 한 형태만 연다.**
  - 생성되는 `.claude/settings.json`의 deny에서 reins의 `Bash(git push --force-with-lease *)`를 뺀다.
  - 허용되는 형태는 `git push --force-with-lease origin <작업 브랜치>` 하나다. 나머지는 아래 규칙으로 막는다(`<d>`는 기본 브랜치).

    | 막는 것 | 규칙 |
    |---|---|
    | 브랜치를 적지 않음 | `Bash(git push --force-with-lease)`, `Bash(git push --force-with-lease origin)` |
    | `=` 형태 | `Bash(git push --force-with-lease=*)` |
    | 플래그가 첫 인자가 아님 | `Bash(git push * --force-with-lease*)` |
    | 기본 브랜치 | `Bash(git push --force-with-lease * <d>)`, `Bash(git push --force-with-lease * <d> *)`, `Bash(git push --force-with-lease *:<d>)`, `Bash(git push --force-with-lease *:<d> *)`, `Bash(git push --force-with-lease *refs/heads/<d>*)` |
    | 태그·전체 | `Bash(git push --force-with-lease *--tags*)`, `Bash(git push --force-with-lease *refs/tags/*)`, `Bash(git push --force-with-lease *--all*)`, `Bash(git push --force-with-lease *--mirror*)` |
    | `+` refspec | `Bash(git push * +*)`, `Bash(git push *:+*)` |

  - `--force`·`-f`·`--no-verify`·`commit -n`·`commit --no-verify`는 그대로 막는다.
  - `<d>`를 정하는 순서: `git symbolic-ref --short refs/remotes/origin/HEAD`의 결과에서 `origin/`을 뗀 것 → `git config init.defaultBranch` → 둘 다 없으면(git 저장소가 아니어도) `main`과 `master` 둘 다.
  - `fix/remain`처럼 `<d>`로 끝나는 브랜치는 막지 않는다(규칙이 공백이나 `:` 뒤의 `<d>`만 봄).
  - 사용자가 직접 넣은 같은 글의 규칙(`owned:` 밖)은 그대로 남는다(지금의 병합 규칙).
  - 한계(우려 2): 명령 문자열의 글롭이라 `git -C . push …`, 변수, 별칭, 스크립트 안의 push는 못 막는다.
  - ← H2 "작업 브랜치에 한해 … 허용하고, 기본 브랜치와 태그에는 계속 막는다"
- S-27 **글.**
  - `merge` 스킬 ⑥: "Never force-push"를 "Never force-push the default branch or a tag, or rewrite the default branch. A work branch behind the default branch is rebased and pushed with `git push --force-with-lease origin <branch>`, naming the branch; where that is not possible, merge the default branch into it (a rebase merge drops that merge commit)"로 바꾼다.
  - 정지 블록: "an irreversible action (force push, …)"를 "force push to the default branch or a tag, …"로 좁힌다.
  - `release`: "force-pushing"도 같은 범위로 좁힌다.
  - V-9는 구절 `naming the branch`(merge)와 `force push to the default branch or a tag`(블록)를 찾는다.
  - ← H2

### 문서 (W-7, 그리고 각 W)
- S-28 **설계서는 그 W의 커밋에서 먼저 고친다(F-1, AGENTS.md "same commit, before the code").**
  - W-1은 §9 update, W-2는 §5 `gates.yaml`, W-3은 §9 refresh, W-4는 §6 게이트 스크립트, W-5는 §6 훅, W-8은 §3-2·§6 deny의 양판을 각자 커밋에 싣는다.
  - W-7에 남는 것: `CHANGELOG.md`, `harness/CHANGELOG.md`(0.3.4 절에 "Already installed repositories: run `reins config gates --refresh` once after `reins update`" 줄), `docs/ROADMAP.md`·`.ko.md`의 0.3.4 절, 이 저장소 AGENTS.md 금지선의 `gates.yaml` 예외.
  - ← "설계서 양판, … 로드맵 양판이 같은 말을 한다"

## 설계
- **감지.** `discoverGates`는 `detectCandidates(root): Candidate[]`를 바탕으로 한다. `Candidate`는 `{ name, cmd, from, dir, reasons: string[], status: 'pick' | 'offer' | 'covered' | 'excluded', optional? }`다. 루트, 하위 디렉터리, 워크스페이스, CI를 한 목록에 담는다. 지금의 `GateProposal`(`gates`/`excluded`/`proposals`)은 이 목록에서 만들어 install과 기존 호출부가 그대로 쓴다(W-3을 되돌려도 refresh가 돈다). 워크스페이스·CI 읽기는 `detect.ts`가 커지므로 `cli/src/lib/detect-workspaces.ts`, `detect-ci.ts`로 나눈다. YAML은 이미 쓰는 `yaml` 패키지로 읽는다(배포되는 CLI 안에서; 게이트 스크립트와는 별개).
- **refresh.** `diffGates`는 `gateStatus(root, file, candidates): StatusRow[]`가 되어 S-11의 행을 낸다. 표 출력은 `formatGateStatus`다. `configureGates`의 `--apply`는 행 종류(add/remove/replace)에 맞춘다. 주석·다른 키·순서 보존은 지금 쓰는 방식 그대로다.
- **게이트 스크립트.** `renderGateScript()`는 인자 없이 고정 글을 낸다. awk가 명령을 한 줄에 하나씩 내보내고, 셸이 `while IFS= read -r cmd; do run "$cmd"; done`으로 돌린다. 명령 안의 줄바꿈은 S-16에서 이미 거부한다. awk가 실패하면 그 코드와 메시지를 그대로 남기고 exit 2다.
- **deny.** `generate.ts`의 규칙 목록이 기본 브랜치 이름 목록을 받는다(install·update가 git으로 정함). `owned:`에 옛 규칙이 있으므로 `update`는 빠진 `--force-with-lease *`를 지우고 새 규칙을 더한다.
- **deny 테스트용 매처.** `cli/test/helpers/claude-bash-rule.ts`에 Claude Code Bash 규칙을 흉내 낸 매처를 둔다: `Bash(<pattern>)`에서 `*`는 공백과 `/`를 포함한 임의 문자열이고, 나머지는 글자 그대로이며, 명령 전체가 맞아야 한다. `cli/src/lib/glob.ts`(경로 글롭, `*`가 `/`를 넘지 못함)는 쓰지 않는다. 이것은 흉내라서 Claude Code 실제 매칭의 증거가 아니다(우려 2).
- **스킬.** 소스는 `skills/`다. 이 저장소의 `.agents/skills/`·`.claude/skills/`·`.claude/settings.json`은 stable 뒤 자기 업데이트로만 바뀐다(R-2).

## 작업 단위
- [x] W-1 `update` 변경 목록의 버전 제목(S-1~S-3): `update.ts`, `update.test.ts`, 설계 양판 §9 — `3ab4dd4`
- [x] W-5 husky 감지(S-19): `install.ts`, `install.test.ts`, 설계 양판 §6 훅 — `3fb6156`
- [x] W-8 강제 푸시(S-26·S-27): `generate.ts`, `install.ts`·`update.ts`(기본 브랜치 결정), `skills/merge`·`release`, `harness/templates/agents-md-blocks.md`, `generate.test.ts`·`vendor-write.test.ts`, 테스트 매처, 설계 양판 §3-2·§6 — `7653957`
- [x] W-6 스킬 문장(S-20~S-25): S-20~S-25 표의 파일, `skills.test.ts` — `6e6cab7`
- [x] W-4 게이트 스크립트(S-15~S-18): `gate-script.ts`, `install.ts`·`update.ts`·`configure.ts`의 스크립트 쓰기, `gate-script.test.ts`, 설계 양판 §6 — `422bdd9`
- [x] W-2 게이트 감지(S-4~S-10): `detect.ts`, `detect-workspaces.ts`, `detect-ci.ts`, `install.ts`의 후보 화면, fixture 네 곳(`cli/test/fixtures/gates/{croffle,allot,pipit-bot,pipit-music}/` — 부록 A의 파일만), `gate-proposals.test.ts`, 설계 양판 §5 — `5064da0`
- [x] W-3 refresh(S-11~S-14): `gate-refresh.ts`, `config-gates.ts`, `configure.ts`, `gate-refresh.test.ts`·`config.test.ts`·`install-update-tui.test.ts`, 설계 양판 §9 — `8071822`
- [x] W-7 문서(S-28): 두 CHANGELOG, 로드맵 양판, 이 저장소 AGENTS.md 프로젝트 절 — `e53bea8`

순서는 위와 같다. 작고 서로 묶이지 않은 것을 먼저 하고, W-3은 W-2의 후보 목록에 기대므로 뒤에 둔다. 각 단위는 따로 되돌릴 수 있다. W-6과 W-8은 같은 템플릿을 고치지만 커밋이 따로다.

## 검증 기준
판정: 기대값과 다르거나, 판단할 수 없거나, 출력이 비거나 의심스러우면 fail이다. 모든 원 출력은 `.loctx/reports/0.3.4/`에 남긴다.

- V-1 **고치기 전 실패.** 고치기 전 코드(`master`)에서 다음 넷을 재현하고 `before-<n>.log`로 남긴다.
  1. update 출력에 버전 제목이 없음
  2. croffle fixture(부록 A의 `gates.yaml` B)에서 refresh가 `gone`을 냄
  3. pipit-bot fixture에서 `lint:check`가 `check` 이름으로 들어감
  4. `.husky/pre-commit`에 블록 없는 같은 줄이 있을 때 `--hooks`가 블록을 더함

  넷 가운데 재현되지 않는 것이 있으면, 그 단위의 문제를 다시 확인하기 전에는 진행하지 않는다.
- V-2 **update.** 0.3.1~0.3.3 절을 담은 CHANGELOG로 `from=0.3.0-rc.1, to=0.3.3`일 때:
  - 사람이 읽는 출력은 `  0.3.3` → `  0.3.2` → `  0.3.1` 순서의 제목이고, 항목은 `    · `로 시작하며, `0.3.0` 제목이 없다.
  - `    · Stable 2026-11-15 …` 줄이 `  0.3.2`와 `  0.3.1` 제목 사이에 있다.
  - `--json`에 `changes`(평평한 문자열 배열, 0.3.3과 같은 내용)와 `changesByVersion`(`[{version:'0.3.3',items:[…]},…]`)이 둘 다 있다.
  - 항목 없는 버전 절은 빠진다. `from=to`면 둘 다 빈 배열이다.
- V-3 **감지 표 테스트**(`gate-proposals.test.ts`). 아래 각 행을 하나의 테스트 행으로 둔다.
  - S-4:
    - 후보: `lint:check`, `format:check`, `check:migrations`, `test:unit`, `build:web`, `type-check`, `ci`
    - 후보 아님: `contest`, `latest`, `prebuild`, `rebuild`, `pretest`, `postbuild`
    - 빠짐(근거 글과 함께): `test:watch`, `dev`, `start:dev`, `prepare`, `postinstall`, `build:win`, `build:appimage`, `lint`=`oxlint --fix .`
  - S-5:
    - `lint:check`가 묶음이 아님. 0.3.3 테스트에서 `lint:check`를 묶음으로 쓰던 기대를 바꾸고, 그 줄에 `// 024 S-5: intended change` 주석을 단다.
    - `check`가 `pnpm test:unit`을 부르면 `test:unit`은 covered이고 `test`는 covered가 아님.
  - S-6: Makefile 의존 목록, `$(MAKE) x` 본문, Makefile 본문의 `go test`, build 본문이 typecheck 본문을 담음.
  - S-7:
    - 표의 형태마다 한 행: pnpm `-r`, `--filter <name>`, `--filter ./dir`, `-F`, npm `--workspaces`, `-ws`, `-w <name>`, yarn 1 `workspaces run`, `workspace <name>`, berry `foreach -A run`, berry `foreach --include`(분명하지 않음 → offer), bun `--filter`, turbo, nx, lerna
    - 그리고: `@scope/name` 이름, `!` 글롭, `apps/*`·`packages/**` 펼치기, 자기 lock을 가진 하위 디렉터리(워크스페이스 밖), 표 밖의 플래그(분명하지 않음)
  - S-8: `pull_request`가 없는 워크플로는 무시, `${{`, `run: |`, compound, 설치 명령, `working-directory` 바꾸기, 바꿀 수 없는 도구, 다른 후보와 같은 명령(근거로 흡수), `ci-…` 이름.
  - S-9: 위 행마다 근거 글을 글자 그대로 단언한다.
  - S-10: 미리 고름의 상태, 대화형이 아닌 install이 미리 고른 것만 쓰는 것.
- V-4 **기준 프로젝트 fixture.** 부록 A의 네 fixture마다 install의 미리 고름(`status`)과 refresh 표(상태, 근거 글)가 부록 B의 기대 표와 행 단위로 같다(`toEqual`). 그리고 fixture 디렉터리의 파일 목록이 부록 A의 목록과 정확히 같고, 각 파일이 부록 A에 적은 키만 담는다(우려 4).
- V-5 **refresh 동작**(`gate-refresh.test.ts`, `config.test.ts`, `install-update-tui.test.ts`).
  - S-11의 여섯 상태가 각각 한 번 이상 나온다. "출처를 못 찾음"은 package.json·Makefile·go.mod·워크플로 각각에 대해 나온다. `Makefile#x`=`Makefile:x` 짝짓기, 출처가 달라도 명령이 같은 짝짓기, 낯선 출처는 "적용됨"이 되는 것도 각각 확인한다.
  - 아무것도 고르지 않으면 `gates.yaml`의 바이트가 그대로다.
  - `--apply all`은 "미적용" 더하기만 한다. 빼기와 바꾸기를 하지 않은 것을 바이트로 확인한다.
  - 이름으로 고른 빼기는 `gates`와 `order`에서 그 이름만 지우고, 주석·다른 키·남은 순서를 그대로 둔다.
  - 이름 충돌 시 `-2`, `-3`을 붙인다.
  - 모르는 이름이 하나라도 있으면 아무것도 쓰지 않고 exit 1이다.
  - 대화형이 아니고 `--apply`가 없으면 `.loctx/gates-refresh.md`만 쓰고 exit 0이다.
  - `.loctx/gates-refresh.md`: 머리의 시각과 해시, 에이전트 문장, 화면과 같은 행을 담는다. 두 번 돌리면 덮어쓴다.
  - TUI에서 더하기, 빼기, 바꾸기를 각각 한 번 골라 적용한다.
- V-6 **게이트 스크립트 sh 테스트**(`gate-script.test.ts`, 실제 `sh`와 그 OS의 `awk`).
  - order 순서, order 없음, order에 없는 게이트는 안 돎, order의 모르는 이름은 건너뜀
  - `optional: true`는 건너뛰고, `optional: false`·`optional: "true"`는 돎
  - 따옴표 없음·`'…'`(`''` 포함)·`"…"`(`\"` 포함) 값
  - `cmd`에 `|`·`&&`·`$VAR`·따옴표 안의 `#`
  - 줄 끝 주석, CRLF
  - 첫 실패에서 멈추고 그 코드로 끝남
  - exit 2 사례: 흐름 표기, 여러 줄 값, 탭, 빈 `cmd`, 중복 이름, `gates.yaml` 없음. 각 사례에서 부작용 파일을 만드는 명령이 돌지 않았음을 확인하고, 메시지의 줄 번호를 단언한다.
  - 필수 게이트 0개면 `no required gate`와 `exit: 0`
  - 로그 형식(머리, `$ 명령`, `exit:`)이 0.3.3 테스트의 기대와 같다.
  - `gates.yaml`만 고쳐도 다음 실행이 새 명령을 돈다.
  - CI의 세 OS 모두에서 통과한다(V-11).
- V-7 **husky**(`install.test.ts`).
  - 같은 줄이 블록 없이 있으면 제안이 없고, `--hooks`로도 파일 바이트가 그대로다. 줄의 형태는 경로 그대로, `./` 접두, `'` 감쌈, `"` 감쌈, 앞뒤 공백 각각을 확인한다.
  - `# sh …` 주석 줄과 다른 단계의 줄은 걸린 것으로 치지 않는다.
  - 블록이 있는 경우의 0.3.3 테스트는 그대로 통과한다.
- V-8 **deny**(`generate.test.ts`, `vendor-write.test.ts`, 테스트 매처).
  - 생성된 deny에 S-26 표의 규칙이 모두 있고 `Bash(git push --force-with-lease *)`가 없다.
  - 기본 브랜치 결정: origin/HEAD가 `origin/master`면 규칙에 `master`가 들어가고 `origin/master`는 들어가지 않는다. init.defaultBranch가 있으면 그 이름이다. 둘 다 없거나 git 저장소가 아니면 `main`과 `master` 둘 다다.
  - 0.3.3 설치를 `update`하면 옛 규칙이 지워진다. 사용자가 직접 넣은 같은 글의 규칙과 다른 사용자 항목은 남는다.
  - 매칭 표(`<d>`=master). 허용:
    - `git push --force-with-lease origin fix/0.3.4`
    - `git push --force-with-lease origin fix/remain`
    - `git push --force-with-lease origin ci-master2`
  - 매칭 표. 막힘:
    - `git push --force-with-lease`
    - `git push --force-with-lease origin`
    - `git push --force-with-lease origin master`
    - `git push --force-with-lease origin HEAD:master`
    - `git push --force-with-lease origin feature/x:master`
    - `git push --force-with-lease origin refs/heads/master`
    - `git push --force-with-lease origin master --no-verify`
    - `git push --force-with-lease=master origin master`
    - `git push origin master --force-with-lease`
    - `git push origin fix/x --force-with-lease`
    - `git push --force-with-lease --tags`
    - `git push --force-with-lease origin refs/tags/v1`
    - `git push --force-with-lease --all`
    - `git push origin +master`
    - `git push origin HEAD:+x`
    - `git push --force origin fix/x`
    - `git push -f origin fix/x`
- V-9 **스킬 구절**(`skills.test.ts`). S-20~S-25 표와 S-27의 구절이 표에 적은 파일에 글자 그대로 있다. S-22는 표에 적은 열한 스킬 모두에 있다.
- V-10 **양판 대조.** 설계·로드맵의 국문·영문을 마지막 변경 뒤에 pl/doc-reviewer가 대조한다. 그 답을 `.loctx/reports/0.3.4/twin-<n>.md`로 남긴다. 판정은 "내용이 다른 문장 없음"일 때 pass다.
- V-11 **`pnpm check`와 CI.** 로컬 `pnpm check`가 exit 0이고(로그 경로를 남김), PR의 CI 전부(세 OS × Node 22·24, label, trufflehog)가 통과한다.
- V-12 **문서 구절.** `harness/CHANGELOG.md` 0.3.4 절에 "run `reins config gates --refresh` once after `reins update`"가 있다. 이 저장소 AGENTS.md 금지선 줄에 `gates.yaml`이 있다(grep).
- V-13 **이전**(S-17·S-18, `update.test.ts`).
  - 0.3.3이 쓴 스크립트(해시가 맞음)를 `update`가 새 글로 바꾼다. 손으로 고친 스크립트는 묻고, 대화형이 아니면 바꾸지 않고 exit 1이다.
  - 필수 게이트가 없는 설치에도 스크립트가 쓰인다.
  - `config gates --refresh --apply …`는 스크립트를 다시 쓰지 않는다(바이트 그대로).
  - `gates.yaml`은 `generated.yaml`의 `files:`에 없다.

### 릴리스 뒤 검증 (머지 전 판정 대상 아님 — `release` 단계에서 판정)
- R-1 **rc 배포본 smoke.** 배포된 `@bluenyang/reins@0.3.4-rc.N`으로, `pnpm check` 묶음을 가진 임시 git 저장소에서 다음을 확인한다. 각 출력을 `.loctx/reports/0.3.4/smoke-*.log`로 남긴다.
  - `reins install --mode manual`이 exit 0이다.
  - `reins config gates --refresh`(대화형 아님)가 `.loctx/gates-refresh.md`를 만든다.
  - `sh .agents/harness/run-gates.sh manual`이 로그에 `exit: 0`을 남긴다.
  - `gates.yaml`의 `cmd`를 `false`로 바꾸면 다음 실행이 `exit: 1`이다.
- R-2 **stable 뒤 자기 업데이트.** 이 저장소에서 `reins update` 뒤 다음을 확인한다.
  - `.claude/settings.json`에 `Bash(git push --force-with-lease *)`가 없고, S-26의 규칙이 있다.
  - `run-gates.sh`가 새 글이다.
  - 스킬에 S-20~S-27의 구절이 있다.
  - `pnpm check`가 exit 0이다.

## 부록 A. fixture (모양만)
각 fixture에는 아래 파일만 둔다. package.json에는 `name`·`scripts`·`workspaces`만, 워크플로에는 `on:`과 step의 `name`·`run`·`working-directory`만 둔다. 다른 내용(의존성, 주석, 경로 밖 파일)은 넣지 않는다.
- **croffle**
  - 파일: `package.json`(scripts 18개, 기준 프로젝트 그대로), `pnpm-lock.yaml`(빈 파일), `pnpm-workspace.yaml`(`packages: [apps/*, packages/*]`), `apps/desktop/package.json`, `packages/cli/package.json`, `packages/types/package.json`, `apps/server/Makefile`(대상 이름과 의존, `test`·`vet` 본문만), `apps/server/go.mod`(module 한 줄), `apps/server/web/package.json`·`pnpm-lock.yaml`·`pnpm-workspace.yaml`, `.github/workflows/ci.yml`(`on: [push, pull_request]`, run 줄 그대로), `.github/workflows/release.yml`(`on: workflow_dispatch`, `run: pnpm build` 하나)
  - `gates.yaml` 두 가지:
    - A: 기준 프로젝트 그대로. 8개 모두 `from` 없음.
    - B: 0.3.3 install 모양. `typecheck`·`lint`·`build`는 `from: package.json#scripts.<x>`, `format`은 `from: package.json#scripts.format:check`, `server`는 옛 표기 `from: apps/server/Makefile#check`, `test`·`build-cli`·`server-web`은 `from` 없음.
- **allot**: `package.json`(scripts 그대로), `pnpm-lock.yaml`, `.github/workflows/release.yml`(`on: workflow_dispatch`). `gates.yaml`은 기준 프로젝트 그대로(4개, `from` 있음).
- **pipit-bot**: `package.json`(scripts 그대로, `workspaces: [dashboard]`), `yarn.lock`, `dashboard/package.json`, `.github/workflows/abstraction.yml`(`on: push`). `gates.yaml` 없음(install만 봄).
- **pipit-music**: `package.json`, `yarn.lock`, `.github/workflows/ci.yml`(`on: [push, pull_request]`, run 줄 다섯 개 그대로). `gates.yaml` 없음.

## 부록 B. 기대 표
열은 이름 | install 상태 | refresh 상태 | 근거 글(요지 — 테스트에는 S-9의 글 그대로)이다.

- **croffle, `gates.yaml` B**

  | 이름 | install | refresh | 근거 |
  |---|---|---|---|
  | typecheck | pick | 적용됨 | — |
  | lint | pick | 적용됨 | — |
  | format(`pnpm format:check`) | pick(`format:check`) | 적용됨 | — |
  | build | pick | 적용됨 | CI에도 있음 (ci.yml) |
  | server(`make -C apps/server check`) | offer | 적용됨 | 옛 표기 `#` = `:` |
  | test(`pnpm -r test`) | — | 적용됨·직접 적은 것 | — |
  | build-cli | — | 적용됨·직접 적은 것 | CI에도 있음 (ci.yml) |
  | server-web(`pnpm --dir apps/server/web build`) | offer | 적용됨·직접 적은 것 | CI에도 있음 (ci.yml) |
  | apps-desktop-typecheck · packages-cli-typecheck · packages-types-typecheck | covered | 미적용·이미 도는 것 | typecheck가 이미 돎 (`pnpm -r --parallel run typecheck`) |
  | apps-desktop-test | covered | 미적용·이미 도는 것 | test가 이미 돎 (`pnpm -r test`) |
  | apps-desktop-build | covered | 미적용·이미 도는 것 | build가 이미 돎 (`pnpm --filter @croffledev/desktop build`) |
  | packages-cli-build | covered | 미적용·이미 도는 것 | build-cli가 이미 돎 |
  | apps-server-test · apps-server-vet | covered | 미적용·이미 도는 것 | Makefile check이 의존 |
  | apps-server-test-go · apps-server-vet-go | covered | 미적용·이미 도는 것 | Makefile test·vet 본문이 담음 |
  | apps-server-build | offer | 미적용 | — |
  | apps-server-web-typecheck | covered | 미적용·이미 도는 것 | 본문이 typecheck를 담음 (build) · 워크스페이스 밖 |
  | typecheck:desktop · build:unpack | offer | 미적용 | — |
  | ci-go-build(`go -C apps/server build ./...`) | offer | 미적용 | CI에도 있음 (ci.yml) |
  | lint:fix · format · build:win · build:mac · build:linux · build:appimage · dev · start · prepare | excluded | (표에 없음) | 파일을 고침 / 플랫폼 패키징 / 끝나지 않음 / 설치 단계 |

  - "출처를 못 찾음"인 행은 없다. 이 fixture에는 `gone`도 없다(0.3.3에서 5개가 나오던 결함).
  - CI의 `go vet ./...`, `go test ./...`(apps/server)는 각각 apps-server-vet-go·apps-server-test-go의 근거 "CI에도 있음"이 된다. `pnpm --filter @croffledev/croffle-cli build`는 build-cli의 근거가 되고, `pnpm build`(apps/server/web)는 server-web의 근거가 된다.
  - `gates.yaml` A는 같은 표에서 8개 게이트 모두 "적용됨·직접 적은 것"이 되고, 나머지 행은 같다.
- **allot**: `typecheck`·`build`·`test:unit`(이름 test)·`e2e`(optional)는 pick이고 refresh에서 적용됨이다. `check:migrations`·`check:logs`·`build:server`는 offer이고 refresh에서 미적용이다. `dev`·`dev:api`·`preview`·`prepare`는 excluded다. CI 후보는 없다(release.yml에 `pull_request` 없음).
- **pipit-bot**: `lint:check`·`format:check`·`typecheck`·`build`는 pick이다. `check:abstraction`·`dashboard-build`(`yarn --cwd dashboard build`, 루트 `dashboard:build`=`yarn workspace dashboard build`가 이미 돎 → covered)를 본다. `dashboard:build`는 offer다. `lint`=`oxlint --fix .`·`format`·`watch`·`watch:start`·`dev`·`start`·`start:dev`·`dashboard:dev`·`prepare`·`postinstall`은 excluded다. 묶음 `check`는 없다.
- **pipit-music**: `lint:check`·`format:check`·`typecheck`·`build`는 pick이고, 셋은 근거 "CI에도 있음 (ci.yml)"을 단다(`typecheck`, `lint:check`, `format:check`). `corepack enable`·`yarn install --immutable`은 후보가 아니다. `lint`·`format`·`dev`·`start`·`start:dev`는 excluded다.

## 조정 기록
<!-- - A-n (YYYY-MM-DD, W-n) 무엇을 · 왜 · 커밋 -->
- A-1 (2026-11-19, W-2) "끝나지 않는 것"에서 본문의 ` -w`를 뺐다(`--watch`와 이름·본문 낱말만 봄) · npm의 `-w`는 워크스페이스 옵션이라 `npm run build -w pkg`를 잘못 뺄 수 있음 · `5064da0`
- A-2 (2026-11-19, W-2·W-3) 근거(S-9)와 상태(S-11)의 글을 CLI의 다른 출력처럼 영어로 했다: `also in CI (<file>)`, `<x> already runs it (<cmd>)`, `<x> already calls it`, `Makefile <t> depends on it`, `the body of <x> holds it`, `rewrites files`, `never ends`, `install step`, `platform packaging`, `outside the workspace (<file>)`, `unclear (<why>)` / `applied`, `applied, written by hand`, `applied, source not found`, `applied, another command`, `not applied`, `not applied, already runs` · CLI 출력과 `--json`이 영어 · `5064da0`, `8071822`
- A-3 (2026-11-19, W-2) 게이트 이름은 스크립트 이름의 `:`를 `-`로 바꾼다(`lint-check`, `format-check`; S-5의 "이름 `lint:check`"를 바꿈) · 검사 스크립트(S-16)가 `:` 없는 이름만 읽음 · `5064da0`
- A-4 (2026-11-19, W-2) 부록 B의 행을 구현 규칙에 맞춰 고쳤다(우려 5): croffle `apps-desktop-test`는 install에서 offer이고 refresh에서 게이트 `pnpm -r test`가 덮어 "already runs"; `packages-cli-build`는 루트 `release` 본문이 덮음; `apps-desktop-build-unpack`(covered)과 `ci-pnpm-croffledev-croffle-cli-build`(install에서 offer, refresh에서 build-cli와 명령이 같아 짝지어짐)가 더 있음; pipit-bot의 루트 `dashboard:build`는 `dashboard-build`, 워크스페이스 쪽은 `dashboard-build-2`; 하위 디렉터리의 뺀 스크립트는 목록에 내지 않음(루트만). 기대 표는 `cli/test/gate-detect.test.ts`·`gate-refresh.test.ts`에 있음 · `5064da0`, `8071822`
- A-5 (2026-11-19, W-2) Makefile에서 다른 대상을 "이미 도는 것"으로 만드는 것은 후보 대상(`check`·`lint`·`test`·`build`·`vet`·`verify`)뿐이다 · croffle `all: check build`가 check와 build를 덮지 않게 · `5064da0`
- A-6 (2026-11-19, W-2) 워크스페이스 명령의 따옴표로 감싼 글롭(`bun --filter "*"`)은 가려진 낱말이라 분명하지 않음으로 본다 · 0.3.3의 따옴표 규칙(A-11 of 023)과 같게 · `5064da0`
- A-7 (2026-11-19, W-3) 짝짓기에 셋째 단계를 더했다: 출처가 있는 게이트는 이름이 같아도 짝짓는다 · `verify`를 가리키게 된 루트 `check`가 "applied, another command"로 보이게(021의 동작) · `8071822`
- A-8 (2026-11-19, W-3) `--apply`에 `remove:<name>`을 더했고, 화면은 "another command" 줄에 replace와 remove를 함께 내며 둘 다 고르면 remove가 이긴다 · 이름 하나로는 바꾸기와 빼기를 다 고를 수 없어서 · `8071822`
- A-9 (2026-11-19, W-3) README 양판의 refresh 설명도 고쳤다 · 0.3.3 테스트(021 S-26)가 README와 설계의 refresh 설명을 함께 봄 · `8071822`
- A-10 (2026-11-19, W-4) install과 `config gates`가 `gates.yaml`을 `lineWidth: 0`으로 쓴다 · yaml이 긴 명령을 여러 줄로 접으면 검사 스크립트가 읽지 못함 · `422bdd9`
- A-11 (2026-11-19, W-4) 검사 스크립트는 명령 목록을 fd 3으로 읽는다 · 게이트가 훅의 stdin(pre-push의 ref 목록)을 그대로 받게 · `422bdd9`
- A-12 (2026-11-19, W-2·W-3) 문서 대조(pl/doc-reviewer, `.loctx/reports/0.3.4/twin-1.md`)의 보정 3건: 플랫폼 낱말에 `windows`·`macos`, `remove:<name>`은 "어느 상태의 게이트든", 없는 이름이면 `gates.yaml`만 그대로(목록은 씀) · 코드와 문서가 어긋남 · `4a26b96`
- A-13 (2026-11-19, W-8·W-4·W-2·W-3) 코드 리뷰 1(`review-1-answer.md`)의 7건: 다른 인자 뒤의 `--no-verify`·`commit -n`도 막음, 브랜치 없이 `upstream`만 적은 푸시도 막음, refresh 짝짓기를 모든 게이트에 대해 명령부터(같은 출처는 이름·스크립트로 가림), pnpm `-r`·npm `--workspaces`는 필터가 좁힘, 공백·식이 든 `working-directory`는 뺌, 게이트가 없을 때의 `gates: {}`·`order: []`를 읽음, `gates:` 절이 없는 파일은 exit 2 · 실패 입력이 재현됨 · `65838cd`, `e0e7922`, `cba1ff5`, `0c2bdd6`. 다시 리뷰(`review-2-answer.md`): 6건 고쳐짐, 1건 부분(아래 우려 2), 새 결함 1건(`order: []`가 order 없음으로 읽힘)
- A-14 (2026-11-19, W-4) 리뷰 2의 새 결함: 비어 있어도 `order`가 있으면 그것을 따름(`order: []`는 아무것도 돌리지 않음) · `7236466`. 다시 리뷰(`review-3-answer.md`): 고쳐짐, 새 결함 없음
- A-15 (2026-11-19, W-2) fixture 목록 테스트가 Windows의 역슬래시 경로를 `/`로 바꿔 비교한다 · PR #51의 Windows CI에서만 실패 · `689c29f`. 리뷰(`review-4-answer.md`): 맞음, 가리는 것 없음

## 우려
1. **awk로 YAML 읽기.** 사람이나 에이전트가 `gates.yaml`을 흐름 표기 등으로 고치면 스크립트가 exit 2로 멈춘다. 검사가 조용히 빠지지 않고 멈추는 쪽이라 안전하지만 불편할 수 있다. 메시지에 줄 번호와 이유를 적어 고치기 쉽게 한다.
2. **deny 패턴의 한계.** 명령 문자열의 글롭이라 `git -C . push …`, 변수, 별칭, 스크립트 안의 push는 못 막는다. 코드 리뷰(리뷰 1의 2번, 높음; 리뷰 2에서 "부분")가 짚은 대로, `origin`·`upstream`이 아닌 원격으로 브랜치 없이 하는 푸시(`git push --force-with-lease backup`)도 지나간다 — 원격 이름은 글롭으로 일반화할 수 없다. knowledge `permission-glob-no-negation`대로 부정 패턴이 없으므로, "한 형태만 열기"를 긍정 패턴의 나열로 한다. 테스트 매처는 Claude Code의 매칭을 흉내 낸 것이라 실제 매칭의 증거가 아니다. R-2 뒤 이 세션에서 막혀야 할 명령 하나(`git push --force-with-lease origin master`의 dry-run)가 실제로 거부되는지 본다. 정확한 차단은 0.4 에이전트 훅의 자리다.
3. **후보가 늘어남.** 패턴으로 넓히면 화면의 후보가 많아진다. 미리 고르는 범위는 지금과 비슷하게 두고(S-10), 나머지는 고르지 않은 채 근거와 함께 보여 준다.
4. **기준 프로젝트의 모양.** fixture에는 부록 A의 파일과 키만 옮긴다. 공개 저장소에 들어가므로, 넣기 전에 fixture 목록을 보고에 적는다.
5. **부록 B의 기대는 PM이 기준 프로젝트를 읽고 쓴 것이다.** 구현 중 규칙과 어긋나는 행이 나오면, 규칙(S-n)을 바꾸지 않고 행을 고친다. 그때 조정 기록(A-n)에 이유를 남긴다. 규칙을 바꿔야 하면 spec 개정이다.

## 범위 밖
- 에이전트가 `reins config gates --refresh --apply`를 부르는 길.
- H-4·H-6, 0.4의 일(에이전트 훅, 루프, 회고, 역할별 knowledge, D-5).
- GitHub 밖의 CI(GitLab CI, CircleCI 등) 읽기, `run: |` 여러 줄 블록 풀기.
- 감싼 호출(`pnpm exec`, `npx`) 풀기 — 0.3.3과 같음.
