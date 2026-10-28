# 로드맵

English edition: [ROADMAP.md](ROADMAP.md). 두 판이 다르면 한글 문서가 우선합니다.

버전 하나는 intent 묶음입니다. rc.1은 그 버전에서 계획한 것이 모두 끝났다는 뜻이고, 이후 rc는 안정화만 합니다. rc는 사람이 검증하며, stable 릴리스는 메인테이너가 명시적으로 지시할 때만 냅니다.

## 0.1 — graph 설계, 자기 설치·자기 이전

첫 대상은 이 저장소 자신입니다.

| 버전 | 상태 | 내용 |
|---|---|---|
| 0.1.0 | 배포됨 | 검증기(`reins check`), 하네스 원본(역할 12개, 정지 조건, 스키마, 템플릿), 자기 설치와 `migrate`, 에이전트 생성 파일과 `update`, 루프 check와 `reins gate`, 진입 스킬 세 개, `reins status`, metrics, 위반 시나리오, 양판 README |
| 0.1.1 | 완료 | 안정화: 0.1.0에서 루프가 찾은 문제 수정(관리 블록 드리프트 검출, 증거 경로, 밀폐 테스트, 모델 ID 확인, 정지 id 충돌, 버스 응답 스키마) |
| 0.1.2 | 완료 | Claude Code 플러그인: `/plugin marketplace add bluenyang/reins`. 플러그인에는 `reins-setup`만 싣고 나머지 스킬은 프로젝트에 설치합니다 |
| 0.1.3 | 배포됨 | 단계 스킬, 릴리스 흐름, 회고와 knowledge, 루프 수정(아래) |
| 0.1.4 | 배포됨 | 큰 저장소 적용 준비: 릴리스 흐름을 저장소 설정으로, 모노레포·Go 게이트 탐색, migrate ticket id, install 때 기억 파일 옮기기, `*.env` 비밀 패턴 |
| 0.1.5 | 배포됨 | 강제와 권고 구분, rc마다 문서 갱신, 여러 플랫폼 CI(아래) |

### 0.1.3 내용

- **단계 스킬.** 루프를 워크플로 단계마다 하나씩 열 개 스킬로 나눕니다. `reins-loop`는 이 스킬들을 순서대로 부르는 지휘자로 남습니다.
- **릴리스 흐름.** 배포 요약과 버전 동기화를 바로잡고, deploy 역할의 rc 흐름을 스킬로 적습니다.
- **회고와 knowledge.** 반복되는 사유를 세어 제안, 승인, 커밋을 거쳐 knowledge로 올리고, 찾는 데는 `reins recall`을 씁니다.
- **루프 수정.** ticket과 버스 요청을 손으로 쓰지 않고 `reins new`로 만들고, `--respond`가 verify 응답을 쓰며, `status`가 이미 릴리스된 intent의 마감을 다시 요구하지 않게 합니다.

### 0.1.5 내용

- **강제와 권고 구분.** README는 통제를 약속하지만, 역할 권한과 작업 범위, 예산은 아직 에이전트의 협조에 기대고 있습니다. 규칙마다 어떻게 지켜지는지를 한 줄로 적습니다. 스크립트나 훅이 막는 것, 전이 지점에서 검사하는 것, 역할과 스킬에 적혀만 있는 것으로 나눕니다. 이 표를 README 양판과 설계서에 넣고, 권고에 머문 규칙은 0.2의 입력으로 삼습니다. 모델 할당은 두 층으로 나눕니다. 커밋되는 `bindings.yaml`은 팀 기본값이고, gitignore되는 `.loctx/bindings.local.yaml`에 사용자별 덮어쓰기와 감지된 벤더를 둡니다. 역할이 실제로 쓸 모델은 스킬 지침으로 에이전트에게 맡기지 않고 CLI가 정합니다.
- **rc마다 문서 갱신.** rc도 결국 기본 브랜치로 merge되므로 문서도 그 시점에 맞아야 합니다. 로드맵 상태, CHANGELOG 절, README 상태 줄을 코드와 같은 릴리스 PR에서 고치고, 이전 상태가 남아 있으면 T5가 경고합니다.
- **여러 플랫폼 CI.** 패키지는 Node 20 이상을 선언하지만 CI는 Ubuntu와 Node 24만 봅니다. Node 20, 22, 24와 Windows, macOS에서도 `pnpm check`를 돌리고, 거기서 실패하는 것은 같은 버전에서 고칩니다.

## 0.2 — graph에서 loop·harness 깎기, 이기종 에이전트

입력: 0.1에서 쌓은 metrics.

| 버전 | 상태 | 내용 |
|---|---|---|
| 0.2.0 | rc, stable은 관리자 지시로 | `reins config` TUI(모델과 역할, 나 또는 팀 범위, 역할 켜고 끄기), install과 update 화면 |

- 비용과 정지 수치를 기준으로 graph에서 loop·harness 단계를 깎습니다.
- Codex, Gemini(Antigravity), Cursor용 생성 파일과 드리프트 검증.
- `reins recall`, `reins doctor`, `configure budget|gates|language`.
- 예산 정지와 아직 검출하지 못하는 위반.
- 0.1.5에서 권고로 분류한([표](README.ko.md#강제와-권고), 원천 [`enforcement.yaml`](../harness/policy/enforcement.yaml)) 규칙 중 스크립트나 훅으로 막을 수 있는 것(역할 권한, 작업 범위, 예산)을 강제로 바꿉니다. `.env` 읽기 차단부터 시작합니다.
- 이전 세대 하네스 시험 이전. 읽기 전용 리허설을 먼저 합니다.
- stable도 merge 전에 문서를 갱신합니다. 문서만 바꾸는 stable PR(intent `released`, 날짜가 붙은 CHANGELOG `[V]`, 로드맵 행, README 상태 줄)을 먼저 merge하고 stable을 배포합니다. publish 워크플로는 HEAD가 마지막 rc 태그와 같아야 한다는 조건 대신, 그 태그 이후 바뀐 것이 `release.docs` 파일과 해당 버전 intent의 상태뿐이면 stable을 받습니다.

## 0.3 — 적용

- Team Croffle 저장소에 적용합니다. 저장소마다 소유자의 허락을 받습니다.
- 남은 `.ai/` 하네스를 옮깁니다.

## 1.0 — 일정 없음

reins는 0.x에서 기능을 더해 가다가 메인테이너가 체계가 잡혔다고 판단할 때 1.0이 됩니다. 안정화만으로는 1.0이 되지 않습니다. 그때까지 파일 형식(스키마 `@1`)이 마이너 버전에서 바뀔 수 있고, 바뀌면 `update`나 `migrate`가 기존 설치를 옮깁니다.
