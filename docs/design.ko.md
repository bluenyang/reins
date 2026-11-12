# reins 설계서 — v2.0 (2026-11-09)

> 한글 원본. 영어판은 [`design.md`](design.md) — 둘이 어긋나면 이 파일이 기준이다. 기획서 [`proposal.ko.md`](proposal.ko.md) v1.2의 설계.
> v2.0은 0.3(intent 019)의 설계다. v1.0(2026-10-25)과 그 위에 0.1~0.2.0이 더한 것 가운데 바뀐 것은 §10에 모았다. v1.0 본문은 git 이력(`v0.2.0` 태그)에 있다.

## 0. 원칙
1. **reins는 하네스를 관리할 뿐이다.** 명령은 `install`·`migrate`·`update`·`config` 넷이다. 설치가 끝난 뒤 프로젝트가 일하는 동안 어떤 훅·스킬·에이전트도 reins를 실행하지 않는다. 설치된 하네스는 reins와 네트워크 없이 동작한다. (R5·R7·R20·R30)
2. **검사는 프로젝트가 소유한다.** 단계 검사는 프로젝트의 훅 도구(lefthook·husky 등)가 프로젝트 안의 스크립트(`.agents/harness/run-gates.sh`, §6)를 불러 돌린다. 스크립트는 프로젝트의 검사 명령만 부른다. reins는 그것을 제안하거나 설정할 뿐이다. (R7·R23)
3. **지켰는지는 감사로 확인한다.** 실행 중 차단 대신, 버전마다 감사가 단계 준수를 판정한다. 감사는 필수이고 끄는 것은 사용자만 한다. (R5·R9)
4. **단일이 기본이다.** 에이전트 하나(PM)가 단계를 수행한다. 멀티는 역할군에 모델을 할당해 켜고, 할당하지 않은 역할군의 일은 PM이 한다. (R12·R14) 근거: Anthropic, "Building agents: When to fold subagents into your main agent loop"(2026-10-22), "Building multi-agent systems: When and how to use them"(2026-01-23).
5. **파일은 만들 때 수명을 정한다.** 누가·언제 지우는지 없는 파일은 만들지 않는다. (R15·R35)
6. **표준이 있으면 따른다.** 지시는 `AGENTS.md`, 절차는 `SKILL.md`. 역할 에이전트 파일만 생성한다. (R31·R32)
7. **커밋 경계는 이름에.** `.agents/` = 커밋되는 에이전트 컨텍스트, `.loctx/` = 이 머신만. (R34·R35)

## 1. 배치
```
<project>/
├── AGENTS.md                 커밋 · 관리 블록(reins) + 프로젝트 절
├── .agents/                  커밋
│   ├── intent/<NNN>_<slug>/{intent,spec}.md
│   ├── audit/<version>.md    버전 감사 기록
│   ├── knowledge/            명시지
│   ├── harness/              bindings.yaml(설정) · gates.yaml · run-gates.sh(검사 스크립트) · install.yaml · generated.yaml · roles/ · templates/
│   └── skills/<name>/SKILL.md   단계 스킬 11개
├── .claude/agents/rs-*.md    커밋 · 생성물(멀티에서 켠 역할만)
├── docs/                     ROADMAP.md 등
└── .loctx/                   gitignore · ROADMAP.local.md · history/<version>.md · reports/<version>/ · reports/gates/ · context/ · bindings.local.yaml · delegation.local.md
```
`AGENTS.previous.md`는 재구성 대기 중에만 `.agents/`에 있다(§5).

## 2. 역할
### 2-1. 모델 할당의 뜻
역할군이나 상세 역할에 모델을 할당하는 것은 "이 일을 어느 벤더의 어느 모델이 하느냐"를 정하는 것이다. 에이전트 수가 아니다. 그 모델로 단일 실행하든 병렬 실행하든 별개다. 역할 실행은 headless라 매번 새 컨텍스트이고, 넘겨줄 때마다 세부가 빠진다. 그래서 PM은 위임할 때 넘길 파일과 결정 목록을 지시문에 적고, 하위 역할은 받은 것 밖의 추정을 표시한다.

### 2-2. 역할군
PM 말고는 모두 선택이다. 켜지 않은 군의 일은 PM이 한다.

| 군 | 상세 역할 | 하는 일 |
|---|---|---|
| **PM** | — | 사용자(PO)와 대화, 핵심은 묻고 나머지는 스스로 판단, intent(방향성·계획) 작성, 승인 기록, 지시와 재배정, 전체 흐름. 모든 보고는 PM을 거친다 |
| **PL** | 관제 | 하위 작업 조정·정렬, 하위 보고 취합·분석, 조사 취합 → PM. 병렬 작업이나 PM 컨텍스트 저하 때 켠다 |
| | plan-reviewer · code-reviewer · qa-plan-reviewer · doc-reviewer · retrospector | 계획(사용자 원문·intent·제품 경계와 대조)·코드·QA 계획·문서 리뷰, 회고. 일상 리뷰는 리뷰어 하나 |
| | discussion | 큰 결정·이견 때 할당 모델 전부가 서로 보지 않고 의견. PM이 원문을 붙여 근거·반례·소수 의견과 함께 종합 |
| **Planner** | spec-writer · qa-designer | 확정 intent → spec과 작업 단위 / 테스트 방법·체크리스트(코드를 볼 수 있다) |
| **Implementer** | code · qa · doc | 코드, 테스트 코드·스크립트, 문서(로드맵 둘, 표준 문서, `.loctx` 문서; 문서 언어는 입력값). 같은 기능의 코드·테스트·문서는 한 실행이 이어서 처리할 수 있다 |
| **Executor** | tool-executor · researcher · qa-runner · deployer | 큰 툴 로그 요약 → PL / 조사(읽기 전용) / 테스트 수행 / 릴리스(stable은 사용자 지시만) |
| **Advisor** | committee | 고지능 모델 여럿. 복잡하거나 추상적인 요구, 절차 미준수 같은 큰 문제의 해결안 |
| **Auditor** | — | 독립 군, 하나. 하네스와 엔지니어링 기법만 근거로 감사(§3-3) |

- PL에 모델이 여럿이면 첫 모델이 관제다. 리뷰어는 하나(관제가 아닌 첫 모델, 없으면 관제 모델)이고, 관제 모델의 리뷰 참여도 독립 리뷰로 친다. Discussion과 Committee는 할당 모델 전부다.
- 하위 역할은 다른 모델을 직접 부르지 않는다. 결과와 사유를 PM에게 돌려보내고 PM이 다시 배정한다.
- Discussion·Committee를 부르는 때: intent 확정 전 큰 결정, 감사 뒤 위반 해결안, 절차 미준수 사고, 풀리지 않은 이견. 티켓 단위 리뷰에는 쓰지 않는다.

### 2-3. 단일 모드
상시 위임 구조가 없다. PM이 위 일을 단계로 한다. PM은 읽기 위주의 일(조사, 큰 로그 요약, 리뷰, 감사)과 급할 때 서로 독립인 기능의 병렬 구현에 같은 모델의 서브에이전트를 쓸 수 있다. "같은 모델"은 지금 대화하는 모델이다: 하네스는 PM의 모델을 정하지 않는다(§5). 계획과 구현처럼 이어지는 일은 한 실행이 이어서 한다. PM 컨텍스트가 무거워지면 새 세션을 열어 파일로 이어 간다. 감사와 큰 결정에는 사용자가 별도 세션이나 다른 벤더로 외부 검토를 요청할 수 있다. 자기 리뷰는 spec 항목 ↔ 커밋 ↔ 증거 경로 대조표를 채우고 결함도 찾으며, 독립 검토가 아니라고 적는다.

### 2-4. 역할 파일과 하지 않을 일
`harness/roles/<group>.md` 일곱 개(pm, pl, planner, implementer, executor, advisor, auditor). 프론트매터는 상세 역할마다 `does`(한 문장 목표), `must_not`, `tools`(쓰기·셸·push 허용 여부)를 둔다. 모델은 군 단위로 상속해도 도구 권한은 상세 역할마다 고정한다(예: researcher는 읽기 전용, deployer만 반출). 역할 문서의 금지와 호스트가 실제로 막는 권한(생성된 에이전트 파일의 `tools`)은 구분해 적는다.

공통으로 하지 않는 일(모든 역할, 옛 C1~C10): "통과하기 위한" 구현 · AGENTS.md 관리 블록과 하네스 원본·생성물을 손으로 고치기(바꾸려면 사용자가 `config`·`update`) · 비밀값 읽기 · 훅 우회나 게이트 출력 가공 · 사용자 지시 없는 push·PR·머지·릴리스·태그(deployer는 정해진 범위 안에서) · 사용자 확인 없이 지난 결정 뒤집기 · 거절된 제안 다시 내기 · 운영 서버 조작 · intent·spec 밖 변경.

## 3. 흐름, 멈춤, 감사
### 3-1. 흐름과 단계 스킬
`ROADMAP.local.md`(아이디어) → 사용자와 정리 → `ROADMAP.md` → intent → 승인 → spec → 승인 → 구현·커밋 → 리뷰 → 테스트 → PR·CI → **1차 감사** → 머지 → rc → (stable) → **2차 감사** → **회고** → 정리

| 스킬 | 하는 일 | 다음 |
|---|---|---|
| `onboard` | 첫 대화 온보딩, AGENTS.md 재구성(§5) | `roadmap` |
| `roadmap` | local 아이디어 → 사용자와 정리 → 공개 로드맵 | `intent`(사용자가 그 일을 시작할 때) |
| `intent` | 방향성과 계획, 승인 기록 | `spec` |
| `spec` | spec·작업 단위·검증 기준, 요약 진행/수정, 승인 기록 | `implement` |
| `implement` | 작업 단위 구현·테스트 작성·커밋(의미 있는 작업 단위마다 — 그 시점으로 되돌려도 다른 멀쩡한 작업·기능은 되돌아가지 않는 단위; 작업 단위를 더하거나 빼거나 범위를 바꾸려면 먼저 spec을 고치고 승인, 그보다 작은 조정은 진행하고 spec의 조정 기록에), 자기 리뷰 대조표 | `review` |
| `review` | 모든 작업 단위의 리뷰(테스트·문서만 고친 단위 포함; 하지 않았으면 그 사실과 이유를 조정 기록에), 멀티 리뷰어 하나 / 단일 자기 리뷰, 큰 결정이면 Discussion | `implement` 또는 `test` |
| `test` | 검증 기준 수행, 원본 로그 | `merge` |
| `merge` | 푸시 → PR → CI(묻지 않고), 1차 감사 뒤 한 번 보고, 머지(사용자 지시) | CI 뒤 `audit`(1차), 머지 뒤 `release` |
| `audit` | 1차 감사(머지 전, 위험)와 2차 감사(배포 뒤, 절차) → `.agents/audit/<version>.md` | 1차 뒤 `merge`, 2차 뒤 `retro` |
| `release` | rc, stable(사용자 지시) | `audit`(2차), 그 뒤 `retro` |
| `retro` | 회고·개선안·정리, 닫혔다고 보고하고 멈춤 | `roadmap`(사용자가 다음 일을 시작할 때) |

**루프의 끝.** 한 루프는 사용자가 시작한 일(보통 한 버전)과 그 회고까지다. 회고가 루프를 끝낸다: PM은 닫혔다고 보고하고 멈추며, 다음 intent는 사용자가 다음 일을 시작할 때 쓴다. 사용자가 끝을 다르게 말했으면("…까지 진행", "멈추지 않고 진행") 그 지시에 한해 따르고 그 말을 `.loctx/ROADMAP.local.md`에 인용해 둔다. 그래도 intent 승인, spec의 진행/수정, 머지마다의 지시, stable 지시는 받는다. 다음 일의 아이디어는 다른 버전의 작업 중에도 로드맵에 적고, 확정된 항목은 공개 로드맵에 올릴 수 있다. 버전을 고른 것은 그 항목이 어디에 속하는지를 정한 것이지 시작 지시가 아니고, 버전 이름만으로는 확정도 아니다. 진행 중인 버전에 더하는 intent는 같은 루프이고, 사용자가 회고 전에 다음 intent를 쓰라고 하면 waiver로 적는다.

지휘자 스킬은 없다. 순서는 AGENTS.md 기본 블록이 갖고, 각 스킬 끝에 다음 스킬을 적는다. 모든 스킬은 같은 여섯 절을 갖는다: ① 언제 쓰나 ② 절차 ③ 위임(첫 문장은 "`.loctx/delegation.local.md`가 있으면 그것을, 없으면 AGENTS.md의 위임 표를 본다"; 군에 모델이 할당돼 있으면 그 모델, 없으면 직접; 읽기 위주·급한 병렬은 같은 모델 서브에이전트 가능; 넘길 파일·결정 목록) ④ 만든 파일과 수명 ⑤ 다음 스킬 ⑥ 멈추고 물을 때. 스킬은 평문이고 reins를 부르지 않는다. 단일·멀티가 같은 스킬을 쓰므로 모드를 바꿔도 스킬은 다시 만들지 않는다.

### 3-2. 멈추고 물을 때
검증기가 없으므로 정지 조건은 에이전트가 스스로 지키는 평문 규칙이고, 감사의 판정 기준이다(옛 `stops.yaml`에서 작업 중 해당하는 것만 남김). AGENTS.md 기본 블록과 각 스킬 ⑥에 쓴다.
spec이 수락된 뒤 구현 → 리뷰 → 테스트 → 푸시 → PR → CI → 1차 감사는 **묻지 않고 이어 가는 하나의 흐름**이다. 그 사이에는 아래 조건이 아니면 허락을 구하려고 멈추지 않고, 끝에서 한 번 보고한다. 머지는 PR마다 사용자의 지시로 하고(작업 PR이든 기록·릴리스 문서 PR이든), rc는 머지 뒤 저장소의 릴리스 방식대로, stable은 사용자의 지시로 낸다.
- **사용자에게 묻고 멈춘다**: 비가역 작업(force push, 태그 삭제, 기본 브랜치 재작성, 데이터·운영 조작), 머지, stable 릴리스, 금지선에 닿는 일, 작업 단위를 더하거나 빼거나 범위를 바꿔야 함, intent·spec 밖으로 범위가 바뀜, 지난 결정과 충돌, 승인 없이 다음 단계로 가야 함. 진행 중인 작업의 브랜치(수락된 spec의 작업 단위, 그 기록, 릴리스 문서)를 푸시하고 PR을 여는 것은 흐름의 일부다. 그 밖의 것을 기계 밖으로 내보내는 일은 여전히 사용자의 말이 필요하다.
- **사용자를 기다리는 동안**: 배포 승인, 머지 지시, stable 지시를 기다릴 때는 보고하고 기다린다. 그 시간에 다른 단위의 일을 시작하지 않는다. 같은 버전의 안정화는 이 루프의 일이다.
- **회고가 루프를 끝낸다**: 닫혔다고 보고하고 멈춘다(§3-1).
- **멈추고 원인을 찾는다**: 같은 작업 단위에서 두 번 실패(경중에 따라 PL·Advisor 의견, 없으면 사용자에게 선택지), 게이트 출력이 비거나 의심스러움, 증거 없는 통과.
- **사용자 중단**: 채팅·Ctrl+C·세션 종료면 하던 일을 멈추고 재개 지점을 history에 적는다.

### 3-3. 감사
- **두 번**: 한 버전을 두 번 감사한다. **1차 감사**는 CI가 통과한 뒤 머지 전에 PR 브랜치를 보고 **위험**을 본다: 없거나 사용자가 주지 않은 승인, intent·spec 밖으로 나간 범위, 금지선, 리뷰가 빠진 작업 단위, 실패했거나 확인할 수 없는 검사, 생성·하네스 파일의 손 수정. 큰 문제가 있으면 머지 전에 잡힌다. **2차 감사**는 stable 배포 뒤(stable 없이 닫는 버전은 사용자가 닫는다고 한 때) 회고 직전에 한 번, 1차 감사의 head부터 버전의 마지막 커밋까지 **절차만** 본다: 머지마다 사용자의 지시가 있었는가와 머지 방식, CI와 배포 기록, 릴리스 문서, 기록의 완결성(1차 감사의 사용자 처리, waiver, spec의 조정 기록, 1차 감사 없이 간 PR의 사유). 2차 감사는 고치라고 하지 않고 회고로 넘길 것을 적는다. 감사는 이력을 훑어 문제를 찾고 시정할 것을 말한다: 커밋 하나하나를 규칙 문장마다 대조하지 않는다.
- **1차 감사를 받는 PR**: 수락된 spec의 작업 단위(승인받아 더한 단위 포함)를 실은 PR. 기록·문서·릴리스 문서만 실은 PR과, 1차 감사 뒤 조정으로 진행한 작은 보완의 PR은 받지 않고 PR 본문에 그 사유를 한 줄 적는다. stable 전에 머지된 그런 PR은 2차 감사가 본다. 2차 감사 기록과 회고 반영을 실은 닫는 PR은 어느 감사도 보지 않는다. 1차 감사 뒤의 보완 커밋은 다시 감사하지 않는다: 위험이 큰 위반이 있었고 그 보완이 큰 변경일 때만 다시 받고, PM이 그 판단과 이유를 사용자 처리에 적는다.
- **읽는 것**: 그 시점의 AGENTS.md와 하네스 설정, intent, spec, `ROADMAP.md`·`ROADMAP.local.md`, git 이력, history, 게이트·테스트 로그, 커밋별 검사 로그(`.loctx/reports/gates/<tree>.log`), knowledge, 그리고 PR·CI 기록. PR·CI 기록은 감사를 맡기기 전에 PM이 저장소 호스트 CLI의 출력 원본 그대로(예: `gh pr view <n> --json …`, `gh pr checks <n>`) `.loctx/reports/<version>/`에 모아 넘긴다: 1차에는 그 PR과 CI 검사, 2차에는 버전에 머지된 PR마다 번호, 머지한 사람과 시각, 머지 커밋과 head SHA, CI 검사와 결과, 머지마다 사용자의 말, 릴리스 기록(워크플로 실행, 태그), 머지가 커밋을 다시 만들었으면 브랜치 SHA와 기본 브랜치 SHA의 대응표. PM은 같은 때에 커밋별 검사 로그의 빈 곳도 채운다: 감사 대상 커밋(1차는 브랜치의 커밋, 2차는 그 뒤의 커밋)마다 그 트리의 로그에 `worktree: clean`·`exit: 0`인 실행이 있는지 보고, 없는 커밋(rebase로 다시 만든 것, 다른 기계에서 한 것, 훅을 거치지 않은 것)만 깨끗한 작업 트리에서 체크아웃해 `sh .agents/harness/run-gates.sh audit`을 돌린다. 커밋의 내용은 바뀌지 않으므로 나중에 돌려도 답은 같다. 실패한 실행은 고치지 않고 그대로 넘긴다. 감사자는 네트워크 없이 실행하고, 없는 기록은 "확인 불가"로 두고 PM에게 요청한다. 최소 컨텍스트로 받고 작업 대화는 받지 않는다.
- **판정**: §3-1 흐름을 지켰는가. 각 행위 당시의 규칙과 승인된 예외가 기준이다. 커밋도 본다: 커밋마다 의미 있는 작업 단위인가 — 그 시점으로 되돌릴(revert·reset) 수 있고, 되돌려도 다른 멀쩡한 작업·기능은 되돌아가지 않는가. 한 작업에 커밋이 여럿(구현, 리뷰 수정)인 것은 정상이고, 함께 되돌아가도 되는 작은 작업은 한 커밋에 합칠 수 있다. 무관한 작업을 한 커밋에 섞었거나, 작업 단위를 승인 없이 더하거나 빼거나 범위를 바꿨으면 위반이다(차단 장치는 두지 않는다). spec의 조정 기록에 적힌 조정은 지킨 것이고, 기록 없이 한 조정은 위반이며 보완은 기록이다. 버전 동안 생성 파일·하네스 파일이 `update`·`config` 커밋이 아닌 커밋에서 바뀌었으면 위반이다(드리프트). 검사도 본다: 커밋마다 그 트리의 로그에 `worktree: clean`·`exit: 0`인 실행이 있는가 — 커밋 때 남긴 것인지 감사 전에 채운 것(`stage: audit`)인지 함께 적는다. 그런 실행이 없으면 "확인 불가", 깨끗한 실행이 0이 아닌 `exit:`로 끝났으면 위반이다. 증거 경로가 없으면 통과가 아니라 "확인 불가"다.
- **건너뛴 단계**: 사용자 지시로 건너뛴 단계·승인은 intent의 `waivers:`에 그 자리에서 기록되어 있으면 넘긴다. 일회성이다.
- **위반**: 1차 감사의 위반은 머지 전에 보완하거나 사용자가 받아들인다. 어느 쪽이든 감사와 회고에서 정확히 비판하고, 경중에 따라 PL이나 Advisor 의견을 받아 해결 방법을 낸다. 1차 감사에 위반이 없거나 처리가 끝났고 사용자가 머지하라고 하면 바로 머지한다.
- **머지**: 머지 지시가 어느 PR을 말하는지는 PM이 판단한다 — 지명한 PR, 지명이 없으면 PM이 머지를 제안한 것(하나든 묶음이든)이나 방금 말한 PR. 가릴 수 없으면 묻는다. 일반적인 "계속해"는 머지 지시가 아니다. 지시의 말은 PR 기록과 함께 남긴다. 머지한 브랜치는 그 단계에서 원격과 로컬 모두 지운다. 머지가 커밋을 다시 만들면(rebase·squash) 머지 뒤에 쓰는 기록은 기본 브랜치의 SHA를 적는다. 머지 전에 쓴 1차 감사 기록은 고쳐 쓰지 않고, PM이 머지 직후 브랜치 SHA와 기본 브랜치 SHA의 대응표를 만들어 2차 감사에 넘기고 감사 파일의 `SHA 대응`에 커밋한다. spec의 완료 표시는 다음 기록 커밋에서 기본 브랜치 SHA로 고친다.
- **기록**: `.agents/audit/<version>.md`(커밋). 감사 실행은 읽기 전용이다: 감사자는 기록 전문을 답으로 돌려주고, PM이 그 답을 온 그대로 `.loctx/reports/<version>/`에 남긴 뒤 고치지 않고 기록 파일에 쓴다(판정을 바꾸거나 줄이지 않는다). 한 버전의 두 감사는 한 파일의 두 절이다. 1차는 `## 1차 감사`에 쓰고 PR 브랜치에 커밋해 작업과 함께 머지한다(이 커밋을 푸시하면 PR의 head가 움직이므로 CI를 다시 기다린다. 사용자 처리와 보완 커밋도 같다: 마지막 커밋에서 CI가 통과한 뒤 머지한다). 사용자 처리(보완·수용)는 그 아래 구분된 절로 덧붙인다. 2차는 `## 2차 감사`에 쓰고, PM이 그 아래 `SHA 대응`을 붙이며, 사용자 처리 절 없이 회고가 읽고 회고에서 정한 것을 `회고에서의 처리`에 적는다. 2차 기록은 회고의 커밋들과 한 PR로 간다.
- **필수**: `bindings.yaml`의 `audit.required: true`가 기본이다. 끄는 것은 사용자만 `config`로 한다. auditor에 모델이 없으면 감사는 PM 자신의 모델의 새 실행, 또는 사용자가 고른 다른 모델이 한다(권장: 다른 벤더의 새 실행).
- 절차 감사의 통과는 방향이나 구현 품질의 보증이 아니다. 방향은 plan-reviewer와 사용자가 본다.

### 3-4. 승인과 회고
- **승인**: PM이 사용자 말을 인용해 intent·spec 프론트매터 `approvals:`에 `{ role: user, by, at, words, rev }`를 적고 커밋한다. `rev`는 승인 대상 개정이다. 사용자가 원하면 직접 한다. spec 요약은 매번 진행/수정을 기다린다(자동 수락 없음).
- **회고**: 2차 감사 뒤(stable 뒤, stable을 내지 않는 버전은 사용자가 종료를 선언하면). 두 감사의 결과, 특히 2차 감사가 넘긴 것과 릴리스 과정을 보고 retrospector(꺼져 있으면 PM)가 AGENTS.md·스킬·하네스 개선안을 낸다. "켠 역할군이 값을 했는가"도 본다. 개선안 가운데 이 프로젝트가 아니라 하네스 자체(흐름·정지 블록, 스킬, 역할)에 대한 것은 따로 가려 적는다: 다른 프로젝트에서도 날 문제이므로 사용자가 reins로 가져갈 수 있게 한다. history와 감사에서 두 번 이상 나온 결정·실패는 knowledge 후보로 제안한다(§8; 없으면 "없음"이라고 적는다). 사용자가 받아들인 것만 반영한다: 프로젝트 절과 knowledge는 PM이, 하네스 원본은 사용자가 `config`·`update`로. 회고가 끝나면 정리(§4-2)를 한다.

## 4. 파일
### 4-1. 형식
YAML 프론트매터 + Markdown 본문. 본문은 사용자 언어, 키는 영어. 빈 절은 `—`.

| 파일 | 위치 | 절 |
|---|---|---|
| **intent.md** | `.agents/intent/<NNN>_<slug>/` | 문제 · 바라는 결과 · **계획**(작업 순서) · 영향 범위 · 제약 · 열린 질문 · 질의서 기록 · 에이전트가 정한 것 · 하지 않을 것. 프론트매터 `status: draft\|approved\|released\|superseded`, `approvals`, `waivers: [{step, words, at, scope: once}]` |
| **spec.md** | 〃 | 요구 해석(`S-n`, 근거 표시) · 설계 · **작업 단위**(`W-n`, 체크박스, 완료 커밋) · **검증 기준**(`V-n`) · **조정 기록**(`A-n`: 무엇을·왜·어느 커밋) · 우려 · 범위 밖. 프론트매터 `status: draft\|accepted`, `approvals`, `summary_for_user` |
| **audit** | `.agents/audit/<version>.md` | 프론트매터 `first`·`second`(범위·날짜·감사자). **1차 감사**: 읽은 것 · 단계별 판정(지킴·위반·확인 불가·사용자 지시로 건너뜀, 근거 경로) · 비판 · 해결 방법 · 사용자 처리. **2차 감사**: 읽은 것 · 절차 판정 · 회고로 넘길 것 · SHA 대응 · 회고에서의 처리 |
| **history** | `.loctx/history/<version>.md` | 버전당 한 장: 결정(`decisions:` 줄), 판정, 건너뛴 단계, 감사·회고 요약, 지운 로그의 요약(대상 커밋·검증 명령과 결과·예외) |

plan.md, ticket 파일, bus 파일은 없다. 커밋 메시지에 spec 항목(`S-n`/`W-n`, 조정이면 `A-n`)을 적어 계획과 커밋을 잇는다.

**작업 중 spec 조정.** spec이 수락된 뒤에도 일하면서 spec은 움직인다. 작업 단위의 추가·삭제·범위 변경은 spec의 변경이다: 멈추고 spec을 고쳐 요약에 진행/수정을 받는다. 그보다 작은 것은 조정이다 — 같은 단위 안의 방법 변경, 리뷰·감사·rc 확인에서 나온 작은 보완, 단위의 순서 변경, knowledge나 history에 비슷한 선례가 있는 변경. 조정은 진행하고, spec의 조정 기록에 적고(`A-n`), 흐름의 끝 보고에 모아 알린다. 어느 쪽인지 가릴 수 없으면 멈추고 묻는다. 사용자가 보고받은 조정을 받아들이지 않으면 spec의 변경으로 다룬다(되돌리거나 승인받음).

### 4-2. 수명
| 파일 | 만드는 쪽 | 지우는 쪽·시점 |
|---|---|---|
| intent·spec·audit·knowledge | PM·Planner(audit는 감사자의 답을 PM이 그대로 씀) | 지우지 않음(커밋) |
| `.loctx/history/<version>.md` | PM | 지우지 않음(로컬 노하우) |
| `.loctx/reports/<version>/`(게이트·테스트 원본 로그, 하위 보고) | 그 단계를 한 역할 | 회고 뒤 PM이 정리. 지우기 전 history·감사 기록에 요약 |
| `.loctx/reports/gates/<tree>.log`(커밋별 검사 출력) | 훅이 부르는 `run-gates.sh`, 감사 전의 PM | 회고에서 PM. 그 버전의 stable 태그 전에 쓰인 것만(뒤 작업의 로그는 남김) |
| `.agents/AGENTS.previous.md` | install·migrate·config | 재구성이 끝나면 PM |
| `.loctx/delegation.local.md`(개인 위임 표) | config(두 범위)·install·update | 같은 명령이, 개인 설정이 없어지거나 팀과 같은 위임이 될 때 |
| `.loctx/context/`, `ROADMAP.local.md` | 사용자·PM | 사용자 |

install·update는 history에 쓰지 않는다. 각 스킬의 ④가 이 표를 따른다.

## 5. 프로젝트 것과 툴 것의 경계
### `AGENTS.md`
관리 블록 `<!-- reins:begin <block> -->`…`<!-- reins:end <block> -->`: ① 폴더 구조 ② 설정(`.agents/harness/bindings.yaml`; `audit.required`가 true면 버전마다 감사 필수, 끄는 것은 사용자만) ③ 흐름과 스킬 순서 ④ 위임 표(첫 줄은 "`.loctx/delegation.local.md`가 있으면 이 절 대신 그것을 따른다"; 켜진 역할의 모델; 다른 벤더 모델은 그 CLI의 실행 줄, 예: `codex exec -m <model> -s read-only`) ⑤ 승인·건너뛰기 기록 규칙 ⑥ 멈추고 물을 때(§3-2). 블록 밖은 프로젝트 것이다. 블록은 흐름을 강하게 명시해, 차단 없이도 에이전트가 따르게 한다.

**온보딩 표시.** install·migrate는 프로젝트 절 위에 `<!-- reins:onboarding pending -->`과 할 일 목록(목표와 범위, 스택과 명령, 기존 규칙과 관례, 금지선, 문서 언어, 훅 도구가 없으면 훅 도구 정하기)을 둔다. **재구성 표시.** migrate 충돌이나 0.x 이전이면 `<!-- reins:reconcile pending -->`을 두고 이전 본문을 `.agents/AGENTS.previous.md`(참고 자료, 지침 아님)로 옮긴다. 0.2.0 이하 설치를 `update`가 옮길 때 만드는 사본은 머리에 "0.2.0 이하의 지시 사본이며, 여기 적힌 reins 명령(`reins status`·`reins check` 등)은 0.3에 없으니 실행하지 말 것"이라는 한 단락을 붙인다(그 본문에는 옛 reins 명령 줄이 남아 있기 때문이다; migrate의 사본은 다른 하네스의 본문이라 붙이지 않는다). 진행 중인 작업이 있으면 재개 지점을 함께 적는다. **모드 변경 표시.** `config`로 모드를 바꾸면 바뀌는 것은 위임 블록뿐이므로 사본을 만들지 않고 `<!-- reins:mode-changed pending -->`만 둔다. PM은 프로젝트 절에 바뀐 모드와 어긋나는 문장이 있는지만 확인한다. **정리 표시.** `update`가 0.3.2 전의 0.3 설치(`install.yaml`의 pin이 0.3.0·0.3.1)를 올리면 `<!-- reins:tidy pending -->`을 한 번 둔다: 그 AGENTS.md는 가이드가 생기기 전에 쓰였다. 이미 `tidy` 표시가 있거나 온보딩·재구성 표시가 pending이면 두지 않는다(그 절차가 가이드를 따른다). 0.2.0 이하에서 오는 설치는 재구성 표시만 받는다. 어느 표시든 PM은 다음 첫 대화에서 `onboard` 스킬로 처리하고 `done`으로 바꾼다.

**AGENTS.md 가이드.** 프로젝트 절에 무엇을 두는지는 `.agents/harness/templates/agents-md-guide.md`가 말한다. AGENTS.md는 에이전트가 세션마다 읽고 소스를 받은 사람 모두가 읽으므로 짧고 잘 바뀌지 않아야 한다. 두는 것: 프로젝트가 무엇인지, 거시적 목표와 범위, 구조, 스택과 명령, 공통 규칙·관례, 금지선, 계속 지켜야 하는 중요한 지시. 두지 않는 것과 갈 곳: 현재 작업·진행 상황·버전별 계획은 로드맵, 결정과 그 이유는 knowledge 후보(사용자가 받아들일 때 씀), 한 번의 결정은 그 intent·spec이나 history, 개인 메모는 `.loctx/`, 기여 방법은 CONTRIBUTING. `onboard` 스킬은 기존 AGENTS.md·CLAUDE.md·`AGENTS.previous.md`를 가이드로 가르고, 무엇을 어디로 보내고 무엇을 버리는지 표로 사용자에게 보인 뒤 받아들인 것만 옮긴다. reins는 프로젝트 절의 글을 옮기거나 고치지 않는다: 표시만 남긴다.

### `gates.yaml`
`gates.<name>.cmd`(명령 하나) · `order` · `optional`. 발견 절차와 하위 디렉터리 제안은 v1.0과 같다. 훅과 `test` 스킬은 이 명령을 그대로 부른다.

### `bindings.yaml` (2판)
```yaml
schema: reins/bindings@2
mode: single            # single | multi
audit: { required: true }
tools: { claude: { cli: claude, use: true }, openai: { cli: codex, use: true } }
groups:                 # 적지 않은 군 = 꺼짐(PM이 함)
  pl:
    models: [ { vendor: claude, model: claude-sonnet-5-5 }, { vendor: openai, model: gpt-6.1-terra } ]
    roles: { doc-reviewer: { vendor: claude, model: claude-sonnet-5-5 } }
  implementer: { vendor: claude, model: claude-sonnet-5-5, fallback: { vendor: openai, model: gpt-6.1-terra } }
  auditor: { vendor: openai, model: gpt-6.1-sol }
```
**PM의 모델은 적지 않는다.** PM은 지금 대화하는 모델이다: 위임 절은 "you are the PM — the model in this conversation"이라고만 적고, 모델을 배정하지 않은 역할은 그 모델(새 실행이나 서브에이전트)이 하고, 감사는 auditor에 모델이 없을 때 그 모델의 새 실행(또는 사용자가 고른 다른 모델)이 한다. 0.3.1까지 PM의 모델이던 `default` 키는 읽지 않는다. 기존 파일이 깨지지 않게 스키마에는 남기고, `config`가 그 파일을 쓸 때 지우고 알린다.

상속: 상세 역할 > 군 > 꺼짐. 로컬 파일의 빈 군(`{}`)은 팀이 켠 군을 그 사람에게만 끈다. vendor와 model은 한 묶음으로 상속한다. `models`는 pl·advisor만. 실행 중 해석이 필요한 키(`escalation`, `limits`, `parallel`)는 없다. **대체 모델** `fallback`은 군(`groups.<g>.fallback`)과 상세 역할(`roles.<r>.fallback`)에 `{vendor, model}` 하나를 적을 수 있고(한 단계뿐, PM에는 없음) reins가 실행 중에 해석하지 않는다: `config`가 쓸 때 위임 표의 그 역할 칸 끝에 `; fallback: <vendor> <model> — <실행 줄>`로 풀어 적고(감사 줄에는 모델 이름), 역할의 호출을 할 수 없을 때(CLI 없음, 모델 거부, 한도 초과 — 답이 마음에 들지 않는 것은 아님) PM이 그 줄을 한 번 쓰고 사용자 보고와 그 단계의 기록에 썼다는 것과 이유를 적는다. 대체가 없거나 대체도 안 되면 멈추고 묻는다. 대체는 모델과 한 묶음으로 상속한다: 자기 모델을 가진 상세 역할은 자기 대체만 쓰고, 군의 모델을 쓰는 역할은 군의 대체를 쓴다(모델이 여럿인 군도 군 대체 하나). 대체는 같은 파일의 같은 자리에 모델이 있을 때만 적을 수 있고(모델 없이 대체만 있는 개인 설정은 그 군을 꺼 버린다) 그 모델과 달라야 한다. Claude 대체는 전용 `rs-*` 파일 없이 "그 모델의 일반 서브에이전트에 역할 파일의 해당 절을 넘겨"로 적는다. 대체가 하나도 없는 설정의 위임 절은 대체를 말하지 않는다. `config`가 쓸 때 상속을 풀어 생성물과 위임 표에 적는다. 로컬 덮어쓰기 `.loctx/bindings.local.yaml`(같은 모양, 키 단위로 이김)은 사람마다 다를 수 있으므로 생성물에는 쓰지 않는다. 그 사람의 위임이 팀과 달라지면, 위임 블록을 쓰는 명령(`config` 두 범위, `install`, `update`)이 같은 렌더러로 그 사람의 위임 표를 `.loctx/delegation.local.md`에 쓰고, 같아지면 지운다(그린 결과로 비교). 이 표의 Claude 역할은 팀이 같은 이름·모델의 `rs-*`를 생성했으면 그 이름을, 아니면 "그 모델의 일반 서브에이전트에 `.agents/harness/roles/<group>.md`의 해당 역할을 넘겨"를 적는다(로컬용 `rs-*`는 만들지 않음 — `.claude/agents/`는 팀 생성물). 따르게 하는 것은 차단이 아니라 문서다: 스킬 ③의 첫 문장, 위임 절 첫 줄, 그리고 `config`가 표를 쓰거나 지울 때 "열린 세션에는 다시 읽으라고 하거나 새 세션" 안내(intent 020).

## 6. 생성과 드리프트
원본 → 생성물: `harness/roles/` + bindings → `.claude/agents/rs-<group>-<role>.md`(멀티에서 켜진 Claude 역할만; 모델·`tools`가 박힘) · `skills/` → `.agents/skills/`(Claude는 `.claude/skills/`에 복사) · 템플릿 → AGENTS.md 관리 블록. 생성물 머리에 "generated — do not edit". 다른 벤더 모델이 할당된 역할은 에이전트 파일 대신 위임 표의 실행 줄로 다룬다. 실행 줄의 명령은 설정의 `tools.<vendor>.cli`이고, 적혀 있지 않으면 reins가 아는 그 벤더의 기본 명령(openai는 `codex`, google은 `agy`, cursor는 `cursor-agent`)이다. 한 역할에 Claude 모델이 여럿이면(discussion, committee) 모델마다 번호를 붙인 파일(`rs-advisor-committee-1` …)을 만든다. 단일 모드면 에이전트 파일이 없다. install은 `generated.yaml`에 없는 같은 이름 파일을 덮어쓰지 않는다. 그 파일만 건너뛰고 알리며, 나머지 설치는 계속한다.

**`.claude/settings.json`은 합친다.** 이 파일은 사용자와 함께 쓰는 파일이라 위 규칙의 예외다. reins의 것은 금지선에서 만든 `permissions.deny` 규칙뿐이고(`$schema`는 없을 때만 넣음), 그 밖의 키와 항목(`allow`, 사용자가 `deny`에 더한 줄, `hooks`, `env` …)은 순서까지 그대로 둔다. reins가 마지막으로 쓴 규칙 목록을 `generated.yaml`의 `owned:`에 적어 두고, 다시 만들 때 지금 만드는 규칙은 `deny` 끝에 넣고(이미 있으면 그대로) 목록에 있었는데 이제 만들지 않는 규칙만 뺀다. 목록이 없는 설치(0.3.0 이하)는 파일이 reins가 쓴 그대로면 전부 reins 것으로 보고, 손댄 파일이면 더하기만 한다. 사용자 항목이 있어도, reins가 만든 적 없는 기존 파일이어도 합쳐 쓰며 `--force`는 이 파일에 차이가 없다. JSON이 아니거나 `permissions`·`deny`의 모양이 다르면 쓰지 않고 알린다(나머지 생성물은 계속).

**검사 스크립트.** `.agents/harness/run-gates.sh`(POSIX sh)는 `gates.yaml`의 필수 검사 명령을 순서대로 돌리고 그 출력을 화면과 `.loctx/reports/gates/<tree>.log`에 남긴다. 첫 실패에서 멈추고 그 종료 코드를 돌려준다. 명령은 reins가 쓸 때 스크립트에 넣어 둔다(실행 중에 YAML을 읽지 않는다): `install`과 `update`는 돌 때마다 지금의 `gates.yaml`로, `config gates`는 `gates.yaml`을 고칠 때 다시 만든다. 다른 생성물처럼 `generated.yaml`의 해시로 손 수정을 가린다. 필수 검사가 없으면 스크립트도 훅 줄도 없다. reins·npx를 부르지 않고 환경 변수를 바꾸지 않는다. `<tree>`는 검사한 내용의 트리 해시다 — pre-commit 단계는 `git write-tree`(그 커밋을 위해 git이 준비한 인덱스라 `commit -a`·`commit <경로>`에서도 그 커밋의 트리), 그 밖의 단계는 `HEAD^{tree}`. 커밋의 로그는 `git rev-parse <commit>^{tree}`로 찾는다. 실행마다 머리줄 `== <시각> stage: <단계> worktree: clean|dirty`, 명령과 출력, 마지막 줄 `exit: <코드>`를 덧붙인다. 검사는 작업 트리에서 돌기 때문에 작업 트리가 그 트리와 다르면(일부만 스테이징했거나, git이 추적하지도 무시하지도 않는 파일이 있음) `dirty`이고, 그 실행은 그 트리의 증거가 아니다.

**훅.** install은 프로젝트의 훅 도구(lefthook 설정, `.husky/`, pre-commit 설정)를 감지해 단계마다 한 줄 — `sh .agents/harness/run-gates.sh pre-commit`, `… pre-push` — 을 제안한다. husky면 터미널에서 묻고 확인하면 `# reins:begin hooks` 블록에 넣는다(auto 모드도 묻는다; 비대화형은 `--hooks`일 때만). 이미 있는 블록의 본문이 이 한 줄이 아니면(0.3.0이 검사 명령을 직접 적어 둔 블록) `install`·`update`가 이 한 줄로 바꾸고 바꾸기 전 본문을 출력에 보여 준다. 블록이 없는 husky 파일은 확인 없이 건드리지 않는다. lefthook과 pre-commit은 그 도구 형식의 줄을 제안만 하고 사용자가 그 설정에 넣는다. 훅 도구가 없으면 온보딩 할 일로 남기되 스크립트는 만들어 두므로, 도구를 나중에 정해도 넣을 것은 같은 한 줄이다. Windows에서는 `sh`(Git for Windows에 들어 있음)가 훅 도구의 PATH에 있어야 한다.

**드리프트.** 생성 파일과 원본이 어긋난 것(손 수정, 다시 만들지 않음)이다. ① 감사가 버전 동안 생성 파일·하네스 파일을 바꾼 커밋이 `update`·`config` 커밋인지 git 이력으로 가린다. ② `update`는 `generated.yaml` 해시와 현재 파일을 비교해 손으로 고친 파일을 보여 주고 확인받는다(비대화형은 덮어쓰지 않고 목록과 exit 1, `--force`로 덮어씀). 훅과 CI에서는 검사하지 않는다. `.claude/settings.json`에서는 사용자 항목을 바꾼 것은 드리프트가 아니고, reins가 만든 deny 규칙을 손으로 빼거나 고친 것만 드리프트다(다음 `update`·`config`가 다시 넣는다).

## 7. 세대 판별, migrate, 0.x 이전
세대 신호와 `.ai/` 매핑은 v1.0과 같되, 열린 work는 ticket 대신 intent 000의 계획 목록으로 옮긴다. AGENTS.md 충돌은 §5 재구성으로 처리한다.

**0.1.x·0.2.0 → 0.3**(`update`가 감지, 멱등): 스킬 `reins-*` 삭제·새 스킬 설치 · 훅 파일의 `reins:begin hooks` 블록 제거(사용자 줄 보존)와 §6 훅 제안 · `.claude/settings.json`의 reins 훅 항목 제거(사용자 항목 보존) · `.claude/agents/reins-*.md` 삭제 · bindings 1판 → 2판(역할 → 군: pm은 옮기지 않음 — PM은 지금 대화하는 모델, planner·pl→pl/planner, implementer→implementer, code-review→pl.code-reviewer, verify-tool·qa-run·deploy·lookup→executor, qa-design→planner.qa-designer, docs→implementer.doc, advisor→advisor; 사용자가 확인) · `install.yaml`의 `tier` 삭제 · AGENTS.md는 재구성 · `.loctx`의 bus·ticket·dispatch·hook-state·journal·reports·metrics 목록을 보여 주고 확인 뒤 삭제(history·context·ROADMAP.local은 보존). 중간에 멈춰도 다시 실행하면 이어진다.

## 8. knowledge
`.agents/knowledge/<date>_<slug>.md` 형식(결정 · 이유 · 적용 · 바뀌면)은 v1.0과 같다. 승격은 회고에서(`retro` 스킬): retrospector나 PM이 history·감사에서 반복된(두 번 이상) 결정·실패를 찾아 제안하고 — 이미 같은 항목이 있으면 그 항목의 갱신을 제안한다 — 사용자가 받아들이면 PM이 쓴다(`approved: {by, at, words}`). 찾기는 `grep -l 'decisions:.*<keyword>' .loctx/history/* .agents/knowledge/*`. 세는 CLI는 없다.

**수용된 지적.** 감사는 다 잡아내고, 사용자가 수용할 것을 고른다. 같은 지적이 세 번 이상 수용되면(감사 기록의 `사용자 처리`와 `회고에서의 처리`, 여러 버전에 걸쳐) 회고가 `kind: accepted-finding` 항목으로 제안한다: 어떤 지적을 수용으로 보는가(결정), 몇 번 어디서 수용했는가(이유 — 파일 경로와 사용자의 말), 어디까지가 수용이고 어디부터는 다시 위반인가(적용). 승격은 다른 항목과 같다(사용자가 받아들인 것만). 두 감사는 이 항목들을 읽고, 범위 안의 지적을 위반이 아니라 "알려진 수용"으로 항목 파일과 함께 따로 적는다. 범위 밖이면 전처럼 위반이다.

## 9. CLI와 플러그인
`npx @bluenyang/reins` — 네 명령. `install`·`migrate`·`update`는 `--dry-run`, 넷 모두 `--json`. TS, Node ≥ 22, 배포물에 Python 불필요(R65). CLI는 모델을 부르지 않는다.
- `install [--mode manual|auto] [--hooks]`: 하네스 배치, 도구 감지, 게이트 확인, 훅 제안, 온보딩 표시. 기본 모드 single. 3·4세대 위에서는 거부하고 `migrate`로 안내.
- `migrate [--legacy local|committed]`: 세대 판별 후 이전, 재구성 표시.
- `update [--yes] [--force]`: 원본 → 생성물, 손 수정 확인, 0.x 이전.
- `config`: TTY면 화면 — `models and roles`(단순/상세 할당, 군별·상세 역할별 모델, 군 켜기/끄기와 켤 만한 조건: PM 컨텍스트 저하, 독립 작업 병렬, 다른 모델로 리뷰·감사) · `agent tools`(claude, codex, agy, gemini, copilot, cursor agent 다시 감지와 사용 여부) · `mode`(single/multi; 바꾸면 모드 변경 표시) · `audit`(필수 끄기는 한 번 더 확인) · `gates`(지금 검사 — 이름, 명령, 출처, 순서 — 와 훅 도구·검사 스크립트를 보여 주고, 다시 찾기와 하위 디렉터리 제안 더하기를 고름). 범위는 project(팀, 커밋되는 `bindings.yaml`)와 local(나만, `.loctx/bindings.local.yaml`; 위임이 팀과 다르면 `.loctx/delegation.local.md`도) 둘이고 PC 전체 기본값은 없다. project에 쓰면 생성물을 다시 만든다. single 모드에서는 역할군 할당을 "multi에서만 쓰임"으로, auditor를 "감사 권장 모델"로 표시한다. 모델 목록은 벤더 CLI가 주면 그것을, 아니면 `harness/models.yaml`의 알려진 목록을 쓴다. TTY가 아니면 플래그(`config bindings --set …`, `config bindings --fallback <군>[.<역할>]=<model|vendor:model|none>`, `config gates --add …`, `config gates --refresh [--apply <이름…|all>]` 등; 지금의 `configure` 플래그를 그대로 받음). **검사 다시 찾기** `config gates --refresh`는 설치 때와 같은 탐색(루트와 하위 디렉터리)을 다시 돌려 `gates.yaml`과의 차이를 낸다. 짝짓기는 차례로: 출처(`from`)와 명령이 같으면 같은 검사 → 출처와 이름이 같으면 **changed** → 이름이 같으면 **changed**(루트 `check`가 다른 스크립트를 가리키게 된 경우) → 남은 탐색 결과는 **new**, 남은 파일 검사는 **gone**(탐색이 더는 제안하지 않음; 출처 파일이 없어졌는지 다른 검사에 포함됐는지 이유를 함께 냄). `from`이 없는 검사는 손으로 넣은 것이라 "yours"로 보여 주기만 하고 건드리지 않는다. 아무것도 자동으로 쓰지 않는다: 터미널에서는 차이 목록에서 고른 것만, 비대화형에서는 `--apply`에 이름을 준 것만(`all`은 전부) 반영한다 — new는 `gates`와 `order` 끝에 더하고, changed는 명령과 출처를 바꾸고, gone은 뺀다. 주석과 다른 키, 순서는 그대로다. 없는 이름이 하나라도 있으면 쓰지 않고 종료 1. `gates.yaml`이 바뀌면 검사 스크립트(§6)도 다시 만들고 훅 줄은 그대로다. 화면에서는 군 화면의 `fallback (optional)`에서 대체를 고르거나 지운다.
- 설치 시점에 npx로 reins를 받는 것은 괜찮다. 생성물 안의 사람용 안내("설정을 바꾸려면 터미널에서 `npx @bluenyang/reins config`")는 허용하되, 에이전트에게 reins 실행을 지시하는 문장은 없다.
- 저장소 = npm 패키지 + Claude Code 플러그인. 플러그인은 설치 안내만 담는다(사용자에게 `npx @bluenyang/reins install`을 보여 줌).

## 10. v1.0에서 바뀐 것
| v1.0 / 0.1~0.2.0 | v2.0 | 이유 |
|---|---|---|
| 검증기 `reins check` T1~T6, 훅이 `npx @bluenyang/reins check` | 없음. 검사는 프로젝트 훅·스크립트, 준수는 감사 | 적용 저장소가 작업 중 reins에 의존(오프라인·공급망). 사용자 2026-11-07 |
| `gate`·`new`·`status`·`metrics`·`retro`·`knowledge`·`recall`·`doctor` | 없음 | 같음 |
| harness/loop/graph 세 단 | 없음. 단일/멀티와 역할군 켜기 | 사용자 2026-11-09 |
| 역할 12, 고정 역할, `covered_by`, escalation 사슬 | 군 7(PM 외 선택), 꺼진 군은 PM, PM 허브 | 사용자 2026-11-08 |
| plan.md, ticket, bus, metrics.jsonl | intent에 계획, spec에 작업 단위·검증 기준, 하위 보고는 reports | 같음, 파일 수명 |
| 승인 = `approvals` + `Approved-by:` 트레일러 | 사용자 말 인용 `{by, at, words, rev}` | 사용자 2026-11-09 |
| 정지 등급(HOLD·STOP·ESCALATE)과 id A1~G2, enforcement 표 | 평문 멈춤 규칙(§3-2), 감사 기준 | 검증기 없음 |
| qa-design은 코드를 보지 않음(R53) | 코드를 볼 수 있음 | 사용자 2026-11-09 |
| 드리프트를 훅·CI에서 검사 | 감사 + update 확인 | 사용자 2026-11-09 |
| 단계 스킬 `reins-*` 10개 + 지휘자 | 접두어 없는 11개, 지휘자 없음 | 사용자 2026-11-09 |
