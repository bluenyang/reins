---
intent: "022"
status: accepted
approvals:
  - { role: user, by: BlueNyang, at: 2026-11-12, words: "진행", rev: cfbb541, kind: summary }
summary_for_user: |
  작업 단위 열: W-1 spec 수락 뒤 구현~CI를 묻지 않는 하나의 흐름, 정지 목록에서 "기계를 떠나는 일"을 빼고 머지·stable만 지시 · W-2 spec의 `조정 기록`(A-n) — 단위의 추가·삭제·범위 변경만 멈추고 승인, 나머지는 진행 후 기록·보고 · W-3 감사 두 번(1차: CI 뒤 머지 전에 위험, 기록은 PR 브랜치에 / 2차: stable 뒤 회고 직전에 절차만, 회고로 넘김) · W-4 수용된 지적(세 번 이상 수용 → knowledge `accepted-finding`, 감사는 "알려진 수용"으로 분류) · W-5 AGENTS.md 가이드 문서와 온보딩의 가르기, 기존 설치에 `tidy` 표시 한 번 · W-6 회고가 루프의 끝, 기다리는 동안 다음 일로 채우지 않음, 버전 선택은 시작 지시가 아님 · W-7 머지 지시는 PM이 판단, 머지 때 브랜치 삭제, SHA 대응표, 모든 단위 리뷰, 회고가 하네스 자체의 문제를 가림 · W-8 `update`·`config` 보고의 `+`/`~` · W-9 PM은 지금 대화하는 모델(bindings의 `default`는 읽지 않고, `config`가 쓸 때 지움) · W-10 stable 뒤 이 저장소 자기 업데이트.
  intent에 없어 PM이 옮긴 곳(확인 필요): ① rc는 머지 지시 뒤 묻지 않고 냄 ② 작업 단위의 순서 변경은 조정(지금은 멈춤) ③ rc 확인에서 나온 작은 결함은 조정으로, 그 PR은 1차 감사 없이 감(리뷰·CI는 거침; 새 단위가 필요하면 승인과 1차 감사) ④ 머지는 PR마다 지시가 필요(기록·릴리스 문서 PR 포함, 묶음 제안 가능) ⑤ "멈추지 않고 진행"이라 해도 intent 승인·spec 진행/수정·머지·stable 지시는 받음 ⑥ 2차 감사 뒤의 닫는 PR(감사 기록·회고·자기 업데이트)은 감사 밖.
  검토(독립 검토 1회, 지적 17건 모두 반영, 원문 `.loctx/reports/0.3.2/spec-review.md`): `+` 표시의 원인을 코드에서 특정(`writeGenerated`가 새 파일과 다시 쓴 파일을 한 목록으로 돌려줌), 검사가 지금 글로도 통과하던 곳을 구절 전체 확인으로 바꿈, W-1~W-3의 되돌림 순서, 1판 bindings 변환이 `default`를 쓰던 경로, SHA 대응표를 커밋되는 감사 파일로.
  검증 V-1~V-13: 원본 글의 구절 테스트, 표 기반 테스트(위임 블록·bindings·tidy 표시·보고 표시), `pnpm check`와 CI, 설계 양판 대조, rc 뒤 배포본 smoke, stable 뒤 자기 업데이트.
  이 버전은 말씀하신 방식으로 만듭니다: 진행을 받으면 구현 → 리뷰 → 테스트 → PR → CI → 1차 감사까지 묻지 않고 가고, 머지 지시를 기다리며 한 번 보고합니다.
---
## 요구 해석
intent 022의 "바라는 결과"를 아래로 옮긴다. 각 줄 끝의 ← 는 intent의 근거다. 스킬 원본은 `skills/<name>/SKILL.md`, 블록 원본은 `harness/templates/agents-md-blocks.md`다. 이 저장소에 설치된 사본(`.agents/skills/`, `.agents/harness/`, AGENTS.md의 `reins:` 블록)은 stable 뒤 자기 업데이트로만 바뀐다.

### 한 루프의 순서 (W-1, W-3, W-6이 함께 만든다)
새 순서는 다음과 같다. 스킬 수는 열한 개 그대로이고, `merge`와 `audit`이 각각 두 부분을 가진다.

`roadmap` → `intent`(승인) → `spec`(진행/수정) → `implement` → `review` → `test` → `merge` 앞부분(푸시, PR, CI) → `audit` 1차 → `merge` 뒷부분(사용자의 머지 지시, 머지, 브랜치 삭제) → `release`(rc; stable은 지시) → `audit` 2차 → `retro` → 멈춤.

### 승인 뒤의 연속 흐름과 정지 조건 (W-1)
- S-1 **흐름 블록.** 4번과 5번을 고친다. spec이 수락된 뒤 `implement` → `review` → `test` → 푸시 → PR → CI는 **묻지 않고 이어 가는 하나의 흐름**이라고 적는다(핵심 문장: "one flow without asking"). 그 뒤는 "머지는 사용자의 지시로, rc는 머지 뒤 저장소의 릴리스 방식대로, stable은 사용자의 지시로"다. 1차 감사를 이 흐름에 넣는 문장은 W-3이, 루프의 끝은 W-6이 더한다(W-1만으로도 글이 맞도록). ← "spec이 수락되면 구현 → … 묻지 않고 이어 간다"
- S-2 **정지 블록의 "Ask the user and stop".** "anything that leaves the machine (push, PR, release) unless the settings or the user allow it"를 뺀다. 남는 것과 더하는 것: 되돌릴 수 없는 일(강제 푸시, 태그 삭제, 기본 브랜치 재작성, 데이터·운영 변경) · **머지** · **stable 릴리스** · 금지선에 닿는 일 · 작업 단위의 추가·삭제·범위 변경(S-6) · intent와 spec 밖으로 범위가 나감 · 과거 결정과 충돌 · 아직 받지 않은 승인이 필요한 다음 단계. 진행 중인 루프의 브랜치(수락된 spec의 작업 단위, 그 기록, 릴리스 문서)를 푸시하고 PR을 여는 것은 흐름의 일부라고 한 문장으로 적는다(핵심 문장: "Pushing a branch of the loop in progress and opening its PR is part of the flow"). 승인되지 않은 일(spec 없는 브랜치, 다른 저장소)의 반출은 여전히 묻는다. **머지는 PR마다 지시가 필요하다** — 작업 PR이든 기록·릴리스 문서 PR이든. PM은 함께 머지할 묶음을 제안할 수 있다(S-22). ← "멈추고 묻는 것은 되돌릴 수 없는 일, 금지선, 같은 단위의 두 번 실패, 중요한 spec 변경, 머지, stable 릴리스다"
  - (PM 해석) rc 릴리스는 정지 목록에 없으므로 머지 지시 뒤 묻지 않고 낸다(intent 계획 3 "머지(사용자 지시) → 0.3.2-rc.1"). 릴리스 방식이 없는 저장소는 지금처럼 `release` 스킬이 "저장소가 릴리스하는 방식대로"라고만 한다.
- S-3 **스킬.** `test`의 다음은 `merge` 그대로. `merge` 2절 1("Leaving the machine … otherwise ask")을 "수락된 spec의 브랜치는 묻지 않고 푸시하고 PR을 연다"로 바꾼다. ← 흐름·정지 블록과 `implement`·`review`·`test`·`merge` 스킬이 같은 말을 한다
- S-4 흐름의 끝 보고. CI가 끝나면 PM은 한 번 보고한다: 한 일, 검사와 CI 결과, 기다리는 지시(머지). (W-2가 조정 목록을, W-3이 "1차 감사 뒤"와 감사 결과를 이 문장에 더한다.) 그 전에는 멈춤 조건이 아니면 보고를 위해 멈추지 않는다. `merge` 스킬 앞부분의 끝에 적는다. ← "그 흐름의 끝 보고에 모아 알린다"

### 작업 중 spec 조정 (W-2)
- S-5 **spec 템플릿**에 `## 조정 기록` 절을 더한다(검증 기준과 우려 사이). 줄 형식: `- A-n (YYYY-MM-DD, W-n) 무엇을 · 왜 · 커밋`. 조정이 없으면 "—". 템플릿의 스키마 테스트가 새 절을 받아들인다. ← "spec에는 조정 기록을 두는 자리가 있다(무엇을, 왜, 어느 커밋에서)"
- S-6 **경계.** 멈추고 spec을 고쳐 진행/수정을 받는 것: 작업 단위의 추가, 삭제, 범위 변경(그 단위가 건드리기로 한 것 밖으로 나감, 요구 해석 S-n의 뜻이 바뀜). 진행하고 기록하는 것(조정, adjustment): 같은 단위 안의 방법 변경, 리뷰·감사에서 나온 작은 보완, `.agents/knowledge/`나 history에 비슷한 선례가 있는 조정. 어느 쪽인지 가릴 수 없으면 멈추고 묻는다. `spec` 스킬과 `implement` 스킬 2절 4·6절("A change outside the spec's approved work units" 포함), `review` 스킬(작은 지적 수정은 조정으로 진행), 흐름 블록 4번이 이 경계를 같은 말로 적는다.
  - (PM 해석 1) 작업 단위의 **순서**를 바꾸는 것은 조정으로 옮겼다(지금 규칙은 멈춤). intent는 "추가·삭제나 범위 변경"만 멈춤으로 적는다.
  - (PM 해석 2) **rc를 확인하다 찾은 결함**도 같은 경계로 가른다: 작은 보완이면 조정(A-n), 새 작업 단위가 필요하면 spec을 고쳐 승인받는다. `release` 스킬의 "fixes are stabilisation work units"를 이 말로 바꾼다. 0.3.1의 W-15(작은 보완을 진행 후 보고)가 선례다. ← "작업 단위의 추가·삭제나 범위 변경은 멈추고 … 같은 단위 안의 방법 변경, 리뷰·감사에서 나온 작은 보완, 비슷한 선례가 기록에 있는 조정은 진행하고"
- S-7 **조정의 기록과 보고.** 조정은 그 커밋과 같은 커밋(또는 바로 다음 기록 커밋)에서 `## 조정 기록`에 적고, 커밋 메시지가 `A-n`을 적는다. 흐름의 끝 보고(S-4)에 조정 목록을 그대로 싣는다. 사용자가 조정을 받아들이지 않으면 그것은 spec 변경으로 다룬다(되돌리거나 승인받음). ← "진행하고, spec에 적은 뒤 그 흐름의 끝 보고에 모아 알린다", 에이전트가 정한 것 2
- S-8 **감사의 판정.** `audit` 스킬 4의 "Changing the spec's work units themselves (adding, dropping, scope, order) without approval is a violation"를 고친다: 승인 없는 추가·삭제·범위 변경은 위반, 조정 기록에 적힌 조정은 지킴, 적히지 않은 조정은 "기록 누락"(위반, 보완은 기록). ← 문제 1

### 감사 두 번과 1차 감사 뒤의 머지 (W-3)
- S-9 **`audit` 스킬을 두 절로 나눈다**: "First audit — before the merge"와 "Second audit — after the release". 1절(When)은 둘의 때를 적는다. 필수 여부(`audit.required`)는 둘 다에 걸린다. ← "감사 두 번"
- S-10 **1차 감사.** 때: CI가 통과한 뒤, 머지 전. 대상: 그 버전의 작업 단위를 실은 PR의 브랜치(`<base>..<head>`). PM이 넘기는 것: PR과 CI 기록(지금 2절 1의 방식, 머지 관련 항목은 아직 없음), 커밋별 검사 로그 채우기(지금 그대로, 대상은 브랜치의 커밋), intent·spec·로드맵·knowledge. 보는 것은 **위험**이다: 승인 없는 범위 확장(S-8), 금지선, 생성·하네스 파일의 손 수정, 리뷰가 빠진 작업 단위(S-21), 실패했거나 확인할 수 없는 검사, 승인 기록(intent 승인, spec 진행/수정)이 없거나 지어낸 것. 감사는 이력을 훑어 문제를 찾고 시정할 것을 말한다: 커밋마다 모든 규칙 문장을 대조한 표를 만들지 않고, 단계별 판정 표(지금 템플릿)와 비판·해결 방법만 낸다. ← "1차: … 위험을 본다", "이력을 훑어 문제를 찾고 시정할 것을 말한다"
- S-11 **1차 감사의 기록과 처리.** 감사자의 답을 고치지 않고 `.agents/audit/<version>.md`의 `## 1차 감사`에 쓰고(0.3.1 그대로), **PR 브랜치에 커밋**해 함께 머지한다. 이 커밋으로 PR의 head가 움직이므로 CI가 다시 통과하기를 기다린 뒤 보고한다(S-4에 "1차 감사 뒤"와 감사 결과를 더함). 흐름 블록 4번의 흐름 끝을 "… CI → first audit"로 늘린다. 위반은 머지 전에 보완하거나 사용자가 수용하고, 그 결정을 `### 사용자 처리`에 적는다. 보완 커밋은 다시 감사하지 않는다. 다시 받는 것은 위험이 큰 위반이 있었고 그 보완이 큰 변경일 때뿐이며, 그 판단과 이유를 사용자 처리에 적는다. ← 에이전트가 정한 것 3, "기록·문서 보완은 다시 감사하지 않는다. 위험이 큰 문제가 있었고 변경이 클 때만 다시 받는다"
- S-12 **1차 감사를 받는 PR.** 수락된 spec의 작업 단위(승인받아 더한 단위 포함)를 실은 PR이다. 받지 않는 PR: 기록·문서·릴리스 문서만 실은 PR, 그리고 1차 감사 뒤 조정(S-6)으로 진행한 작은 보완의 PR. 받지 않는 PR은 본문에 그 사유를 한 줄로 적고, stable 전에 머지된 것은 2차 감사가 본다. 2차 감사 뒤의 닫는 PR(2차 감사 기록, 회고 반영, 자기 업데이트)은 감사 대상이 아니다. 어느 PR이든 머지에는 지시가 필요하다(S-2).
  - (PM 해석 3) intent는 "기록·문서 보완은 다시 감사하지 않는다"까지만 말한다. 한 버전에 PR이 여럿일 때의 기준이 없어, **작은 코드 보완의 PR도 1차 감사 없이 가는 것**으로 옮겼다(근거: "위험이 큰 문제가 있었고 변경이 클 때만 다시 받는다"). 코드 보완은 리뷰(S-21)와 CI는 그대로 거친다.
- S-13 **머지.** `merge` 스킬 뒷부분: 1차 감사에 위반이 없거나 처리가 끝났고 사용자의 머지 지시가 있으면 바로 머지한다. 머지 지시 읽기, 브랜치 삭제, SHA 기록은 S-22~S-24. 다음은 `release`. ← "사용자의 머지 지시를 받으면 바로 머지한다"
- S-14 **2차 감사.** 때: stable 배포 뒤 회고 직전에 한 번. stable 없이 닫는 버전은 사용자가 닫는다고 한 때. 대상: 1차 감사의 head부터 그 버전의 마지막 커밋까지와 머지·배포 과정. PM이 넘기는 것: 머지된 모든 PR의 기록(번호, 병합자, 시각, 머지 커밋, head SHA, CI 결과), 브랜치 SHA와 기본 브랜치 SHA의 대응표(S-24), 릴리스 기록(워크플로 실행, 태그), 1차 감사 뒤의 커밋에 대한 검사 로그. 보는 것은 **절차**뿐이다: 머지 지시가 있었는가와 머지 방식, CI와 배포 기록, 릴리스 문서, 기록의 완결성(사용자 처리, waiver, 조정 기록, 1차 감사 없이 간 PR의 사유). 해결 방법 절은 쓰지 않고 "회고로 넘길 것"을 쓴다. 결과는 같은 파일의 `## 2차 감사`에 고치지 않고 쓰고, 그 아래 PM이 `### SHA 대응`(S-24의 표, 커밋되어 남음)을 붙인다. 사용자 처리 절은 없다: 회고가 읽고, 회고에서 사용자가 정한 것을 `### 회고에서의 처리`에 적는다. 기록 커밋은 회고의 커밋들과 한 PR로 간다. ← "2차: … 절차만 본다 … 결과를 회고로 넘긴다", 에이전트가 정한 것 4·6
- S-15 **감사 템플릿**(`harness/templates/audit.md`)을 두 절 구조로 바꾼다: 프론트매터는 `version`, `first: { range, at, auditor }`, `second: { range, at, auditor }`. `## 1차 감사`(읽은 것, 단계별 판정, 비판, 해결 방법, 사용자 처리)와 `## 2차 감사`(읽은 것, 절차 판정, 회고로 넘길 것, SHA 대응, 회고에서의 처리). 감사 템플릿에는 스키마가 없다(지금도 없음): 테스트가 절 제목을 직접 확인한다. 단계별 판정 표에 "알려진 수용"(S-18) 줄 설명을 더한다. ← 에이전트가 정한 것 4
- S-16 **주변.** auditor 역할(`harness/roles/auditor.md`)의 `does`와 본문, 흐름 블록 5번, settings 블록의 감사 줄("every version ends with an audit" → 두 번이라는 말), `release` 스킬의 When("the version is audited" → 1차 감사와 머지 뒤)과 Next(stable 뒤 `audit` 2차), `retro` 스킬 2절 1(2차 감사의 "회고로 넘길 것"을 읽는다), records 블록(조정 기록과 감사 파일의 두 절), `harness/roles/pl.md`·`pm.md`에 감사 시점을 말하는 문장이 있으면 그것, 설계 §3-3이 같은 말을 한다. 위임 블록의 감사 줄은 "required every version"을 "required every version, before the merge and after the release"로만 고친다(누가 돌리는지는 W-9의 S-27이 고치는 다른 구절). `merge`와 `audit` 스킬의 5절(Next)은 두 줄이 된다(`merge`: "After CI: `audit` (first). After the merge: `release`." / `audit`: "After the first: `merge`. After the second: `retro`."). `skills.test.ts`의 "the next skills follow the flow"는 스킬마다 다음 스킬의 **목록**을 비교하도록 고친다. ← "설계서 양판 … 이 같은 말을 한다"

### 수용된 지적 (W-4)
- S-17 **knowledge 항목.** 템플릿의 `kind`에 `accepted-finding`을 더한다(스키마의 허용 값에도). 본문 절은 그대로 쓰되 뜻을 적는다: 결정(어떤 지적을 수용으로 보는가), 이유(몇 번, 어느 감사에서 나왔고 매번 수용했다는 것 — 파일 경로와 사용자의 말), 적용(어디까지가 이 수용이고 어디부터는 다시 위반인가), 바뀌면. ← "knowledge에 '수용된 지적'으로 올린다"
- S-18 **감사.** 1차·2차 모두 `.agents/knowledge/`의 `kind: accepted-finding` 항목을 읽는다. 지적이 그 항목의 적용 범위 안이면 위반이 아니라 "알려진 수용(known acceptance)"으로 따로 적고 항목 파일을 가리킨다. 범위를 벗어나면 위반이다. 감사는 여전히 다 잡아낸다(빼지 않고 분류만 바꾼다). ← "감사는 knowledge를 읽고 그런 지적을 위반 대신 '알려진 수용'으로 표시한다"
- S-19 **회고.** `retro` 스킬 2절 3(knowledge 후보)에 더한다: 감사 기록들의 `사용자 처리`(1차)와 `회고에서의 처리`(2차)에서 **세 번 이상 수용된 같은 지적**을 세어 `accepted-finding` 후보로 제안한다. 승격은 지금 절차 그대로(사용자가 받아들인 것만). 설계 §8에 같은 말. ← 에이전트가 정한 것 8

### AGENTS.md 가이드와 온보딩 (W-5)
- S-20 **가이드 문서** `harness/templates/agents-md-guide.md`(설치되면 `.agents/harness/templates/agents-md-guide.md`). 영문, 한 쪽 이내. 내용:
  - 두는 것: 프로젝트가 무엇인지, 거시적 목표와 범위, 구조, 스택과 명령, 공통 규칙·관례, 금지선, 계속 지켜야 하는 중요한 지시.
  - 두지 않는 것과 갈 곳: 현재 작업·진행 상황·버전별 계획 → 로드맵(`docs/ROADMAP.md`, `.loctx/ROADMAP.local.md`) · 결정과 그 이유 → knowledge 후보(사용자 승인 뒤) · 개인 메모와 이 기계의 설정 → `.loctx/` · 기여 방법 → CONTRIBUTING · 일회성 결정 → 그 intent나 history.
  - 원칙: 에이전트가 세션마다 읽으므로 짧게, 잘 바뀌지 않게. 한 번만 한 지시를 규칙으로 적지 않는다.
  - (PM 해석) 위치를 `templates/`로 했다: 그 폴더는 이미 통째로 설치되어 설치 목록을 바꾸지 않는다. ← "새 가이드 문서(위치는 spec)", 에이전트가 정한 것 5
- S-20a **`onboard` 스킬.** 2절 3(프로젝트 절 쓰기) 앞에 가르기 단계를 넣는다: 가이드를 읽고, 기존 AGENTS.md·CLAUDE.md·`AGENTS.previous.md`의 내용을 가이드대로 가른다. 옮길 것은 사용자에게 "무엇을 어디로"의 표로 보여 주고, 받아들인 것만 옮긴다(knowledge는 후보로 제안, 승격 절차 그대로). 버리는 것도 표에 적는다. 온보딩·재구성 안내 문장(`agents-md.ts`의 `onboardingNote`, `reconcileNote`)이 가이드를 가리킨다. ← "`onboard` 스킬은 사용자와 대화하며 … 무엇을 어디로 보냈는지 사용자에게 보여 준다"
- S-20b **기존 설치의 표시.** `update`가 하네스 0.3.2 미만인 0.3 설치(`install.yaml`의 pin `version`, `update`가 지금 읽는 값)를 올릴 때 AGENTS.md에 `<!-- reins:tidy pending -->`와 안내 한 단락을 넣는다("AGENTS.md guide — … run the `onboard` skill: sort the project sections by the guide … then change the marker to done"). 한 번만: 이미 `tidy` 표시(pending이든 done이든)가 있거나, 온보딩·재구성 표시가 pending이면(그 절차가 가이드를 따르므로) 넣지 않는다. 0.2.0 이하에서 오는 설치는 지금처럼 재구성 표시만 받는다. `placeNote`의 종류에 `tidy`를 더한다. `onboard` 스킬 1절이 `tidy`를 알고, 그때는 질문 묶음 없이 가르기 단계(S-20a)만 한다. 흐름 블록의 마지막 문장이 "pending 표시가 있으면 `onboard`부터"라고 말한다. reins는 프로젝트 절의 글을 고치지 않는다. ← 에이전트가 정한 것 7, 제약 "프로젝트 절을 reins가 고치지 않는다"

### 루프의 끝 (W-6)
- S-25 **흐름 블록**에 순서 목록 아래 한 단락을 더한다(영문, 뜻): 한 루프는 사용자가 시작한 작업 단위(보통 한 버전)와 그 회고까지다. 회고가 루프를 끝낸다: 보고하고 멈춘다. 다음 intent는 사용자가 시작할 때 쓴다. 사용자가 끝을 다르게 말했으면("…까지", "멈추지 말고") 그 지시에 한해 따르고 그 말을 `.loctx/ROADMAP.local.md`에 인용해 둔다(건너뛴 단계가 아니라 끝을 정한 말이라 waiver가 아니다 — PM 해석 4). 그래도 intent 승인, spec의 진행/수정, 머지 지시, stable 지시는 매번 받는다. 다음 일의 아이디어는 언제든 로드맵에 적는다. 버전을 고른 것은 시작 지시가 아니다. ← "루프의 끝" 다섯 줄
  - (PM 해석 5) "앞 루프가 닫혔다"는 그 버전의 회고가 끝났다는 뜻이다(커밋된 2차 감사 기록의 `회고에서의 처리`와 로컬 history가 있음). 사용자가 닫혔다고 하면 그 말이 우선이다.
  - (PM 해석 6) "멈추지 않고 진행"이라고 해도 승인 넷은 그대로 받는 것으로 옮겼다(intent 제약 "intent 승인, spec의 진행/수정, 머지 지시, stable 지시는 그대로 명시적이다").
- S-26 **정지 블록**에 두 줄을 더한다: "**While you wait for the user** — a release approval, a merge instruction, a stable instruction — report and wait; do not start another unit's work. Stabilising the same version is this loop's work." 그리고 "**The retro ends the loop:** report that it is closed and stop." 머지와 stable은 "Ask the user and stop" 목록에 그대로 있고(지시가 필요한 일), 이 줄은 기다리는 동안의 일을 말한다.
- S-26a **스킬.** `release`: 2절에 "배포가 사용자를 기다리면 보고하고 기다린다. 다음 단위의 일을 시작하지 않는다"를 더하고 6절에 같은 말. `retro`: 마지막 단계로 "루프가 닫혔다고 보고하고 멈춘다", Next를 "`roadmap` — 사용자가 다음 일을 시작할 때"로. `roadmap`: 1단계에 "다른 버전의 작업 중에도 적는다", 2단계에 "버전을 고른 것은 그 항목이 어디에 속하는지를 정한 것이지 시작 지시가 아니다"와 "버전 이름만으로는 확정이 아니다(무엇을, 왜, 무엇을 뺄지까지)", 3단계에 "확정된 항목은 다른 버전의 작업 중에도 공개 로드맵에 올릴 수 있다", 4단계를 "사용자가 그 일을 시작하고 앞 루프가 닫혔으면(회고 끝) `intent`로 넘긴다"로. `intent`: When을 "사용자가 이 일을 시작했고, 확정된 로드맵 항목에 승인된 intent가 없고, 앞 루프가 닫혔다. 진행 중인 버전에 더하는 intent는 같은 루프다. 사용자가 회고 전에 다음 intent를 쓰라고 하면 waiver로 적는다"로. 설계 §3-1·§3-2에 같은 말. ← 분석의 "고칠 것", 에이전트가 정한 것 9·10

### 머지·리뷰·회고의 관례 (W-7)
- S-21 **`review` 스킬.** 2절에 더한다: 테스트나 문서만 고친 단위를 포함해 모든 작업 단위를 리뷰한다. 리뷰하지 않은 단위는 그 사실과 이유를 spec의 조정 기록에 적는다. 기록 없이 리뷰가 빠진 단위는 1차 감사의 지적이다(S-10). ← "테스트만 고친 단위도 리뷰하거나, 하지 않았다고 기록하게 한다"
- S-22 **머지 지시 읽기**(`merge` 스킬 뒷부분): 어느 PR을 말하는지는 PM이 판단한다 — 지명한 PR, 지명이 없으면 PM이 머지를 제안한 것(하나든 묶음이든)이나 대화에서 방금 말한 PR. 가릴 수 없으면 묻는다. 계속하라는 일반적인 말은 머지 지시가 아니다. 지시의 말을 PR 기록과 함께 남긴다(2차 감사가 본다). ← "머지 지시는 PM이 판단해 읽는다 …"
- S-23 **브랜치 삭제**(`merge` 스킬 뒷부분): 머지한 브랜치는 그 단계에서 원격과 로컬 모두 지운다. 4절(파일과 수명)에 "작업 브랜치 — 머지 때 삭제"를 더한다. ← "머지한 브랜치는 머지 단계에서 원격과 로컬 모두 지운다"
- S-24 **SHA 기록**(`merge` 스킬 뒷부분): 머지가 커밋을 다시 만들면(rebase, squash) 머지 뒤에 쓰는 기록은 기본 브랜치의 SHA를 적는다. 머지 전에 쓴 1차 감사 기록은 고쳐 쓰지 않는다. PM은 머지 직후 브랜치 SHA와 기본 브랜치 SHA의 대응표를 만들어 `.loctx/reports/<version>/`에 두었다가, 2차 감사에 넘기고 감사 파일의 `### SHA 대응`에 커밋한다(S-14; 작업 파일은 회고 뒤 지워지므로). spec의 완료 표시는 다음 기록 커밋(릴리스 문서 PR)에서 기본 브랜치 SHA로 **고친다**. ← "머지가 SHA를 바꾸면(rebase·squash) 기록은 기본 브랜치의 SHA를 적는다"
  - (PM 해석 7) 1차 감사 기록이 머지 전에 브랜치 SHA로 쓰이므로(S-11) "머지 뒤에 쓰는 기록"으로 좁히고 대응표를 커밋해 남긴다.
- S-24a **`retro` 스킬** 2절 2에 더한다: 제안 가운데 이 프로젝트의 것이 아니라 하네스의 글 자체(흐름·정지 블록, 스킬, 역할)에 대한 것을 가려 표시한다. 그것은 다른 프로젝트에서도 날 문제이므로 사용자가 reins로 가져갈 수 있게 따로 적는다(하네스 원본은 손으로 고치지 않는다). ← "`retro` 스킬: 회고에서 나온 하네스 문제 가운데 다른 프로젝트에서도 날 만한 것을 가려 사용자에게 알린다"
- "목표 절에 진행 상황을 적지 않는다"는 S-20의 가이드에 들어 있다.

### `update` 보고의 표시 (W-8)
- S-28 `update`의 보고는 그 실행 전에 있던 경로를 `+`(new)로 표시하지 않는다: 있던 파일을 다시 쓴 것은 `~`(changed)다. 원인(검토에서 확인): `writeGenerated`(`cli/src/lib/vendor-write.ts`)가 새로 쓴 파일과 다시 쓴 파일을 `written` 한 목록으로 돌려주고, `install.ts`가 그것을 통째로 `applied.created`에 넣는다(`fsx.apply`는 맞게 가른다). 고침: `writeGenerated`의 결과를 `created`와 `changed`로 나누고, `install.ts`·`update.ts`의 보고가 그대로 `+`와 `~`로 낸다. 같은 목록을 쓰는 `config`의 보고(`cli/src/reins.ts`, 지금은 새 파일도 `~`)도 같은 구분을 쓴다. 드라이 런과 실제 실행의 표시가 같다. ← "`update` 보고는 다시 쓴 기존 파일을 새 파일로 표시하지 않는다"

### PM은 지금 대화하는 모델 (W-9)
- S-27 **위임 블록**(`renderDelegation`): "you are the PM (vendor model)"에서 괄호를 뺀다. 단일: "you are the PM — the model in this conversation — and do every role yourself …". 멀티: "you are the PM — the model in this conversation. … Roles not listed are yours." 감사 줄: auditor에 모델이 있으면 지금처럼 그 모델, 없으면 "run it in a fresh run of your own model (or another one the user chooses)". 개인 위임 표도 같은 함수라 같이 바뀐다. ← "위임 블록은 PM의 모델 이름을 적지 않고 … 배정하지 않은 역할과 감사는 '네 모델'이 한다"
- S-27a **bindings의 `default`.** 스키마 판은 2 그대로다. `default` 키는 스키마에 남겨 기존 파일이 검증을 통과하게 하되(0.3.1을 쓰는 팀원의 `config`도 깨지지 않음), reins는 읽지 않는다. `pmBinding`을 없애고 `auditBinding`은 auditor에 모델이 없으면 "없음"을 돌려준다. `defaultBindings`(새 설치)는 `default`를 쓰지 않는다. `config`가 bindings 파일(팀·개인)을 쓸 때 `default`가 있으면 지우고 그 사실을 한 줄로 알린다. `update`는 1판 bindings를 2판으로 바꿀 때만 bindings 파일을 쓴다: 그 변환(`convertV1`)이 `pm` 역할을 `default`로 옮기던 것을 그만두고, 옮기지 않았다고 알린다. `default`를 읽는 나머지 곳도 함께 고친다: 개인 설정 합치기(`mergeLocal`), `config-models.ts`의 PM 표시와 선택, `config.ts`의 도움말과 요약, `install.ts`의 설치 요약. ← 에이전트가 정한 것 12, 제약 "`default`가 적힌 기존 bindings 파일로도 `update`와 `config`가 실패하지 않는다"
- S-27b **`config`.** 요약(`config.ts`)의 `PM:` 줄을 "PM: the model in the conversation"으로. 화면(`config-models.ts`)에서 PM 항목을 뺀다. 플래그 `--set default=<model>`은 거부하고 이유를 낸다("the PM is the model in the conversation; nothing to set"). 모르는 군 오류의 목록에서 `default`를 뺀다. ← "`config`는 PM의 모델을 묻지 않는다"
- S-27c **글.** settings 블록의 bindings 줄("which model does which role group")은 그대로 맞다. 설계 §2-1·§2-3·§5(`default … # PM` 예시와 상속 설명), §9 `config`, README 양판의 PM 모델 언급, `harness/roles/pm.md`에 PM 모델을 정한다는 말이 있으면 고친다. `audit` 스킬의 단일 모드 문장("another vendor, or the same vendor's top model — chosen by the user")은 "a new run of your own model, or another one the user chooses"로 맞춘다. 서브에이전트의 "your own model"은 "지금 대화하는 모델"을 뜻한다고 §2-3에 한 문장. ← "다른 모델이 필요한 역할만 배정한다"

### 문서 (각 단위와 같은 커밋)
- S-29 설계서 양판(`docs/design.md`, `docs/design.ko.md`)의 §3-1(흐름 표와 순서), §3-2(멈춤), §3-3(감사), §3-4(회고), §4(감사 파일 형식, spec의 조정 기록, 가이드 문서, 수명), §5(AGENTS.md와 표시, bindings), §8(수용된 지적), §9(`config`)를 각 작업 단위의 커밋에서 고친다(설계가 코드보다 먼저, 같은 커밋). README 양판의 흐름·감사 설명과 `harness/CHANGELOG.md`의 0.3.2 절도 단위마다. `harness/VERSION`과 블록의 `v=` 표기, 루트 CHANGELOG, 로드맵 상태는 rc.1 릴리스 문서에서 0.3.1 때와 같은 방식으로 올린다. ← "설계서 양판 …, README 양판, `harness/CHANGELOG.md`가 같은 말을 한다"

## 설계
- **글이 바뀌는 곳이 겹친다.** 흐름 블록과 정지 블록, `merge`·`audit`·`retro` 스킬은 여러 단위가 고친다. 단위마다 자기 문장만 고치고(아래 순서), 되돌릴 때 다른 단위의 문장이 남도록 문장 단위로 나눈다. 블록 전체의 최종 글은 W-6 뒤에 한 번 통독해 맞춘다(통독에서 고친 것은 조정으로 기록).
- **차단 장치 없음.** 모든 변경은 글(블록, 스킬, 역할, 템플릿)과 그 글을 쓰는 코드다. 훅, CI, CLI 검사를 더하지 않는다.
- **테스트.** 글의 변경은 `cli/test/skills.test.ts`의 문장 확인(핵심 낱말이 원본과 설계 양판에 있는가, 다음 스킬 순서)과 `harness.test.ts`의 템플릿 스키마로 묶는다. 위임 블록·bindings·표시는 표 기반 단위 테스트(`config.test.ts`, `bindings-v2.test.ts`, `update.test.ts`).
- **이 버전을 만드는 방식.** 설치된 규칙은 0.3.1이지만 사용자가 말한 방식으로 일한다(intent 계획 2): 구현~CI와 1차 감사까지 묻지 않고, 작은 조정은 조정 기록에 적고 끝에 보고한다. 이 spec에는 아직 템플릿에 없는 `## 조정 기록` 절을 미리 둔다. 설치된 규칙과 달랐던 곳은 보고와 감사 요청에 밝힌다.
- **순서와 되돌림.** W-9(독립적인 코드) → W-8(독립적인 코드) → W-1 → W-2 → W-3 → W-4 → W-6 → W-7 → W-5. 각 단위의 커밋 뒤에 원본의 글이 서로 맞는다(W-1은 1차 감사와 루프의 끝을 말하지 않는다). 되돌림은 쌓인 순서의 역순이다: W-3은 W-1·W-2 위에, W-7의 머지 문장은 W-3의 `merge` 뒷부분 위에 서므로, W-1이나 W-2를 되돌리려면 W-3을, W-3을 되돌리려면 W-7의 머지 문장을 먼저 되돌린다. W-4·W-5·W-6·W-8·W-9는 혼자 되돌릴 수 있다. 위임 블록의 감사 줄은 W-3과 W-9가 서로 다른 구절을 고친다.

## 작업 단위
- [ ] W-1 승인 뒤의 연속 흐름과 정지 조건 (S-1~S-4)
- [ ] W-2 작업 중 spec 조정 (S-5~S-8)
- [ ] W-3 감사 두 번과 1차 감사 뒤의 머지 (S-9~S-16)
- [ ] W-4 수용된 지적 (S-17~S-19)
- [ ] W-5 AGENTS.md 가이드와 온보딩 (S-20, S-20a, S-20b)
- [ ] W-6 루프의 끝 (S-25, S-26, S-26a)
- [ ] W-7 머지·리뷰·회고의 관례 (S-21~S-24a)
- [ ] W-8 `update`·`config` 보고의 표시 (S-28)
- [ ] W-9 PM은 지금 대화하는 모델 (S-27~S-27c)
- [ ] W-10 이 저장소를 0.3.2 하네스로 (stable 뒤 `reins update` 커밋 하나; AGENTS.md 프로젝트 절에서 하네스로 올라간 관례의 중복을 걷어 내는 커밋 하나 — 무엇을 걷어 낼지는 그때 사용자에게 보이고 받는다)

문서(S-29)는 각 단위의 커밋에 들어간다.

## 검증 기준
글을 확인하는 검사는 **낱말 하나가 아니라 아래 따옴표의 구절 전체**를, 적힌 절 안에서 찾는다. 구절은 구현 때 원본에 그대로 들어간다. 모두 `cli/test/`의 vitest이고 `pnpm check`로 돈다. 실패 모양은 "구절이 없음" 또는 "없어야 할 구절이 남음"이다.

- V-1 (W-1; S-1~S-4) 흐름 블록에 "one flow without asking" · 정지 블록에 "anything that leaves the machine"이 없고 "Pushing a branch of the loop in progress and opening its PR is part of the flow"가 있으며, "Ask the user and stop" 줄에 "a merge"와 "a stable release"가 있다 · `merge` 스킬 2절에 "otherwise ask"가 없고 "report once"가 있다. 설계 양판 §3-2에 같은 뜻의 구절("one flow without asking" / "묻지 않고 이어 가는 하나의 흐름").
- V-2 (W-2; S-5~S-8) spec 템플릿 본문에 `## 조정 기록` 제목이 검증 기준과 우려 사이에 있다(제목의 순서를 테스트가 확인) · `implement` 스킬 6절과 `spec` 스킬에 "added, dropped or rescoped"와 "adjustment" · 어느 스킬에도 멈춤 조건으로서의 "reordered"가 없다 · `audit` 스킬에 "an adjustment recorded in the spec is kept" · `release` 스킬에 "stabilisation work units"가 없다 · `implement` 스킬에 "names its `A-n`".
- V-3 (W-3; S-9~S-16) `audit` 스킬에 `### First audit — before the merge`와 `### Second audit — after the release` 제목 · 첫 절에 "risk", "committed on the PR branch", "wait for CI again" · 둘째 절에 "procedure only", "handed to the retro"가 있고 "remedy"가 없다 · `merge` 스킬에 "every merge needs the user's instruction" · 다음 스킬 테스트: `test`→[merge], `merge`→[audit, release], `audit`→[merge, retro], `release`→[audit], `retro`→[roadmap] · 감사 템플릿에 `## 1차 감사`, `## 2차 감사`, `### SHA 대응`, `### 회고에서의 처리` 제목과 프론트매터 `first`·`second` · 위임 블록 출력에 "before the merge and after the release" · 흐름 블록에 "first audit"과 "second audit" · 설계 양판 §3-3에 "1차 감사"/"first audit", "2차 감사"/"second audit".
- V-4 (W-4; S-17~S-19) knowledge 스키마가 `kind: accepted-finding`을 받아들이고 `kind: other`는 거부한다 · `audit` 스킬 두 절 모두에 "known acceptance" · `retro` 스킬 2절에 "accepted three times or more" · 설계 양판 §8에 "수용된 지적"/"accepted finding".
- V-5 (W-5; S-20~S-20b) `harness/templates/agents-md-guide.md`가 있고 "What belongs", "What does not, and where it goes" 제목과 roadmap·knowledge·`.loctx`·CONTRIBUTING을 갈 곳으로 적는다 · `install`의 쓰기 목록에 그 경로가 있다 · `update.test.ts` 표: ① 0.3.1 pin 설치 → `<!-- reins:tidy pending -->` 한 번 ② 다시 `update` → 그대로 한 번 ③ `tidy done` → 넣지 않음 ④ 온보딩이나 재구성이 pending → 넣지 않음 ⑤ 0.2.0 설치 → 재구성 표시만 ⑥ 표시 단락을 뺀 프로젝트 절은 바이트가 같다 · `onboard` 스킬 1절에 "reins:tidy pending", 2절에 "agents-md-guide.md"와 "what goes where" · `onboardingNote`·`reconcileNote` 출력에 "agents-md-guide.md".
- V-6 (W-6; S-25~S-26a) 흐름 블록에 "The retro ends the loop"와 "Naming a version is not an instruction to start" · 정지 블록에 "While you wait for the user"와 "do not start another unit's work" · `intent` 스킬 1절에 "the user started this work"와 "the previous loop is closed" · `roadmap` 스킬에 "not an instruction to start"와 "A version name alone is not a settlement" · `retro` 스킬 2절의 마지막 단계에 "Report that the loop is closed and stop" · `release` 스킬 2절에 "report and wait" · 설계 양판 §3-1에 "회고가 루프를 끝낸다"/"The retro ends the loop".
- V-7 (W-7; S-21~S-24a) `review` 스킬 2절에 "including one that changes tests or documents only"와 "record that and why" · `merge` 스킬 2절에 "the PM judges which PR the instruction means", "cannot tell, ask", "Delete the merged branch, remote and local", "names the default branch's SHAs" · `retro` 스킬 2절에 "about the harness itself".
- V-8 (W-8; S-28) `update.test.ts`: 멀티 모드에 Claude 역할 하나가 켜진 임시 저장소를 설치하고, 설치된 그 역할의 원본(`.agents/harness/roles/…`)을 한 줄 바꾼 뒤 `update`(드라이 런과 실제) — 보고에서 그 `rs-*.md` 경로가 `~` 줄에 있고 `+` 줄에 없다. 새 역할을 켠 뒤의 `update`에서는 새 `rs-*.md`가 `+` 줄에 있다. `config`의 보고도 같은 두 경우에 `~`와 `+`를 가른다. 지금 코드에서는 첫 단언이 실패한다(고치기 전 실패를 로그로 남김).
- V-9 (W-9; S-27~S-27c) 표 기반: `renderDelegation`의 단일·멀티 출력에 "you are the PM (" 이 없고 "the model in this conversation"이 있다 · auditor 모델이 없으면 감사 줄에 "a fresh run of your own model", 있으면 그 모델 이름 · `default`가 있는 bindings(팀, 개인)로 `config`(읽기)와 `update`가 종료 0이고 출력이 `default`의 모델을 말하지 않는다 · `config`가 쓰면 파일에서 `default`가 사라지고 알림 한 줄 · `--set default=x`는 거부(메시지에 "the model in the conversation") · 새 설치의 `bindings.yaml`에 `default`가 없다 · 1판 bindings의 `pm`은 `update`의 변환 결과에 `default`로 나오지 않고 알림에 나온다 · `config`의 요약에 "PM: the model in the conversation" · 화면의 항목 목록에 PM이 없다 · `audit` 스킬에 "same vendor's top model"이 없다 · 설계 양판 §5의 bindings 예시에 `default:` 줄이 없다.
- V-10 (전체) `pnpm check` 종료 0. 원본 로그 `.loctx/reports/0.3.2/check.log`. CI 9개 검사(Ubuntu·macOS·Windows × Node 22·24, 집계, label, trufflehog) 통과.
- V-11 (전체, 글; S-29) 설계 양판 대조: 이 버전이 고친 절(§2-1, §2-3, §3, §4, §5, §8, §9)을 PM과 같은 모델의 서브에이전트(작업 대화를 받지 않음)가 국문·영문으로 나란히 읽고, 뜻이 다른 문장을 원문 인용과 함께 낸다. 답 원본 `.loctx/reports/0.3.2/design-twin-comparison.md`. 다른 곳이 하나라도 있으면 실패. README 양판의 흐름·감사·PM 문장도 같은 대조에 넣는다. `harness/CHANGELOG.md`의 0.3.2 절에 W-1~W-9마다 한 줄 이상이 있다(테스트가 절의 줄 수가 아니라 단위별 핵심 낱말 — flow, adjustment, first audit, accepted finding, guide, loop, merge, report, PM — 을 확인).
- V-12 (rc 뒤) 배포본 smoke: `.loctx/context/scripts/smoke-published-0.3.1.sh`를 0.3.2용으로 고쳐 새 설치, 0.3.1 → 0.3.2 `update`(tidy 표시 한 번, `+`/`~` 표시, `default`가 있는 bindings), `config` 요약을 확인한다. 실패 0.
- V-13 (W-10, stable 뒤) 이 저장소의 `reins update` 드라이 런과 실행이 종료 0이고, AGENTS.md 위임 블록에 모델 이름이 붙은 PM 표기가 없다.

## 조정 기록`을 갖고 스키마를 통과한다. `skills.test.ts`: `implement`·`spec`·`audit` 스킬과 흐름 블록이 추가·삭제·범위 변경(added, dropped, rescoped)을 멈춤으로, 조정(adjustment)을 진행으로 적고, "reordered"가 멈춤 목록에 없다.
- V-3 (W-3) `skills.test.ts`: `audit` 스킬에 "First audit"과 "Second audit" 절이 있고, 첫 절이 "before the merge", 둘째 절이 "procedure"와 "retro"를 말하며 둘째 절에 remedy를 내라는 말이 없다. 다음 스킬 순서 테스트가 `test → merge → audit → merge → release → audit → retro`를 따른다. 감사 템플릿이 두 절 구조이고 스키마(있으면)를 통과한다. 설계 양판 §3-3에 같은 낱말.
- V-4 (W-4) knowledge 스키마가 `kind: accepted-finding`을 받아들이고 모르는 값은 거부한다. `audit` 스킬에 "known acceptance", `retro` 스킬에 "three"와 "accepted"가 있다.
- V-5 (W-5) 가이드 문서가 있고 설치 계획(`install`의 쓰기 목록)에 들어간다. `update.test.ts` 표: ① 0.3.1 설치 → `tidy pending` 한 번 ② 다시 `update` → 더 넣지 않음 ③ `tidy done`인 파일 → 넣지 않음 ④ 온보딩이나 재구성이 pending → 넣지 않음 ⑤ 0.2.0 설치 → 재구성 표시만 ⑥ 프로젝트 절의 글은 표시 줄 말고는 바이트가 같다. `onboard` 스킬이 guide와 `tidy`를 말한다.
- V-6 (W-6) `skills.test.ts`: 흐름 블록에 "The retro ends the loop"에 해당하는 문장과 "not an instruction to start", 정지 블록에 "Report and wait", `intent` 스킬의 When에 "started"와 "closed", `roadmap` 스킬에 "not an instruction to start", `retro` 스킬에 "stop", `release` 스킬에 "wait". 설계 양판 §3-1·§3-2에 같은 낱말.
- V-7 (W-7) `skills.test.ts`: `review` 스킬에 "tests or documents only"와 기록하라는 말, `merge` 스킬에 "which PR"·"ask"·"delete"·"default branch"와 SHA, `retro` 스킬에 하네스 자체에 대한 제안을 가르는 문장.
- V-8 (W-8) `update.test.ts`: 0.3.0 하네스로 설치한 임시 저장소를 지금 코드로 `update`(드라이 런과 실제) — 실행 전에 있던 경로가 `+` 줄에 하나도 없다.
- V-9 (W-9) 표 기반: `renderDelegation`의 단일·멀티 출력에 "you are the PM (" 이 없고 "the model in this conversation"이 있다 · auditor 모델이 없으면 감사 줄이 "your own model", 있으면 그 모델 · `default`가 있는 bindings 파일(팀, 개인)로 `config`(읽기), `update`가 종료 0 · `config`가 쓰면 `default`가 사라지고 알림 한 줄 · `--set default=x`는 거부(종료 0 아님, 메시지에 conversation) · 새 설치의 `bindings.yaml`에 `default`가 없다 · 0.2.0 bindings의 `pm`은 옮기지 않고 알림. 화면 테스트(`install-update-tui.test.ts`나 `config.test.ts`)에서 PM 항목이 없다.
- V-10 (전체) `pnpm check` 종료 0. 원본 로그 `.loctx/reports/0.3.2/check.log`. CI 9개 검사(Ubuntu·macOS·Windows × Node 22·24, 집계, label, trufflehog) 통과.
- V-11 (전체, 글) 설계 양판 대조: 이 버전이 고친 절(§2-1, §2-3, §3, §4, §5, §8, §9)을 국문·영문으로 나란히 읽어 뜻이 다른 문장이 없는지 본다. 결과 `.loctx/reports/0.3.2/design-twin-comparison.md`. 다른 곳이 있으면 실패.
- V-12 (rc 뒤) 배포본 smoke: `.loctx/context/scripts/smoke-published-0.3.1.sh`를 0.3.2용으로 고쳐 새 설치, 0.3.1 → 0.3.2 `update`(tidy 표시 한 번, `+` 표시, `default`가 있는 bindings), `config` 요약을 확인한다. 실패 0.
- V-13 (W-10, stable 뒤) 이 저장소의 `reins update` 드라이 런과 실행이 종료 0이고, AGENTS.md 위임 블록에 모델 이름이 붙은 PM 표기가 없다.

## 조정 기록
—

## 우려
- **글만으로 선 경계.** 루프의 끝과 "기다리는 동안 채우지 않는다"는 차단 장치 없이 글로만 선다(intent 제약). 지켜졌는지는 2차 감사와 회고가 본다.
- **1차 감사 기록이 PR 브랜치에 들어간다.** 감사 뒤 보완 커밋이 붙으면 기록의 head와 실제 머지 head가 달라진다. 사용자 처리 절에 보완 커밋을 적고 2차 감사가 그 구간을 본다(S-11, S-14).
- **닫는 PR은 감사 밖이다.** 2차 감사 기록, 회고 반영, 자기 업데이트를 실은 마지막 PR은 어느 감사도 보지 않는다(S-12). 다음 버전의 회고가 history로 본다.
- **`default`를 스키마에 남긴다.** 읽지 않는 키가 파일에 남아 헷갈릴 수 있다. `config`가 쓸 때 지우고 알린다. 스키마에서 빼는 것은 다음 스키마 판으로 미룬다.
- **블록 글이 길어진다.** 흐름·정지 블록에 문단이 늘어난다. 에이전트가 세션마다 읽는 글이므로 W-6 뒤 통독에서 줄일 수 있는 곳을 줄인다(뜻을 바꾸지 않는 범위, 조정으로 기록).
- **이 버전 자체가 새 규칙의 첫 사용자다.** 감사자(GPT-6 Astra)는 설치된 0.3.1 규칙으로 판정하므로, 사용자가 말한 방식과 다른 곳이 위반으로 나올 수 있다. 감사 요청에 intent 계획 2와 사용자의 말을 함께 넘긴다.

## 범위 밖
- git 저장소가 아닌 작업 폴더, cursor의 `agent` 감지(0.4 후보).
- 훅·CI에서 흐름을 막는 장치, 감사 결과를 세는 CLI.
- 새 스킬 추가(열한 개 그대로), bindings 스키마 판 올리기.
- reins가 프로젝트 절의 글을 옮기거나 고치는 것.
- 커밋 메시지 형식, 문서 언어 쌍, `docs/conversation/` 쓰는 법을 하네스에 넣는 것.
- Claude Code auto 모드의 머지 거부에 대한 문장.
