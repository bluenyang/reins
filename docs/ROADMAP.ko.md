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
| 0.1.4 | 계획 | 큰 저장소 적용 준비: 릴리스 흐름을 저장소 설정으로, 모노레포·Go 게이트 탐색, migrate ticket id, install 때 기억 파일 옮기기, `*.env` 비밀 패턴 |

### 0.1.3 내용

- **단계 스킬.** 루프를 워크플로 단계마다 하나씩 열 개 스킬로 나눕니다. `reins-loop`는 이 스킬들을 순서대로 부르는 지휘자로 남습니다.
- **릴리스 흐름.** 배포 요약과 버전 동기화를 바로잡고, deploy 역할의 rc 흐름을 스킬로 적습니다.
- **회고와 knowledge.** 반복되는 사유를 세어 제안, 승인, 커밋을 거쳐 knowledge로 올리고, 찾는 데는 `reins recall`을 씁니다.
- **루프 수정.** ticket과 버스 요청을 손으로 쓰지 않고 `reins new`로 만들고, `--respond`가 verify 응답을 쓰며, `status`가 이미 릴리스된 intent의 마감을 다시 요구하지 않게 합니다.

## 0.2 — graph에서 loop·harness 깎기, 이기종 에이전트

입력: 0.1에서 쌓은 metrics.

- 비용과 정지 수치를 기준으로 graph에서 loop·harness 단계를 깎습니다.
- Codex, Gemini(Antigravity), Cursor용 생성 파일과 드리프트 검증.
- `reins recall`, `reins doctor`, `configure budget|gates|language`.
- 예산 정지와 아직 검출하지 못하는 위반.
- 이전 세대 하네스 시험 이전. 읽기 전용 리허설을 먼저 합니다.

## 0.3 — 적용

- Team Croffle 저장소에 적용합니다. 저장소마다 소유자의 허락을 받습니다.
- 남은 `.ai/` 하네스를 옮깁니다.

## 1.0 — 일정 없음

reins는 0.x에서 기능을 더해 가다가 메인테이너가 체계가 잡혔다고 판단할 때 1.0이 됩니다. 안정화만으로는 1.0이 되지 않습니다. 그때까지 파일 형식(스키마 `@1`)이 마이너 버전에서 바뀔 수 있고, 바뀌면 `update`나 `migrate`가 기존 설치를 옮깁니다.
