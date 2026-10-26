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
### 공통 금지선 C1~C10 — 전 역할, 검증기가 집행
C1 "통과하기 위한" 구현(하드코딩·보이기만) · C2 `AGENTS.md` 관리 블록·`policy/`·`roles/` 수정(PM·update만) · C3 자기 권한 파일·생성물 수정 · C4 비밀값 읽기 · C5 훅 우회·게이트 출력 가공(`| tail`) · C6 push/PR/머지/릴리스/태그(배포 역할만) · C7 사용자 확인 없이 과거 결정 뒤집기 · C8 거절된 제안 재제시 · C9 운영 서버·클러스터 조작 · C10 intent·plan 밖 변경(새 ticket으로)

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
역할 파일 `harness/roles/<r>.md`: 프론트매터 `must_not:`(집행 원본) · `may:`(설명) · 본문 절차.

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
수치: `reins check`와 `reins gate`는 실행할 때마다 `reins/metric@1` 한 줄을 `.loctx/reports/metrics.jsonl`에 덧붙인다. 토큰 사용량은 호출한 쪽이 `reins metrics record`로 남긴다. `reins metrics`는 토큰을 역할·벤더·ticket·intent별로, knowledge stop을 ticket별로 요약한다.
조사 레포에 있던 것은 A·B1·D1·D2뿐 — 나머지는 전부 새로 생긴다.

### 비용 범위 — 좁은 범위가 이김
프로젝트 기본값(install, `policy/budget`) < 버전(PM, plan.md) < **사용자 정의 범위**(기본 제공: ticket·rc·세션·역할; `configure budget`). 단위 토큰. 기본값 없으면 첫 적용 때 측정.

### 검증기 = `reins check` — 전환 지점 6
T1 ticket 시작 전(B1·의존·예산·바인딩·**`asks:`↔`decisions:` 대조로 같은 질문 재발 방어**) · T2 커밋 전(P2·C10·F2·C4·C5) · T3 판정 시(D1~D5·증거) · T4 떠나기 전(A·C6·루프 단계·**기본 브랜치로 가는 push는 A4 HOLD**, publish 워크플로의 `release: v…` 커밋만 `GITHUB_ACTIONS=true`에서 예외) · T5 rc 종료(E3·열린 ticket 0(기획분·안정화분 모두)·history·plan 일치율 S7·**`.loctx/release/<V>.md`로 다음 rc 번호를 보고(없으면 rc.1)하고, 그 번호가 이미 기록돼 있으면 F2**) · T6 상시(G1·F1).
`reins check --stage` 이름: `ticket-start --ticket <id>`(T1) · `pre-commit`(T2, 훅) · `verdict --ticket <id>`(T3) · `pre-push`(T4, 훅) · `rc-close --release <version>`(T5). 자기 id가 없는 검사(의존·plan 일치·history 기록)는 F2로 보고한다.
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

상태 전이: intent `approved` ∧ spec `accepted` ∧ plan `reviewed` 일 때만 T1 통과. plan §작업 순서 한 항목 = ticket 하나. ticket `done` → history 한 줄 → 삭제. bus는 응답이 history에 요약되면 삭제.

### 버전·rc 규약 (사용자)
버전 = intent 묶음. **rc.1 = 기획 전부 완료.** rc.N = 안정화만(버그·조정·작은 추가 intent). rc = 출시 전 사람 확인 단계. 버전 범위는 작게. ticket `release:`는 기획분/안정화분.

**PR 흐름.** 작업은 `type/topic` 브랜치 → PR → CI 초록 → 머지로만 기본 브랜치에 들어간다. deploy 역할이 브랜치를 push하고 PR을 열고(본문 초안은 docs) `gh pr checks --watch`로 기다린 뒤, 필수 체크가 모두 초록일 때만 `gh pr merge --rebase --delete-branch`로 머지한다. 빨간 체크가 있으면 머지하지 않고 pl에게 돌려준다(D2). pl·implementer는 머지하지 않는다. T4가 `master`/`main` 직접 push를 A4로 막는다. 브랜치 보호(PR 필수, 체크 `ci`)는 저장소 설정이라 사용자가 켠다.

**rc와 stable.** 버전 `<V>`에서 T5가 통과하면 deploy 역할이 T5가 보고한 번호로 `gh workflow run publish.yml -f version=<V>-rc.<N> -f dry_run=false`를 돌리고, `.loctx/release/<V>.md`(로컬, gitignore된 장부)에 한 줄(`- rc.<N> <커밋> <stage id> <날짜>`)을 덧붙인 뒤 사용자에게 npm에서 staged 버전을 승인하라고 알린다. rc도 staged라서 승인 뒤에야 공개된다. rc 뒤 수정은 `release: stabilization` ticket이다. 다 닫히면 T5가 다시 통과하고 다음 rc를 낸다. stable `<V>`는 사용자 지시가 있을 때만 낸다(A2). publish 워크플로는 `v<V>-rc.*` 태그가 있고 그 커밋이 정확히 기본 브랜치 HEAD(rc 자신의 release 커밋)일 때만 진행한다. 마지막 rc와 stable 사이에는 아무것도 들어올 수 없다.

## 5. 프로젝트 것과 툴 것의 경계 (D7·D8·D9)
### `AGENTS.md` 관리 블록
`<!-- reins:begin <block> v=X -->`…`<!-- reins:end <block> -->` 넷: notice · workflow · skills · language. 밖은 프로젝트 것. 손대면 F2, 바꾸려면 `reins:override`. **읽기 마커** `<!-- reins:read invariants|secrets|gates -->`로 프로젝트 소유 절을 검증기가 읽는다. 훅 파일엔 `npx @bluenyang/reins check --stage …` 한 줄(마커). 중첩 AGENTS.md는 설치한 디렉터리만.
**update 두 길**: 스크립트 `reins update`(관리 블록·업스트림 파일·생성물, 멱등) + 스킬 `reins-update`(프로젝트 절에 필요한 변경을 PM이 제안→승인→적용). 변경 노트가 스킬 필요 여부를 말한다.

### `gates.yaml`
`gates.<name>.cmd`(명령 **하나**, 파이프·`&&` 금지) · `order` · `optional+needs`(못 채우면 manual 표시) · `mutating_forbidden: true` · `evidence: raw` · `secrets:`. PM 발견 절차: 읽기(package.json·Makefile·훅·CI) → 분류(수정형 제외) → 훅·CI가 이미 부르는 명령 우선 → 사용자 확인(auto면 리포트) → `--dry-run`. 루프는 gates.yaml만 본다.

### `bindings`
`roles.<r>: {vendor, model, fallback, parallel}` · `vendors.<v>.detected` · `escalation` · `limits`(역할 상한). **감지 안 된 벤더의 역할은 fallback, 없으면 pm 모델** → Claude만으로 12 역할. manual(벤더 선택→기본 배치→수정) / auto(감지→적용). `configure bindings` = 파일 + 생성물 재생성. 모델 ID는 바인딩 시 CLI에서 1회 확인(`unverified` 표시 가능).

## 6. 생성과 드리프트 (D10)
원본 → 생성물: `skills/` → `.claude/skills/` **복사**(Codex·Gemini·Cursor는 `.agents/skills/` 직접) · `roles/`+bindings → `.claude/agents/<r>.md`, `.codex/agents/<r>.toml`+`config.toml` · `policy/` 권한 → `.claude/settings.json`(+SKILL `allowed-tools`), 훅 → `settings.json#hooks`(T2·T4·T6). 권한은 **금지선의 역**으로 생성. 머리말 "generated — do not edit". 1차 검증은 Claude 생성물만.
드리프트 `reins check --drift` 3층: **형식**(`skills-ref validate`) · **일치**(재생성 diff = 0, 스킬 바이트 일치) · **규약**(스키마·tier·권한≤금지선·관리 블록·오버라이드 버전·approvals↔트레일러·bus 산문 없음·`.loctx` gitignore). 실패 = F2. 훅과 CI가 같은 스크립트.

## 7. 세대 판별과 migrate (D11)
신호(순서대로 첫 일치): 미적용 / 1세대(`.ai/`만) / 2세대(AGENTS만) / 3세대(`.claude/commands/`) / 4세대(skills 10+ & `work-cicd-to|go-flow`) / reins(마커).
매핑: history → `.loctx/history/` 그대로 · 열린 plan → intent 폴더 `draft` · 열린 work → ticket(프론트매터 변환) · ROADMAP.local 그대로, pub → `docs/ROADMAP.md` · release·pr 그대로 · test 리포트 → reports, 섞인 **도구 파일은 목록만**(비밀 가능) · verify/benchmark/artifacts 목록만 · conversation 등 → context · `<repo>-workflow`·commands **버림**(고유 절차는 보존 목록) · `.claude/memory` → knowledge · AGENTS 절 유지 + Workflow·Skills·Language만 치환(원문 보관) · 1세대 = install + `_legacy/`.
멱등. 매 실행 history 한 장. **첫 대상 = 이 레포.**

## 8. knowledge (D12)
`.agents/knowledge/<date>_<slug>.md`: 프론트매터 `kind: decision|failure` · `status` · `supersedes` · `topics` · `decisions` · `symptoms` · `applies_to` · `source` · `approved`. failure는 `symptom·cause·fix·check·verified`. 본문 4절 **결정 · 이유 · 적용(안 되는 경우 포함) · 바뀌면** — "어떻게 했다"는 쓰지 않는다.
승격: 같은 reason·decision **2회**(또는 `verified ≥ 2`) → PM 제안 → 사용자 승인(요약+거부권) → 커밋 → 범용이면 promote 후보. 바뀐 결정은 새 항목 + `superseded`. 스택별 실패 **시드**는 `harness/knowledge-seeds/`에서 `source: preset`으로.
검색 `reins recall`: `decisions·topics·symptoms` 3축 grep → 최근 N → 벡터는 선택 슬롯.

## 9. CLI와 플러그인 (D13·D14)
`npx @bluenyang/reins` — `install <tier> [--mode manual|auto]` · `migrate <tier>` · `update` · `configure bindings|budget|gates|language` · `check [--stage] [--drift]` · `gate [<name>…] [--ticket]` (gates.yaml 그대로 실행, 원본 출력을 `$ cmd` … `exit N` 형식으로 `.loctx/reports/`에 — T3가 읽는 증거) · `metrics [--intent]`(`.loctx/reports/metrics.jsonl` 요약: 토큰을 역할·벤더·ticket·intent별로, knowledge stop을 ticket별로)와 `metrics record --role --tokens [--ticket|--intent]`(역할 실행에 쓴 토큰을 호출한 쪽이 보고, reins는 모델을 부르지 않는다) · `recall` · `status` · `doctor`. 전부 `--dry-run`·`--json`. TS, Node ≥ 20, Python 없음(R65). **CLI는 모델을 부르지 않는다** — 에이전트 일은 스킬(`reins-setup` 등)이.
install은 3·4세대 하네스 위에서는 **거부하고 `migrate`로 안내**한다. 1·2세대면 설치하되 옛 `.ai/`는 건드리지 않고 migrate를 안내한다. 버전 핀과 설정은 `.agents/harness/install.yaml`(tier·version·mode·language).
install 질문(manual): 벤더 · 바인딩 조정 · 게이트 확인 · 비밀 패턴 · 훅 **제안만** · 공개 레포? · 문서 언어 · 예산(선택). auto는 감지·기본값·리포트.
레포 = Claude Code 플러그인 + 마켓플레이스 + npm 패키지. 저장소 루트가 둘 다다. `.claude-plugin/plugin.json`(name `reins`, `version`은 package.json과 같음, userConfig `language` 기본 `ko`·`default_mode` 기본 `manual`, `skills`·훅·에이전트·MCP·의존성 없음)과 `.claude-plugin/marketplace.json`(마켓플레이스 `bluenyang`, 항목 하나의 `skills`는 `["./skills/reins-setup"]`이라 플러그인은 `/reins:reins-setup`만 노출한다 — `reins-intent`·`reins-loop`는 `reins install`이 프로젝트에 쓰는 사본에만 두어 같은 스킬이 두 벌 생기지 않게 한다). `skills/reins-setup/SKILL.md`는 CLI를 `npx @bluenyang/reins@<version>`으로 고정해서 부르고, `scripts/sync-version.ts`(`version` 라이프사이클 스크립트)가 package.json 기준으로 plugin.json과 이 고정 버전을 고치며, 세 값이 같은지 테스트가 확인한다. 그 밖: `skills/` · `agents/`(생성) · `harness/`(원본의 원본 + templates + knowledge-seeds + VERSION) · `cli/` · `codex/ gemini/ cursor/`(1차 unverified) · `hooks/` · `docs/ test/ .agents/ .loctx/`. 플러그인 루트 `bin/` 없음. npm 패키지에는 `.claude-plugin`을 넣지 않는다(마켓플레이스는 git으로 받는다). 선택 의존(humanize-korean·diagram-design)은 감지해 권장만.

## 10. `spike/` (D15)
생각 10개 살림(must_not 프론트매터 · intent/knowledge stop · failure 카탈로그+verified · 시드 · suggested_next · metrics.jsonl · 카운터 리셋 등 — §3·§4·§8에 반영). 코드·구조 전부 버림(Python, state.json 상태 기계, dispatch, 8단계, 게이트 프리셋, TOML, md 핸드오프). **디렉터리는 구현 시작 시 삭제**, 해시 `9ebb597`로 참조 — 사용자 확인.

## 11. 1차 구현 순서 (제안)
1. `cli/` 뼈대 + `check`(검증기 T2·T4 + 드리프트 형식·일치) — 가장 먼저, 자기 레포에 훅으로 건다.
2. `harness/` 원본: roles 12 · policy(C1~C10, A~G) · schemas(5 파일) · templates.
3. `install graph --mode manual` → 이 레포에 self-install → `.agents/`·`.loctx/` 생성 (S5).
4. `migrate` — 이 레포의 `.ai/` → v4 배치 (S1).
5. 생성기(Claude) + `update` + `configure bindings`.
6. 스킬 입구(`reins-setup`·`reins-intent`·`reins-loop`) → 첫 intent를 **자기 루프로** 돌린다 (R66).
7. metrics.jsonl로 비용 측정 → 루프·하네스 단으로 깎아 내리기(2차).

## 부록 — 조사자가 기본값으로 정한 것 (사용자 미확인, 설계 확정 시 함께)
승인 기록 방식 · 생성 표 · 드리프트 3층 · 세대 신호 · migrate 매핑 · knowledge 형식·승격 임계 · CLI 명령면·exit code · install 질문표 · 플러그인 트리 · spike 처분 · 1차 구현 순서.
