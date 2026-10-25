# reins

[English](../README.md)

reins는 저장소에 에이전트 하네스를 설치하고 기존 하네스를 옮기고 갱신하는 도구입니다. 하네스는 코딩
에이전트의 역할, 루프 정책, 스키마로 검증되는 인수인계 파일, 지식 저장소, 게이트로 이루어집니다.
정해진 지점마다 스크립트 `reins check`가 루프를 계속해도 되는지 판정하므로 에이전트는 자기 역할
안에서 지시받은 일만 합니다. 사람은 게이트에서 결정만 내립니다.

BlueNyang과 Team Croffle의 저장소 열두 곳이 같은 하네스 계보를 쓰면서 같은 문제를 겪고 있어 이
도구를 만듭니다. 에이전트가 요청 밖으로 나가고 구현한 세션이 검증과 판단까지 합니다. 지식이 gitignore
영역에서 사라지고 멈추는 기준이 없습니다. 복사본끼리 어긋나고 루프가 Claude에서만 돕니다. 문제 전체
목록(P1–P6)은 [proposal.ko.md](proposal.ko.md)에 있습니다.

## 상태

버전 0.1.0은 프리릴리스이며 계획의 1차(round one)입니다. 아직 npm에 올라가 있지 않고 Claude Code
플러그인 매니페스트도 없습니다. 그래서 지금은 `npx @bluenyang/reins`가 동작하지 않으니 소스에서
빌드해야 합니다([소스에서 시작하기](#소스에서-시작하기) 참고). 생성되는 벤더 파일은 Claude Code만
검증했습니다.

reins는 자기 루프로 자기 자신을 개발합니다. intent 001(`reins status`)은 intent → spec → plan →
ticket 순서를 거쳤고 T1~T5 검사를 통과했으며 코드 리뷰는 Codex가 맡았습니다. 이때 다른 벤더에 묶인
역할은 각 벤더 CLI(`codex exec`, `agy -p`)로 돌았습니다. `reins-loop` 스킬에 따라 주 에이전트가
호출한 것이며 CLI가 벤더를 스스로 부르는 기능은 아직 없습니다.

## 사다리

단계는 세 가지입니다. 위 단계는 아래 단계를 포함하고 세 단계는 하나의 원본을 공유합니다.

| 단계 | 구성 |
|---|---|
| harness | 커밋·푸시 시점의 검증기(T2, T4, T6), 레드라인, 생성되는 권한 설정 |
| loop | 계획 → 작업 → 테스트 → 릴리스 사이클, 역할 수는 줄고 전환 지점과 정지 조건은 같습니다 |
| graph | 열두 역할 전부, 스키마로 검증되는 인수인계 파일, 역할별 모델 바인딩 |

`reins install <tier>`는 세 단계 모두 받습니다. 1차는 graph 단계를 겨냥합니다. 0.2에서는 측정한 비용을
입력으로 삼아 graph에서 loop와 harness를 깎아 낼 계획입니다.

## 동작 방식

**역할.** 열두 개입니다: pm, planner, pl, implementer, lookup, verify-tool, code-review, qa-design,
qa-run, deploy, docs, advisor. 역할 파일마다 해서는 안 되는 일이 적혀 있습니다. 역할을 나누는 것이
모델을 나누는 것은 아닙니다. 모든 역할을 한 모델로 돌릴 수 있고 `bindings.yaml`이 역할마다 벤더와
모델을 정합니다. 설계상 감지되지 않은 벤더에 묶인 역할은 fallback으로, 그것도 없으면 pm의 모델로
돌아가므로 열두 역할 모두 Claude만으로 돌 수 있습니다.

**레드라인.** 모든 역할에 적용되고 검증기가 강제하는 규칙이 열 개(C1–C10) 있습니다. 몇 가지를 들면
이렇습니다. 통과만 시키는 구현 금지(C1), 관리 블록·정책·역할 파일 수정 금지(C2), 자기 권한 파일 수정
금지(C3), 시크릿 읽기 금지(C4), 훅 우회 금지(C5), deploy 역할 밖의 push·PR·merge·릴리스 금지(C6).
전체 목록은 [design.ko.md](design.ko.md) 2절에 있습니다.

**검증기.** `reins check`는 전환 지점마다 돌아 판정을 하나 출력합니다. 모델을 호출하지 않습니다.
역할이 판단을 인수인계 파일에 쓰면 검증기가 그것을 적용할 뿐입니다.

| 판정 | 종료 코드 | 의미 |
|---|---|---|
| CONTINUE | 0 | 계속 진행 |
| HOLD | 10 | 사용자의 답이 필요합니다 |
| STOP | 20 | 사람 없이 고칠 수 있고 이어서 재개합니다. 정지할 때 어디서, 왜(A1~G2 중 id), 어떻게 재개하는지 기록합니다 |
| ESCALATE | 30 | 실패 사슬: pl → pm → advisor → 사용자 |

정지 조건 A1–G2는 24개이며 되돌릴 수 없는 작업, 미결 결정, 무너진 전제, 반복 실패, 비용, 규칙 위반,
사용자 중단을 다룹니다.

**사슬과 사람의 두 결정.** 작업은 `intent.md` → `spec.md` → `plan.md` → ticket 네 파일을 따라
흐릅니다. 사람이 결정하는 지점은 둘입니다. intent는 사용자가 승인하고 spec은 3~5줄 요약을 보고
사용자가 거부할 수 있습니다. 나머지는 역할끼리 검토합니다. 검증 출력은 나온 그대로 붙입니다.
"통과"라는 한 마디만으로는 통과가 아닙니다.

**배치.**

| 경로 | 커밋 | 내용 |
|---|---|---|
| `AGENTS.md` | 합니다 | 도구가 쓰는 관리 블록, 프로젝트가 쓰는 섹션 |
| `.agents/` | 합니다 | `intent/`, `knowledge/`, `harness/`(역할, 정책, 스키마, 템플릿, `bindings.yaml`, `gates.yaml`), `skills/` |
| `.claude/` | 합니다 | `.agents/`에서 생성한 파일, 직접 고치지 않습니다 |
| `.loctx/` | 안 합니다 (gitignore) | ticket, 보고서, 인수인계 `bus/`, `history/`, 로컬 로드맵 |

## 소스에서 시작하기

Node 20 이상과 pnpm이 필요합니다.

```sh
git clone https://github.com/bluenyang/reins.git
cd reins
pnpm install
pnpm build
```

CLI는 설치하려는 저장소의 루트에서 실행합니다. 저장소에 커밋이 하나 이상 있어야 합니다(0.1.0의
`check`는 커밋이 없는 저장소에서 실패합니다).

```sh
node /path/to/reins/cli/dist/reins.js install graph --dry-run   # 쓸 파일을 미리 보여 줍니다
node /path/to/reins/cli/dist/reins.js install graph --mode auto # 파일을 놓고 CLI를 감지해 기본값을 적용합니다
node /path/to/reins/cli/dist/reins.js check --drift             # 원본과 생성물이 맞으면 "drift: ok"를 출력합니다
node /path/to/reins/cli/dist/reins.js status                    # intent, ticket, bus, 마지막 history
```

3·4세대 하네스가 있는 저장소에는 `install`이 거부하고 `migrate`를 안내합니다. 훅은 설치 안내문에서
제안만 하고 `--hooks`를 줄 때만 추가합니다. 배포되면 같은 명령을 `npx @bluenyang/reins <command>`로
실행하게 할 계획입니다.

## 명령

| 명령 | 상태 | 하는 일 |
|---|---|---|
| `install <harness\|loop\|graph>` | 구현됨 | 하네스를 설치합니다. `--mode manual\|auto`, `--hooks`, `--dry-run`, `--json` |
| `migrate <tier>` | 구현됨 | 기존 하네스나 `.ai/` 작업 공간을 이 배치로 옮깁니다 |
| `update` | 구현됨 | 패키지된 하네스를 다시 적용하되 프로젝트 섹션은 건드리지 않습니다 |
| `configure bindings` | 구현됨 | `--set role=model ...` 또는 `--vendors claude,openai`. 옵션이 없으면 묻습니다 |
| `gate [names...]` | 구현됨 | `gates.yaml`을 선언된 대로 실행하고 원본 출력을 `.loctx/reports/`에 남깁니다 |
| `status` | 구현됨 | 하네스, intent, ticket, bus, 마지막 history를 읽기 전용으로 보여 줍니다 |
| `check` | 구현됨 | `--stage ticket-start\|pre-commit\|verdict\|pre-push\|rc-close` 또는 `--drift` |
| `metrics` | 구현됨 | `.loctx/reports/metrics.jsonl` 요약: 역할·벤더·ticket·intent별 토큰, ticket당 knowledge 정지 수. `metrics record`로 역할 실행의 토큰을 남깁니다 |
| `recall` | 미구현 | 증상으로 과거 결정을 찾습니다 |
| `doctor` | 미구현 | — |
| `configure budget\|gates\|language` | 미구현 | — |

`install`, `migrate`, `update`, `gate`, `status`, `check`, `metrics`는 `--json`을 받습니다. `check`와 `gate`는 실행할 때마다 `.loctx/reports/metrics.jsonl`에 한 줄을 남깁니다. `check`의 stage는
T1(`ticket-start`), T2(`pre-commit`), T3(`verdict`), T4(`pre-push`), T5(`rc-close`)에 대응합니다.

## 스킬

에이전트가 쓰는 진입점 스킬이 세 개 있고 `SKILL.md` 표준을 따릅니다.

| 스킬 | 쓸 때 |
|---|---|
| `reins-setup` | reins를 설치하거나 기존 하네스를 옮길 때 |
| `reins-intent` | 새 요청이 들어올 때: 질문지, 승인된 intent, 수락된 spec |
| `reins-loop` | spec이 수락됐을 때: plan, ticket, 구현, 검증, 리뷰, history |

## 로드맵

| 버전 | 내용 |
|---|---|
| 0.1 | graph 설계, 이 저장소의 자기 설치·자기 이전, 검증기, 스킬 세 개, README. 0.1.0을 npm에 배포합니다 |
| 0.2 | graph에서 loop·harness 깎기, Codex·Gemini·Cursor 생성물, `recall`·`doctor`·예산 정지, 이전 세대 하네스 시험 이전 |
| 0.3 | Claude Code 플러그인, Team Croffle 저장소에 적용 |
| 1.0 | 정해진 일정은 없습니다. 0.x에서 기능을 더해 가다가 메인테이너가 체계가 잡혔다고 판단할 때 1.0이 됩니다. 안정화만으로 1.0이 되지는 않습니다 |

## 문서

- [proposal.ko.md](proposal.ko.md): 문제, 목표, 요구사항, 성공 기준
- [design.ko.md](design.ko.md): 배치, 역할, 정지 조건, 파일 형식, CLI
- 영문판: [proposal.md](proposal.md), [design.md](design.md). 영문판과 한국어판이 다르면 한국어 파일이 우선합니다.

## 라이선스

MIT
