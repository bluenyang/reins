---
intent: "012"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-27, kind: first-review }
  - { role: pm, at: 2026-10-27 }
summary_for_user: |
  릴리스 방식을 `install.yaml`의 `release:`(워크플로·입력·승인 방식)로 정한다. deploy는 PR·merge 뒤 그 워크플로를 dispatch하고, reins의 npm staged 흐름은 설정의 한 값이다.
  게이트 탐색이 하위 디렉터리도 보고 제안만 한다. 고른 것만 기록하고, 나중엔 `reins configure gates`로 더한다.
  migrate는 겹치는 work id를 `000-n`으로 다시 매기고 intent 000 초안을 만든다. `--legacy committed`로 `.agents/legacy/`에 남길 수 있다.
  install·migrate는 `.claude/memory`를 knowledge 제안 초안으로 옮긴다. `*.env`를 비밀 패턴에 넣는다.
  update는 안 쓰는 upstream 파일을 지우고, status·update는 CLI 버전과 "already up to date"를 보여 준다.
---
## 요구 해석
- S-1 `.agents/harness/install.yaml`에 선택 필드 `release:`를 추가한다(`reins/install@1` 유지, 추가만): `workflows:` 목록(각 항목 `file`, `inputs`(값 안의 `{version}`은 dispatch 버전으로 바뀜), `stages: [rc, stable]`(기본 둘 다), `approval: npm-staged|none`). ← "릴리스 방식은 저장소 설정(`install.yaml` 등)으로 정하고", 질의 답 "install.yaml에 워크플로 목록·입력·승인 방식을 설정"
- S-2 reins 자신의 흐름은 `release.workflows: [{file: publish.yml, inputs: {version: "{version}", dry_run: "false"}, approval: npm-staged}]`로 표현하고, 이 저장소의 install.yaml에 이 값을 넣는다. `npm-staged`의 고유 동작(run-name으로 run 찾기, 로그의 "staged with id"를 장부에 기록, 사용자의 npm 승인, stable 때 `v<V>-rc.*` 태그 조건)은 이 승인 방식 안에서만 적용된다. ← "reins 자신의 npm staged 흐름은 그 설정의 한 값", 문제 "deploy 역할이 `publish.yml`, npm 승인, `master`를 직접 가정"
- S-3 deploy 범위는 PR·merge와 설정된 워크플로 dispatch다. merge 대상은 `master` 고정이 아니라 저장소 기본 브랜치다. `release:`가 없으면 merge까지만 하고 "release 설정 없음"을 보고한다. T5(`rc-close`)가 CONTINUE일 때 단계(rc/stable)에 맞는 워크플로마다 실행할 `gh workflow run <file> -f k=v` 줄을 출력하고, deploy는 그 줄을 그대로 실행한다. 실행이 권한 때문에 거부되면 deploy는 다른 방법을 찾지 않고 그 줄을 사용자에게 넘긴다(0.1.3 stable dispatch가 권한 분류기에 막힌 경험). ← 질의 답 "deploy 범위: PR·merge + 릴리스 워크플로 dispatch"
- S-4 `install.ts`와 `update`가 install.yaml을 다시 쓸 때 `release:`를 포함해 자신이 모르는 키를 보존한다. ← 제약 "기존 설치는 `update`로 그대로 옮겨 간다"
- S-5 `discoverGates`는 루트 결과(`gates`)와 별도로 하위 디렉터리 제안(`proposals`)을 낸다. 깊이 3까지 `package.json`(check·verify·ci·typecheck·lint(변경하지 않는 것)·test·build), `Makefile`(check·test·build), `go.mod`(test·vet)을 찾는다. `node_modules`, `.git`, `dist`, `build`, `vendor`, `.loctx`, `.agents`는 건너뛴다. 명령은 도구 자체의 디렉터리 옵션을 쓴 단일 명령이다(`pnpm --dir d s`, `npm --prefix d run s`, `make -C d t`, `go -C d test ./...`). 이름은 `<dir 슬러그>-<script>`로 짓는다. ← "게이트 탐색이 루트 `package.json`만 본다", 질의 답 "하위 디렉터리 게이트: 제안만"
- S-6 install manual 모드는 제안 목록을 보여 주고 사용자가 고른 이름만 gates.yaml에 넣는다. auto 모드는 루트 것만 넣고 제안은 notes로 보고한다. ← 질의 답 "사용자가 고른 것만 gates.yaml에 기록. auto 모드는 루트 것만 자동"
- S-7 `reins configure gates [--add <name>…]`를 구현한다(설계 §9에 이미 있는 명령). 인자가 없으면 gates.yaml에 아직 없는 제안을 출력하고, `--add`는 고른 제안을 기존 항목 뒤에 덧붙인다. 기존 항목·순서·주석이 아닌 키는 그대로 둔다. 이미 설치된 저장소(migrate한 croffle)에서 고르는 경로다. ← 같은 질의 답
- S-8 migrate의 work→ticket 변환은 열린 work 파일을 경로순으로 정렬해 `000-1`부터 차례로 번호를 매긴다. 파일 이름은 `.loctx/ticket/000-<n>_<slug>.md`로 하고, 원래 id와 경로는 `migrated_from`에 남긴다. `depends`는 같은 하위 폴더 안에서 하나로 정해지는 것만 새 id로 바꾸고, 나머지는 빼서 `asks:`에 적는다. 다시 실행해도 `migrated_from`이 같은 ticket은 새로 만들지 않는다. ← "migrate가 `.ai/work`를 ticket으로 바꿀 때 id가 겹친다(croffle: `000-1` 네 개)"
- S-9 ticket을 하나라도 만든 migrate는 `.agents/intent/000_migrated/intent.md`가 없으면 `status: draft` 초안으로 만든다. 본문에는 옮긴 ticket 목록을 적는다. 그 뒤 T1은 "intent.md 없음" 대신 "intent 000이 draft"로 멈추고, status는 "user: approve the intent"를 보여 준다. ← "intent 000이 없어 T1에서 멈출 것으로 보인다"
- S-10 `reins migrate <tier> --legacy local|committed`(기본 local = 지금의 `.loctx/_legacy/`). `committed`면 legacy를 `.agents/legacy/`로 옮긴다. 단, 비밀 파일 패턴(S-12 포함)에 맞는 파일은 `.loctx/_legacy/`에 두고 보고서에 따로 적는다. ← 질의 답 "선택지로 커밋된 경로(`.agents/legacy/`)에 남김"
- S-11 install(세대 none·gen1·gen2)과 migrate는 `.claude/memory/*`를 지우거나 옮기지 않는다. 대신 파일마다 `.loctx/knowledge-proposals/memory-<name>.md` 초안을 만든다(knowledge 템플릿 frontmatter, `approved` 없음, `source: .claude/memory/<f>`, 본문은 원문). 승격은 기존 `reins knowledge accept`로 한다. migrate의 `.claude/memory → .agents/knowledge` 이동은 없앤다. ← "install은 `.claude/memory` 같은 기존 기억을 knowledge로 옮기지 않는다", 바라는 결과 "기존 기억 파일은 잃지 않는다"
- S-12 비밀 파일 패턴(`common-red-lines.yaml` C4와 `DEFAULT_SECRET_PATTERNS`)에 `*.env`를 추가한다. `*.example*`·`*.sample` 허용은 그대로 둔다. ← "비밀 파일 패턴에 `*.env`가 없다"
- S-13 update는 `.agents/harness/` 아래에서 package harness에 있지만 `tierFiles`(현재 tier)에 들지 않는 파일(예: `CHANGELOG.md`)을 지우고, 지운 목록을 출력한다. 프로젝트 소유 파일과 upstream에 없는 파일은 건드리지 않는다. ← "update가 더 이상 설치하지 않는 파일을 지워야 한다"
- S-14 drift match는 tier에 설치되는 파일 집합만 upstream과 비교한다. 설치 대상이 아닌 upstream 파일이 남아 있으면 STOP이 아니라 `reins update` 안내가 붙은 WARN을 낸다. ← "`.agents/harness/CHANGELOG.md`가 남아 drift가 F2 STOP한다"
- S-15 `reins status`는 하네스 버전과 함께 CLI 버전(install.yaml `cli`, 실행 중인 package 버전)을 보여 준다. update 출력 첫 줄은 `cli vA → vB, harness vX → vY`이다. 만든 파일·바뀐 파일·지운 파일이 모두 없으면 "already up to date"를 출력한다. ← "status와 update 출력이 하네스 버전만 보여 준다"
- S-16 `nextForIntent`: 열린 ticket이 있으면 id순 첫 ticket을 보고 정한다. `done`이면 `reins-review: close <id>`, `blocked`면 `pl: unblock <id>`, `todo`·`doing`이면 `implementer: <id> (reins-implement)`를 낸다. ← "ticket이 열린 intent의 다음 할 일이 비어 있다"
- S-17 설계서 양판 §4(PR·rc·stable 흐름을 release 설정 기준으로), §5(gates 제안·configure gates), §6(drift 대상), §7(work 번호·intent 000·legacy·memory), §9(install.yaml `release`, `configure gates`, `migrate --legacy`)를 코드보다 먼저, 같은 커밋에서 고친다. deploy 역할과 reins-release 스킬도 S-3에 맞춘다. ← 영향 범위 "설계서 §4·§5·§9 양판", AGENTS.md 불변식
## 설계
- 스키마: `harness/schemas/install.schema.json`(`reins/install@1`)을 새로 두고 기존 키(tier·version·cli·mode·language)와 선택 `release`를 정의한다. `additionalProperties`는 열어 두어 기존 파일이 그대로 통과하게 한다. drift convention 층에서 검증한다.
- release: `cli/src/lib/release.ts`에 install.yaml 읽기, `{version}` 치환, `gh workflow run` 줄 만들기를 순수 함수로 둔다. `stages.ts` T5가 CONTINUE일 때 `dispatch:` 줄을 출력하고 `--json`에도 담는다. deploy.md는 "Merge procedure"를 기본 브랜치 기준으로 바꾸고, "rc procedure"는 일반 절차(T5의 dispatch 줄 실행 → `gh run watch`)와 `npm-staged` 절에 추가되는 단계(run-name 매칭, stage id 장부, npm 승인, stable 태그 조건)로 나눈다.
- install.yaml 쓰기: `install.ts`는 기존 파일을 parse해 아는 키만 덮고 나머지 키를 보존한 뒤 stringify한다.
- 게이트: `discoverGates`가 `{gates, excluded, proposals}`를 반환한다. 하위 탐색은 `subdirProposals(root)`로 분리한다. 러너 판정은 디렉터리별 lock 파일을 따르고, 없으면 루트 러너를 쓴다. 제안 명령도 기존 `compound()` 검사를 통과해야 한다. `configure gates`는 `configure.ts`에 두고 yaml Document API로 덧붙여 주석을 보존한다.
- migrate: `convertWorkToTicket(text, fileName, n, idMap)`로 번호와 id 맵을 밖에서 받는다. 번호 계산은 `planMigration`이 한 번에 한다. intent 000 초안은 `templates/intent.md`에서 만든다(slug `migrated`, version은 package.json 버전, 없으면 `"0.0.0"`).
- memory: `planMemoryProposals(root)`를 install과 migrate가 함께 쓴다. `.loctx/`는 gitignore이므로 F2(승인 없는 knowledge)를 일으키지 않고, 원본은 그대로 남아 잃는 것이 없다.
- update 정리: `retiredFiles(installedList, upstreamList, tier)` = upstream에 있음 ∧ tierFiles 밖 ∧ PROJECT_OWNED 아님. dry-run은 지울 목록만 보여 준다. `InstallResult.applied`에 `removed`를 추가한다.
- status: `HarnessStatus`에 `cliInstalled`, `cliPackage`를 추가하고(JSON 키는 추가만), `nextForIntent` 입력에 열린 ticket의 `{id, status}`를 넘긴다.
## 우려 표시
- 불변식 "설계서가 기준, 다르면 같은 커밋에서 양판 수정": S-17로 충족한다. §7의 "`.claude/memory` → knowledge"를 "knowledge 제안 초안"으로 바꾸는 것은 설계 변경이므로 같은 커밋에서 양판을 고쳐야 한다. 충돌 없음.
- 불변식 "Python 금지(R65)": TS만 쓴다. 충돌 없음.
- R67(공개 문서 영어·한국어 양판): 설계서·README에 닿는 변경은 양판을 함께 고친다. 충돌 없음.
- 파일 형식은 추가만: install.yaml `release`(선택), ticket `migrated_from`(이미 쓰는 추가 키), status JSON 키, `InstallResult.applied.removed`. 기존 키의 의미는 바꾸지 않는다. 충돌 없음.
- C4(비밀 파일): `--legacy committed`가 tool 파일을 커밋 경로로 옮길 수 있다. S-10에서 비밀 패턴 파일을 제외해 막는다. 다만 패턴에 걸리지 않는 tool 파일(.sh, .json)에도 비밀이 있을 수 있으므로 보고서에 "커밋 전 검토"를 적는다. reviewer가 확인할 것.
- S-13의 삭제는 upstream 소유 경로에만 한다. 프로젝트가 같은 이름으로 둔 파일까지 지울 위험이 있지만, `.agents/harness/`는 drift가 이미 upstream 소유로 다루는 곳이라 허용 범위로 본다.
- croffle `migrate --dry-run`은 사용자가 직접 실행한다. 결과에서 S-5·S-8과 다른 점(work 폴더 구조, 스크립트 이름)이 나오면 plan 단계에서 반영한다. plan으로 넘긴다.
- AI-GW 실제 적용은 사용자 판단이다. 이번 범위는 일반 결함(S-11, S-12)뿐이다.
## 검증 기준
- C-1 (S-1, S-4) `release:`가 있는 install.yaml과 없는 install.yaml이 모두 install 스키마를 통과한다. `reins update` 뒤에도 `release:`와 모르는 키가 바이트 단위로 같은 값으로 남는다(vitest, fixture).
- C-2 (S-2, S-3) T5 CONTINUE 출력: 이 저장소 설정에서는 `gh workflow run publish.yml -f version=<V>-rc.<N> -f dry_run=false`가 나온다. `stages: [stable]`인 워크플로는 rc 때 나오지 않는다. `release:`가 없으면 dispatch 줄 없이 "no release settings"가 나온다(vitest).
- C-3 (S-3, S-17) deploy.md와 reins-release에 `master`라는 merge 대상 고정이 없고, `publish.yml`·npm 승인은 `npm-staged` 절에만 나온다. 설계서 양판 §4·§9에 `release:`가 있다(문자열 테스트).
- C-4 (S-5) fixture(루트 `package.json`의 build만, `apps/desktop/package.json`의 typecheck·test, `server/go.mod`, `node_modules/x/package.json`)에서 `gates`는 루트 build뿐이다. `proposals`에는 `pnpm --dir apps/desktop typecheck`, `go -C server test ./...` 등이 있고 node_modules는 없으며, 모든 cmd가 `compound()`에 걸리지 않는다.
- C-5 (S-6) manual install에서 asker가 제안 하나만 고르면 gates.yaml에 루트 게이트와 그 하나만 들어간다. auto install은 루트 게이트만 넣고 notes에 제안이 나온다.
- C-6 (S-7) `configure gates`는 아직 없는 제안만 보여 주고, `--add` 뒤 기존 항목·order·주석이 그대로이며 새 게이트가 order 끝에 붙는다. 없는 이름이면 exit 1이고 파일은 바뀌지 않는다.
- C-7 (S-8) id 1·2·3이 네 폴더에 겹친 `.ai/work` fixture(12개, 일부 done)에서 열린 것만 `000-1…000-k`로 겹침 없이 나온다. 모든 ticket이 ticket 스키마를 통과하고, `depends` 재매핑과 `asks:` 기록이 맞으며, 다시 실행해도 ticket 수가 같다.
- C-8 (S-9) 그 migrate 뒤 `intent/000_migrated/intent.md`가 intent 스키마를 통과하는 draft이고, `check --stage ticket-start --ticket 000-1`의 B3 메시지가 "draft"를 말하며, status 다음 할 일이 "user: approve the intent"다.
- C-9 (S-10) `--legacy committed`에서 `.ai/verify/run.sh`는 `.agents/legacy/`로, `.ai/test/x.env`는 `.loctx/_legacy/`로 가고 보고서에 남는다. 기본값의 결과는 지금과 같다(기존 테스트 통과).
- C-10 (S-11) `.claude/memory/a.md`가 있는 세대 none 저장소에 install하면 원본은 남고, `.loctx/knowledge-proposals/memory-a.md`가 생기며, `reins check --drift`가 F2를 내지 않는다. migrate도 같고 `.agents/knowledge/`에 승인 없는 파일이 생기지 않는다. `knowledge accept`로 승격된다.
- C-11 (S-12) `isSecretPath`: `langfuse.env`·`a/b.env` → 걸림, `x.env.example`·`x.example.env`·`.env.sample` → 안 걸림. 생성된 `.claude/settings.json` deny에 `*.env`가 있다.
- C-12 (S-13, S-14) 0.1.0 설치 fixture(`.agents/harness/CHANGELOG.md` 있음)에서 `check --drift`는 STOP 없이 WARN이다. `update` 뒤 그 파일이 없고 출력에 지운 목록이 있으며, `gates.yaml`과 upstream에 없는 프로젝트 파일은 남는다. `--dry-run`은 아무것도 지우지 않는다.
- C-13 (S-15) 바뀐 것이 없는 상태에서 다시 update하면 출력에 `cli v`, `harness v`, "already up to date"가 있다. `status`(텍스트와 `--json`)에 CLI 버전이 나온다.
- C-14 (S-16) 열린 ticket이 todo·doing·blocked·done인 각 경우에 `nextForIntent`가 정해진 문자열을 낸다. 기존 `nextForIntent` 테스트는 그대로 통과한다.
- C-15 `pnpm check`와 `reins check --drift`가 통과하고, 이 저장소에서 `reins update`를 실행하면 install.yaml의 `release:`가 유지된다.
## 범위 밖
- loop·harness 단계 깎기, 벤더 생성물, `.env` 차단 훅(0.2).
- pipit-hub 허브 전체(멀티 레포 워크스페이스, 0.3+), changesets·Go 이미지 워크플로 자체의 작성.
- 대상 저장소(croffle, AI-GW)에 직접 쓰기와 실제 적용.
- 사용자 홈의 Claude 기억(`~/.claude/projects/*/memory`) 가져오기, 하위 디렉터리 게이트 자동 기록.
