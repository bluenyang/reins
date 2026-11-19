---
intent: "024"
status: draft
approvals: []
summary_for_user: |
  W-1 `update` 변경 목록을 버전 제목(`0.3.3` 등) 아래 묶습니다. `--json`은 기존 `changes`를 두고 `changesByVersion`을 더합니다.
  W-2·W-3 게이트: 이름 패턴과 본문, 워크스페이스, CI `run:` 줄로 후보를 찾고 근거를 답니다. refresh는 `gone`/`new` 대신 "감지한 전체 + 적용 상태" 표를 화면과 `.loctx/gates-refresh.md`에 냅니다. 사람이 고르면 에이전트가 `gates.yaml`을 고치고(따로 커밋), 화면에서 바로 적용하는 길도 남깁니다. W-4 `run-gates.sh`가 실행 때 `gates.yaml`을 읽습니다(POSIX awk, reins가 쓰는 모양만 읽고 그 밖은 exit 2).
  W-5 husky 파일에 이미 같은 줄이 있으면 다시 제안하거나 넣지 않습니다. W-6 스킬 문장 H-1·H-2·H-3·H-5·H-7·H-10. W-8 작업 브랜치에서 `--force-with-lease`를 허용하고, 기본 브랜치·태그·브랜치를 적지 않은 형태는 계속 막습니다. W-7 문서.
  확인 필요(PM 판단): ① install이 미리 고르는 후보는 지금의 핵심 이름과 `lint:check`·`format:check`·`type-check`까지, `check:*`·CI·하위 디렉터리는 고르지 않은 채 보여 줌 ② `gates.yaml`은 프로젝트 파일 — 이 저장소 AGENTS.md 금지선 문장에 그 예외를 적음 ③ 0.3.3 자신의 stable 줄이 배포본에 없는 문제는 제목 묶음으로 해결된 것으로 봄.
  검증 V-1~V-12: 고치기 전 실패 재현, 표 테스트, 기준 프로젝트 네 곳 fixture, 게이트 스크립트 sh 테스트, deny 테스트, 스킬 구절 테스트, 양판 대조, `pnpm check`와 CI, rc 배포본 smoke, stable 뒤 자기 업데이트.
---
## 요구 해석
<!-- 각 S-n 끝의 ← 는 그것이 나온 intent 문장이다. "PM 판단"은 intent에 없는 것을 이 spec이 정한 곳이다. -->

### `update`의 변경 목록 (W-1)
- S-1 **버전 제목으로 묶음.** `changesBetween`(`cli/src/commands/update.ts:83`)은 범위 `(from, to]`의 절을 버전과 항목의 목록으로 돌려준다. 사람이 읽는 출력은 버전마다 `  0.3.3` 제목 줄 아래 `    · <항목>`을 낸다. 새 버전이 위다(CHANGELOG 순서 그대로). stable 줄("Stable 2026-11-15 …")은 자기 버전 제목 아래에 있으므로 다른 버전의 일로 읽히지 않는다. ← "변경 목록이 버전마다 `## 0.3.x` 제목 아래 묶여 나온다"
- S-2 **`--json`은 깨지 않는다(PM 판단).** 기존 `changes: string[]`(평평한 목록)는 그대로 두고 `changesByVersion: { version, items }[]`를 더한다. 이유: `--json`을 읽는 쪽이 있을 수 있고, 평평한 목록은 제목 없이도 쓸모가 있다.
- S-3 **0.3.3 자신의 stable 줄(PM 판단).** stable은 rc 커밋에서 그대로 내므로, 그 패키지의 CHANGELOG에는 자기 stable 줄이 없다. 제목으로 묶으면 "다른 버전의 stable 줄이 섞여 보이는" 문제는 사라지므로, stable 줄을 미리 넣거나 보고에서 빼는 일은 하지 않는다. ← intent의 첫 문제

### 게이트 감지 (W-2)
- S-4 **이름 패턴과 본문.** 루트와 하위 디렉터리의 package.json에서, 이름에 `check`·`lint`·`test`·`typecheck`·`type-check`·`build`·`e2e`·`verify`가 낱말로 든 스크립트를 후보로 본다(`lint:check`, `format:check`, `check:migrations`, `test:unit`, `build:web` 등). 다음은 뺀다. 고치는 것(지금의 `MUTATING`, `--fix`/`--write`/`fmt`/`format`), 끝나지 않는 것(이름이나 본문에 `dev`·`start`·`watch`·`serve`·`preview`가 낱말로 들거나 `--watch`), 설치 단계(`prepare`·`preinstall`·`install`·`postinstall`), 플랫폼 패키징 변형(`build:win`·`build:mac`·`build:linux`, `:dmg`·`:exe`·`:appimage` 등 플랫폼 낱말이 든 `build:*`). 뺀 것은 지금처럼 `excluded`에 이유와 함께 남는다. Makefile은 `check`·`lint`·`test`·`build`·`vet`·`verify` 대상, go.mod는 `test`·`vet`. ← "정해진 이름 목록 대신 패턴 … 과 본문으로 찾는다", "고치는 것, 끝나지 않는 것 … 은 뺀다"
- S-5 **묶음 검사는 `check`·`verify`·`ci`만.** `lint:check`는 더 이상 묶음 자리에 들어가지 않고 자기 이름의 후보가 된다(pipit-bot·pipit-music). `check:*`도 각자 자기 이름의 후보다. 묶음이 이미 부르는 것의 판정은 0.3.3 규칙(S-2 of 023: 이름으로 부름, 또는 본문이 글자 그대로 같음)을 모든 후보로 넓힌다. 그리고 `test`의 판정도 그 규칙으로 옮긴다(PM 판단: 이제 `lint:check`·`test:unit`이 따로 후보가 되므로, 낱말 `test`만 보면 `test:unit`을 부른 것으로 잘못 칠 수 있다). ← "`check:*` 같은 확인용 스크립트는 각자 자기 이름의 후보"
- S-6 **한 디렉터리 안의 판정.** Makefile의 `check`가 의존하거나 본문에서 `$(MAKE) x`/`make x`로 부르는 대상은 "이미 도는 것"이다. Makefile이 있는 디렉터리의 go.mod `test`·`vet`는, Makefile의 어느 대상 본문이 `go test`·`go vet`을 담으면 "이미 도는 것"이다. `build` 본문이 `typecheck`의 본문을 글자 그대로 담으면 `typecheck`도 "이미 도는 것"이다(croffle web). ← 0.3.3 뒤 PM 분석 ③, "정해짐"
- S-7 **워크스페이스.** 워크스페이스 목록은 pnpm(`pnpm-workspace.yaml`의 `packages`), npm·bun·yarn 1(`package.json`의 `workspaces` 배열이나 `{packages}`), yarn berry(같은 필드)에서 읽고, 글롭(`packages/*`, `apps/**`)을 디렉터리로 펼친다. 패키지 이름은 각 package.json의 `name`. 루트 스크립트의 조각이 다음 가운데 하나면, 해당 패키지들의 같은 이름 후보는 "이미 도는 것"이다.
  - pnpm `-r`/`--recursive` `[run] X`(모든 패키지), `--filter <name|./dir> [run] X`(맞는 패키지)
  - npm `run X --workspaces`/`-ws`(모든 패키지), `run X -w <name|dir>`(그 패키지)
  - yarn 1 `workspaces run X`, `workspace <name> X`; berry `workspaces foreach [옵션] run X`(모든 패키지; `--include`/`--from`은 분명하지 않음으로 봄)
  - bun `--filter <pattern> X`(맞는 패키지; 글롭 `*`만)
  - turbo `run X`, nx `run-many -t X`, lerna `run X`(모든 패키지)

  자기 workspace 파일이나 lock 파일을 가진 하위 디렉터리는 루트 워크스페이스 밖이다(croffle web). 분명하지 않은 형태는 거르지 않는다. ← "워크스페이스(pnpm·npm·yarn 1·berry·bun, turbo·nx·lerna) … 도 본다", "분명하지 않으면 거르지 않는다"
- S-8 **CI 워크플로의 `run:` 줄.** `.github/workflows/*.yml|yaml`의 각 step `run:`에서, 한 줄짜리이고 `${{`가 없고 한 명령(지금의 `compound`가 거짓)인 것을 후보로 본다. 여러 줄(`run: |`)은 줄마다 같은 조건으로 본다. 단 앞 줄이 `cd`이면 그 블록은 분명하지 않음으로 보고 내지 않는다. step에 `working-directory:`가 있으면 그 디렉터리에서 도는 명령으로 다룬다(`--dir`/`-C` 형태로 바꿀 수 있는 도구만 후보, 나머지는 근거만). 설치 명령(`pnpm install`, `npm ci`, `go mod download` 등)과 S-4에서 빼는 것은 내지 않는다. 이미 다른 후보와 명령이 같으면 새 후보가 아니라 그 후보의 근거("CI에도 있음")가 된다. CI 후보는 자동으로 들어가지 않는다. ← "CI 워크플로의 `run:` 줄도 본다"
- S-9 **후보의 근거.** 후보마다 근거 목록을 단다: `CI에도 있음 (<파일>)`, `루트 <스크립트>가 이미 돎 (<조각>)`, `<묶음>이 이미 부름`, `Makefile check가 의존`, `본문이 <스크립트>를 담음`, `파일을 고침`, `끝나지 않음` 등. ← "후보마다 근거를 단다"
- S-10 **install이 미리 고르는 것(PM 판단).** install은 후보 전체를 근거와 함께 보여 주고, 지금 install이 자동으로 넣던 모양(묶음, `lint`, `typecheck`, `test`, `build`, `e2e`는 optional)에 `lint:check`·`format:check`·`type-check`를 더한 것을 미리 고른 상태로 둔다. "이미 도는 것"은 고르지 않는다. `check:*`·CI 후보·하위 디렉터리 후보는 고르지 않은 채 보여 준다(allot의 `check:migrations`처럼 게이트로 볼지 사람이 정할 것이 있어서다). 대화형이 아니면 미리 고른 것만 쓴다. 이유: 처음 설치의 결과가 지금과 크게 달라지지 않게 하면서, 0.3.3에서 빠졌던 `format:check`·`lint:check`를 잡는다.

### refresh (W-3)
- S-11 **감지한 전체와 적용 상태.** `config gates --refresh`는 `gone`/`new`/`changed`를 내지 않는다. 감지한 후보 전체와 `gates.yaml`의 게이트 전체를 짝지어, 줄마다 아래 상태 하나와 근거를 보여 준다.

  | 상태 | 뜻 |
  |---|---|
  | 적용됨 | `gates.yaml`에 있고, 감지한 후보와 명령이 같다 |
  | 적용됨·직접 적은 것 | `gates.yaml`에 있고 `from`이 없다(사람이 적음) |
  | 적용됨·출처를 못 찾음 | `gates.yaml`에 있고 `from`이 있으나, 그 파일에 그 스크립트·대상이 실제로 없다(package.json `scripts` 키, Makefile 대상, go.mod 파일, 워크플로 파일) |
  | 적용됨·다른 명령 | `gates.yaml`에 있고 출처가 같은데 감지한 명령이 다르다 |
  | 미적용 | 감지했으나 `gates.yaml`에 없다 |
  | 미적용·이미 도는 것 | 감지했으나 다른 게이트(묶음, 루트 `-r`, Makefile 의존)가 이미 돌린다 |

  짝짓기는 명령이 같으면 같은 게이트(출처가 달라도)다. 다음으로 출처가 같으면(`Makefile#x`와 `Makefile:x`는 같은 출처) 같은 게이트다. reins가 모르는 출처(`.github/workflows/…`, 그 밖의 것)를 가진 게이트는 "적용됨" 또는 "적용됨·출처를 못 찾음"으로만 보이고, 출처를 읽지 못하면 "적용됨"이다. reins는 무엇도 "없어졌다"고 판정하지 않는다. ← "refresh는 `gone`/`new` 대신 감지한 전체와 적용 상태를 보여 주고", "reins는 무엇도 "없어졌다"고 판정하지 않으며"
- S-12 **`.loctx/gates-refresh.md`.** 같은 표를 `.loctx/gates-refresh.md`에 쓴다(refresh마다 덮어씀). 머리에 만든 시각, `gates.yaml`의 해시, "이 목록을 보고 사용자가 고른 것을 에이전트가 `gates.yaml`에 반영한다 — 따로 커밋"이라는 한 줄을 둔다. 수명: 다음 refresh가 덮어쓰고, 반영한 에이전트가 지운다(`.loctx/`라 커밋되지 않음). ← "같은 목록을 `.loctx/`에 파일로 남긴다", "사람이 고르고, 에이전트가 `gates.yaml`을 직접 고친다"
- S-13 **화면에서 바로 적용.** 터미널 화면은 표를 보여 준 뒤, "미적용" 줄은 더하기, "적용됨" 줄은 빼기, "적용됨·다른 명령"은 감지한 명령으로 바꾸기를 고를 수 있다. 아무것도 고르지 않으면 쓰지 않는다. 빼기는 사람이 고를 때만 일어난다. 대화형이 아니면 `--apply <name…>`이 같은 일을 한다(`all`은 "미적용" 더하기와 "다른 명령" 바꾸기만, 빼기는 이름으로만). ← "지우는 것은 사람이 고를 때만", "터미널 화면에서 골라 바로 적용하는 길도 남긴다"
- S-14 **이름.** 새로 더하는 게이트의 이름은 지금처럼(루트는 스크립트 이름, 하위는 `<dir-slug>-<script>`, CI는 `ci-<명령 낱말 slug>`), 겹치면 `-2`, `-3`.

### 게이트 스크립트 (W-4)
- S-15 **`run-gates.sh`가 `gates.yaml`을 읽는다.** 스크립트는 명령을 박아 넣지 않고, 실행할 때 `.agents/harness/gates.yaml`을 POSIX `awk`로 읽어 `order`의 순서대로(없으면 `gates`의 순서대로) `optional: true`가 아닌 게이트의 `cmd`를 돌린다. 로그 형식(`== … stage: … worktree: …`, 명령, 출력, `exit:`)은 그대로다. ← "`run-gates.sh`가 실행할 때 `gates.yaml`을 읽어"
- S-16 **읽는 모양(PM 판단).** 스크립트가 읽는 것은 reins가 쓰는 모양이다. 최상위 `gates:` 아래 두 칸 들여 쓴 `<name>:`, 그 아래 네 칸의 `cmd:`·`optional:`(나머지 키는 무시), 최상위 `order:` 아래 `  - <name>`. `cmd` 값은 따옴표 없는 글, `'…'`(`''`는 `'`), `"…"`(`\"`·`\\`만)을 읽는다. 주석 줄과 줄 끝의 ` #` 주석(따옴표 밖)은 무시한다. 그 밖의 모양(흐름 표기 `{ }`, 여러 줄 값, 앵커, 탭 들여쓰기)이 `gates:` 안에 있으면 아무것도 돌리지 않고 `run-gates: gates.yaml has a shape this script cannot read (<줄 번호>)`를 남기고 exit 2. `gates.yaml`이 없거나 필수 게이트가 없으면 `exit: 0`으로 끝난다(지금은 스크립트 자체가 없다 — 아래 S-17). 이유: Node가 없는 프로젝트(Go, Python)에서도 돌아야 하고, 하네스는 reins 없이 동작해야 한다.
- S-17 **생성과 경계.** 스크립트는 `gates.yaml`의 내용과 상관없이 늘 같은 글이므로, `install`·`update`가 쓰고 `generated.yaml`이 해시한다(지금처럼). 필수 게이트가 없어도 스크립트는 쓰고, 훅 줄의 제안은 필수 게이트가 있을 때만 한다(지금처럼). `config gates`는 이제 스크립트를 다시 쓰지 않는다. `gates.yaml`은 프로젝트의 파일이다. reins는 install 때 쓰고 `config gates`로 고치며, 사람과 에이전트도 고칠 수 있다(따로 커밋). `generated.yaml`에 없고 drift가 아니다(지금도 없음 — 설계에 명시). 이 저장소 AGENTS.md 금지선의 "Files reins writes (`.agents/harness/` …)" 문장에 `gates.yaml`은 예외라고 적는다(프로젝트 절의 글; PM 판단 ②). ← "`gates.yaml`이 하나뿐인 진짜 설정이 된다", 제약 "이미 있는 `gates.yaml`을 reins가 저절로 바꾸지 않는다"
- S-18 **이전.** 0.3.3 이하의 스크립트(명령을 박은 것)는 `update`가 새 글로 바꾼다. 일반 생성 파일과 같이, 손으로 고친 것이면 묻는다.

### husky 훅 (W-5)
- S-19 **이미 있는 줄.** husky 파일에 `# reins:begin hooks` 블록이 없어도, 주석이 아닌 줄 가운데 `sh .agents/harness/run-gates.sh <stage>`(앞뒤 공백, 따옴표로 감싼 경로, `./` 접두는 같은 것으로 봄)가 있으면 그 단계는 이미 걸린 것이다. 제안하지 않고, `--hooks`나 확인을 받아도 블록을 더하지 않는다. 다른 단계의 줄(`pre-commit` 파일에 `… pre-push`)은 걸린 것으로 치지 않는다. ← "husky 훅 감지가 이미 있는 `run-gates.sh` 줄을 알아보고, 다시 제안하거나 중복으로 넣지 않는다"

### 스킬 문장 (W-6)
- S-20 **H-1.** 모든 스킬의 ③ 첫 문장은 이미 "Check `.loctx/delegation.local.md` if it exists"다. 0.3.3에서 늦게 읽은 것은 흐름의 시작(intent)에서 그 문장을 읽고도 표를 열지 않았기 때문이다. `intent` 스킬 ②의 첫 단계와 AGENTS.md 위임 블록 첫 줄에 "작업을 시작할 때 그 파일을 먼저 열어 표를 읽는다"를 둔다. ← H-1
- S-21 **H-2.** `review` ②에 "리뷰 요청의 머리에 `git diff --stat <base>..<head>`를 그대로 붙이고, 리뷰어는 받은 diff의 파일 목록이 그것과 같은지 먼저 확인한다(빠진 파일이 있으면 리뷰 전에 PM에게 돌려보냄)". ← H-2
- S-22 **H-3.** 다른 모델을 부르는 모든 스킬의 ③(같은 문단)에 "부른 모델에 보낸 요청과 받은 최종 답은 받는 즉시 `.loctx/reports/<version>/`에 그대로 남기고, 회고 뒤 지운다". ← H-3
- S-23 **H-5.** `review`와 `test`에 "국문·영문 양판의 한쪽을 바꾸면, 마지막 변경 뒤에 양판 대조를 다시 한다. waiver나 검사 생략이 이를 대신하지 않는다". ← H-5
- S-24 **H-7.** `spec` ⑤에 "spec을 개정할 때 두 로드맵(`docs/ROADMAP.md`, `.loctx/ROADMAP.local.md`)과 개정 전 검토 기록을 다시 보고, 개정이 그것과 어긋나지 않는지 적는다". ← H-7
- S-25 **H-10.** `audit` 1차 ⑤의 "remedy (pl or advisor opinions by severity)"를 단계로 쓴다: "위반마다 심각도를 적고, 높은 것은 pl/discussion 또는 advisor/committee(켜져 있으면)의 의견을 서로 보지 않게 받아 해결안 옆에 원문 경로와 함께 둔다". ← H-10

### 작업 브랜치의 강제 푸시 (W-8)
- S-26 **deny를 좁힌다.** 생성되는 `.claude/settings.json`의 deny에서 `Bash(git push --force-with-lease *)`를 뺀다. 대신 다음을 막는다. 브랜치를 적지 않은 형태 `Bash(git push --force-with-lease)`와 원격만 적은 형태 `Bash(git push --force-with-lease origin)`, 기본 브랜치를 대상으로 한 것 `Bash(git push --force-with-lease *<default>)`·`Bash(git push --force-with-lease *:<default>)`·`Bash(git push --force-with-lease *<default> *)`, 태그 `Bash(git push --force-with-lease *--tags*)`·`Bash(git push --force-with-lease *refs/tags/*)`, 그리고 `+` refspec `Bash(git push *+*)`. `--force`·`-f`·`--no-verify`·`commit -n`은 그대로 막는다. `<default>`는 install·update 때 `git symbolic-ref --short refs/remotes/origin/HEAD`(없으면 `git config init.defaultBranch`, 그것도 없으면 `main`과 `master` 둘 다)로 정한다. ← H2 "작업 브랜치에 한해 … 허용하고, 기본 브랜치와 태그에는 계속 막는다"
- S-27 **글.** `merge` 스킬 ⑥의 "Never force-push"를 "Never force-push the default branch or a tag, or rewrite the default branch; a work branch behind the default branch is rebased and pushed with `git push --force-with-lease origin <branch>` naming the branch, or, where that is not possible, updated by merging the default branch into it (a rebase merge drops that merge commit)"로 바꾼다. 정지 블록의 "an irreversible action (force push, …)"를 "force push to the default branch or a tag"로 좁힌다. `release`의 "force-pushing"도 같은 범위로. 설계 양판 §3-2·§6. ← H2

### 문서 (W-7)
- S-28 설계 양판(§5 `gates.yaml`, §6 게이트 스크립트·훅·deny, §9 refresh, §3-2), `CHANGELOG.md`, `harness/CHANGELOG.md`(0.3.4: 이미 설치된 저장소는 `reins update` 뒤 `reins config gates --refresh`를 한 번 보라는 줄 포함), `docs/ROADMAP.md`·`.ko.md`의 0.3.4 절이 같은 말을 한다. ← "설계서 양판, … 로드맵 양판이 같은 말을 한다"

## 설계
- **감지의 모양.** `discoverGates`는 `Candidate { name, cmd, from, dir, reasons[], status: 'pick' | 'offer' | 'covered' | 'excluded', optional? }`의 목록을 내는 `detectCandidates(root)`로 바뀐다. 루트, 하위 디렉터리, 워크스페이스, CI를 한 목록에 담는다. 지금의 `GateProposal`(`gates`/`excluded`/`proposals`)은 이 목록에서 만들어 install과 기존 호출부가 그대로 쓰게 한다(호출부 변경을 줄임). `pick`은 S-10의 미리 고름, `offer`는 보여만 줌, `covered`는 "이미 도는 것".
- **refresh.** `diffGates`는 `gateStatus(root, file, candidates)`로 바뀌어 S-11의 행 목록을 낸다. `formatGateDiff`는 상태 열과 근거 열을 가진 표로. `--apply`의 이름 해석과 쓰기(`configureGates`)는 고친 행 종류(더하기/빼기/바꾸기)에 맞춘다. 주석·다른 키·순서 보존은 지금 쓰는 방식 그대로.
- **게이트 스크립트.** `renderGateScript()`는 인자 없이 고정 글을 낸다. awk 부분은 S-16의 모양만 읽어 `\0` 대신 줄 단위로 명령을 내보내고, 셸은 `while IFS= read -r cmd`로 돌린다. 테스트는 이 저장소의 `gate-script.test.ts`처럼 실제 `sh`로 돌린다(따옴표·주석·order 없음·optional·읽을 수 없는 모양).
- **deny.** `generate.ts`의 규칙 목록이 기본 브랜치 이름을 받는다. `owned:` 목록이 이전 규칙을 갖고 있으므로, `update`는 빠진 `--force-with-lease *`를 지우고 새 규칙을 더한다(지금의 병합 규칙).
- **스킬.** 소스는 `skills/`, 이 저장소의 `.agents/skills/`·`.claude/skills/`는 stable 뒤 자기 업데이트로만.

## 작업 단위
- [ ] W-1 `update` 변경 목록의 버전 제목(S-1~S-3): `update.ts`, `update.test.ts`
- [ ] W-2 게이트 감지(S-4~S-10): `detect.ts`(새 모듈로 나눌 수 있음), `install.ts`의 후보 화면, fixture 네 곳(`cli/test/fixtures/gates/{croffle,allot,pipit-bot,pipit-music}` — 모양만), `gate-proposals.test.ts`
- [ ] W-3 refresh(S-11~S-14): `gate-refresh.ts`, `config-gates.ts`, `configure.ts`, `gate-refresh.test.ts`·`config.test.ts`
- [ ] W-4 게이트 스크립트(S-15~S-18): `gate-script.ts`, `install.ts`·`update.ts`·`configure.ts`의 스크립트 쓰기, `gate-script.test.ts`
- [ ] W-5 husky 감지(S-19): `install.ts`, `install.test.ts`
- [ ] W-6 스킬 문장(S-20~S-25): `skills/{intent,review,test,spec,audit,implement,merge,release,retro}/SKILL.md` 중 해당, AGENTS.md 위임 블록 템플릿, `skills.test.ts`
- [ ] W-8 강제 푸시(S-26·S-27): `generate.ts`, `skills/merge`·`release`, `harness/templates/agents-md-blocks.md`, `generate.test.ts`·`vendor-write.test.ts`
- [ ] W-7 문서(S-28, S-17의 AGENTS.md 금지선 예외): 설계 양판, 두 CHANGELOG, 로드맵 양판, 이 저장소 AGENTS.md 프로젝트 절

순서: W-1 → W-5 → W-8 → W-6 → W-4 → W-2 → W-3 → W-7. 작은 것과 서로 묶이지 않은 것을 먼저 하고, W-3은 W-2의 후보 목록에 기대므로 뒤에 둔다. 각 단위는 따로 되돌릴 수 있다(W-3을 되돌리면 refresh는 W-2의 후보로 옛 비교를 한다 — W-2가 `GateProposal`을 그대로 내므로).

## 검증 기준
- V-1 **고치기 전 실패.** 고치기 전 코드에서 다음이 실패함을 로그로 남긴다(`.loctx/reports/0.3.4/before-*.log`). update 출력에 버전 제목이 없음, croffle fixture에서 refresh가 `gone`을 냄, pipit fixture에서 `lint:check`가 `check` 이름으로 들어감, `.husky/pre-commit`에 블록 없는 줄이 있을 때 `--hooks`가 블록을 더함. 실패가 재현되지 않으면 그 V는 fail이다.
- V-2 **update 표 테스트.** 0.3.1~0.3.3 CHANGELOG로 `from=0.3.0-rc.1, to=0.3.3`: 출력에 `0.3.3`, `0.3.2`, `0.3.1` 제목이 이 순서로 있고, "Stable 2026-11-15" 줄이 `0.3.2` 제목 아래에 있다. `--json`에 `changes`(평평)와 `changesByVersion`이 둘 다 있다.
- V-3 **감지 표 테스트.** S-4~S-8의 각 규칙에 행 하나 이상: 패턴으로 잡히는 이름, 빼는 이름(dev·watch·prepare·build:win·`--fix`), `lint:check`가 묶음이 아님, `test:unit`을 `test` 낱말로 부른 것으로 치지 않음, Makefile 의존·go 본문·build 본문, 워크스페이스 관리자 여섯(pnpm·npm·yarn 1·berry·bun·turbo/nx/lerna)의 "이미 도는 것", 분명하지 않은 형태는 거르지 않음, CI `run:`의 조건(한 줄·`${{` 없음·compound 아님·`cd` 블록 제외·`working-directory`).
- V-4 **기준 프로젝트 fixture.** 네 fixture에서 install의 미리 고름과 refresh 표가 `.loctx/ROADMAP.local.md` PM 분석 표의 "실제로 돌리는 검사"와 맞는다. croffle: 기존 게이트 5개가 모두 "적용됨" 계열이고 "출처를 못 찾음" 없음, 하위 후보 13개 중 루트 `-r`·`--filter`·Makefile이 이미 도는 것은 "미적용·이미 도는 것", format check·cli build·web build가 CI 근거와 함께 보임. allot: `check:migrations`·`check:logs`가 고르지 않은 후보로 보임. pipit 둘: `lint:check`·`format:check`가 미리 고른 후보. 기대값은 테스트에 표로 적는다.
- V-5 **refresh 동작.** 아무것도 고르지 않으면 `gates.yaml`의 바이트가 그대로다. `--apply all`은 빼기를 하지 않는다. 이름으로 고른 빼기만 지운다. `.loctx/gates-refresh.md`가 화면과 같은 행을 담는다. 모르는 이름 하나면 아무것도 쓰지 않고 exit 1.
- V-6 **게이트 스크립트 sh 테스트.** 실제 `sh`로: order 순서, order 없음, optional 건너뜀, 세 가지 따옴표 값, 줄 끝 주석, 첫 실패에서 멈추고 그 코드로 끝남, 읽을 수 없는 모양은 아무것도 돌리지 않고 exit 2, `gates.yaml` 없음은 `exit: 0`. 로그 형식이 0.3.3과 같다(머리·명령·`exit:` 줄). `gates.yaml`만 고쳐도 다음 실행이 새 명령을 돈다.
- V-7 **husky.** 블록 없는 같은 줄이 있으면 제안 없음, `--hooks`로도 파일 바이트 그대로. 다른 단계의 줄은 걸린 것으로 치지 않음. 블록이 있는 경우는 0.3.3 테스트가 그대로 통과.
- V-8 **deny.** 생성된 deny에 S-26의 규칙이 있고 `Bash(git push --force-with-lease *)`가 없다. 기본 브랜치 결정 세 경우(origin/HEAD, init.defaultBranch, 둘 다 없음). 0.3.3 설치를 `update`하면 옛 규칙이 지워지고 사용자 항목은 남는다. Claude Code의 규칙 매칭으로 확인할 수 있는 범위에서, `git push --force-with-lease origin fix/x`는 어느 deny에도 걸리지 않고 `… origin master`, `… origin HEAD:master`, `… --tags`, `git push origin +master`는 걸린다(테스트는 reins 안의 glob 매처 `cli/src/lib/glob.ts`로; Claude Code 자체 매칭과의 차이는 우려 2).
- V-9 **스킬 구절.** S-20~S-25·S-27의 문장이 해당 스킬 소스에 있다(`skills.test.ts`의 구절 테스트 방식).
- V-10 **양판 대조.** 설계·로드맵의 국문·영문을 마지막 변경 뒤에 대조하고(pl/doc-reviewer), 그 답을 `.loctx/reports/0.3.4/`에 남긴다.
- V-11 **`pnpm check`와 CI.** 로컬 `pnpm check` exit 0(로그 경로), PR의 CI 전부 통과.
- V-12 **배포본.** rc 뒤 배포된 패키지로 임시 저장소에서 install → refresh → `run-gates.sh` smoke. stable 뒤 이 저장소 자기 업데이트(`reins update`)로 deny·스크립트·스킬이 바뀌고 `pnpm check`가 통과한다.

## 조정 기록
<!-- - A-n (YYYY-MM-DD, W-n) 무엇을 · 왜 · 커밋 -->
—

## 우려
1. **awk로 YAML 읽기.** 사람이나 에이전트가 `gates.yaml`을 흐름 표기 등으로 고치면 스크립트가 exit 2로 멈춘다. 검사가 조용히 빠지지 않고 멈추는 쪽이라 안전하지만 불편할 수 있다. 메시지에 줄 번호와 읽는 모양을 적어 고치기 쉽게 한다.
2. **deny 패턴의 한계.** 셸 명령 문자열의 글롭이라 `git -C . push --force-with-lease origin master`, 변수, 별칭은 못 막는다. knowledge `permission-glob-no-negation`대로 부정 패턴이 없어 "기본 브랜치만" 막는 것을 긍정 패턴의 나열로 한다. 0.4의 에이전트 훅이 이를 정확히 막는 자리다.
3. **후보가 늘어남.** 패턴으로 넓히면 화면의 후보가 많아진다. 미리 고르는 범위를 지금과 비슷하게 두고(S-10), 나머지는 고르지 않은 채 근거와 함께 보여 준다.
4. **기준 프로젝트의 모양.** fixture에는 스크립트 이름과 본문, 워크스페이스·Makefile·워크플로의 모양만 옮기고 다른 내용은 넣지 않는다. 그래도 공개 저장소에 들어가므로, 넣기 전에 fixture 목록을 보고에 적는다.

## 범위 밖
- 에이전트가 `reins config gates --refresh --apply`를 직접 부르는 길.
- H-4·H-6, 0.4의 일(에이전트 훅, 루프, 회고, 역할별 knowledge, D-5).
- GitHub 밖의 CI(GitLab CI, CircleCI 등) 읽기.
- 감싼 호출(`pnpm exec`, `npx`) 풀기 — 0.3.3과 같음.
