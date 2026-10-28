# reins 설계서 — v1.0 (2026-10-25)

> 한글 원본. 영어판은 [`design.md`](design.md) — 둘이 어긋나면 이 파일이 기준이다. 기획서 [`proposal.ko.md`](proposal.ko.md) v1.1의 설계. 윤문: humanize-korean v2.3 light, 2문장(조사 보정).

> 3단계 산출물. 기획서 v1.1(`docs/proposal.ko.md`)의 R1~R67을 구조와 형식으로. 코드는 없다.
> 작업 1~6의 초안·논의 경과는 `3_design-doc.draft.md`(671줄). 이 문서는 그것을 주제별로 다시 묶고 중복을 뺀 것.
> 확정되면 `docs/design.ko.md` + `docs/design.md`(영어).

## 0. 원칙 — 설계 전체를 꿰는 다섯 줄
1. **역할은 모델과 독립.** 어느 역할도 어느 모델로든 돈다. Claude 하나로도 전부 성립. (R14·R57)
2. **금지선은 열거, 허용은 서술.** 검증기는 "못 하는 것" 목록만 집행한다 — 그래서 결정론. (R4·R7)
3. **판단은 역할이, 집행은 스크립트가.** 검증기·CLI는 추론하지 않는다. 역할이 bus에 판정을 쓰면 검증기가 그것을 적용한다. (R5·R7)
4. **커밋 경계는 이름에.** `.agents/` = 커밋되는 에이전트 컨텍스트, `.loctx/` = 이 머신만. 그 외 루트는 사람·코드. (R34·R35)
5. **표준이 있으면 따른다.** `AGENTS.md`·`SKILL.md`는 표준, 역할·권한·훅만 생성. (R31·R32)

## 1. 배치 (= `4_layout.md` v4)
```
<project>/
├── AGENTS.md                 커밋 · 관리 블록(툴) + 프로젝트 절
├── .agents/                  커밋 · 에이전트 컨텍스트
│   ├── intent/<id>_<slug>/{intent,spec,plan}.md
│   ├── knowledge/  harness/{policy,roles,schemas,templates, bindings.yaml, gates.yaml, install.yaml}  SKILLS.md  skills/
├── .claude/ .codex/ .gemini/ .cursor/   커밋 · 생성물
├── docs/  (ROADMAP.md, 기획서·설계서, 공유할 benchmark·조사)   test/  (단위·통합·e2e)
└── .loctx/                   gitignore (+ 내부 .gitignore) · ROADMAP.local.md ticket/ reports/ pr/ release/ context/ bus/ test/ history/
```
노하우(`.loctx/history/`)는 사람마다 달라 로컬, 거기서 걸러낸 명시지(`knowledge/`)만 커밋(R54).

## 2. 역할과 금지선 (D1)
### 공통 금지선 C1~C10 — 전 역할
C1 "통과하기 위한" 구현(하드코딩·보이기만) · C2 `AGENTS.md` 관리 블록·`policy/`·`roles/` 수정(PM·update만) · C3 자기 권한 파일·생성물 수정 · C4 비밀값 읽기 · C5 훅 우회·게이트 출력 가공(`| tail`) · C6 push/PR/머지/릴리스/태그(배포 역할만) · C7 사용자 확인 없이 과거 결정 뒤집기 · C8 거절된 제안 재제시 · C9 운영 서버·클러스터 조작 · C10 intent·plan 밖 변경(새 ticket으로)

지키는 방식(`held`): **차단**(blocked) 스크립트·훅·deny가 실행 전에 막음 · **검사**(checked) 전이 지점이나 drift 검사가 사후에 잡음 · **권고**(advised) 역할·스킬 문서에만 있음. 원천은 `policy/enforcement.yaml`이고(규칙마다 한 줄: C1–C10, A1–G2, T1–T6, 역할 `must_not` 항목 전부를 `<role>#<n>`으로, 예산 범위), 등급은 실제로 지켜지는 부분 중 가장 강한 것이며 `gap`에 빈 곳을 적는다. 표는 이 파일에서 만든다. 세부 근거는 [`violations.ko.md`](violations.ko.md).

<!-- enforcement:begin redlines -->
| id | 지킴 | 수단 | 빈틈 |
|---|---|---|---|
| C1 | 권고 | `role` | judged by reviewers only; nothing detects a hard-coded pass |
| C2 | 차단 | `hook:pre-commit`, `check:drift` | only when the hook is installed; the edit itself is not prevented |
| C3 | 차단 | `hook:pre-commit`, `check:drift` | only when the hook is installed; no deny rule covers .claude/settings.json itself |
| C4 | 차단 | `deny`, `hook:pre-commit` | Claude Code only; .env.* is a finite list, so names such as .env.custom have no deny rule; the hook sees staged paths, not reads |
| C5 | 차단 | `deny`, `gate`, `check:verdict` | combined or later-position forms such as git commit -nm are not denied |
| C6 | 권고 | `role` | pre-push holds pushes to the default branch (A4) and the deny rules stop force and --no-verify pushes; any other push, PR, merge, release or tag is not blocked |
| C7 | 권고 | `role` | — |
| C8 | 권고 | `role` | — |
| C9 | 권고 | `role` | — |
| C10 | 권고 | `role` | T2 lists it but the pre-commit check does not compare the diff with plan.md |
<!-- enforcement:end -->

### 역할 12 — 기본 바인딩은 참고값
| 역할 | 기본 | 하는 것 | 절대 못 하는 것 |
|---|---|---|---|
| pm | Opus | 사용자 대화, intent 확정 제안, spec 1차 승인 + 사용자 요약, 예산 지정, AGENTS 프로젝트 절, 로드맵 | 코드 수정 · 사용자 승인 없는 intent 확정 |
| planner (기획/설계) | Opus | 질의서, intent 구체화, **spec.md** | 코드 수정 · 범위 밖 요구 추가 |
| pl | Sonnet | **plan.md**, plan→ticket, 구현자 지휘, 결과 받아 판단 | push/PR/릴리스 · 테스트 판정 · 자기 코드 머지 |
| implementer (병렬) | Sonnet | ticket 구현, 게이트 실행, 커밋 | 계획 밖 파일 · 자기 작업 판정 |
| lookup | Haiku | 결정·코드·문서 찾아 전달 | **파일 쓰기 전부** |
| verify-tool | Haiku | 게이트·시나리오 실행, 출력 그대로 첨부(R46), 실패를 PL이 파악할 수 있게 요약(R51) | 코드 수정 · 실패를 통과로 · 안 돌린 걸 돌렸다고 |
| code-review | GPT | diff↔plan·spec 대조, 수정 **제안** | 코드 수정 · 머지 결정 |
| qa-design | Gemini Pro | 시나리오 설계, spec 1차 검토, plan 단순 검토 | **코드 읽기** · 구현 |
| qa-run | Gemini Flash | 시나리오 실행·판정 | 애매하면 통과 (무조건 실패 R17) |
| deploy | Haiku→Sonnet→Opus | push·PR·rc·노트 게시 | 정식 릴리스(사용자 명시만) · 운영 조작 · force push |
| docs | Sonnet/Haiku | README·공개 문서(en + .ko)·PR·노트 초안, 윤문 슬롯 | 코드 수정 · 확인 안 된 동작을 사실처럼 |
| advisor | Fable | 사슬 끝 원인 분석 | 사용자 허가 없는 권한 확장 |
역할 파일 `harness/roles/<r>.md`: 프론트매터 `must_not:`(집행 원본) · `may:`(설명) · `covered_by:` · 본문 절차.
**켜고 끄기.** pm·implementer·verify-tool은 고정이라 늘 켜져 있다. 나머지 역할은 끌 수 있다(§5). `covered_by:`는 꺼진 역할의 일을 맡는 쪽이다: planner·pl·qa-design·deploy·docs → pm · code-review → pl · qa-run → verify-tool(자기가 돌린 것을 스스로 판정하지 않으므로 판정은 사슬 위로 넘어간다) · lookup → `caller`(부른 역할이 직접 찾는다) · advisor → `user`(사슬의 끝). 맡은 역할은 꺼진 역할의 `must_not`도 함께 지키며, 자기 작업에 대한 판정은 사슬의 다음 역할(pl → pm → advisor → user)로 넘긴다.

## 3. 정지 조건과 검증기 (D3·D4)
### 등급 네 개
**HOLD** 사용자 답 필요 · **STOP** 사람 없이 고칠 수 있어 멈춤, 재개 가능 · **ESCALATE** 실패 사슬(pl→pm→advisor→user, R18) · **ABORT** 되돌림 — 검증기 판정이 아니라 역할의 행동.
모든 정지는 ①어디서 ②왜(`reason: <ID>`) ③어떻게 재개할지를 기록(R48). 같은 명령 재실행 = 그 자리에서 이어짐.

### 조건 24 — 7묶음 (상세 표는 draft D3)
| 묶음 | ID | kind |
|---|---|---|
| A 비가역 | A1 force push·태그 삭제(pre-push: HOLD)·main 재작성 / A2 정식 릴리스 / A3 데이터·운영 / A4 pre-release 루프 밖에서 로컬을 떠남 | intent |
| B 결정 | B1 열린 `asks:` / B2 불변식 변경에 결정 없음 / B3 intent·spec 충돌 / B4 로드맵 침묵·모순 / B5 외부 가정 붕괴로 범위 변경 | intent |
| P 전제 | P1 근거 무너짐(plan·ticket 먼저 고침) / P2 diff가 plan에서 벗어났는데 갱신 없음(R45) | knowledge |
| D 실패 | D1 같은 단위 2라운드(rc.1 전 = ticket, 후 = rc) / D2 red check 2회 / D3 flaky → 격리·계속·보고 / D4 거짓 통과 의심(게이트 출력이 비면 STOP이 아니라 WARN) / D5 증거 없는 pass | knowledge |
| E 비용 | E1 80% 경고 / E2 범위 예산 100% STOP / E3 rc·세션 100% HOLD — 값 없으면 경고만 | knowledge |
| F 위반 | F1 금지선 시도 / F2 드리프트 / F3 거절 재제시 | knowledge |
| G 중단 | G1 채팅·Ctrl+C·세션 종료 → 재개 정보 기록 / G2 spec 요약 거부 | intent |
`kind` = spike에서 살린 구분: **intent**(사람 몫, 자동화 않음) / **knowledge**(배워서 줄어듦). 지표: 항목당 knowledge stop 수. 카운터(D1·D2)는 통과하면 리셋.
수치: 단계 스킬은 역할 실행이 끝날 때마다 `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`을 한 줄 부르고, 벤더가 토큰 수를 주지 않으면 기록하지 않는다. `reins check`와 `reins gate`는 실행할 때마다 `reins/metric@1` 한 줄을 `.loctx/reports/metrics.jsonl`에 덧붙인다. 토큰 사용량은 호출한 쪽이 `reins metrics record`로 남긴다. `reins metrics`는 토큰을 역할·벤더·ticket·intent별로, knowledge stop을 ticket별로 요약한다.
조사 레포에 있던 것은 A·B1·D1·D2뿐 — 나머지는 전부 새로 생긴다.

### 조건별로 지키는 방식
위 금지선 표와 같은 원천·열이다(`held`: 차단·검사·권고). 정지 조건과 전환 지점 여섯 개를 다룬다. `stops.yaml`의 `detect:`가 `verifier`여도 여기서는 `advised`일 수 있다. `held`는 설계 의도가 아니라 지금 코드가 하는 일을 적기 때문이다.

<!-- enforcement:begin stops -->
| id | 지킴 | 수단 | 빈틈 |
|---|---|---|---|
| A1 | 차단 | `deny`, `hook:pre-push` | moving a published tag forward to a descendant passes the ancestry test |
| A2 | 권고 | `role` | — |
| A3 | 권고 | `role` | — |
| A4 | 차단 | `hook:pre-push` | only a push to the default branch is held; other ways of leaving the machine are not detected |
| B1 | 검사 | `check:ticket-start` | — |
| B2 | 권고 | `role` | — |
| B3 | 권고 | `role`, `check:ticket-start` | the scope conflict is a role's judgement; ticket-start checks only the approval chain |
| B4 | 권고 | `role` | — |
| B5 | 권고 | `role` | — |
| P1 | 권고 | `role` | — |
| P2 | 검사 | `check:ticket-start`, `check:rc-close` | only ticket-in-plan; a diff is not compared with plan.md |
| D1 | 검사 | `check:verdict` | does not tell a ticket before rc.1 from an rc after |
| D2 | 권고 | `role` | no memory across runs |
| D3 | 권고 | `role` | no alone-versus-full-run comparison |
| D4 | 차단 | `gate`, `check:verdict` | an empty gate output is only a WARN |
| D5 | 검사 | `check:verdict` | — |
| E1 | 권고 | `role` | nothing reads a budget or a token count |
| E2 | 권고 | `role` | nothing reads a budget or a token count |
| E3 | 권고 | `role` | T5 lists it but nothing reads a budget or a token count |
| F1 | 권고 | `role` | the deny rules stop some attempts in Claude Code, but no stop is recorded |
| F2 | 차단 | `hook:pre-commit`, `check:drift`, `check:ticket-start`, `check:rc-close` | — |
| F3 | 권고 | `role` | — |
| G1 | 권고 | `role` | no signal handler and no resume record on an interrupt |
| G2 | 권고 | `role` | — |
| T1 | 검사 | `check:ticket-start` | budget-left is not implemented |
| T2 | 차단 | `hook:pre-commit` | only when the hook is installed; the P2 and C10 diff checks do not exist |
| T3 | 검사 | `check:verdict` | — |
| T4 | 차단 | `hook:pre-push` | implements A1 and the default-branch push (A4); A2, A3, C6 and the loop-step check do not exist |
| T5 | 검사 | `check:rc-close` | E3 is not implemented |
| T6 | 권고 | `role` | no code runs on an interrupt or a violation signal |
<!-- enforcement:end -->

### 비용 범위 — 좁은 범위가 이김
프로젝트 기본값(install, `policy/budget`) < 버전(PM, plan.md) < **사용자 정의 범위**(기본 제공: ticket·rc·세션·역할; `configure budget`). 단위 토큰. 기본값 없으면 첫 적용 때 측정.

### 검증기 = `reins check` — 전환 지점 6
T1 ticket 시작 전(B1·의존·예산·바인딩·**`asks:`↔`decisions:` 대조로 같은 질문 재발 방어**) · T2 커밋 전(P2·C10·F2·C4·C5) · T3 판정 시(D1~D5·증거) · T4 떠나기 전(A·C6·루프 단계·**기본 브랜치로 가는 push는 A4 HOLD**, publish 워크플로의 `release: v…` 커밋만 `GITHUB_ACTIONS=true`에서 예외) · T5 rc 종료(E3·열린 ticket 0(기획분·안정화분 모두)·history·plan 일치율 S7·**`.loctx/release/<V>.md`로 다음 rc 번호를 보고(없으면 rc.1)하고, 그 번호가 이미 기록돼 있으면 F2**) · T6 상시(G1·F1).
`reins check --stage` 이름: `ticket-start --ticket <id>`(T1) · `pre-commit`(T2, 훅) · `verdict --ticket <id>`(T3) · `pre-push`(T4, 훅) · `rc-close --release <version> [--stable]`(T5). 자기 id가 없는 검사(의존·plan 일치·history 기록)는 F2로 보고한다.
판정 CONTINUE / HOLD / STOP / ESCALATE → bus `stop-report`(reason·재개 정보·사용자 언어 한 줄). exit 0/10/20/30.
루프 단: 역할만 줄고 T·조건 유지. 하네스 단: T2·T4·T6만.
34개(금지선 C1~C10, 조건 A1~G2) 각각을 지금 코드에서 누가 잡는지, 그리고 뒷받침하는 시나리오: [`violations.ko.md`](violations.ko.md).

## 4. 사람과 에이전트가 주고받는 다섯 파일 (D5·D6·D2)
공통: YAML 프론트매터(기계, 스키마 검증) + Markdown 본문(사람). 본문은 사용자 언어, 키와 bus는 영어. 빈 절은 `—`. **승인 = 프론트매터 `approvals:` + 상태 변경 커밋 트레일러 `Approved-by:`** — 별도 장부 없음.

| 파일 | 위치 | 절 | 승인 |
|---|---|---|---|
| **intent.md** | `.agents/intent/<NNN>_<slug>/` | 문제 · 바라는 결과 · 영향 · 제약 · 열린 질문 · **질의서 기록** · **하지 않을 것** | 사용자 |
| **spec.md** | 〃 | 요구 해석(`S-n`) · 설계(불변식 충돌 필수) · 우려 · 검증 기준 · 범위 밖. 프론트매터 `summary_for_user:` 3~5줄 | pm + qa-design 1차 → **사용자 요약 거부권**(R64) |
| **plan.md** | 〃 | 바뀌는 파일 · **작업 순서(→ticket)** · 위험 · 증명 · 테스트 체크리스트 · **이탈 기록**(R45). `agents:` 역할만, `budget:` | qa-design 단순 |
| **ticket** | `.loctx/ticket/<intent>-<n>_<slug>.md` | 조사 레포 work 7절 그대로(목적·현재 코드·작업·결정·기대·주의·검증). 프론트매터 `release: planned\|stabilization` · `asks:` · `budget:` · `depends:` | — |
| **bus** | `.loctx/bus/*.{request,response}.yaml` | request: changes·why·tried·not_tried·deadline·revert·errors(출력 그대로) / response: verdict·grounds·fixes·may_proceed·major_issues·evidence·suggested_next | — |

상태 전이: intent `approved` ∧ spec `accepted` ∧ plan `reviewed` 일 때만 T1 통과. plan §작업 순서 한 항목 = ticket 하나. intent 상태는 `draft` → `approved` → `released`다. 해당 intent의 stable 버전이 나가면 deploy 역할이 `released`로 바꾸고, `reins status`는 그 intent를 할 일 없이 `released` 한 줄로 접는다. `superseded`는 그대로다. ticket `done` → history 한 줄 → 삭제. bus는 응답이 history에 요약되면 삭제.

### 버전·rc 규약 (사용자)
버전 = intent 묶음. **rc.1 = 기획 전부 완료.** rc.N = 안정화만(버그·조정·작은 추가 intent). rc = 출시 전 사람 확인 단계. 버전 범위는 작게. ticket `release:`는 기획분/안정화분.

**PR 흐름.** 작업은 `type/topic` 브랜치 → PR → CI 초록 → 머지로만 기본 브랜치에 들어간다. deploy 역할이 브랜치를 push하고 PR을 열고(본문 초안은 docs) `gh pr checks --watch`로 기다린 뒤, 필수 체크가 모두 초록일 때만 `gh pr merge --rebase --delete-branch`로 머지한다. 빨간 체크가 있으면 머지하지 않고 pl에게 돌려준다(D2). pl·implementer는 머지하지 않는다. T4가 기본 브랜치(`master`/`main`) 직접 push를 A4로 막는다. 브랜치 보호(PR 필수, 체크 `ci`)는 저장소 설정이라 사용자가 켠다.

**릴리스 설정.** 저장소의 릴리스 방식은 `.agents/harness/install.yaml`의 `release:`로 정한다(선택. `reins/install@1`은 그대로이고 키만 더해진다). `workflows:`는 `{file, inputs, stages: [rc, stable], approval: npm-staged|none}` 목록이다(`stages` 기본은 둘 다, 입력 값 안의 `{version}`은 dispatch 버전으로 바뀐다). `release:`가 없으면 deploy는 머지까지만 하고 "release 설정 없음"을 보고한다. `reins install`·`reins update`는 파일을 다시 쓸 때 `release:`와 자신이 모르는 키를 보존한다. `install.yaml`에 `release:` 키가 없으면 `install`과 `migrate`(dry-run 포함)가 `.github/workflows/*.yml|yaml`에서 `on: workflow_dispatch` 트리거(문자열·목록·맵 형태)를 가진 워크플로를 찾아 노트에 워크플로마다 `{file, inputs, approval: none}` 초안을 하나씩 보인다. 입력 이름이 `version`이면 `"{version}"`, `tag`면 `"v{version}"`, boolean이면 `"false"`, 그 밖에는 `"<fill in>"`으로 채운다. 제안일 뿐이며 reins는 쓰지 않고 정하는 것은 maintainer다. **릴리스 문서.** `release:`에는 `docs: [{file, check}]`도 둘 수 있다(선택, 기본값 없음, 추가만). `roadmap-row`(첫 칸이 `<V>`인 표 줄이 있고 상태 칸이 `planned`·`계획`이 아님), `changelog-section`(rc는 `## [Unreleased] — <V>` 또는 `## [<V>]` 제목, stable은 `## [<V>]`), `mentions-version`(파일에 `<V>`가 독립된 토큰으로 있음, 예: README 상태 줄) 셋이다. T5 전에 docs 역할이 릴리스 브랜치에서 이 파일들을 고쳐서 릴리스 PR(rc·stable)에 함께 들어가게 한다. T5는 이전 상태가 남은 파일마다 F2 WARN(`docs: <file> still describes the previous state (<check>)`)을 하나씩 내며 STOP은 아니고, `release.docs`가 없으면 검사도 없다. 이 저장소는 `docs/ROADMAP.md`·`docs/ROADMAP.ko.md`(roadmap-row), `CHANGELOG.md`(changelog-section), `README.md`·`docs/README.ko.md`(mentions-version)를 설정한다. reins 자신의 흐름은 `workflows: [{file: publish.yml, inputs: {version: "{version}", dry_run: "false"}, approval: npm-staged}]`라는 값이다. 이 저장소의 `publish.yml`은 `PUBLISH_DEPLOY_KEY` 시크릿이 있으면 그 deploy key로 checkout한다. 그래서 기본 브랜치 ruleset의 bypass가 deploy key뿐이어도 릴리스 커밋과 태그를 push할 수 있고, 시크릿이 없으면 워크플로 토큰을 쓴다.

**rc와 stable.** deploy 역할의 범위는 PR, 저장소 기본 브랜치로의 머지, 설정된 워크플로 dispatch다. 버전 `<V>`에서 T5가 통과하면 T5가 보고한 번호로 `release:`에서 만든 `dispatch: gh workflow run <file> -f k=v …` 줄을 rc 단계의 워크플로마다 하나씩 출력하고(`--json`에도 담긴다), deploy 역할은 그 줄을 그대로 실행한다. 권한 때문에 dispatch가 거부되면 다른 방법을 찾지 않고 그 줄을 사용자에게 넘긴다. 그 뒤 `.loctx/release/<V>.md`(로컬, gitignore된 장부)에 한 줄(`- rc.<N> <커밋> <stage id> <날짜>`)을 덧붙인다. rc 뒤 수정은 `release: stabilization` ticket이다. 다 닫히면 T5가 다시 통과하고 다음 rc를 낸다. stable `<V>`는 사용자 지시가 있을 때만 낸다(A2). `reins check --stage rc-close --release <V> --stable`은 같은 검사를 하되 다음 rc 대신 stable 줄(`dispatch (stable — user's instruction only, A2): gh workflow run …`, `--json`에도 담김)을 내고, ledger에 rc가 없으면 `no rc recorded for <V>` WARN을 낸다. `--stable`이 없으면 `stable: rerun with --stable on the user's instruction` 한 줄만 더하므로, rc를 내는 에이전트에게는 실행할 stable 줄이 보이지 않는다. `approval: npm-staged`에 고유한 동작은 그 값의 워크플로에만 적용된다. run-name으로 run 찾기, 로그의 "staged with id"를 장부에 기록, 사용자의 npm staged 버전 승인(rc도 staged라서 승인 뒤에야 공개된다), stable 때 `v<V>-rc.*` 태그가 정확히 기본 브랜치 HEAD(rc 자신의 release 커밋)에 있어야 한다는 조건이다. 마지막 rc와 stable 사이에는 아무것도 들어올 수 없다.

### 단계 스킬
workflow 단계마다 스킬 하나, 모두 열 개다. `reins-loop`는 단계 스킬을 순서대로 부르는 지휘자이며 공통 규칙(판정 코드·metrics·중단 기록)만 담는다. 단계 스킬은 얇은 입구다: 첫 단계가 자기 check이고, 판정(CONTINUE·HOLD·STOP·ESCALATE)을 따르며 HOLD·STOP이면 멈추고, 따로 불려도 그 단계를 끝낸다. 판단은 역할에, 강제는 스크립트에 두고 스킬은 판정 로직을 더하지 않는다. `--stage` check가 없는 단계(roadmap·intent·spec·test·retro, ticket 없는 review)는 `reins check --drift`와 `reins status`로 시작하고, 앞 산출물이 없으면 HOLD로 사용자에게 묻는다.

| 스킬 | 역할 | 먼저 부르는 check | 출력 | 다음 |
|---|---|---|---|---|
| `reins-roadmap` | pm | status + drift | `docs/ROADMAP.md`(양판), 대상 버전 | `reins-intent` |
| `reins-intent` | pm | drift | 승인된 `intent.md` | `reins-spec` |
| `reins-spec` | planner → pm·qa-design → pl | drift, intent 승인 확인 | accepted `spec.md`, `plan.md`, ticket | `reins-implement` |
| `reins-implement` | implementer | **T1** | 커밋(훅 **T2**) | `reins-review` |
| `reins-review` | verify-tool → code-review, 판정은 pl | drift, ticket이 있으면 검증 교환 뒤 **T3** | bus 응답, ticket close | `reins-implement` 또는 `reins-test` |
| `reins-test` | qa-design → qa-run, verify-tool | status + drift, 그 버전에 열린 ticket 없음 | e2e 시나리오, 결과, 빌드 | `reins-release` |
| `reins-release` | deploy | **T5**(push 때 훅 **T4**) | PR·CI·merge·rc | `reins-retro` |
| `reins-retro` | pm | status | 회고 요약 | `reins-roadmap` 또는 다음 intent |

ticket 없는 `reins-review`(사용자가 직접 고친 범위)는 drift만 부르고 리뷰 전용 bus 쌍을 남기며, T3도 ticket close도 하지 않는다. 리뷰어에게 주는 diff는 설치된 사본(`.agents/harness`, `.agents/skills`, `.agents/SKILLS.md`, `.claude`)만 제외하고 그 `git diff --stat`을 덧붙인다. 설치된 사본의 변경은 항상 허용된다.

## 5. 프로젝트 것과 툴 것의 경계 (D7·D8·D9)
### `AGENTS.md` 관리 블록
`<!-- reins:begin <block> v=X -->`…`<!-- reins:end <block> -->` 넷: notice · workflow · skills · language. 밖은 프로젝트 것. 손대면 F2, 바꾸려면 `reins:override`. **읽기 마커** `<!-- reins:read invariants|secrets|gates -->`로 프로젝트 소유 절을 검증기가 읽는다. 훅 파일엔 `npx @bluenyang/reins check --stage …` 한 줄(마커). 중첩 AGENTS.md는 설치한 디렉터리만.
**update 두 길**: 스크립트 `reins update`(관리 블록·업스트림 파일·생성물, 멱등) + 스킬 `reins-update`(프로젝트 절에 필요한 변경을 PM이 제안→승인→적용). 변경 노트가 스킬 필요 여부를 말한다.

### `gates.yaml`
`gates.<name>.cmd`(명령 **하나**, 파이프·`&&` 금지) · `order` · `optional+needs`(못 채우면 manual 표시) · `mutating_forbidden: true` · `evidence: raw` · `secrets:`. PM 발견 절차: 읽기(package.json·Makefile·훅·CI) → 분류(수정형 제외) → 훅·CI가 이미 부르는 명령 우선 → 사용자 확인(auto면 리포트) → `--dry-run`. **하위 디렉터리**(모노레포): 발견 단계는 깊이 3까지(node_modules·.git·dist·build·vendor·.loctx·.agents 제외) `package.json`·`Makefile`·`go.mod`에서 *제안*도 낸다. 제안은 도구 자체의 디렉터리 옵션을 쓴 명령 하나(`pnpm --dir d s`, `make -C d t`, `go -C d test ./...`; 러너는 그 디렉터리 lock 파일, 없으면 루트 것)이고 이름은 `<dir 슬러그>-<script>`, 실행은 저장소 루트에서 한다. manual install은 목록을 보여 주고 고른 이름만 기록하며, auto는 루트 게이트만 넣고 제안은 notes로 보고한다. `reins configure gates [--add <name>…]`는 아직 없는 제안을 보여 주고, 고른 것을 기존 항목 뒤에 주석을 보존한 채 덧붙인다. 루프는 gates.yaml만 본다.

### `bindings`
`roles.<r>: {vendor, model, fallback, parallel, enabled}` · `vendors.<v>: {cli, available}` · `escalation` · `limits`(역할 상한). **두 층.** 커밋되는 `bindings.yaml`은 팀 기본값이며 더는 `detected`를 적지 않는다(옛 `detected:` 키는 읽되 무시한다. `reins update`가 이 키와 타임스탬프를 로컬 파일로 옮기고 — 로컬에 이미 있는 vendor 항목은 그대로 둔다 — `bindings.yaml`에서는 그 키만 지워 주석과 나머지 키를 그대로 둔다. `--dry-run`은 옮길 목록만 보여준다). git-ignore되는 `.loctx/bindings.local.yaml`(`reins/bindings-local@1`)에는 `vendors.<v>: {detected, at}`(install이나 `configure bindings`가 감지를 실행할 때만 쓴다)와 사용자별 `roles.<r>: {model, enabled}` 덮어쓰기가 있다(둘 중 하나 이상. `configure bindings --local --set role=model`과 `--local --enable|--disable`은 `roles`만 쓴다). **켜고 끄기(추가만).** 어느 파일이든 `roles.<r>.enabled: false`가 역할을 끈다. 바인딩 항목은 남으므로 모델 선택이 보존된다. 역할이 켜져 있는지는 고정 역할(pm·implementer·verify-tool. 여기 적힌 `enabled: false`는 경고와 함께 무시한다)이면 켜짐, 아니면 `local enabled ?? 팀 enabled ?? true`로 정한다. 모델처럼 local이 양쪽으로 이긴다. `reins configure bindings --disable <role…>|--enable <role…> [--local]`가 이 값을 쓴다(local 키가 팀 값과 같아지면 지운다. 고정 역할이나 없는 역할은 거절하고 아무것도 쓰지 않는다). **역할별 resolver 순서:** local 덮어쓰기 → 팀 바인딩(그 벤더가 감지됐을 때, claude는 늘 가능) → 역할 파일의 `fallback_binding`(그 벤더가 감지됐을 때) → pm 모델. 결과는 `{role, vendor, model, source: local|team|fallback|pm, enabled, covered_by?}`이다(꺼진 역할도 모델을 해석하므로 다시 켤 때 그대로 보인다). local 파일에 없는 벤더는 그 자리에서 감지하고 다시 쓰지 않는다. `reins status`(`--json`의 `bindings`)와 `configure bindings --show`가 해석된 표를 보여 준다. 꺼진 역할은 `off → <covered_by>`, local 파일로만 켜진 역할은 `on (local)`로 보인다 → Claude만으로 12 역할. manual(벤더 선택→기본 배치→수정) / auto(감지→적용). `configure bindings` = 파일 + 생성물 재생성. 모델 ID는 바인딩 시 CLI에서 1회 확인(`unverified` 표시 가능).

## 6. 생성과 드리프트 (D10)
원본 → 생성물: `skills/` → `.claude/skills/` **복사**(Codex·Gemini·Cursor는 `.agents/skills/` 직접) · `roles/`+bindings → `.claude/agents/<r>.md`, `.codex/agents/<r>.toml`+`config.toml` · `policy/` 권한 → `.claude/settings.json`(+SKILL `allowed-tools`), 훅 → `settings.json#hooks`(T2·T4·T6). 권한은 **금지선의 역**으로 생성. 머리말 "generated — do not edit". 1차 검증은 Claude 생성물만. 생성되는 agent 파일은 커밋된 팀 기본값으로만 만든다(local 파일은 쓰지 않는다). 그래서 한 사용자의 덮어쓰기가 다른 사람의 drift를 만들지 않는다. 팀이 끈 역할(고정 역할 제외)은 agent 파일을 만들지 않고, 전에 만든 파일은 `configure`와 `update`가 `generated.yaml` 기준으로 지운다. 팀은 껐지만 한 사용자가 local로 켠 역할에는 agent 파일이 없으므로, 루프 스킬이 해석된 모델로 직접 부른다(Claude면 역할 파일 본문을 넘긴 일반 subagent). 팀 벤더가 Claude가 아닌 역할도 Claude agent 파일을 `fallback_binding`(없으면 pm 모델)으로 만들고, 머리말에 "fallback for <vendor>"를 적는다. 그 벤더가 없는 사용자는 이 파일로 역할을 돌린다. 루프 스킬은 역할이 쓸 모델을 `reins status --json`(`bindings`)에서 가져온다.
드리프트 `reins check --drift` 3층: **형식**(`skills-ref validate`) · **일치**(재생성 diff = 0, 스킬 바이트 일치) · **규약**(스키마·tier·권한≤금지선·관리 블록·오버라이드 버전·approvals↔트레일러·bus 산문 없음·`.loctx` gitignore). 일치 층은 tier가 설치하는 파일만 비교한다. tier가 더 이상 설치하지 않는 upstream 파일(예: `CHANGELOG.md`)은 F2 STOP이 아니라 `reins update`를 안내하는 WARN이다. `reins update`는 `.agents/harness/` 아래에서 upstream에 있고 tier 밖이며 프로젝트 소유가 아닌 파일을 지우고 목록을 출력한다(`bindings.yaml`·`gates.yaml`·`install.yaml`·`generated.yaml`과 upstream에 없는 파일은 남는다). `--dry-run`은 목록만 낸다. 실패 = F2. 훅과 CI가 같은 스크립트.

## 7. 세대 판별과 migrate (D11)
신호(순서대로 첫 일치): 미적용 / 1세대(`.ai/`만) / 2세대(AGENTS만) / 3세대(`.claude/commands/`) / 4세대(skills 10+ & `work-cicd-to|go-flow`) / reins(마커).
매핑: history → `.loctx/history/` 그대로 · 열린 plan → intent 폴더 `draft` · 열린 work → ticket(프론트매터 변환) · ROADMAP.local 그대로, pub → `docs/ROADMAP.md` · release·pr 그대로 · test 리포트 → reports, 섞인 **도구 파일은 목록만**(비밀 가능) · verify/benchmark/artifacts 목록만 · conversation 등 → context · `<repo>-workflow`·commands **버림**(고유 절차는 보존 목록) · `.claude/memory`는 그대로 두고 파일마다 `.loctx/knowledge-proposals/memory-<name>.md` 초안을 만든다(`reins knowledge accept`로 승격) · AGENTS 절 유지 + Workflow·Skills·Language만 치환(원문 보관) · 1세대 = install + `_legacy/`.
열린 work는 실행 한 번에 경로순으로 `000-1…000-N`을 매겨 `.loctx/ticket/000-<n>_<slug>.md`로 쓴다(원래 id는 `migrated_id`, 원래 경로는 `migrated_from`). `depends`는 같은 하위 폴더·버전 안에서 열린 항목 하나만 그 id를 가질 때만 새 id로 바꾸고, 끝난 의존은 빼며, 나머지는 빼서 `asks:`에 적는다. `migrated_from`이 이미 있는 ticket은 다시 만들지 않는다. ticket을 만든 실행은 intent 000이 없으면 `.agents/intent/000_migrated/intent.md`를 `draft`로 써서 목록을 적는다(version은 `package.json`, 없으면 `0.0.0`). 그 뒤 T1은 "intent 000이 draft"로 멈추고 `status`는 "user: approve the intent"를 보여 준다. legacy는 `.loctx/_legacy/`(`--legacy local`, 기본) 또는 `.agents/legacy/`(`--legacy committed`)로 가며, 비밀 패턴에 걸린 파일은 어느 쪽이든 `.loctx/_legacy/`에 남고 보고서에 적는다. 나머지는 "커밋 전 검토"를 적는다.
`migrate --dry-run`(과 `install --dry-run`)은 install 단계도 계획만 세우고 아무것도 쓰지 않는다. 노트에 install이 제안할 하위 디렉터리 게이트(이름과 명령)와 만들 메모리 초안(경로)이 나온다.
멱등. 매 실행 history 한 장. **첫 대상 = 이 레포.**

## 8. knowledge (D12)
`.agents/knowledge/<date>_<slug>.md`: 프론트매터 `kind: decision|failure` · `status` · `supersedes` · `topics` · `decisions` · `symptoms` · `applies_to` · `source` · `approved`. failure는 `symptom·cause·fix·check·verified`. 본문 4절 **결정 · 이유 · 적용(안 되는 경우 포함) · 바뀌면** — "어떻게 했다"는 쓰지 않는다.
승격: 같은 reason·decision **2회**(또는 `verified ≥ 2`) → PM 제안 → 사용자 승인(요약+거부권) → 커밋 → 범용이면 promote 후보. 바뀐 결정은 새 항목 + `superseded`. 스택별 실패 **시드**는 `harness/knowledge-seeds/`에서 `source: preset`으로.
세기(`reins retro`, 스크립트 — 세기만 하고 문장은 PM이 쓴다): **키**는 `stop:<id>`(`metrics.jsonl`의 정지 사유), `reason:<slug>`(history 쪽의 선택 줄 `reasons: a, b`, `decisions:` 바로 다음 줄), `decision:<slug>`(`decisions:` 줄)다. **서로 다른 티켓·history 페이지 두 곳 이상**에 나온 키가 후보다(한 티켓 안의 반복은 1, 티켓 없는 페이지는 한 장이 1). 이미 `status: active` knowledge 항목의 `decisions`·`symptoms`에 있는 키(접두어 없는 슬러그, 정지는 id)는 빠지고, superseded 항목의 키는 다시 후보가 된다. `reins retro [--release <v>] [--json]`은 정지 id별 횟수, 실패 라운드(HOLD·STOP 판정 수), 역할별 토큰도 보이며 `--release`는 `version`이 v인 intent로 범위를 좁힌다. `reins status`도 같은 후보 수를 보인다. `reins knowledge propose <key|slug> [--from <history>…]`는 템플릿으로 `.loctx/knowledge-proposals/<slug>.md` 초안을 쓰고(`approved` 없음), 사용자가 답한 뒤 회고 스킬이 부르는 `reins knowledge accept <slug>`만 이를 `approved: {by: user, at: <날짜>}`와 함께 `.agents/knowledge/<date>_<slug>.md`로 옮긴다. PM이 교훈이 아니라고 판단한 후보는 `reins knowledge dismiss <key> --reason <text>`로 기록한다(`.loctx/knowledge-proposals/dismissed.jsonl`에 그때의 단위 수와 함께 한 줄). retro와 status는 그보다 많은 단위에서 다시 나타날 때까지 그 후보를 세지 않는다. `approved`가 없는 knowledge 항목(`source: preset` 제외)은 `reins check`에서 F2 STOP이다.
검색 `reins recall`: `decisions·topics·symptoms` 3축 grep → 최근 N → 벡터는 선택 슬롯.

## 9. CLI와 플러그인 (D13·D14)
`npx @bluenyang/reins` — `install <tier> [--mode manual|auto]` · `migrate <tier> [--legacy local|committed]` · `update [--yes]` · `config`(인자 없음. 터미널 — stdin·stdout 모두 TTY — 에서는 설정 화면: `models and roles configuration`과 `exit`가 있는 메인 화면이다. `@clack/prompts`를 주입 가능한 `Prompter` 뒤에 두고 화면을 그릴 때만 불러오며, Ctrl-C는 아무것도 쓰지 않고 나가는 것이다. models and roles 화면에는 `< Configuration`, `exit`, 쓰기 범위(`local`이 기본이며 `.loctx/bindings.local.yaml`, `global`은 커밋되는 `bindings.yaml`), 역할 켜고 끄기(고정 역할은 항상 켜짐으로만 보이고 목록에 넣지 않는다), 역할마다 `[ON|OFF] role vendor model (source)` 한 줄이 나오고, 사용자 자신의 값에는 `(local)`이 붙는다. 역할을 고르면 역할 화면으로 가서 감지된 벤더(claude는 늘 나옴)와 모델을 차례로 고른다. google·cursor는 `agy models`·`cursor-agent models`(10초, 실패하면 이유 한 줄과 알려진 목록)로, claude·openai는 알려진 목록(역할 파일의 default·fallback 바인딩, 확인된 모델, 현재 바인딩)으로 채우고 목록 끝에는 늘 `other`(모델 ID 직접 입력)가 있다. 고른 값은 바로 그 범위에 `configure bindings`로 쓰고(global은 vendor 파일도 다시 만든다) 화면을 다시 그린다. 터미널이 아니면 해석된 bindings 표(`configure bindings --show`와 같다)와 `configure …` 플래그 명령을 알리는 한 줄을 내고 exit 0이다. `--json`은 `{bindings}`를 낸다. 화면이 주는 역할 켜고 끄기의 플래그 형식이 `configure bindings --disable|--enable`이며, 터미널 없이 묻지 않고 동작한다. 에이전트와 CI가 쓴다) · `configure bindings [--set r=m…] [--vendors …] [--disable <role…>|--enable <role…>] [--local] [--show]|budget|gates [--add <name>…]|language` · `check [--stage] [--drift]` · `gate [<name>…] [--ticket] [--respond]` (gates.yaml 그대로 실행, 원본 출력을 `$ cmd` … `exit N` 형식으로 `.loctx/reports/`에 — T3가 읽는 증거. `--ticket <id> --respond`는 응답 없는 가장 최근 `kind: verify` 요청에 bus 응답 `<id>_<nn>.response.yaml`도 쓴다 — 모든 게이트가 돌아 exit 0일 때만 verdict pass, `evidence:`는 보고서 경로, `may_proceed` 포함. stdout에는 게이트마다 pass/fail 한 줄과 실패 게이트의 시그니처·file:line만 내고 원본은 내지 않으며, 열린 verify 요청이 없으면 쓰지 않고 exit 1. 그래서 verify-tool은 `gate --respond`와 `check --stage verdict` 두 번의 호출이다) · `new intent <slug> [--version] [--origin]` · `new ticket <intent> <step> <slug> [--title] [--depends] [--release] [--role]` · `new request <ticket> <kind> [--from] [--to]`(하네스 템플릿에서 파일을 만든다 — 다음 빈 번호. ticket은 plan의 `tickets:`가 예약했고 아직 쓰이지 않은 id를 먼저 쓴다. 스키마 검증을 먼저 통과해야 쓰고, 이미 있는 파일은 덮어쓰지 않으며, 거부하면 exit 1, 경로는 stdout, 대화형 질문 없음) · `metrics [--intent]`(`.loctx/reports/metrics.jsonl` 요약: 토큰을 역할·벤더·ticket·intent별로, knowledge stop을 ticket별로)와 `metrics record --role --tokens [--ticket|--intent]`(역할 실행에 쓴 토큰을 호출한 쪽이 보고, reins는 모델을 부르지 않는다) · `retro [--release <v>]`(정지 id·리뷰 사유·결정·실패 라운드·토큰, 반복 키를 knowledge 후보로; 세기만) · `knowledge propose <key> [--from <history>…]` / `knowledge accept <draft>`(초안은 `.loctx/knowledge-proposals/`, accept가 `approved`와 함께 `.agents/knowledge/`에 씀) / `knowledge dismiss <key> --reason <text>`(교훈이 아니라고 판단한 후보) · `recall` · `status`(후보 수도) · `doctor`. 전부 `--dry-run`·`--json`. TS, Node ≥ 22. 배포되는 것에는 Python이 필요 없다(R65 — 개발·테스트 도구는 써도 된다). **CLI는 모델을 부르지 않는다** — 에이전트 일은 스킬(`reins-setup` 등)이.
install은 3·4세대 하네스 위에서는 **거부하고 `migrate`로 안내**한다. 1·2세대면 설치하되 옛 `.ai/`는 건드리지 않고 migrate를 안내한다. 버전 핀과 설정은 `.agents/harness/install.yaml`(tier·version·cli·mode·language, 선택 `release` — §4 "릴리스 설정". 파일은 `harness/schemas/install.schema.json`으로 검증하고 모르는 키는 보존한다). `version`은 하네스 버전, `cli`는 설치를 쓴 패키지 버전이며, 단계 스킬은 `npx @bluenyang/reins@<cli>`로 CLI를 부른다.
install 질문(manual): 벤더 · 바인딩 조정 · 게이트 확인 · 비밀 패턴 · 훅 **제안만** · 공개 레포? · 문서 언어 · 예산(선택). auto는 감지·기본값·리포트. 터미널(stdin·stdout TTY)이고 `--mode manual`이며 `--json`이 아니면 이 중 넷은 화면이다. 벤더는 claude·openai·google·cursor multiselect(감지된 벤더 미리 선택, claude 고정), 언어는 `ko`·`en`·`other`(other면 코드를 입력) select, 게이트 확인은 찾은 게이트를 나열하는 confirm, 하위 게이트는 제안 multiselect다. 화면을 나가면(Ctrl-C) 아무것도 쓰지 않는다. 터미널이 아니면 같은 질문을 예전과 같은 문자열·파싱으로 한 줄씩 묻기 때문에 파이프로 넣은 답이 그대로 동작한다. auto는 묻지 않는다. 터미널에서 `--yes`·`--dry-run`·`--json` 없이 `update`를 하면 먼저 dry run으로 계획(`+`/`~`/`-` 파일, bindings 이동, 덮어쓴 블록, changelog 항목)을 보여 주고 `Apply this update?`를 묻는다. no면 아무것도 쓰지 않고 exit 0이다. `--yes`·비TTY·`--json`이면 예전처럼 바로 실행하고, 바뀔 것이 없으면 묻지 않고 `already up to date`만 말한다.
레포 = Claude Code 플러그인 + 마켓플레이스 + npm 패키지. 저장소 루트가 둘 다다. `.claude-plugin/plugin.json`(name `reins`, `version`은 package.json과 같음, userConfig `language` 기본 `ko`·`default_mode` 기본 `manual`, `skills`·훅·에이전트·MCP·의존성 없음)과 `.claude-plugin/marketplace.json`(마켓플레이스 `bluenyang`, 항목 하나의 `skills`는 `["./skills/reins-setup"]`이라 플러그인은 `/reins:reins-setup`만 노출한다 — 나머지 아홉 스킬은 loop 계층 이상에서 `reins install`이 프로젝트에 쓰는 사본에만 두어 같은 스킬이 두 벌 생기지 않게 한다). `skills/reins-setup/SKILL.md`는 CLI를 `npx @bluenyang/reins@<version>`으로 고정해서 부르고, `cli/src/scripts/sync-version.ts`(`version` 라이프사이클 스크립트)가 package.json 기준으로 plugin.json과 이 고정 버전을 고치며, 세 값이 같은지 테스트가 확인한다. 그 밖: `skills/` · `agents/`(생성) · `harness/`(원본의 원본 + templates + knowledge-seeds + VERSION) · `cli/` · `codex/ gemini/ cursor/`(1차 unverified) · `hooks/` · `docs/ test/ .agents/ .loctx/`. 플러그인 루트 `bin/` 없음. npm 패키지에는 `.claude-plugin`을 넣지 않는다(마켓플레이스는 git으로 받는다). 선택 의존(humanize-korean·diagram-design)은 감지해 권장만.

## 10. `spike/` (D15)
생각 10개 살림(must_not 프론트매터 · intent/knowledge stop · failure 카탈로그+verified · 시드 · suggested_next · metrics.jsonl · 카운터 리셋 등 — §3·§4·§8에 반영). 코드·구조 전부 버림(Python, state.json 상태 기계, dispatch, 8단계, 게이트 프리셋, TOML, md 핸드오프). **디렉터리는 구현 시작 시 삭제**, 해시 `9ebb597`로 참조 — 사용자 확인.

## 11. 1차 구현 순서 (제안)
1. `cli/` 뼈대 + `check`(검증기 T2·T4 + 드리프트 형식·일치) — 가장 먼저, 자기 레포에 훅으로 건다.
2. `harness/` 원본: roles 12 · policy(C1~C10, A~G) · schemas(5 파일) · templates.
3. `install graph --mode manual` → 이 레포에 self-install → `.agents/`·`.loctx/` 생성 (S5).
4. `migrate` — 이 레포의 `.ai/` → v4 배치 (S1).
5. 생성기(Claude) + `update` + `configure bindings`.
6. 스킬 입구(`reins-setup`과 loop 계층의 단계 스킬 아홉 개) → 첫 intent를 **자기 루프로** 돌린다 (R66).
7. metrics.jsonl로 비용 측정 → 루프·하네스 단으로 깎아 내리기(2차).

## 부록 — 조사자가 기본값으로 정한 것 (사용자 미확인, 설계 확정 시 함께)
승인 기록 방식 · 생성 표 · 드리프트 3층 · 세대 신호 · migrate 매핑 · knowledge 형식·승격 임계 · CLI 명령면·exit code · install 질문표 · 플러그인 트리 · spike 처분 · 1차 구현 순서.
