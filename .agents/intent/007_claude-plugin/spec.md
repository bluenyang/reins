---
intent: "007"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-26, kind: first-review }
  - { role: pm, at: 2026-10-26 }
summary_for_user: |
  저장소 루트를 Claude Code 플러그인(`reins`)이자 마켓플레이스(`bluenyang`)로 만든다. 마켓플레이스 항목은 `./skills/reins-setup`만 싣는다.
  플러그인 버전은 package.json 버전과 같아야 하고, 테스트가 이를 확인한다. 릴리스 때 publish 워크플로가 버전 동기화와 설치본 갱신까지 하고 함께 커밋한다.
  reins-setup은 고정된 버전 문자열로 `npx @bluenyang/reins@<version>`을 부른다. 같은 파일이 `reins install`로 프로젝트에 들어가도 그대로 동작한다.
  userConfig는 `language`(기본 ko)와 `default_mode`(기본 manual) 두 개를 둔다. 검증은 스키마 테스트와 CI의 `claude plugin validate --strict`로 한다.
  README 양판과 설계서 §9 양판은 플러그인 설치를 먼저 소개하도록 고친다. CLI 기능은 바꾸지 않는다.
---
## 요구 해석
- S-1 `/plugin marketplace add bluenyang/reins` → `/plugin install reins@bluenyang`으로 설치된다. ← 바라는 결과 1
- S-2 플러그인이 켜지면 `/reins:reins-setup`이 보이고, 이 스킬이 `npx @bluenyang/reins install`(또는 `migrate`)을 실행한다. ← 바라는 결과 2
- S-3 플러그인에는 `reins-setup`만 싣는다. `reins-intent`·`reins-loop`는 프로젝트 설치본에만 둬서 같은 스킬이 두 벌 생기지 않게 한다. ← 바라는 결과 3, 질의서 "플러그인에 넣는 것"
- S-4 플러그인 버전과 스킬이 부르는 CLI 버전이 같다. ← 바라는 결과 4, 질의서 "CLI 버전"
- S-5 userConfig는 `language`(기본 ko)와 `default_mode`(기본 manual) 두 개다. ← 질의서 "설정"
- S-6 플러그인 루트에 `bin/`이 없고 `dependencies`는 비어 있으며 훅·에이전트·MCP는 넣지 않는다. ← 제약 1·2, 질의서
- S-7 `claude plugin validate`로 검증하고, CI에서 돌릴 수 있으면 CI에도 넣는다. ← 제약 3
- S-8 README 양판과 설계서 §9 양판이 플러그인 설치를 기준으로 설명한다. ← 바라는 결과 5
## 설계
- **배치.** 저장소 루트 하나가 플러그인이자 마켓플레이스다. `.claude-plugin/plugin.json`에는 name `reins`, version, description, author{name: BlueNyang}, homepage, repository, license MIT, keywords, userConfig를 적는다. `.claude-plugin/marketplace.json`에는 name `bluenyang`, owner, plugins: [{ name `reins`, source `"./"`, skills: [`./skills/reins-setup`] }]를 적는다. source가 마켓플레이스 루트이면서 `skills`를 나열하면 나열한 디렉터리만 읽고 기본 `skills/` 스캔은 하지 않는다. 그래서 S-3이 성립한다. plugin.json에는 `skills`를 넣지 않는다(넣으면 스캔이 줄지 않고 오히려 더해진다). `bin/`·루트 CLAUDE.md·`hooks`·`agents`·`mcpServers`는 두지 않는다.
- **버전 동기화.** plugin.json `version`은 package.json `version`과 같다(marketplace 항목에는 version을 쓰지 않는다. plugin.json 값이 우선한다). 버전은 `scripts/sync-version.ts`가 맞춘다. package.json의 `version` 라이프사이클 스크립트로 이 파일을 실행해 plugin.json과 SKILL.md의 고정 버전을 함께 고친다. publish 워크플로는 버전을 정한 뒤 빌드하고 `npm version`(→ sync-version)과 `reins update`(이 레포 설치본 갱신)를 실행한 다음, 세 값이 같은지 확인하고 package.json·plugin.json·SKILL.md·설치본을 함께 커밋한다(pm 결정 2026-10-26: 릴리스는 지금처럼 Actions에서만). vitest 테스트가 세 값이 같은지 매번 확인한다.
- **CLI 호출.** `skills/reins-setup/SKILL.md`에 `npx @bluenyang/reins@0.1.2 …`처럼 버전을 문자 그대로 박는다. 다른 후보는 이렇다. `${CLAUDE_PLUGIN_ROOT}/package.json`을 읽는 방식은 프로젝트에 설치된 사본에서 동작하지 않는다. userConfig로 버전을 받는 방식은 사용자가 틀린 값을 넣을 수 있다. `@latest`는 S-4를 어긴다. 문자열을 박으면 플러그인으로 부를 때와 `reins install`이 프로젝트에 놓은 사본으로 부를 때 모두 그 사본을 만든 패키지 버전을 가리킨다. 프로젝트 사본이 하네스 VERSION과 같은 세대로 묶이므로 버전 어긋남도 생기지 않는다. reins 저장소 안에서는 지금처럼 `node cli/dist/reins.js`를 쓴다.
- **userConfig.** `language`는 {type string, title, description, default "ko"}로 둔다. `default_mode`는 {type string, default "manual", options [manual, auto]}로 둔다. options 피커는 Claude Code 2.1.271 이상에서만 동작하고, 그보다 낮은 버전에서는 문자열 입력으로 처리된다. SKILL.md는 `${user_config.language}`·`${user_config.default_mode}`를 질문의 기본값으로만 쓴다. 치환되지 않은 채 `${`로 시작하는 값이 보이면(프로젝트 사본이라는 뜻) 2단계 질문의 기존 기본값을 쓴다고 명시한다. `--mode`는 사용자가 확인한 뒤에만 `auto`로 바꾼다.
- **검증.** (a) 항상 실행하는 vitest 스키마 테스트로 다음을 확인한다. 두 JSON이 파싱되는지, 필수 필드가 있는지, 버전 세 개가 같은지, 마켓플레이스 항목의 skills가 `["./skills/reins-setup"]`인지, 루트에 `bin/`이 없는지, plugin.json에 dependencies·hooks·agents·mcpServers가 없는지. (b) CI에서 `npx -y @anthropic-ai/claude-code@<고정버전> plugin validate . --strict`를 별도 단계로 실행한다. 인증 없이 실행되지 않으면 그 단계를 빼고 (a)만 남기고, 그 사실을 plan에 기록한다. 로컬 `pnpm check`에는 넣지 않는다(claude CLI가 필수가 아니므로).
- **문서.** README·README.ko의 Quick start 첫 경로를 플러그인 두 명령 + `/reins:reins-setup`으로 바꾼다. Codex·Antigravity·Cursor 사용자와 터미널 사용자를 위해 기존 `npx` 경로는 둘째로 남긴다. design.md·design.ko.md §9에는 실제 배치(루트 = 플러그인 + 마켓플레이스, 항목이 setup만 싣는 이유, 버전 동기화 규칙)를 반영한다. 코드보다 먼저 같은 커밋에 넣는다(AGENTS.md 규칙).
## 우려 표시
- 불변식 점검: 설계서 우선(설계와 다르면 설계서를 먼저 고친다)과 충돌하지 않는다. §9의 "`skills/`(thin entry points)"를 "플러그인은 setup만 노출"로 좁혀 고친다. 스크립트는 TypeScript만 쓴다(R65)는 규칙과 충돌하지 않는다(sync-version은 TS로 쓴다). 문서 양판 원칙(R67)과 충돌하지 않는다. "CLI 기능 불변"과도 충돌하지 않는다.
- `npm publish`의 `files`에는 `.claude-plugin`을 넣지 않는다. 마켓플레이스는 git으로 받으므로 npm 패키지에는 필요 없다.
- `claude plugin validate`가 CI에서 인증이나 네트워크를 요구할 수 있다. 그 경우에는 (a)만으로 S-7의 "넣을 수 있으면"을 충족한다.
- SKILL.md에 박은 버전은 릴리스 때마다 diff에 나타난다. 감수할 비용이다.
## 검증 기준
- C-1 (S-1, S-7) 스키마 테스트 통과. CI에서 `claude plugin validate . --strict`가 경고 없이 통과하거나, 빠진 이유가 plan에 기록되어 있다.
- C-2 (S-2) 깨끗한 임시 저장소에서 `/plugin marketplace add <로컬 경로>` → `/plugin install reins@bluenyang` → `/reins:reins-setup`이 install dry-run까지 진행된다(수동 시나리오, 결과를 history에 남긴다).
- C-3 (S-3) 설치된 플러그인의 스킬 목록이 `reins:reins-setup` 하나다. 테스트는 마켓플레이스 항목의 skills 배열로 확인한다.
- C-4 (S-4) 테스트: plugin.json version = package.json version = SKILL.md의 `@bluenyang/reins@<v>`. `pnpm version patch` 뒤에도 세 값이 같다. publish 워크플로 dry_run에서 동기화·update 후 drift ok.
- C-5 (S-5) 테스트: userConfig 키가 정확히 `language`·`default_mode`이고 기본값이 ko·manual이다. SKILL.md에 치환되지 않았을 때의 대체 규칙이 있다.
- C-6 (S-6) 테스트: 루트에 `bin/`이 없고 plugin.json에 dependencies·hooks·agents·mcpServers가 없다.
- C-7 (S-8) README·README.ko·design.md·design.ko.md §9에 플러그인 설치 명령이 같은 내용으로 있다. `reins check --drift`는 `drift: ok`다.
## 범위 밖
Codex·Gemini·Cursor 플러그인, 공식 디렉터리 등록, 플러그인 안 CLI 재구현, loop·harness 단계 설치, 훅·에이전트·MCP 동봉, CLI 기능 변경.
