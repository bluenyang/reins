---
intent: "019"
status: accepted
approvals:
  - { role: user, by: BlueNyang, at: 2026-11-09, words: "진행", rev: e8c6095, kind: summary }
  - { role: user, by: BlueNyang, at: 2026-11-09, words: "진행", rev: bb2a6ff, kind: stabilisation, scope: "ST-1, ST-2, ST-3, ST-5 (ST-4 not chosen yet)" }
summary_for_user: |
  명령은 install·migrate·update·config 넷만 남기고 작업 중 명령과 그 코드는 지운다. 생성물은 어디서도 reins나 npx를 실행하지 않는다.
  설정은 bindings.yaml 2판 한 파일(모드 single 기본, 역할군 모델, 감사 on/off)이고 AGENTS.md가 직접 가리킨다.
  문서는 intent·spec·감사 기록·버전 history로 줄인다(plan, ticket, bus, metrics 삭제). 작업 단위 W-1~W-9.
  세 단(harness/loop/graph)은 없애고, 역할 에이전트 파일은 접두어 rs-를 붙인다(사용자 2026-11-09).
---
## 요구 해석
intent 019의 "바라는 결과"와 "계획"을 아래로 옮긴다. 각 줄 끝의 ← 는 intent의 근거다.

### 경계
- S-1 CLI 명령은 `install`, `migrate`, `update`, `config` 넷이다. `configure`는 `config`의 비대화형 하위 명령으로 합친다(`config bindings --set …`, `config gates …` 등 지금의 플래그를 그대로 받는다). `check`, `gate`, `new`, `status`, `metrics`, `retro`, `knowledge`, `hook` 계열 명령과 그 전용 코드(`commands/{check,gate,new,status,metrics,retro,knowledge,stages}.ts`, `lib/{verdict,enforcement,metrics,retro,release,work}.ts` 중 네 명령이 쓰지 않는 것)를 지운다. ← "남는 명령은 네 개", "작업 중 명령 제거"
- S-2 생성물 불변식: install·migrate·update·config가 쓰는 어떤 파일에도 `reins`나 `@bluenyang/reins`를 **실행하는** 줄이 없다. 문서 안의 사람용 안내("설정을 바꾸려면 터미널에서 `npx @bluenyang/reins config`")는 허용하되, 에이전트에게 실행을 지시하는 문장은 없다. 테스트가 생성물 전체를 검사한다(검증 기준 V-1). ← "작업 중 어떤 훅·스킬·에이전트도 reins를 실행하지 않는다"
- S-3 훅: install은 프로젝트의 훅 도구를 감지한다(lefthook 설정, `.husky/`, `pre-commit` 설정). 있으면 `gates.yaml`의 게이트 명령을 **그대로** 부르는 줄을 제안하고, 사용자가 확인하면 넣는다(auto 모드에서도 묻는다; 비대화형은 `--hooks`일 때만 넣는다). 넣는 줄은 프로젝트 명령만 부른다(예: `pnpm check`). 훅 도구가 없으면 AGENTS.md 온보딩 항목에 "훅 도구 정하기"를 남겨 PM이 첫 대화에서 묻는다. ← "검사는 프로젝트가 소유", "install은 할 수 있는 만큼 제안·설정"

- S-16 harness/loop/graph 세 단(기획서 R1~R3)을 없앤다. 단일/멀티와 역할군 켜기가 그 자리를 대신한다. install의 단 인자와 단별 설치 표를 지우고, 기획서 R1~R3은 W-2에서 고친다. 0.1.x·0.2.0 설치의 `tier`는 update가 무시하고 지운다(사용자 2026-11-09 "a"). ← "단일이 기본, 필요한 것만 켠다"

### 설정
- S-4 `.agents/harness/bindings.yaml`을 2판(`schema: reins/bindings@2`)으로 바꾼다. 키: `mode: single | multi`(기본 single), `audit: { required: true }`, `default: {vendor, model}`(PM이 쓰는 모델), `groups:` 아래 `pm`, `pl`, `planner`, `implementer`, `executor`, `advisor`, `auditor`. 군 값은 `{vendor, model}` 하나, 또는 `models: [{vendor, model}, …]`(pl·advisor만, 여럿), 또는 `roles: { <role>: {vendor, model} }`(상세 지정). 군을 적지 않으면 꺼짐 = PM이 한다. `escalation`, `limits`, `parallel`, `enabled` 같은 실행 중 해석 키는 없다. 로컬 덮어쓰기 `.loctx/bindings.local.yaml`도 같은 모양이고 키 단위로 이긴다. ← "모델 할당의 뜻", "상속", "vendor·model 묶음", "로컬 덮어쓰기"
- S-5 상속은 `config`가 쓸 때 **미리 풀어서** 생성물에 적는다: 상세 역할 > 군 > (없으면 PM). pl의 첫 모델이 관제, 리뷰어는 하나(기본: 관제가 아닌 첫 모델, 하나뿐이면 관제 모델), Discussion은 전부. advisor는 Committee 전부. ← "PL 모델 배치", "일상 리뷰는 리뷰어 하나", "Advisor 여럿"
- S-6 `config`(TTY): 메인 화면에 `models and roles`(단순/상세 모드 전환, 군별·상세 역할별 모델, 군 켜기/끄기와 켤 만한 조건 안내), `agent tools`(claude, codex, agy, gemini, copilot, cursor agent 다시 감지와 사용 여부), `mode`(single/multi), `audit`(필수 끄기는 확인 한 번 더). 범위 project/local(ST-3). project에 쓰면 생성물을 다시 만든다. 모드를 바꾸면 mode-changed 표시를 남긴다(ST-5). TTY가 아니면 지금처럼 플래그로 동작한다. ← "config 항목", "단일/멀티 전환", "역할군을 켤 때 조건을 보여 준다"

### 역할과 생성물
- S-7 `harness/roles/`를 군과 상세 역할로 다시 쓴다: `pm.md`, `pl.md`(관제·리뷰 다섯·Discussion), `planner.md`(spec-writer·qa-designer), `implementer.md`, `executor.md`(tool-executor·researcher·qa-runner·deployer), `advisor.md`(committee), `auditor.md`. 각 파일은 하는 일, 하지 않을 일, 도구 권한(쓰기·셸·push; 상세 역할마다), 돌려보내는 형식(결과 + 사유를 PM에게)을 적는다. 목표는 한 문장으로 구체적으로 쓴다. lookup·verify-tool·qa-design·qa-run·code-review·docs·deploy·planner(옛) 파일은 지운다. ← "역할", "도구 권한 고정", "Look-up → Retrospector"
- S-8 Claude용 생성물: 켜진 군의 상세 역할마다 `.claude/agents/rs-<group>-<role>.md`(예: `rs-pl-code-reviewer.md`; 모델과 권한이 박힘; 접두어는 사용자 2026-11-09 "짧게 접두어", `rs-`는 PM이 정함). install은 `generated.yaml`에 없는 같은 이름 파일을 덮어쓰지 않고 멈춘다. 다른 벤더 모델이 할당된 역할은 에이전트 파일 대신 AGENTS.md 기본 블록의 "위임 표"에 그 벤더 CLI의 읽기 전용 실행 줄(예: `codex exec -m <model> -s read-only`)을 적는다. 이 줄은 벤더 CLI를 부르는 것이지 reins를 부르는 것이 아니다. 단일 모드면 에이전트 파일을 만들지 않는다. ← "멀티는 역할군에 모델을 할당해 켠다", "하위 역할은 PM을 거친다"
- S-9 스킬 11개를 `skills/<name>/SKILL.md`로 새로 쓴다: `onboard`, `roadmap`, `intent`, `spec`, `implement`, `review`, `test`, `merge`, `audit`, `release`, `retro`. 각 스킬은 ① 언제 쓰나 ② 절차 ③ "위임" 문단(군에 모델이 있으면 그 모델로, 없으면 직접; 읽기 위주·급한 병렬은 같은 모델 서브에이전트 가능; 위임할 때 넘길 파일·결정 목록을 적는다) ④ 만든 파일과 수명 ⑤ 다음 스킬 ⑥ 멈추고 사용자에게 물을 때. reins를 부르지 않는다. 옛 `reins-*` 스킬과 `reins-loop`, `reins-setup`은 지운다(플러그인의 setup 입구는 W-8에서 `npx @bluenyang/reins install` 안내만 남긴다). ← "단계 스킬 11개", "지휘자 없음", "위임 문단"
- S-10 문서 형식: `intent.md`에 `## 계획` 절을 더하고 `plan.md` 템플릿·스키마를 지운다. `spec.md`에 `## 작업 단위`(W-n, 체크박스, 완료 커밋)와 `## 검증 기준`(qa-designer 몫)을 둔다. ticket 파일, bus 템플릿·스키마, knowledge 제안 파일을 지운다. 승인 항목 형식: `{ role: user, by, at, words, rev }`. 사용자 지시로 건너뛴 단계는 intent의 `waivers:`에 `{ step, words, at, scope: once }`. ← "plan.md는 intent로", "승인 기록", "건너뛴 단계 기록"
- S-11 기록 파일과 수명(만들 때 정함): `.agents/audit/<version>.md`(커밋, 영구), `.loctx/history/<version>.md`(버전당 한 장, 로컬 영구), 게이트·테스트 로그 `.loctx/reports/<version>/`(회고 뒤 정리 때 삭제; 지우기 전 history와 감사 기록에 요약), 하위 보고 `.loctx/reports/<version>/handoff/`(같음). install·update는 history에 쓰지 않는다. 각 스킬의 ④가 이 표를 따른다. ← "파일 수명"

### AGENTS.md와 온보딩
- S-12 AGENTS.md 기본 블록(`reins:begin`~`end`)을 다시 쓴다: ① 폴더 구조 ② 설정 파일 위치와 감사 설정("`.agents/harness/bindings.yaml`의 `audit.required`가 true면 버전마다 감사는 필수; 끄는 것은 사용자만") ③ 흐름(4-1)과 스킬 순서 ④ 위임 표(S-8) ⑤ 승인과 건너뛰기 기록 규칙 ⑥ 멈추고 물을 때(정지 조건을 평문 규칙으로, S-13). install·migrate는 프로젝트 절 위에 `<!-- reins:onboarding pending -->`과 할 일 목록을 둔다. migrate 충돌과 0.x 이전이면 `<!-- reins:reconcile pending -->`과 함께 이전 본문을 `.agents/AGENTS.previous.md`(참고 자료)로 옮긴다. 모드 전환은 `<!-- reins:mode-changed pending -->`만 남긴다(ST-5). PM은 다음 첫 대화에서 `onboard` 스킬로 처리하고 표시를 `done`으로 바꾼다. ← "온보딩", "충돌 처리", "기본 블록은 흐름을 강하게 명시"
- S-13 `harness/policy/`: `stops.yaml`의 정지 조건 가운데 에이전트가 작업 중 스스로 멈춰야 하는 것(비가역 작업, 범위 밖 변경, 반복 실패, 비밀 파일, stable 릴리스 등)만 남겨 평문 규칙으로 AGENTS.md 블록 ⑥과 감사 기준에 쓴다. `enforcement.yaml`, `transitions.yaml`, `budget.yaml`은 지운다(검증기가 없으므로). `common-red-lines.yaml`은 역할 파일의 "하지 않을 일"로 옮긴다. ← "작업 중 reins를 부르는 어떤 형태도 만들지 않는다", 감사 판정 기준

### update와 이전
- S-14 `update`: 원본에서 생성물을 다시 만들기 전에 `generated.yaml` 해시와 현재 파일을 비교해, 손으로 고친 생성 파일을 보여 주고 확인받는다(비대화형은 덮어쓰지 않고 목록만 내고 exit 1, `--force`로 덮어씀). ← "update는 손으로 고친 생성 파일을 덮어쓰기 전에 확인"
- S-15 0.1.x·0.2.0 → 0.3 이전(`update`가 감지): 스킬 `reins-*` 삭제·새 스킬 설치, 훅 파일의 `reins:begin hooks` 블록 제거(사용자 줄은 보존)와 S-3 제안, `.claude/settings.json`의 reins 훅 항목 제거(사용자 항목 보존), bindings 1판 → 2판 변환(역할 → 군 매핑 표는 설계서), AGENTS.md는 S-12 reconcile로, `.loctx`의 bus·ticket·dispatch·hook-state·journal·reports 목록을 보여 주고 확인 뒤 삭제(history·context·ROADMAP.local은 보존). 중간에 멈춰도 다시 실행하면 이어진다(멱등). ← "기존 설치는 update로", "기존 사용자 훅과 설정은 보존"

## 설계
- 순서는 intent의 계획을 따른다. 설계서(`docs/design*.md`)는 W-2에서 이 spec으로 다시 쓴다. 이 spec과 설계서가 어긋나면 설계서를 먼저 고친다.
- 남는 코드: `install`, `migrate`(`migrate-plan`), `update`, `config`(`config-models`, `configure`의 플래그 경로), `lib/{blocks,fsx,glob,git,harness,upstream,vendor-write,detect,prompter,ask,schema,secrets,memory,skills}`와 `generate`(훅·런타임·dispatcher 부분 제거). `bindings.ts`는 2판 스키마로 다시 쓴다.
- 지우는 코드는 해당 테스트와 함께 지운다. 지운 뒤 `pnpm check`가 통과해야 한다(작업 단위마다).

## 작업 단위
- [x] W-1 (75fb004; `.agents/harness`는 W-3·W-4에서, publish 워크플로의 reins 줄은 W-8에서) 이 저장소 운영 전환: `.husky/pre-commit`·`pre-push`를 `pnpm check`만 부르게, AGENTS.md에서 reins 블록·`reins status`/`check` 지시를 빼고 "0.3 개발 동안 intent 019의 흐름을 손으로 따른다(단일 모드, 큰 결정은 외부 검토)"를 적는다, `.claude/` 생성물·`.agents/skills`의 reins 호출을 걷어낸다(0.2.0 스킬은 비활성 표시), CI의 `reins check` 줄을 뺀다.
- [x] W-2 (ea326cd) 설계서 양판 재작성(S-1~S-15 반영, 0.2 원칙의 바뀐 것 표), 기획서의 바뀌는 요구(R5·R7 해석, R53, R46 관련 문장) 같은 커밋.
- [x] W-3 (38bf0b6; 연결은 W-6·W-7) bindings 2판 스키마·해석(`bindings.ts`), 로컬 덮어쓰기, 1판 → 2판 변환 함수(S-4, S-5, S-15 일부).
- [x] W-4 (f4d7e4f) 역할 파일 7개와 정책 정리(S-7, S-13), 템플릿·스키마 정리(S-10, S-11). **W-6과 한 단위로 한다**(새 역할 파일이 옛 파일과 이름이 같아 생성기와 함께 바꿔야 함; 2026-11-09 순서 변경: W-7 앞부분 → W-4+W-6 → W-5 → W-7 나머지).
- [x] W-5 (f4d7e4f; update가 지운 0.x 스킬을 install이 다시 넣지 않도록 W-4·W-6과 같은 커밋) 스킬 11개(S-9).
- [x] W-6 (f4d7e4f) 생성기와 AGENTS.md 기본 블록(S-2, S-8, S-12), install의 훅 제안(S-3)과 온보딩 표시.
- [x] W-7 (51f2fcd: 작업 중 명령과 코드 삭제; f4d7e4f: config·update·migrate 2판; 22cfbbd: configure 별칭; 180f7d8: migrate의 열린 work → intent 000 계획) CLI 정리: 작업 중 명령과 코드 삭제(S-1), `config` 통합과 새 화면(S-6), `update`의 덮어쓰기 확인과 이전(S-14, S-15).
- [x] W-8 (ba65664) 플러그인(`.claude-plugin`)의 setup 입구, README 양판, `docs/violations*` 정리, CHANGELOG.
- [x] W-9 검증 — 감사(0.3.0) 뒤 다시 나눠 적음. **검증 완료**: V-1(e2e, install·config·update 뒤), V-3~V-6(단위·e2e 테스트), V-2(e2e: reins 없는 PATH·닿지 않는 registry·실제 git 훅; 수동: `unshare -rn` 네트워크 차단 안에서 스킬이 시키는 git·게이트·커밋·머지, `.loctx/reports/0.3.0/v2-network-isolated.log`), 실제 v0.2.0 설치 이전(`w9-migrate-v020.log`), 자기 이전 리허설(`w9-self-migrate.log`). **미검증**: Windows에서의 V-2 수동 검사(CI는 Windows에서 V-1과 단위 테스트만). **출시 뒤**: 이 저장소의 실제 자기 이전(사용자 결정 2026-11-09). 처음 표시(2026-11-09)는 V-2 일부가 검증되기 전이었다 — 감사 지적 3.

## 안정화 (rc.2)
rc.1을 쓰며 나온 결함과 사용자 결정(2026-11-09). 구현 전에 이 절을 적고 요약 승인을 받는다(감사 0.3.0의 교훈).
- [x] ST-1 (23ddc12) single 모드 표시: `config` 화면과 비대화형 출력(`config`, `config bindings --show`)이 single일 때 역할군 할당에 "multi에서만 쓰임"을, auditor에 "감사 권장 모델"을 붙이고, 맨 위에 "single: 모든 역할을 PM이 함"을 보인다. update의 1판 변환 안내에 "옛 할당은 멀티용으로 보관, 필요 없으면 `config bindings --off …`"를 더한다. ← 사용자 2026-11-09 "single 모드인데도 각 역할에 모델이 할당되어 있거든?"
- [x] ST-2 (23ddc12) 알려진 모델 목록: 벤더별 목록을 하네스 데이터(`harness/models.yaml`)로 두고 `config` 화면이 쓴다. CLI가 목록을 주는 벤더(agy, cursor-agent)는 그 목록을 먼저 쓰고 실패할 때만 이 목록. 역할군을 다 꺼도 OpenAI·Claude 목록이 비지 않는다. ← 사용자 2026-11-09 "openai 쪽은 모델 목록이 없는 이유가 뭐야??" (0.3에서 역할 파일의 기본 모델 필드를 없애며 생긴 회귀)
- [x] ST-3 (23ddc12) 범위 이름: 화면과 문서의 `global`을 `project`로 바꾼다(팀, 커밋되는 `.agents/harness/bindings.yaml`). `local`은 그대로. 범위는 이 둘뿐이고 PC 전체 기본값은 두지 않는다. 플래그는 `--local`과 기본값(project) 그대로. ← 사용자 2026-11-09 "이름을 project로 바꿔야 겠네 … PC 전체 기본값은 안 넣을 거야. project랑 local만."
- [x] ST-5 (23ddc12) 모드 전환은 가벼운 확인: `config`로 모드를 바꾸면 `AGENTS.previous.md`를 만들지 않고 재구성 표시도 붙이지 않는다. 대신 `<!-- reins:mode-changed pending -->`과 "모드가 A → B로 바뀌었다. 위임 표는 reins가 갱신했으니 프로젝트 절에 바뀐 모드와 어긋나는 문장이 있는지만 확인하고 done으로"를 붙이고, `onboard` 스킬이 처리한다. `AGENTS.previous.md`와 전체 재구성은 migrate 충돌과 0.x 이전에만 쓴다. 설계서 §5와 spec S-12의 "모드 전환이면 reconcile"을 같은 커밋에서 고친다. ← 사용자 2026-11-09 "응. 그렇게 하자"(모드 전환으로 바뀌는 것은 관리 블록뿐이라 사본·비교가 과하다는 PM 제안에)
- ST-4 local로만 multi를 켰을 때의 위임 표: 이 spec에서는 다루지 않는다. 사용자가 "그 두 개랑, 아까 미뤄둔 ST-4까지 하자"(2026-11-09)로 다시 당겼고, "intent부터 적어라. 다른 세션에서 하게"에 따라 작업 단위 규칙(ST-6)·감사 입력(ST-7)과 함께 intent 020으로 옮겼다.

## 안정화 (rc.4)

- [ ] ST-8 git 저장소 밖에서 실행: 지금은 모든 명령이 `git rev-parse --show-toplevel` 실패(종료 128)나 git 없음(ENOENT)을 잡지 않아 Node 스택 트레이스로 죽는다(0.1부터; 사용자 2026-11-10 Windows에서 `npx @bluenyang/reins@0.3.0-rc.3 install`). 저장소 루트를 못 찾으면 `reins <command>: not a git repository (or git is not installed) — run git init here first` 한 줄을 stderr에 내고 exit 2로 끝낸다. reins는 `git init`을 대신하지 않는다(저장소를 만드는 것은 사용자 몫). 테스트: 저장소 밖 폴더, git이 PATH에 없는 환경. ← 사용자 2026-11-10 "ㅇㅇ"(PM 제안: 메시지만 내고 exit 2, `git init`은 하지 않음)
- 검증: ST-1·ST-2·ST-3·ST-5마다 단위 테스트, 설계서 §5·§9 같은 커밋에서 수정, 리뷰(GPT-6.1 Sol) 뒤 rc.2.

## 검증 기준
- V-1 install(single, multi 각각)과 update 뒤 생성된 모든 파일을 훑어, `reins`·`@bluenyang/reins`를 실행하는 줄이 없다(허용된 사람용 안내 문장은 형식으로 구분). 훅 파일에는 `gates.yaml` 명령만 있다.
- V-2 오프라인 시험: 설치한 임시 저장소에서 `PATH`에 reins가 없고 네트워크를 막은 채, 훅이 달린 커밋과 스킬 문서가 가리키는 모든 명령이 reins 없이 동작한다.
- V-3 bindings 2판: 단일 기본, 군·상세 상속, pl·advisor 여럿, 로컬 덮어쓰기, 1판 → 2판 변환의 표 기반 테스트. 관제·리뷰어·Discussion 배정이 S-5대로 생성물에 적힌다.
- V-4 스킬 11개가 있고 각 스킬에 ①~⑥ 절이 있다. 다음 스킬 사슬이 흐름(4-1) 순서와 같다.
- V-5 AGENTS.md 기본 블록에 설정 파일 경로, `audit.required`, 흐름, 온보딩 표시가 있다. 모드 전환은 mode-changed 표시만 남기고(ST-5), migrate 충돌이 reconcile 표시와 `AGENTS.previous.md`를 만든다.
- V-6 update: 손으로 고친 생성 파일이 있으면 확인 없이 덮어쓰지 않는다. 0.2.0 설치본 이전에서 사용자 훅 줄과 settings 항목이 보존되고, reins 호출이 모두 사라지고, 중간에 멈춘 뒤 다시 실행하면 같은 결과다.
- 감사(W-9 뒤, 머지 다음): intent 019의 흐름을 지켰는가를 이 spec의 작업 단위와 커밋으로 대조한다.

## 우려 표시
- U-1, U-2는 사용자가 답했다(2026-11-09): 세 단은 없앤다(S-16), 에이전트 파일은 짧은 접두어(S-8).
- U-3 플러그인의 `reins-setup` 스킬은 사용자가 설치 입구로 쓰던 것이다. 지우면 플러그인 사용자의 첫 경험이 바뀐다. W-8에서 setup 입구를 "install 안내"로만 남긴다(에이전트가 reins를 부르는 것이 아니라 사용자에게 명령을 보여 주는 것).
- U-4 0.2.0 설치본을 보존한 이전 시험 사례가 이 저장소 밖에 필요하다. W-9에서 v0.2.0 태그로 임시 저장소에 설치해 만든다.

## 사용자에게 묻는 것
- 1(세 단) → (a) 없앤다. 2(에이전트 파일 이름) → 짧은 접두어. (사용자 2026-11-09)

## 범위 밖
- Codex·Gemini·Cursor용 에이전트 생성 파일(위임 표의 실행 줄로만 다룬다).
- 0.2.1~0.2.8의 나머지 항목.
