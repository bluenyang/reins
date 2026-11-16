---
intent: "023"
status: accepted
approvals:
  - { role: user, by: BlueNyang, at: 2026-11-16, words: "진행", rev: ab56c6f, kind: summary }
summary_for_user: |
  W-1 게이트 탐색: 루트 package.json의 `typecheck`·`lint`도 게이트 후보가 됩니다. 묶음 검사(`check`·`verify`·`ci`·`lint:check` 중 고른 것)가 그 스크립트를 이름으로 부르거나(`pnpm lint`, `run-s lint typecheck`) 같은 명령을 글자 그대로 담으면(`tsc --noEmit`) 넣지 않습니다. 이 판정은 `test`보다 엄격합니다: `\blint\b`로 보면 `lint:check`·`lint:fix`도 lint로 쳐 버리기 때문이고, `test`의 판정은 이미 설치된 저장소의 refresh 결과가 바뀌지 않도록 그대로 둡니다. `pnpm -r`·`--filter`·`turbo`·`nx`·`lerna`처럼 루트 스크립트가 아닌 것을 부를 수 있는 호출은 부른 것으로 치지 않습니다(틀리면 검사가 두 번 돌 뿐 빠지지 않음). 파일을 고치는 lint·typecheck는 빼고, 순서는 check → lint → typecheck → test → build → e2e입니다. 재현 두 모양, 이 저장소 모양(check + build 그대로), 실행기별 명령을 표 테스트로, refresh가 `new typecheck`만 보이고 `--apply` 없이 쓰지 않는 것도 테스트로 확인합니다.
  W-2 2차 감사 범위: 시작점은 1차 감사 기록 `first.range`의 끝 SHA(머지가 SHA를 바꿨으면 SHA 대응 표의 기본 브랜치 SHA)이고, PM은 그 값을 감사 요청에 그대로 옮깁니다. `audit` 스킬·감사 템플릿 4행·감사자 역할 파일·설계 양판 §3-3을 고칩니다. W-3: 두 CHANGELOG와 로드맵 양판에 0.3.3을 적습니다.
  확인 필요(intent에 없어 PM이 정함): ① `harness/roles/auditor.md`도 W-2에서 고침 ② `test` 판정은 그대로 ③ 직접 호출은 명령이 글자 그대로 같을 때만 부른 것으로 침 ④ lint를 typecheck 앞에 ⑤ 재귀·필터·태스크 러너 호출은 부른 것으로 치지 않음.
  검증 V-1~V-9: 고치기 전 실패 로그, 표 테스트, install·refresh 테스트, 스킬 구절 테스트, 양판 대조, `pnpm check`와 CI, rc 뒤 배포본 smoke, stable 뒤 자기 업데이트. 진행을 받으면 구현 → 리뷰 → 테스트 → PR → CI → 1차 감사까지 묻지 않고 가고 머지 지시를 기다리며 한 번 보고합니다.
---
## 요구 해석
<!-- 각 S-n 끝의 ← 는 그것이 나온 intent 문장이다. "PM 판단"은 intent에 없는 것을 이 spec이 정한 곳이다. -->

### 게이트 탐색 (W-1)
- S-1 **루트 후보.** `discoverGates`(`cli/src/lib/detect.ts` L100–139)가 루트 package.json의 `typecheck`와 `lint` 스크립트도 본다. 게이트 이름은 스크립트 이름 그대로 `typecheck`·`lint`, 명령은 다른 루트 게이트와 같은 모양(`pnpm typecheck`, `yarn lint`, `npm run typecheck`), `from`은 `package.json#scripts.typecheck`·`package.json#scripts.lint`. `Gate['name']`(L74)의 합집합과 `ROOT_GATE_NAMES`(L144)에 두 이름을 더한다. 정확히 이 두 이름만 본다(`type-check`, `tsc`, `lint:ci` 등은 범위 밖). ← "루트 package.json의 `typecheck`·`lint`도 게이트 후보가 된다", "하지 않을 것: 다른 이름의 스크립트 … 넓히기"
- S-2 **묶음 검사가 "부른다"의 판정.** 묶음 검사는 지금처럼 `check`/`verify`/`ci`/`lint:check` 중 처음 있고 파일을 고치지 않는 것이다(L113–114). 묶음 검사가 고른 것이 있을 때, 후보 스크립트 `S`(`typecheck` 또는 `lint`)는 아래 둘 중 하나면 "이미 부른다"로 보고 게이트에 넣지 않는다. 묶음 검사가 없으면 두 후보는 있는 대로 들어간다. ← "묶음 검사(`check` 등)가 이미 그 스크립트를 부르면 넣지 않는다. 지금 `test`를 다루는 방식과 같다", 에이전트가 정한 것 "정확한 판정(예: `pnpm typecheck`·`run typecheck`·`tsc` 직접 호출)은 spec에서 정한다"
  - **조각으로 나누기**(두 판정 모두 이것을 쓴다): 묶음 본문에서 먼저 리다이렉션 `\d*>&\d+`를, 이어서 `\d*>\s*\S+`를 지운다(이 순서로). 그다음 `/&&|\|\||[;|&]/`로 나누고, 조각마다 앞뒤 공백을 걷고 연속 공백을 하나로 줄이고, 빈 조각은 버린다.
  1. **이름으로 부름**: 어느 조각에 `S`가 하나의 낱말로 있다 — 앞 글자가 없거나 영숫자·`_`·`-`·`:`·`.`·`/`가 아니고, 뒤 글자가 없거나 영숫자·`_`·`-`·`:`·`.`가 아니다(정규식 `(?<![\w:./-])S(?![\w:.-])`). `pnpm lint`, `npm run typecheck --silent`, `yarn typecheck`, `run-s lint typecheck test`가 여기에 든다. **단, 재귀·필터·태스크 러너 조각은 맞지 않는 것으로 본다**: 공백으로 나눈 낱말 가운데 `-r`, `--recursive`, `--filter`(`--filter=…` 포함), `-F`, `--workspaces`, `-ws`가 있거나, 첫 낱말이 `turbo`·`nx`·`lerna`인 조각. 이런 호출은 루트 스크립트가 아니라 워크스페이스 패키지의 같은 이름 스크립트를 부를 수 있으므로, 틀릴 때 검사가 남는 쪽으로 정한다(PM 결정).
  2. **명령을 그대로 담음**: 조각 가운데 하나가, 같은 방식으로 다듬은 `S`의 본문(리다이렉션을 지우고 앞뒤 공백을 걷고 연속 공백을 하나로 줄인 것; 나누지는 않으므로 `&&` 등이 든 본문은 어느 조각과도 같지 않아 그 후보는 남는다)과 글자 그대로 같다. 예: `typecheck`가 `tsc --noEmit`이고 `check`가 `oxlint . && tsc --noEmit 2>&1 && pnpm test`이면 부른 것이다. `pnpm exec X`, `npx X`, `cross-env A=1 X`처럼 감싼 호출은 풀지 않는다 — 이런 경우 부르는데도 못 알아보는 것(거짓 음성)은 받아들인다. 치르는 값은 같은 검사를 한 번 더 돌리는 것뿐이다.
  - **왜 직접 호출을 이 범위로만 치는가(PM 판단).** 같은 명령이면 게이트가 같은 검사를 두 번 돌릴 뿐이라 빼는 것이 맞다. 그러나 `oxlint`·`eslint`·`tsc`라는 도구 이름만 같고 경로·플래그가 다르면(`lint`가 `oxlint cli/src`, `check`가 `oxlint .`) 다른 것을 검사할 수 있다. 빠뜨린 게이트는 검사가 사라지는 것이고, 남는 게이트는 시간이 더 들 뿐이며 `config gates --refresh`·install에서 사용자가 빼면 된다. 그래서 틀릴 때 검사가 남는 쪽으로 정한다.
- S-3 **경계 사례(표 테스트의 행, V-2).** 묶음 검사가 있을 때:

  | 묶음 본문에 있는 것 | `lint` | `typecheck` | 이유 |
  |---|---|---|---|
  | `pnpm lint` · `npm run lint` · `run-s lint …` | 부름 | — | S-2.1 |
  | `pnpm -r lint` · `pnpm --filter ./cli lint` · `npm run lint --workspaces` | 안 부름 | — | 재귀·필터 조각(S-2.1 단서) |
  | `turbo run lint typecheck` · `nx run-many -t lint` · `lerna run lint` | 안 부름 | 안 부름 | 태스크 러너 조각(S-2.1 단서) |
  | `pnpm lint:check` · `pnpm lint:fix` | 안 부름 | — | `:`로 이어진 다른 스크립트 이름 |
  | `pnpm fmt:check` | 안 부름 | — | `lint`라는 낱말이 없음 |
  | `oxlint .` · `eslint .` (직접) | `lint` 본문과 글자가 같을 때만 부름 | — | `oxlint`·`eslint`는 `lint`라는 낱말이 아님(앞 글자가 영문자); S-2.2만 해당 |
  | `pnpm typecheck` · `run-s typecheck` | — | 부름 | S-2.1 |
  | `pnpm typecheck:watch` · `pre-typecheck` | — | 안 부름 | 다른 스크립트 이름 |
  | `tsc --noEmit` (직접) | — | `typecheck` 본문과 글자가 같을 때만 부름 | S-2.2 |
  | `tsc --noEmit 2>&1` · `tsc --noEmit > out.log` | — | `typecheck`가 `tsc --noEmit`이면 부름 | 리다이렉션을 지운 뒤 비교 |
  | `pnpm exec tsc --noEmit` · `npx tsc --noEmit` · `cross-env A=1 tsc --noEmit` | — | 안 부름 | 감싼 호출은 풀지 않음(거짓 음성 수용) |
  | `concurrently "npm:lint" "npm:typecheck"` | 안 부름 | 안 부름 | 앞 글자가 `:` — 두 게이트가 남음(돌리는 시간만 늚, 우려 3) |

- S-4 (지움, PM 결정) 고른 묶음이 `lint:check`이어도 따로 다루지 않는다: 다른 묶음처럼 S-2로 판정한다(`lint`의 본문이 `lint:check`의 조각과 글자 그대로 같으면 빠지고, 다르면 남는다). 묶음 게이트의 이름은 지금처럼 `check`다. `check` 안의 `pnpm lint:check`도 같은 규칙이라 `lint`는 남는다(S-3).
- S-5 **파일을 고치는 스크립트.** `lint` 본문이 `MUTATING`(L94)에 걸리면 지금처럼 게이트에 넣지 않고 `excluded`에 남긴다(지금도 L109–111이 남긴다). `typecheck`도 같은 검사를 거치고 `excluded`에 남는다 — 지금의 `excluded` 루프는 이름에 `check`가 든 스크립트를 건너뛰므로(L110 `!/check/.test(name)`), `typecheck`는 그 예외에서 뺀다. 묶음 후보가 파일을 고치면 지금처럼 다음 후보로 가고, 남은 후보가 없으면 묶음 없이 `lint`·`typecheck`가 판정 없이 들어간다. ← "`lint`가 파일을 고치는 명령(`--fix`/`--write`)이면 지금처럼 제외한다"
- S-6 **순서와 이름.** 루트 게이트는 `check` → `lint` → `typecheck` → `test` → `build` → `e2e` 순으로 `gates`(따라서 install이 쓰는 `order`)에 들어간다. 이유(PM 판단): 검사 스크립트는 첫 실패에서 멈추므로(설계 §6) 빠른 정적 검사를 앞에 두고, 이 저장소의 `check`도 lint → typecheck → test 순이다. `config gates --refresh --apply`로 더한 새 게이트는 지금처럼 `order` 끝에 붙는다(설계 §9, `appendOrder`) — 기존 파일의 순서는 reins가 다시 정하지 않는다. ← "루트 … 게이트 후보가 된다"(순서는 intent에 없음)
- S-7 **`test`의 판정은 그대로(PM 판단, 확인 필요).** `test`는 지금처럼 묶음 본문에 `\btest\b`가 있으면 넣지 않는다(L119–120). S-2의 규칙으로 바꾸면 `test:unit`을 부르는 `check`에서 `test`가 새로 제안되는 등 이미 설치된 저장소의 refresh 결과가 바뀌는데, intent는 `test`를 바꾸라고 하지 않았다. 그래서 `vitest run`을 직접 부르는 묶음에서 `test`가 남는 지금의 동작도 그대로다(우려 2). ← "지금 `test`를 다루는 방식과 같다"
- S-8 **install과 refresh는 같은 결과.** 두 경로 모두 `discoverGates`를 부른다(`install.ts` L266, `configure.ts` L382 `gateDiff`). 그래서 탐색 함수 하나만 고치고, install과 refresh가 같은 게이트를 낸다는 것을 테스트로 확인한다(V-3). 이미 있는 `gates.yaml`은 reins가 바꾸지 않는다: refresh는 새 후보를 `new`로 보여 주기만 하고, 터미널에서 고르거나 `--apply`에 이름을 준 것만 쓴다(지금 동작). `update`도 `gates.yaml`을 건드리지 않는다. ← "install과 `config gates --refresh`가 같은 결과를 낸다", 제약 "이미 있는 `gates.yaml`을 reins가 저절로 바꾸지 않는다. 새 후보는 `config gates --refresh`가 보여 주고 사용자가 고른다"
- S-9 **재현의 표 테스트.** intent의 재현 두 모양과 이 저장소 모양, S-3·S-5의 경계 사례, 실행기별 명령을 `cli/test/gate-proposals.test.ts`에 표(`it.each`)로 둔다. 재현 두 모양은 고치기 전 코드에서 실패해야 하며 그 출력을 남긴다(V-1). ← "위 재현 두 모양이 테스트 표에 들어간다"
- S-10 **바꾸지 않는 것.** 하위 디렉터리 후보(`subdirProposals`, `NODE_SCRIPTS`)와 루트 Makefile 탐색(`check`·`test`·`build`만)은 그대로다. intent의 문제는 루트 package.json이다. ← "`discoverGates`는 루트 package.json에서 … 만 본다"(문제 1)

### 2차 감사의 범위 (W-2)
- S-11 **시작점.** 2차 감사의 범위는 `.agents/audit/<version>.md`의 1차 감사 기록 프론트매터 `first.range`의 **끝 SHA**부터 그 버전의 마지막 커밋까지다(`<그 SHA>..<last>`, git 범위라 시작 커밋 자체는 1차 감사가 이미 본 것으로 빠진다). 1차 감사 뒤 사용자 처리를 적느라 PR head가 앞으로 갔어도 시작점은 바뀌지 않는다(0.3.2에서 PM이 그 head `8ce5fac`를 적은 것이 이 경우). ← "2차 감사의 범위는 1차 감사 기록의 `first.range` 끝 SHA부터 시작한다"
- S-12 **SHA가 바뀐 머지.** 머지가 SHA를 바꿨으면(rebase 머지) 그 끝 SHA에 대응하는 기본 브랜치 SHA를 쓴다. 대응은 PM이 2차 감사 1절에서 모으는 "브랜치 SHA와 기본 브랜치 SHA의 표"(감사 뒤 `### SHA 대응`에 붙는 그 표)에서 찾는다. 표에 그 SHA가 없으면 PM은 범위를 짐작하지 않고 표를 먼저 채운다. ← "머지가 SHA를 바꿨으면 SHA 대응 표의 기본 브랜치 SHA를 쓴다"
- S-13 **PM은 그대로 옮긴다.** PM은 그 값을 감사 요청의 범위와 `second.range`의 시작에 고치지 않고 옮긴다. 1절의 "1차 감사 뒤 커밋의 게이트 로그"도 같은 시작점 뒤의 커밋이다. ← "PM은 감사 요청에 그 값을 그대로 옮긴다"
- S-14 **템플릿.** `harness/templates/audit.md` 4행의 자리 표시를 `"<first.range의 끝 SHA — 머지가 SHA를 바꿨으면 그 기본 브랜치 SHA>..<last>"`의 뜻으로 고친다(정확한 글은 구현에서 정하되 `first.range`와 "기본 브랜치"(default-branch)가 들어간다). ← "`audit` 스킬과 감사 템플릿에서"
- S-15 **역할 파일(PM 판단, 확인 필요).** `harness/roles/auditor.md` 23행에도 "from the first audit's head"가 있다. intent의 영향 범위에는 없지만 그대로 두면 감사자가 읽는 글이 스킬과 다른 말을 하므로, 같은 W-2에서 같은 뜻으로 고친다. 감사자는 범위를 요청에서 받으므로 역할 파일에는 "the range the PM gives (from the end of `first.range`)" 정도로 짧게 적는다. ← "`audit` 스킬과 감사 템플릿에서 2차 감사의 범위는 …"(같은 요구가 있는 다른 원본)

### 문서
- S-16 **설계 양판.** W-1과 같은 커밋에서 `docs/design.md`·`design.ko.md` §5 `gates.yaml` 절(L146)에 루트 탐색 규칙을 적는다: 루트 후보 이름(묶음, `lint`, `typecheck`, `test`, `build`, `e2e`), S-2의 조각 나누기와 "부른다" 판정 두 가지(재귀·필터·태스크 러너 조각은 치지 않음, 감싼 호출은 풀지 않음), 파일을 고치는 스크립트(S-5), 순서(S-6). "v1.0과 같다"는 하위 디렉터리 제안에만 남긴다. W-2와 같은 커밋에서 양판 §3-3(L94)의 "1차 감사의 head부터"/"from the first audit's head"를 S-11~S-13의 뜻으로 고친다. ← "설계서 양판의 게이트 탐색·감사 범위 설명 … 이 같은 말을 한다", AGENTS.md "change `docs/design.ko.md` (and the English edition) in the same commit"
- S-17 **변경 기록.** `CHANGELOG.md`에 `## [0.3.3]`(Fixed: 루트 `typecheck`·`lint` 탐색 / Changed: 2차 감사의 범위 시작점), `harness/CHANGELOG.md`에 `## 0.3.3`(같은 두 가지)을 적는다. `harness/CHANGELOG.md`는 `reins update`가 보여 주는 글이므로, 이미 설치된 저장소는 `update`로 `gates.yaml`이 바뀌지 않고 `reins config gates --refresh`로 새 후보를 볼 수 있다는 한 줄을 넣는다(S-8의 제약을 사용자에게 알리는 문장이지 새 동작이 아니다). ← "`CHANGELOG.md`, `harness/CHANGELOG.md`가 같은 말을 한다"
- S-18 **로드맵.** `docs/ROADMAP.md`·`ROADMAP.ko.md`의 0.3 절, 0.3.2 다음에 `### 0.3.3`을 더한다: 두 항목(게이트 탐색 결함, H1)과 출처(사용자 2026-11-16, 0.3.2 회고 H1), H2는 다음 버전으로 남겼다는 한 줄. 상태 줄과 rc·stable 날짜는 `release` 스킬이 채운다. ← 영향 범위 "`docs/ROADMAP.md`·`ROADMAP.ko.md`", 하지 않을 것 H2
- S-19 **설치된 사본.** 이 저장소의 `.agents/skills/`·`.claude/skills/`·`.agents/harness/`는 이 버전에서 손으로 고치지 않는다. stable 뒤 `reins update` 커밋 하나로 바뀐다(계획 3 "이 저장소 자기 업데이트"). ← 제약 "이 저장소의 `.agents/` 생성 파일은 `reins update`로만, 따로 커밋해 바꾼다"

## 설계
- **W-1 코드.** `discoverGates`에서 `check`를 고른 뒤 `pieces(body)`(S-2의 조각 나누기)와 `calls(bundleBody, name, scripts)`(S-2의 두 판정; 묶음이 없으면 항상 false)를 두고, `lint`와 `typecheck`를 `pick([name])`으로 고른다. `excluded` 루프의 이름 예외에서 `typecheck`를 뺀다(S-5). `ROOT_GATE_NAMES`(L144)에 두 이름을 더하면 하위 디렉터리 제안 이름의 예약(L245 `taken`)에도 들어간다: 지금 하위 이름은 `<dir-slug>-<script>`라 `lint`·`typecheck`와 겹치지 않지만, 루트 이름 목록과 예약 목록이 같은 것을 말하게 둔다. `res.gates.push` 순서를 check → lint → typecheck → test → build → e2e로 한다(S-6). `test`의 줄(L119–120)은 손대지 않는다(S-7). 정규식의 `S`는 고정 문자열 `lint`·`typecheck`라 이스케이프가 필요 없다. `gateDiff`·install은 같은 함수를 부르므로 바꾸지 않는다.
- **W-1 테스트.** `gate-proposals.test.ts`에 `describe('root typecheck and lint (023 S-1..S-9)')`와 `it.each` 표 하나: 행마다 `scripts`, 잠금 파일(pnpm), 기대 게이트 이름 목록(순서까지), 필요하면 기대 `excluded` 이름. 표의 행은 V-2에 적는다. install·refresh 동일성은 같은 파일 또는 `gate-refresh.test.ts`에(V-3). 기존 테스트 가운데 루트에 `typecheck`·`lint`가 있어 기대가 바뀌는 것이 있으면 기대를 고치고 그 이유를 조정 기록(A-n)에 적는다.
- **W-2 글.** `skills/audit/SKILL.md` § Second audit 1절(L23, "the gate logs of the commits made after the first audit's head")과 2절(L24, "from the first audit's head")에서 그 말을 지우고, 1절 끝(또는 2절 앞)에 시작점 문장을 둔다. 예: "The range starts at the end SHA of the first audit record's `first.range`; when the merge rewrote the commits, at its default-branch SHA from the SHA table. The PM copies that SHA into the audit request as it is." 템플릿 4행(S-14), `harness/roles/auditor.md` 23행(S-15), 설계 양판 §3-3(S-16).
- **W-3 글.** S-17·S-18. 루트 `CHANGELOG.md`의 rc 날짜·`harness/VERSION`·README 상태 같은 릴리스 문서는 `release` 스킬의 일이다(0.3.2처럼 작업 PR에 함께 실으면 조정 기록에 적는다).
- **되돌림.** W-1(코드·테스트·설계 §5)과 W-2(스킬·템플릿·역할·설계 §3-3)는 서로 다른 파일과 절이라 하나만 되돌려도 다른 쪽이 그대로 선다. W-3은 마지막에 오며, W-1이나 W-2를 되돌리면 W-3의 해당 줄도 함께 되돌린다(글만의 커밋).

## 작업 단위
- [x] W-1 (e8d58a8) 루트 `typecheck`·`lint` 게이트 후보 (S-1~S-10, S-16의 §5) — `cli/src/lib/detect.ts`, `cli/test/gate-proposals.test.ts`(필요하면 `cli/test/gate-refresh.test.ts`), `docs/design.md`·`design.ko.md` §5
- [x] W-2 (268676f) 2차 감사 범위의 시작점 (S-11~S-15, S-16의 §3-3) — `skills/audit/SKILL.md` L23(게이트 로그 "after the first audit's head")·L24(범위 "from the first audit's head"), `harness/templates/audit.md`, `harness/roles/auditor.md`, `docs/design.md`·`design.ko.md` §3-3, 구절 테스트(`cli/test/skills.test.ts`)
- [x] W-3 (ed7bebf) 0.3.3 문서 (S-17, S-18) — `CHANGELOG.md`, `harness/CHANGELOG.md`, `docs/ROADMAP.md`·`ROADMAP.ko.md`

## 검증 기준
- V-1 (W-1; S-9) **고치기 전 실패.** W-1의 테스트를 먼저 쓰고 지금 코드에서 돌린다: 재현 ①행은 기대 `[lint, typecheck, test, build]`에 실제 `[test, build]`, ②행은 기대 `[check, typecheck, build]`에 실제 `[check, build]`로 실패한다. 출력 원본 `.loctx/reports/0.3.3/w1-before.log`. 두 행이 실패하지 않으면(지금 코드로 통과하면) 테스트가 결함을 잡지 못하는 것이라 실패로 본다.
- V-2 (W-1; S-1~S-7, S-10) **표 테스트** `gate-proposals.test.ts`, `discoverGates(...).gates`의 이름을 순서까지 비교한다. `lint`·`typecheck`가 나오는 모든 행에서 그 게이트의 `cmd`와 `from`(`package.json#scripts.lint`·`package.json#scripts.typecheck`)도 확인한다. 따로 적지 않은 행은 pnpm 잠금 파일(명령 `pnpm <script>`).
  1. 재현 ①: `typecheck: tsc --noEmit`, `lint: oxlint .`, `test: vitest run`, `build: tsc` → `[lint, typecheck, test, build]`
  2. 재현 ②: `check: pnpm lint && pnpm test`, `lint: oxlint .`, `typecheck: tsc --noEmit`, `test: vitest run`, `build: tsc` → `[check, typecheck, build]`
  3. 이 저장소 모양: spec 작성 시점(`ab52546`) 루트 `package.json`의 `scripts`를 fixture에 글자 그대로 옮긴다 — 키 `build`, `typecheck`, `lint`, `fmt`, `fmt:check`, `test`, `check`, `version`, `prepare`(`check: pnpm lint && pnpm fmt:check && pnpm typecheck && pnpm test`) → `[check, build]`, `excluded`에 `fmt`
  4. 직접 호출, 같은 명령: `check: oxlint . && tsc --noEmit && pnpm test`, `lint: oxlint .`, `typecheck: tsc --noEmit`, `test: vitest run` → `[check]`
  5. 직접 호출, 다른 명령: `check: oxlint . && tsc -p . --noEmit && pnpm test`, `lint: oxlint src`, `typecheck: tsc --noEmit` → `[check, lint, typecheck]`
  6. 리다이렉션: `check: tsc --noEmit 2>&1 && pnpm lint`, `typecheck: tsc --noEmit`, `lint: oxlint .` → `[check]`
  7. 감싼 호출: `check: pnpm exec tsc --noEmit && pnpm lint`, `typecheck: tsc --noEmit`, `lint: oxlint .` → `[check, typecheck]`
  8. 다른 이름: `check: pnpm lint:check && pnpm fmt:check && pnpm typecheck:watch && pnpm test`, `lint: oxlint .`, `lint:check: oxlint . --deny-warnings`, `typecheck: tsc --noEmit`, `typecheck:watch: tsc --noEmit --watch` → `[check, lint, typecheck]`
  9. `run-s`: `check: run-s lint typecheck test`, 세 스크립트 → `[check]`
  10. 재귀: `check: pnpm -r lint && pnpm typecheck`, `lint: oxlint .`, `typecheck: tsc --noEmit` → `[check, lint]`
  11. 필터: `check: pnpm --filter ./cli lint && pnpm typecheck`, 같은 두 스크립트 → `[check, lint]`
  12. 태스크 러너: `check: turbo run lint typecheck`, 같은 두 스크립트 → `[check, lint, typecheck]`
  13. 묶음이 `lint:check`, 본문 같음: `lint:check: eslint .`, `lint: eslint .`, `typecheck: tsc --noEmit` → `[check, typecheck]`, `check`의 `from`은 `package.json#scripts.lint:check`. 본문 다름(`lint: eslint . --max-warnings 0`) → `[check, lint, typecheck]`
  14. 묶음이 `ci`: `ci: pnpm lint`, `lint: oxlint .`, `typecheck: tsc --noEmit` → `[check, typecheck]`, `check`의 `from`은 `package.json#scripts.ci`
  15. 묶음이 `verify`: `verify: pnpm typecheck`, `typecheck: tsc --noEmit`, `lint: oxlint .` → `[check, lint]`
  16. 파일을 고치는 `check`: `check: eslint --fix . && pnpm typecheck`, `lint: eslint .`, `typecheck: tsc --noEmit`, `test: vitest run` → `[lint, typecheck, test]`(다음 후보 없음). 같은 행에 `verify: pnpm lint`를 더하면 → `[check, typecheck, test]`, `check`의 `from`은 `package.json#scripts.verify`
  17. 파일을 고치는 lint, 묶음 없음: `lint: eslint --fix .`, `typecheck: tsc --noEmit`, `test: vitest run` → `[typecheck, test]`, `excluded`에 `lint`
  18. 파일을 고치는 typecheck: `typecheck: tsc --noEmit && oxfmt --write .`, `lint: oxlint .` → `[lint]`, `excluded`에 `typecheck`
  19. `lint`만: `lint: oxlint .` → `[lint]`
  20. 둘 다 없음(지금 동작): `test: vitest run`, `build: tsc` → `[test, build]`
  21. 여섯 모두: `check: node scripts/verify.js`, `lint: oxlint .`, `typecheck: tsc --noEmit`, `test: vitest run`, `build: tsc`, `e2e: playwright test` → `[check, lint, typecheck, test, build, e2e]`, `e2e`는 `optional: true`
  22. npm 실행기(`package-lock.json`): 1행의 scripts → `lint`의 `cmd`가 `npm run lint`, `typecheck`의 `cmd`가 `npm run typecheck`
  23. yarn 실행기(`yarn.lock`): 1행의 scripts → `yarn lint`, `yarn typecheck`
  24. 루트 Makefile만(S-10): `check:`, `lint:`, `typecheck:`, `test:` 타깃 → `[check, test]`(`make check`, `make test`) — `lint`·`typecheck` 타깃은 후보가 아니다
  - 실패는 vitest의 기대/실제 목록 차이로 보인다. 모든 행에서 `compound(g.cmd)`가 false.
- V-3 (W-1; S-8) **install과 refresh.** ⓐ V-2 1행과 같은 fixture(pnpm 잠금 파일)를 비대화형 경로 `runInstall({mode:'auto', asker: defaultsAsker})`로 설치해 순서를 결정적으로 만든 뒤 → `gates.yaml`의 `order`가 `[lint, typecheck, test, build]`, 이어서 `configureGates({refresh:true})`의 `diff`가 빈 목록. ⓑ `gate-refresh.test.ts`: `check`(typecheck를 부르지 않음)·`build`만 있는 저장소를 설치한 뒤 `typecheck` 스크립트를 더하고 `configureGates({refresh:true})` → `kinds(diff)`에 `new typecheck`가 있고 `gates.yaml`과 `run-gates.sh`의 바이트가 그대로. `--apply typecheck` → `order` 끝이 `typecheck`, 검사 스크립트에 그 명령. ⓒ 이어서 `check`가 `pnpm typecheck`(fixture의 실행기 명령)를 부르게 바꾸고 refresh → `gone typecheck`, `why`가 `no longer proposed`로 시작. 기대와 다르면 vitest 실패.
- V-4 (W-2; S-11~S-15) **구절 테스트** `skills.test.ts`: `skills/audit/SKILL.md`에 "`first.range`", "default-branch SHA", "copies that SHA into the audit request as it is"(구현이 다른 글을 택하면 테스트와 이 V-4를 같은 커밋에서 맞추고 A-n에 적는다) · `harness/templates/audit.md`의 `second: { range:` 줄에 `first.range` · `harness/roles/auditor.md`에 `first.range` · `skills/audit/SKILL.md`, `harness/roles/auditor.md`, `docs/design.md`에 "first audit's head"가 없고 `docs/design.ko.md`에 "1차 감사의 head"가 없다. 하나라도 어기면 실패.
- V-5 (W-1·W-2·W-3; S-16·S-17) **양판 대조.** PM과 같은 모델의 서브에이전트(작업 대화를 받지 않음)가 설계 양판의 §3-3과 §5 `gates.yaml` 절을 나란히 읽는다. 같은 실행에서 `CHANGELOG.md`의 0.3.3 절과 `harness/CHANGELOG.md`의 0.3.3 절, 로드맵 양판의 0.3.3 절이 서로와 이 spec의 S-2·S-5·S-6·S-11~S-13과 같은 말을 하는지 본다. 답은 주장마다(S-2의 두 판정과 단서, S-5, S-6, S-11~S-13, 변경 기록의 두 항목) 한 줄: 비교한 두 문장을 모두 원문 그대로 인용하고, 뜻이 같으면 "none found", 다르면 그 차이를 적는다. 답 원본 `.loctx/reports/0.3.3/design-twin-comparison.md`. 차이가 하나라도 있거나, 답이 비었거나, 어느 주장에 두 인용이 없으면 실패(고친 뒤 다시 돌리고 A-n에 적음).
- V-6 (전체) `pnpm check` 종료 0. 원본 로그 `.loctx/reports/0.3.3/check.log`(마지막 줄들에 vitest 통과 수와 `exit: 0`). 출력이 비었거나 통과 수가 없으면 실패. CI의 모든 검사(0.3.2 기준 9개: Ubuntu·macOS·Windows × Node 22·24, 집계, label, trufflehog) 통과.
- V-7·V-8·V-9는 CI가 아니라 PM이 이 기계에서 돌린다(로컬 게이트 로그, `.loctx/`의 smoke 스크립트, 이 저장소의 자기 업데이트). V-8·V-9는 릴리스 전에 `harness/VERSION`이 올라가 있을 것을 요구하지 않는다: `release` 스킬이 rc에서 올리고, V-8은 배포된 rc 패키지를, V-9는 배포된 stable 패키지를 쓴다.
- V-7 (전체) 커밋마다 `.loctx/reports/gates/<tree>.log`에 `worktree: clean`, `exit: 0` 실행이 있다(훅이 남김; 없으면 1차 감사 전에 채움).
- V-8 (rc 뒤; S-8·S-1) **배포본 smoke.** `.loctx/context/scripts/smoke-published-0.3.2.sh`를 고쳐 `smoke-published-0.3.3.sh`로: ⓐ 새 임시 저장소에 재현 ① 모양 → rc로 `install --mode auto` → `gates.yaml`의 `order`가 `lint, typecheck, test, build` ⓑ 재현 ② 모양을 0.3.2로 설치 → rc로 `update` → `gates.yaml` 바이트가 그대로 → `config gates --refresh`에 `new typecheck`, 파일 그대로 → `--apply typecheck`로 쓰임 ⓒ 기존 smoke 항목(0.3.2 smoke의 B·H·J)이 그대로 통과. 원본 `.loctx/reports/0.3.3/smoke-rc.log`, 실패 0.
- V-9 (stable 뒤; S-19) 이 저장소에서 설치한 stable로 `reins update --dry-run` → 종료 0이고, 계획에 `.agents/skills/audit/SKILL.md`·`.claude/skills/audit/SKILL.md`(감사 스킬), `.agents/harness/roles/auditor.md`와 `.claude/agents/`의 감사자 정의가 있으면 그것(감사자 역할), `.agents/harness/templates/audit.md`(감사 템플릿)가 바뀌는 파일로 있고 `.agents/harness/gates.yaml`은 없다. 이어서 `reins update` 실행 → 종료 0, 설치된 감사 스킬에 "`first.range`"가 있고 "first audit's head"가 없으며 `gates.yaml`의 바이트가 그대로. 두 실행의 출력 원본 `.loctx/reports/0.3.3/self-update.log`.

## 조정 기록
<!-- - A-n (YYYY-MM-DD, W-n) 무엇을 · 왜 · 커밋 -->
- A-1 (2026-11-16, W-1) V-2 표의 픽스처 해석: 4행은 `build` 없이 스크립트를 따로 적음, 9행(`run-s`)은 공용 픽스처의 `build`가 있어 `[check, build]`를 기대, 22~24행은 표가 아니라 별도 `it`로, V-3ⓒ는 npm 실행기 픽스처라 `check`를 `npm run typecheck && node -e 0`으로 · spec의 기대값이 공용 픽스처의 `build`를 적지 않았음, 판정 규칙은 그대로 · e8d58a8
- A-2 (2026-11-16, W-1) 리뷰(GPT-6.1 Sol) 지적 1: 설계 양판 §5가 "파일을 고치는 스크립트는 모두 제외 목록에"라고 했으나 코드는 이름에 `check`가 든 것(typecheck 제외)을 목록에 넣지 않음 → 양판에 그 예외를 적음 · 원문 `.loctx/reports/0.3.3/code-review.md` · e61696f
- A-3 (2026-11-16, W-1·W-2) V-5 대조 지적: 설계 양판 §5 예외 목록에 `-ws`가 빠짐(코드·S-2.1에는 있음), 규칙 (2)가 스크립트 본문도 같은 방식으로 정리함을 말하지 않음, S-12의 "표에 SHA가 없으면 표를 먼저 채운다"가 스킬·설계에 없음 → 세 곳 보충 · 원문 `.loctx/reports/0.3.3/design-twin-comparison.md` · d8083a9

## 우려
1. **intent 밖에서 PM이 정한 것 — 모두 확인 필요.** ① S-15: `harness/roles/auditor.md`도 W-2에서 고침(intent의 영향 범위에 없음) — 확인 필요 ② S-7: `test` 판정은 그대로 — 확인 필요 ③ S-2.2: 직접 호출은 명령이 글자 그대로 같을 때만 부른 것으로 침(감싼 호출은 풀지 않음) — 확인 필요 ④ S-6: lint를 typecheck 앞에 — 확인 필요 ⑤ S-2.1 단서: 재귀·필터·태스크 러너 호출은 부른 것으로 치지 않음 — 확인 필요.
2. **`lint`·`typecheck`는 `test`보다 엄격하게 판정한다.** `test`는 `\btest\b`(`test:unit`도 부른 것으로 침, `vitest run` 직접 호출은 못 알아봄, `pnpm -r test`도 부른 것으로 침), `lint`·`typecheck`는 S-2(다른 이름·재귀·필터·태스크 러너는 안 침, 같은 명령의 직접 호출은 알아봄). 새 두 후보에 `\blint\b`를 쓰면 `lint:check`·`lint:fix`도 lint로 치게 된다. `test`를 맞추면 이미 설치된 저장소의 refresh 결과가 바뀌므로 이 버전에서는 하지 않는다. 다음 버전에서 맞출지는 로드맵 아이디어로 둘 수 있다.
3. **남는 쪽으로 틀린다.** `concurrently "npm:lint"`, 경로만 다른 `oxlint` 직접 호출, `pnpm exec tsc --noEmit`·`npx`·`cross-env`로 감싼 호출(거짓 음성 수용), `pnpm -r lint`·`--filter`·`--workspaces`·`turbo`·`nx`·`lerna`(루트 스크립트까지 부르는 경우에도) 같은 경우 같은 검사가 두 번 돌 수 있다. 돌리는 시간만 늘고 검사는 빠지지 않으며, 사용자가 install이나 refresh에서 뺄 수 있다. 재귀·러너 호출을 부른 것으로 치면, 루트 스크립트를 부르지 않는 경우 루트 검사가 빠지므로 그쪽을 택하지 않았다.
4. **손으로 넣은 같은 게이트.** 사용자가 `from` 없이 `typecheck`를 이미 손으로 넣었으면 refresh는 그것을 "yours"로 두고 탐색의 것을 `new typecheck-2`로 보여 준다(지금의 `diffGates` 규칙). 고르지 않으면 쓰지 않으므로 해는 없지만 같은 명령이 두 번 보인다. 이 버전에서 바꾸지 않는다.
5. **이미 설치된 저장소.** 0.3.2 이전 설치는 `update`만으로는 게이트가 늘지 않는다(제약). 결함이 있던 저장소(croffle·pipit-bot 같은 모양)는 `config gates --refresh`를 한 번 돌려야 한다 — S-17의 한 줄로 알린다.
6. **자기 업데이트는 작업 단위가 아니다.** 결정대로 W-1~W-3만 두었다. stable 뒤 `reins update` 커밋은 intent 계획 3의 단계로 하고 V-9로 확인한다(022에서는 W-10이었다).

## 범위 밖
- H2(뒤처진 작업 브랜치의 갱신과 `--force-with-lease`): 다음 버전(사용자 2026-11-16 "결함 + H1").
- `type-check`, `tsc`, `lint:ci` 등 다른 이름의 스크립트, 루트 Makefile의 `typecheck`·`lint` 타깃, 하위 디렉터리 후보의 변경.
- `test`의 기존 판정 변경(S-7), 기존 `gates.yaml`의 순서 재정렬.
- 이 저장소의 설치된 사본을 손으로 고치는 것(S-19).
