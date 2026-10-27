---
intent: "013"
status: accepted
approvals:
  - { role: qa-design, at: 2026-10-27, kind: first-review }
  - { role: pm, at: 2026-10-27 }
  - { role: user, at: 2026-10-27, kind: summary }
summary_for_user: |
  규칙마다 지키는 방식(차단·검사·권고)을 `harness/policy/enforcement.yaml` 한 곳에 적는다. README 양판과 설계서 표는 테스트가 이 파일에 맞춘다. 권고로 남은 것은 0.2 로드맵으로 넘긴다.
  모델 할당은 두 층이 된다. 커밋되는 `bindings.yaml`(팀 기본값)과 gitignore된 `.loctx/bindings.local.yaml`(사용자 덮어쓰기·감지 결과)로 나누고, 역할이 실제로 쓸 모델은 `reins status`가 보여 준다.
  `install.yaml`의 `release.docs`에 적은 문서(로드맵·CHANGELOG·README)가 버전을 따라오지 않으면 T5가 경고한다. `--stable`을 주면 stable dispatch 줄도 낸다.
  CI는 Ubuntu·Windows·macOS × Node 22·24에서 돌고 `.gitattributes`로 줄 끝을 LF로 맞춘다. 지원 범위는 Node ≥22로 맞추고, 런타임 의존성 commander를 14로 낮춘다(15는 22.12 이상 요구).
---
## 요구 해석
- S-1 새 파일 `harness/policy/enforcement.yaml`(`reins/policy/enforcement@1`)에 규칙마다 지금 어떻게 지켜지는지를 한 줄씩 적는다. 대상은 레드라인 C1–C10, 정지 조건 A1–G2, 전이 T1–T6, 역할 파일의 `must_not` 항목 전부(`<role>#<n>`, 1부터), 예산(`budget.yaml`의 scope와 E1–E3)이다. 각 줄은 `held:`(`blocked` 스크립트·훅·deny가 실행 전에 막음 / `checked` 전이 지점이나 drift·CI가 사후에 잡음 / `advised` 역할·스킬 문서에만 있음), `by:`(`deny`, `hook:pre-commit`, `hook:pre-push`, `check:<stage>`, `check:drift`, `gate`, `ci`, `agent-tools`, `role` 중 하나 이상), 부분 공백이 있으면 `gap:` 한 줄을 가진다. 등급은 실제로 잡히는 부분 가운데 가장 강한 것으로 매기고, 빈 곳은 `gap:`에 적는다. ← "규칙마다 '어떻게 지켜지는가'(스크립트·훅이 막음 / 전이 지점에서 검사 / 역할·스킬에 적혀만 있음)를 적은 표", 제약 "표는 지금 상태를 정직하게 적는다"
- S-2 README 양판(`README.md`, `docs/README.ko.md`)에 "Enforced versus advised" 절을 두고 S-1을 표로 보인다. C·A–G·T는 id마다 한 줄, 역할은 역할마다 한 줄(차단·검사·권고 개수와 차단되는 항목)로 적는다. "enforced by the verifier"(README 50행)처럼 사실과 다른 문장은 고친다. 설계서 양판은 §2 레드라인과 §3 정지 조건 표에 `held` 열을 더하고, 세부 근거는 `docs/violations.md`로 연결한다. ← "표가 README 양판과 설계서에 있다"
- S-3 `advised` 항목과 `gap:`이 있는 항목을 `docs/ROADMAP.md`·`.ko.md`의 0.2 절에 입력 목록으로 링크한다(항목을 복사하지 않고 S-1을 가리킨다). ← "권고에 머문 것은 0.2의 입력이 된다"
- S-4 `.loctx/bindings.local.yaml`(`reins/bindings-local@1`, git-ignored)을 둔다. 형식은 `vendors.<v>: {detected, at}`와 `roles.<r>: {model}`(사용자 덮어쓰기)이다. install과 `configure bindings`는 감지 결과를 이 파일에 쓰고, 커밋되는 `bindings.yaml`에는 더 이상 `vendors.<v>.detected`를 쓰지 않는다. `cli`와 `available`(팀이 쓰기로 한 벤더)은 그대로 둔다. 기존 파일에 남은 `detected:`는 읽을 때 무시하고 오류로 보지 않는다. ← "두 층: 커밋되는 `bindings.yaml`(팀 기본값)과 gitignore되는 `.loctx/bindings.local.yaml`(사용자 덮어쓰기·감지 결과)", 문제 "감지한 벤더까지 함께 커밋된다"
- S-5 resolver `resolveBindings(root)`가 역할마다 실제 모델을 정한다. 순서는 ① local `roles.<r>.model` → ② 팀 `roles.<r>` → ③ 그 벤더가 감지되지 않았으면 역할 파일의 `fallback_binding`(그 벤더가 감지된 경우) → ④ pm의 해석 결과 모델이다. 결과는 `{role, vendor, model, source: local|team|fallback|pm}`와 이유다. 감지는 local 파일의 `vendors.<v>`에서 읽는다. 파일이 없거나 일부 벤더의 `vendors.<v>`가 빠져 있으면(예: 새 clone에서 `configure bindings --local --set`이 먼저 실행된 경우) 빠진 벤더만 그 자리에서 감지한다. 그 결과는 파일에 다시 쓰지 않으며, local 파일의 `vendors`는 install이나 `configure bindings`가 감지를 명시적으로 실행할 때만 쓴다(`--local --set`은 `roles`만 쓴다). `reins status`(텍스트와 `--json`의 `bindings`)와 `reins configure bindings --show`가 이 표를 보여 주고, `configure bindings --local --set r=m`이 local 덮어쓰기를 쓴다. ← "역할이 실제로 쓸 모델은 CLI가 정해 보여 준다", 문제 "fallback은 스킬 지침에만 있다"
- S-6 생성되는 `.claude/agents/reins-<r>.md`는 커밋된 팀 기본값으로만 만든다. 그래서 local 덮어쓰기가 다른 사람의 drift를 만들지 않는다. 팀 기본값이 Claude가 아닌 역할도 Claude agent 파일을 만들고, model은 `fallback_binding`, 없으면 pm 모델로 한다. 벤더가 없는 사용자가 이 파일로 fallback을 실행한다. reins-loop와 `references/vendor-cli.md`는 역할을 부를 때 S-5의 해석 결과(`reins status --json`)를 쓴다고 적는다. ← 같은 문장들
- S-7 install.yaml `release:`에 선택 필드 `docs:`를 더한다(`[{file, check}]`, 기본값 없음, 추가만). `check`는 `roadmap-row`(첫 칸이 `<V>`인 표 줄이 있고 상태 칸이 `planned`·`계획`이 아님), `changelog-section`(rc: `## [Unreleased] — <V>` 또는 `## [<V>]`, stable: `## [<V>]`), `mentions-version`(파일에 `<V>`가 독립된 토큰으로 있음) 셋이다. T5는 어긋난 항목마다 WARN을 낸다(`docs: <file> still describes the previous state (<check>)`). STOP으로 하지 않는 이유: 문구 판단은 오탐이 날 수 있고, 이번 버전은 권고를 강제로 바꾸지 않는다. 이 저장소는 로드맵·CHANGELOG·README 양판 다섯 파일을 설정한다. ← "이전 상태가 남아 있으면 T5가 경고한다"
- S-8 deploy.md와 reins-release에 단계를 더한다. T5 전에 docs 역할이 같은 브랜치에서 `release.docs` 파일(로드맵 상태, CHANGELOG 절, README 상태 줄)을 고쳐 커밋하고, 그 커밋이 릴리스 PR(rc·stable)에 함께 들어간다. T5의 docs WARN이 남아 있으면 deploy는 PR 전에 보고한다. ← "릴리스 PR(rc·stable)에서 로드맵 상태, CHANGELOG 절, README 상태 줄이 함께 갱신되고"
- S-9 `reins check --stage rc-close --release <V> --stable`: 열린 ticket·history·plan 검사는 같고, rc 번호 대신 `dispatchLines(ws, 'stable', V)`를 `dispatch (stable — user's instruction only, A2): gh workflow run …` WARN 줄로 낸다(`--json`에도 담음). ledger에 rc가 하나도 없으면 WARN `no rc recorded for <V>`을 낸다. `--stable`이 없으면 rc 줄 뒤에 `stable: rerun with --stable on the user's instruction` 한 줄만 낸다. stable 줄을 늘 함께 내지 않는 이유는 rc 때 에이전트가 그 줄을 실행할 위험 때문이다. deploy.md step 6은 이 줄을 실행하도록 바뀐다. ← "T5가 stable 줄도 낸다(사용자 지시가 있을 때만 실행)"
- S-10 `.github/workflows/ci.yml`: `check` job을 `os: [ubuntu-latest, windows-latest, macos-latest]` × `node: [22, 24]`(S-11) matrix로 돌린다(`fail-fast: false`). 각 칸에서 `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, `check --drift`를 실행하고, plugin validate는 ubuntu·Node 24 칸에서만 한다. 루트에 `.gitattributes`(`* text=auto eol=lf`)를 둔다. 이 matrix에서 실패하는 것은 이번 버전에서 고친다. 양이 많으면 plan에서 영역별(줄 끝·경로·프로세스·macOS 임시 경로) ticket으로 나눈다. ← "CI가 Node 20·22·24 × Ubuntu·Windows·macOS에서 `pnpm check`를 돌리고, 거기서 실패하는 것은 같은 버전에서 고친다"
- S-11 Node 버전(사용자 결정 2026-10-27: "node >= 22로 조금 낮춰서 맞춤"): `engines.node`를 `">=22"`로 올리고, 런타임 의존성 `commander`를 `^14`(engines `>=20`)로 낮춘다(`commander@15`는 `>=22.12.0`). 개발 도구 `vitest@5`(`^22.12 || ^24 || >=26`)는 그대로 두고, 기여자용 문서(CONTRIBUTING 양판)에 개발에는 Node 22.12 이상이 필요하다고 적는다. CI의 node matrix는 `[22, 24]`(setup-node의 22는 최신 22.x). README 양판과 AGENTS.md, 설계서 §9의 "Node ≥ 20"을 "Node ≥ 22"로 고친다. ← 바라는 결과 "CI가 Node … 에서 `pnpm check`를 돌리고", 사용자 결정
- S-12 설계서 양판 §2·§3(held 열과 enforcement.yaml), §4(release docs, `--stable`), §5 bindings(두 층, resolver 순서, 생성물은 팀 기본값), §6(non-Claude 역할의 Claude agent 생성), §9(`configure bindings --local|--show`, `rc-close --stable`, Node ≥ 22)와 AGENTS.md, README 양판을 코드와 같은 커밋에서 고친다. 설계서는 코드보다 먼저 고친다. ← 영향 범위 "설계서 양판(§2·§3·§5·§9)", AGENTS.md 불변식
## 설계
- 표의 원천: 기존 정책 스키마(`red-lines@1`, `stops@1`)를 건드리지 않으려고 `enforcement.yaml`을 따로 둔다. `stops.yaml`의 `detect:`는 설계 의도라서 그대로 두고, `held`/`by`는 현재 사실만 적는다. 첫 내용은 `docs/violations.md`의 "caught by"에서 옮긴다. 이때 `settings deny`는 deny, `verifier`의 pre-commit·pre-push는 hook, 그 밖의 stage는 check, `role`과 `none (gap)`은 advised로 옮긴다. 역할 쪽은 `capabilities`(code-review·lookup의 `disallowedTools`)를 `agent-tools`(blocked, Claude만)로 적고, 나머지 `must_not`은 대부분 advised다(deploy의 force-push는 deny). T6·E1–E3·budget은 advised(코드 없음)다. `harness/policy/`에 있으므로 tier 설치·drift match 대상이 된다.
- 표 렌더링: `cli/src/lib/enforcement.ts`에 `enforcementRows(harness)`와 `renderTable(rows, lang)`을 순수 함수로 둔다. README·설계서의 표는 `<!-- enforcement:begin -->…<!-- enforcement:end -->` 사이에 둔다(reins 관리 블록과는 다른 이름). 테스트가 렌더 결과와 문서 내용이 같은지 비교하고, 갱신은 `pnpm docs:enforcement` 스크립트(TS)로 한다. 한국어판은 등급 단어만 옮긴다(차단·검사·권고).
- bindings: `cli/src/lib/bindings.ts`에 `readLocal`, `writeLocal`, `resolveBindings(team, local, detected, roleMeta)`를 둔다. 감지는 기존 `vendors()`를 쓴다. `buildBindings`는 `vendors.<v>`에서 `detected`를 빼고, install은 같은 감지값으로 local 파일을 쓴다(`.loctx/`는 이미 gitignore, F2 없음). `configureBindings`에 `local`과 `show` 옵션을 더한다. `--local --set`은 팀 파일과 생성물을 건드리지 않는다. T1의 `bindings-valid`는 팀 파일 기준을 유지한다. `HarnessStatus`에 `bindings`를 더한다(JSON 키는 추가만).
- 생성: `generateVendorFiles`는 `b.vendor !== 'claude'`일 때 skip하지 않고, 역할 파일의 `fallback_binding`(Claude 모델)이나 pm 모델로 agent 파일을 만든다. 헤더 주석에 "fallback for <vendor>"를 적는다. 입력이 커밋된 파일뿐이라 결정적이다. `generated.yaml`에 새 파일이 더해지므로 `reins update`로 옮겨 간다.
- T5: `CheckOptions`에 `stable?: boolean`을 더하고, `reins.ts`에 `--stable` 옵션을 둔다. `rcClose`는 마지막에 `docsFindings(root, release, stage)`를 덧붙인다. `release.ts`에 `readReleaseDocs`와 `checkDoc(text, check, V, stage)`를 순수 함수로 둔다. `install.schema.json`의 `release`에 `docs`를 더한다(`additionalProperties`는 열린 채로 둔다).
- Windows·macOS에서 예상되는 실패(코드 확인 결과, S-10에서 고침):
  1. **줄 끝**: `.gitattributes`가 없어서 Windows runner(autocrlf=true)가 CRLF로 체크아웃한다. 그러면 `oxfmt --check`가 전부 실패하고, `generated.yaml`의 sha와 `.claude/*` 비교(drift F2)가 깨진다. `split('\n')` 파서(`new.ts`, `update.ts`, `retro.ts`, `metrics.ts`, `check.ts:40`)에는 `\r`이 남는다. → `eol=lf`로 대부분 해결된다.
  2. **Node 20**: commander 15와 vitest 5 때문에 CLI도 테스트도 시작하지 못한다 → S-11로 지원 범위를 Node ≥22로 맞추고 commander를 14로 낮춘다.
  3. **gate 실행**: `gate.ts`가 `spawnSync(cmd + ' 2>&1', {shell: true})`로 Windows에서 cmd.exe를 쓴다. 테스트 gate는 `node -e "…"`라 대체로 통과하겠지만, `shq()`의 POSIX 작은따옴표 dispatch 줄은 cmd/PowerShell에서 그대로 실행되지 않는다(런타임 문제이므로 문서에 적음).
  4. **벤더 탐지**: `detect.ts:280`의 `spawnSync(cli)`가 shell 없이 `.cmd` shim(npm 전역 `claude.cmd`, `codex.cmd`)을 못 띄운다. 테스트는 `REINS_NO_VENDOR_SPAWN`으로 피하지만 실제로는 모델 확인이 `unverified`가 된다.
  5. **임시 디렉터리 정리**: e2e(`violations`, `robustness`)가 git 자식 프로세스 직후 `rmSync`를 한다. Windows에서는 EBUSY/EPERM이 날 수 있다(`maxRetries`로 대응).
  6. **경로 비교**: 코드는 대부분 `/` 연결이나 `fsx`의 slash 정규화를 쓰지만, 테스트가 `join()`으로 만든 기대 경로를 비교하는 곳(`gate.test`의 evidence source 등)은 구분자가 섞일 수 있다.
  7. **macOS**: `os.tmpdir()`가 `/var/…`인데 `git rev-parse --show-toplevel`은 `/private/var/…`를 돌려준다. 그래서 `repoRoot`와 테스트 경로의 절대 경로 비교(`stages.ts`의 evidence 밖 판정)가 어긋날 수 있다(`realpathSync`).
  hook 파일(sh)은 CI가 실행하지 않고, `chmod`·`sh -c`는 코드와 테스트 어디에도 없다.
## 우려 표시
- 불변식 "설계서가 기준, 다르면 같은 커밋에서 양판 수정": S-12로 충족한다. §5의 "`vendors.<v>.detected`"를 local로 옮기는 것과 §6의 non-Claude 역할 agent 생성은 설계 변경이다. 같은 커밋에서 양판을 고친다. 충돌 없음.
- 불변식 "TypeScript만(R65)": 표 렌더 스크립트도 TS로 쓴다. 충돌 없음.
- R67(양판): README·설계서·로드맵 표와 문장은 양판을 함께 고치고, 테스트가 두 판의 표를 모두 확인한다. 충돌 없음.
- 형식은 추가만: `enforcement.yaml`(새 파일), install.yaml `release.docs`(선택), `bindings.local.yaml`(새 local 파일), status JSON `bindings`, `--stable`·`--local`·`--show` 옵션을 더한다. 커밋된 `bindings.yaml`은 키를 쓰지 않게 될 뿐이고(`detected`), 기존 파일은 그대로 유효하다. 충돌 없음.
- **Node 버전(해결됨).** 의존성 engines 때문에 Node 20은 지원할 수 없었다. 사용자가 Node ≥22로 맞추고 런타임 의존성을 낮추기로 정했다(S-11). 설계 §9와 AGENTS.md의 "Node ≥ 20"은 같은 커밋에서 "Node ≥ 22"로 바뀐다.
- 제약 "권고를 강제로 바꾸지 않는다": S-7의 docs 검사와 S-9의 stable 줄은 WARN뿐이라 새 STOP이 없다. S-6의 fallback agent 생성은 권한을 늘리거나 막지 않는다.
- S-6은 생성물을 늘린다(커밋되는 `.claude/agents/` 파일 수). 범위를 넘는다고 보면 pm이 리뷰에서 S-5(보여 주기)만 남기고 빼도 된다.
- `enforcement.yaml`의 역할 항목 키(`<role>#<n>`)는 `must_not` 순서에 묶인다. 순서가 바뀌면 커버리지 테스트가 실패해서 갱신을 강제하므로 허용한다.
## 검증 기준
- C-1 (S-1) red-lines·stops·transitions의 모든 id, 모든 역할의 `must_not` 항목, budget scope가 `enforcement.yaml`에 정확히 한 줄씩 있고, 남는 줄이 없으며, `held`·`by` 값이 허용 목록 안에 있다(vitest).
- C-2 (S-1) `docs/violations.md`에서 caught by가 `none (gap)`이나 `role`로 시작하는 id는 `held: advised`이고, `settings deny`나 `verifier`로 시작하는 id는 advised가 아니다(vitest, 표 파싱).
- C-3 (S-2) README 양판과 설계서 양판의 `enforcement` 마커 사이 내용이 `renderTable` 결과와 같고, README에 "enforced by the verifier"라는 문장이 없다(문자열 테스트).
- C-4 (S-3) 로드맵 양판의 0.2 절에 enforcement 표로 가는 링크가 있다(roadmap 테스트).
- C-5 (S-4) graph install(auto, fixture)을 하면 `bindings.yaml`에 `detected` 키가 없고, `.loctx/bindings.local.yaml`에 감지 결과가 있다. `detected`가 있는 0.1.4 형식 bindings.yaml도 T1과 drift를 통과한다.
- C-6 (S-5) resolver 표 테스트: local 덮어쓰기 → `source: local`, openai 미감지 + code-review의 fallback → `claude-sonnet-5-5`/`fallback`, fallback도 없고 벤더도 없음 → pm 모델/`pm`. `status --json`에 `bindings`가 있고, `configure bindings --local --set pm=x`는 `bindings.yaml`과 `.claude/agents/`를 바꾸지 않는다.
- C-7 (S-6) local 파일이 있든 없든 `generateVendorFiles` 결과가 바이트 단위로 같다. openai에 묶인 역할도 `.claude/agents/reins-code-review.md`가 fallback 모델로 생기고, 이 저장소에서 `check --drift`가 통과한다. reins-loop SKILL.md와 `references/vendor-cli.md`가 해석된 모델을 `reins status --json`에서 가져오라고 적는다(문자열 테스트).
- C-8 (S-7) fixture에서 로드맵 행이 `planned`, CHANGELOG에 V 절이 없고, README가 이전 버전만 말하면 T5가 docs WARN 세 개를 내고 판정은 CONTINUE다(exit 0). 다 맞으면 docs WARN이 없고, `release.docs`가 없으면 검사도 없다. stable에서는 `[Unreleased] — V`만 있으면 WARN이 난다.
- C-9 (S-8) deploy.md와 reins-release에 "release.docs"와 docs 역할 단계가 T5 앞에 있다(문자열 테스트).
- C-10 (S-9) `--stable`: 이 저장소 설정에서 `gh workflow run publish.yml -f version=<V> -f dry_run=false`가 "user's instruction only" 표시와 함께 나오고 `next rc` 줄은 없다. `--stable`이 없으면 rc 줄과 안내 한 줄만 나온다. ledger가 없으면 `no rc recorded` WARN이 난다(vitest).
- C-11 (S-10) ci.yml이 3개 OS × S-11의 Node 목록 matrix이고 `fail-fast: false`이며, plugin validate는 한 칸에서만 돈다(yaml 파싱 테스트). `.gitattributes`가 있다. PR CI의 모든 칸이 녹색이다(verify-tool이 run 링크를 증거로 붙인다).
- C-12 (S-11) `engines.node`가 `">=22"`이고, 런타임 `dependencies`의 설치된 engines 가운데 가장 높은 최소 버전이 22 이하다(vitest). `commander`가 14.x다. README·AGENTS.md·설계서에 "Node ≥ 20"이 남아 있지 않다. CONTRIBUTING 양판에 개발용 Node 22.12가 적혀 있다(문자열 테스트).
- C-13 `pnpm check`와 `reins check --drift`가 통과하고, 0.1.4 설치 fixture에서 `reins update`를 하면 install.yaml의 `release:`와 기존 bindings.yaml이 그대로 남는다.
- C-14 (S-12) 설계서 양판에 바뀐 내용이 있다. §4에 `release.docs`와 `--stable`, §5에 `bindings.local.yaml`과 resolver 순서, §6에 non-Claude 역할의 fallback agent 생성, §9에 `--local`·`--show`와 Node ≥ 22가 들어간다(문자열 테스트).
## 범위 밖
- 권고 규칙을 실제로 막는 훅·예산 정지·역할 권한 강제, `.env` 차단 훅(0.2). 이번에는 표에 `advised`/`gap`으로 적기만 한다.
- Codex·Gemini·Cursor 생성물, migrate의 버전별 intent 분리(0.2).
- 다른 저장소의 `release.docs` 기본값(빈 값이 기본이다), 문서 내용의 자동 수정(T5는 경고만 한다).
- Windows에서 hook(sh) 실행 검증, dispatch 줄의 PowerShell 인용(문서에 알려진 제약으로 적는다).
