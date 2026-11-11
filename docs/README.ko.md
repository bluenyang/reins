# reins

[English](../README.md)

reins는 저장소의 에이전트 하네스를 관리합니다. 코딩 에이전트가 그 저장소에서 일하는 방식을 정하는 파일(`AGENTS.md`, 역할, 단계 스킬, 모델 할당)을 설치·이전·갱신·설정하는 것이 전부입니다. reins가 설치한 것은 프로젝트가 일하는 동안 reins를 실행하지 않습니다. 검사는 프로젝트의 훅 도구가 프로젝트의 명령으로 돌리고, 흐름을 지켰는지는 버전마다 감사가 판정합니다.

BlueNyang과 Team Croffle의 저장소 열두 곳이 같은 하네스 계통을 쓰면서 같은 문제를 겪었기 때문에 만들었습니다. 에이전트가 요청 밖으로 나가고, 한 세션이 구현과 판정을 함께 하고, 지식이 gitignore된 곳에서 사라지고, 사본이 서로 갈라졌습니다. 전체 목록은 [기획서](proposal.ko.md)에 있습니다.

## 상태

**0.3.1-rc.1이 릴리스 후보입니다**(intent 021): `npx @bluenyang/reins@0.3.1-rc.1`. **0.3.0이 최신 릴리스입니다**(intent 019, 020): `npx @bluenyang/reins install`. 0.2.0까지는 스킬과 훅이 작업 중에 `npx @bluenyang/reins`를 불렀습니다. 0.3은 그것을 없애고, `reins update`가 0.1.x·0.2.0 설치를 옮깁니다. 버전마다 바뀐 것은 [CHANGELOG.md](../CHANGELOG.md)에, 앞으로의 계획은 [로드맵](ROADMAP.ko.md)에 있습니다.

## 동작 방식

- **기본은 단일 에이전트입니다.** 에이전트 하나(PM)가 모든 단계를 수행합니다. 조사, 리뷰, 감사처럼 읽기 위주의 일이나 급한 병렬 작업에는 같은 모델의 서브에이전트를 쓸 수 있습니다. 멀티는 역할군(PM, PL, Planner, Implementer, Executor, Advisor, Auditor)에 모델을 할당해 켭니다. 모델이 없는 역할군의 일은 PM이 합니다. 근거는 Anthropic의 [Building agents: When to fold subagents into your main agent loop](https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop)(2026-10-22)입니다.
- **흐름은 실행 중 차단이 아니라 문서로 적습니다.** `docs/ROADMAP.md` → intent → spec → 구현 → 리뷰 → 테스트 → 머지 → 감사 → 릴리스 → 회고. 단계마다 `.agents/skills/`에 스킬이 있고, 순서와 멈추고 물을 때는 `AGENTS.md`에 있습니다.
- **승인은 사용자가 합니다.** intent와 매번의 spec 요약은 사용자를 기다립니다. PM은 사용자의 말을 인용해 승인을 기록합니다. 사용자가 건너뛰라고 한 단계는 한 번만 적용됩니다.
- **버전마다 감사합니다.** 머지 뒤, rc 전에 감사가 기록(intent, spec, git 이력, 로그)을 읽고 단계마다 판정합니다. 사용자가 끄지 않는 한 필수이고, 결과는 `.agents/audit/`에 커밋됩니다.
- **온보딩.** 설치 뒤 첫 대화에서 PM이 프로젝트를 파악하고 사용자에게 물어 `AGENTS.md`의 프로젝트 절을 씁니다.
- **파일마다 수명이 있습니다.** 작업 중 파일은 회고 뒤에 요약하고 지웁니다.

설계는 [design.ko.md](design.ko.md)에 있습니다.

## 시작하기

설정할 저장소의 루트에서 실행합니다(Node 22 이상).

```sh
npx @bluenyang/reins install --dry-run   # 무엇을 쓸지 보기
npx @bluenyang/reins install             # 묻고 나서 하네스 배치
npx @bluenyang/reins config              # 모델과 역할, 에이전트 도구, 모드, 감사
```

그다음 저장소에서 에이전트를 여세요. `AGENTS.md`의 온보딩 표시가 첫 대화를 시작합니다. Claude Code에서는 플러그인이 같은 명령을 보여 줍니다.

```
/plugin marketplace add bluenyang/reins
/plugin install reins@bluenyang
/reins:reins-setup
```

reins 자체를 개발하려면 `git clone https://github.com/bluenyang/reins.git` 뒤 `pnpm install`, `pnpm build`를 하고 `node cli/dist/reins.js <명령>`으로 실행합니다([CONTRIBUTING.ko.md](CONTRIBUTING.ko.md)).

## 명령

| 명령 | 하는 일 |
|---|---|
| `install` | 하네스를 배치하고, 에이전트 도구를 감지하고, 게이트를 확인하고, 검사 스크립트 `.agents/harness/run-gates.sh`(프로젝트 게이트 명령을 돌리고 출력을 감사용으로 남김)를 쓰고 그것을 부르는 훅 한 줄을 제안하고(`--hooks`면 husky에 넣음), 온보딩 표시를 남깁니다. `--mode manual\|auto`, `--dry-run`, `--json` |
| `migrate` | 이전 하네스나 `.ai/` 작업 공간을 이 배치로 옮기고, 이전 `AGENTS.md`는 PM이 합치도록 따로 둡니다. `--legacy local\|committed`, `--dry-run` |
| `update` | 패키지의 하네스를 다시 적용합니다. 손으로 고친 생성 파일은 덮어쓰기 전에 묻고(`--force`), 0.1.x·0.2.0 설치를 0.3으로 옮기며 옛 작업 파일을 보여 줍니다(`--yes`면 지움) |
| `config` | 터미널에서 화면: 모델과 역할, 에이전트 도구, 모드(single·multi), 감사. `config bindings`·`config gates`는 플래그로(`configure`는 별칭). `config gates --refresh`는 프로젝트 검사를 다시 찾아 `gates.yaml`과의 차이(new·changed·gone)를 보여 주고 고른 것만 반영합니다(터미널이 아니면 `--apply <이름…|all>`). 화면의 `gates` 항목에서도 같은 일을 합니다. 군이나 역할에 대체 모델을 적을 수 있습니다(`config bindings --fallback <군>[.<역할>]=<model>`). 첫 모델을 부를 수 없을 때 쓰도록 대체 실행 줄이 위임 표에 들어갑니다 |

## 스킬

`onboard`, `roadmap`, `intent`, `spec`, `implement`, `review`, `test`, `merge`, `audit`, `release`, `retro`. 단계마다 하나이고 평문이며, 단일과 멀티에서 같은 스킬을 씁니다. 스킬마다 만드는 파일과 지우는 때, 다음 스킬을 적습니다.

## 문서

- [proposal.ko.md](proposal.ko.md): 문제, 목표, 요구사항
- [design.ko.md](design.ko.md): 배치, 역할, 흐름, 감사, 파일 형식, CLI
- [ROADMAP.ko.md](ROADMAP.ko.md): 버전
- [conversation/](conversation/): 메인테이너의 설계 대화. 무엇을 두고 고민했고 왜 그렇게 정했는지를 적은 것이며 규칙은 아닙니다
- 영어판: [proposal.md](proposal.md), [design.md](design.md), [ROADMAP.md](ROADMAP.md). 둘이 어긋나면 한글판이 기준입니다.

## 라이선스

MIT
