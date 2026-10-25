# reins — 어떤 위반을 누가 잡는가 (S3)

> 한글 원본. 영어판은 [`violations.md`](violations.md) — 둘이 어긋나면 이 파일이 기준입니다. [`design.ko.md`](design.ko.md) §3의 짝 문서입니다.

설계에는 공통 금지선 10개(C1~C10)와 정지 조건 24개(A1~G2)가 있습니다. 이 표는 34개 각각에 대해, 설계가 의도한 바가 아니라 **지금 코드에서** 누가 위반을 잡는지 적습니다. intent 003의 S3 표입니다.

`test/e2e/violations.test.ts`가 이 표를 뒷받침합니다. 임시 git 저장소에서 규칙을 일부러 어기고, 빌드된 `cli/dist/reins.js`를 자식 프로세스로 실행해 정지 보고서와 종료 코드를 읽습니다. 지금은 `violations: 18/18 stopped`를 출력합니다. 시나리오 번호는 V1~V18이며, `—`인 행은 시나리오가 없습니다. 실행할 코드 경로가 없거나, 역할의 판단이라 시나리오로 자동화하지 않았기 때문입니다.

열 설명:

- **caught by** — `verifier`(`reins check` / `reins gate`, 단계 명시), `settings deny`(생성된 `.claude/settings.json`의 deny 규칙, Claude Code 전용), `role`(역할의 판단. `stops.yaml`이 `detect: role`·`pm`·`runtime`으로 적었거나, 금지선이 역할의 `must_not` 글로만 있는 경우), `none (gap)`(코드가 아무것도 잡지 못함). 둘이 적힌 행은 앞의 것이 주된 검출 주체입니다.
- **where** — 단계·명령 또는 파일. `pre-commit`·`pre-push` 단계는 훅이 설치되어 있을 때만 돕니다(`install`이 제안하고 `--hooks`로 추가). 나머지 단계는 역할이 호출할 때 돕니다.

| id | what | caught by | where | scenario |
|---|---|---|---|---|
| C1 (금지선) | "통과용" 구현 — 하드코딩, 일부 경로만 맞아 보이게 함 | role | 검토 역할의 판단. `implementer.md`의 `must_not`, 그리고 생성된 모든 Claude 에이전트에 들어가는 공통 금지선 지시 | — |
| C2 (금지선) | `AGENTS.md` 관리 블록, `harness/policy/`, `harness/roles/` 편집 | verifier | `check --stage pre-commit`(`.agents/harness/` 아래 파일이 스테이징됐을 때)와 `check --drift`의 match 층, F2로 보고. 관리 블록: none (gap) | V4 |
| C3 (금지선) | 자기 권한 파일이나 생성된 벤더 파일 편집 | verifier | `check --stage pre-commit`(`.claude/`·`.agents/harness/`가 스테이징됐을 때)와 `check --drift`, `generated.yaml` 해시 | V5 |
| C4 (금지선) | 비밀 파일 읽기 | settings deny, verifier | 나열된 패턴에 대한 `.claude/settings.json`의 `Read`/`Edit` 규칙(`.env.*`는 고정 목록으로 좁혀지므로 `.env.custom` 같은 이름에는 규칙이 없음). `check --stage pre-commit`은 스테이징된 비밀 경로를 거부할 뿐 읽기는 보지 않음 | V1, V18 |
| C5 (금지선) | 훅 우회, 게이트 출력 가공 | verifier, settings deny | `reins gate`가 단일 명령이 아닌 게이트를 거부. `check --stage verdict`가 파이프를 거친 증거를 거부. `.claude/settings.json`이 `git commit --no-verify`·`git push --no-verify`를 막음. `-n` 같은 줄임 형태: none (gap) | V13, V17, V18 |
| C6 (금지선) | deploy 역할 밖의 push·PR·merge·release·tag | none (gap) | — | — |
| C7 (금지선) | 사용자 없이 기록된 결정 뒤집기 | role | `common-red-lines.yaml`. 생성된 모든 Claude 에이전트에 들어가는 공통 금지선 지시 | — |
| C8 (금지선) | 거절된 제안 다시 꺼내기 | role | `common-red-lines.yaml`. 생성된 모든 Claude 에이전트에 들어가는 공통 금지선 지시 (F3 참고) | — |
| C9 (금지선) | 운영 서버·클러스터·네트워크 장비 건드리기 | role | `common-red-lines.yaml`. 생성된 모든 Claude 에이전트에 들어가는 공통 금지선 지시 | — |
| C10 (금지선) | intent·plan 밖의 파일·동작 변경 | role | `code-review.md`(plan 밖의 diff는 C10)와 `implementer.md`의 `must_not`. diff를 plan과 자동으로 비교하는 검사는 없음: none (gap) | — |
| A1 | 공유 브랜치 force push, 공개 태그 이동·삭제, main 재작성 | verifier, settings deny | `check --stage pre-push`(원격 커밋이 푸시할 커밋의 조상이 아님, 태그를 포함한 모든 ref 쌍). `.claude/settings.json`이 `git push --force`·`-f`·`--force-with-lease`를 막음. 태그 삭제, 그리고 조상 관계가 유지되는 태그의 전진 이동: none (gap) | V8, V18 |
| A2 | 정식(rc가 아닌) 릴리스 | none (gap) | — | — |
| A3 | 되돌릴 수 없는 데이터 변경, 운영 서버·클러스터 접촉 | none (gap) | — | — |
| A4 | pre-release 루프 밖에서 로컬을 떠나는 모든 것 | none (gap) | — | — |
| B1 | 열린 `asks:`가 있는 ticket | verifier | `check --stage ticket-start` | V10 |
| B2 | 기록된 결정 없이 설계 불변식이 바뀜 | none (gap) | — | — |
| B3 | 변경이 intent나 spec과 충돌 | role, verifier | 범위 충돌 자체는 역할의 판단. `check --stage ticket-start`는 승인 사슬(`Approved-by:` 커밋이 있는 승인된 intent, 수락된 spec)만 확인 | V9 |
| B4 | 로드맵이 침묵하거나 자기모순 | role | pm | — |
| B5 | 외부 API·환경이 설계 가정과 어긋남 | role | 발견한 역할, 이후 `spec.md` | — |
| P1 (정지) | 작업의 근거가 더는 성립하지 않음 | role | plan과 ticket을 읽는 역할들 | — |
| P2 (정지) | diff가 `plan.md`에서 벗어났는데 plan을 고치지 않음 | verifier | `check --stage ticket-start`(plan의 `tickets:`에 없는 ticket)와 `rc-close`(plan에 없는 intent의 열린 ticket) | V11 |
| D1 | 검증 라운드가 연속 두 번 실패 | verifier | `check --stage verdict` | V15 |
| D2 | history·knowledge에 해결이 없는 red check 두 번 | none (gap) | — | — |
| D3 | flaky: 혼자서는 통과, 전체 실행에서는 실패 | none (gap) | — | — |
| D4 | 거짓 통과 의심: 종료 코드 없음, 빈 출력, 파이프를 거친 게이트 | verifier | `check --stage verdict`(종료 코드 줄 없음, 0이 아닌 종료 코드, 명령 줄 없음, 복합 명령, 빈 게이트 출력은 WARN), `reins gate`(복합 명령 거부) | V13, V14, V17, V21, V23 |
| D5 | 증거 없는 pass | verifier | `check --stage verdict`(저장소 밖 절대 증거 경로 포함) | V12, V22 |
| E1 | 가장 좁은 예산의 80% | none (gap) | — | — |
| E2 | ticket·범위 예산 100% | none (gap) | — | — |
| E3 | rc·세션 예산 100% | none (gap) | — | — |
| F1 | 역할이 자기 `must_not`이나 금지선에 있는 행동을 시도 | none (gap) | — | — |
| F2 | 하네스 원본과 생성 파일 사이의 드리프트, 또는 규약 위반 | verifier | `check --stage pre-commit`과 `check --drift`(format·convention·match·generated 층). `ticket-start`·`rc-close`의 plan·ticket 검사, `verdict`의 마지막 verify 교환 스키마 검사도 F2로 보고 | V2, V3, V4, V6, V7, V16, V20 |
| F3 | 거절된 제안을 다시 제시 | role | `stops.yaml`의 `detect: role` | — |
| G1 | 사용자가 중단: 채팅, Ctrl+C, 세션 종료 | none (gap) | — | — |
| G2 | 사용자가 spec 요약을 거부 | role | pm (`stops.yaml`의 `detect: pm`) | — |

정지 조건 P1·P2(전제)는 예전에 C1·C2였고, 공통 금지선 C1·C2(설계 §2)와 id가 겹쳤습니다. 하네스 0.1.1부터 정지 조건은 P1·P2이고, 정지 보고서의 `reason: C1`~`C10`은 언제나 금지선입니다. `metrics`는 `reason: C1`·`C2`로 적힌 옛 기록을 P1·P2로 읽습니다.

## 행별 설명

- **C2 (금지선)**: match 층은 `.agents/harness/`를 패키지된 upstream과 비교해 F2로 보고합니다. 고정된 버전이 패키지 버전과 다르면 경고만 합니다. `AGENTS.md` 관리 블록은 어떤 것과도 비교하지 않습니다. `reins check`는 `blocks.ts`를 읽지 않습니다. 프로젝트 루트의 `harness/` 원본도 검사하지 않습니다.
- **C3**: 정지 보고서에 `reason: C3`이 담깁니다. 생성된 `.claude/settings.json`의 deny 규칙은 `.claude/settings.json` 자체의 편집을 막지 않습니다.
- **C4**: `settings deny`는 Claude Code 안에서만 읽기를 막습니다. 다른 벤더에는 deny 규칙이 없고, 검증기는 스테이징된 경로를 볼 뿐 읽기는 보지 않습니다. `denyRules`는 `.env.*` 패턴을 고정 목록(`.env.local`, `.env.*.local`, `.env.development`, `.env.production`, `.env.staging`, `.env.test`)으로 바꾸므로, `.env.custom` 같은 이름은 deny 규칙 없이 읽고 편집할 수 있습니다. 스테이징 검사는 이런 이름도 거부합니다. V18은 세 문자열(`Read(**/.env)`, `Bash(git push --force *)`, `Bash(git commit --no-verify *)`)만 단언하고 패턴 전체 목록은 단언하지 않습니다.
- **C5**: deny 규칙은 `git commit --no-verify *`와 `git push --no-verify *`만 정확히 대응합니다. `-n` 같은 줄임 형태는 막지 않습니다.
- **C7, C8, C9**: 금지 내용은 `common-red-lines.yaml`에 있고, 생성된 모든 Claude 에이전트에 "`common-red-lines.yaml`의 공통 금지선을 어기지 않는다"는 줄이 들어갑니다. 개별 역할의 `must_not` 목록에는 없으며, 이를 확인하는 검사도 없습니다. F3은 `stops.yaml`에도 `detect: role`로 있습니다.
- **C10**: `code-review.md`의 1단계는 `plan.md` 밖의 diff를 C10으로 보고, `implementer.md`는 `must_not`에 둡니다. 역할이 사람 손으로 하는 검토입니다. T2는 C10을 검증기 검사로 나열하지만 `preCommit`에는 diff와 plan을 비교하는 코드가 없습니다.
- **C6**: deny 규칙은 force push와 `--no-verify` push만 막습니다. 일반 `git push`, PR, merge, release, tag는 아무것도 막지 않습니다. `pre-push`는 원격 커밋이 조상인지(A1)만 봅니다.
- **A1**: `pre-push`는 git이 넘기는 모든 ref 쌍에 조상 검사를 적용하며 태그도 포함합니다. 자손이 아닌 커밋으로 옮긴 태그는 HOLD로 잡힙니다. 새 ref와 삭제(0 해시)는 건너뛰므로 태그나 브랜치 삭제는 잡히지 않습니다. 자손 커밋으로 앞으로 옮긴 태그는 조상 검사를 통과해 거부되지 않으며, 설계는 공개 태그 이동을 되돌릴 수 없는 일로 봅니다.
- **A2, A3, A4**: `stops.yaml`은 `detect: verifier`로 적고 T4도 이들을 나열하지만, `prePush`는 A1만 구현합니다.
- **B2**: `stops.yaml`은 `detect: verifier`로 적었지만, 설계 불변식과 기록된 결정을 비교하는 코드가 없습니다.
- **B3**: `stops.yaml`은 B3을 `detect: role`로 적었으나, ticket-start의 승인 사슬 검사는 `reason: B3`으로 보고합니다.
- **P1 (정지)**: `stops.yaml`은 `detect: role`로 적었고, 근거를 평가하는 코드는 없습니다.
- **P2 (정지)**: ticket이 plan에 있는지 보는 검사만 있습니다. diff를 `plan.md`와 비교하는 코드는 없으므로 T2의 P2·C10 검사도 없습니다.
- **D1**: 한 ticket의 연속된 실패 `verify` 교환 수를 셉니다(1회는 경고, 2회는 escalate). "rc.1 전은 ticket, 후는 rc"의 구분은 하지 않습니다.
- **D4**: `verdictCheck`는 증거에 명령 줄(`$ cmd`)과 `exit 0`이 있는지 봅니다. 이 두 줄만 있는 증거는 WARN(`gate output is empty`, V23)이고 판정은 그대로입니다. `reins gate`는 빈 명령 출력을 그대로 보고서에 씁니다. 증거 자체가 없는 경우는 다른 사례로, D5(V12)입니다.
- **D2, D3**: `stops.yaml`은 `detect: verifier`로 적었지만, 실행 사이의 기억도, 단독 실행과 전체 실행의 비교도 없습니다.
- **E1, E2, E3**: `budget.yaml`에 기본값이 없고, 예산이나 토큰 수를 읽는 코드가 없습니다. T1의 `budget-left`와 T5의 E3은 없습니다.
- **F1, G1**: T6("상시")은 `transitions.yaml`에 있으나 코드가 없습니다. CLI에는 시그널 처리가 없고, 중단 시 재개 기록도 쓰지 않습니다. F1은 Claude Code에서 deny 규칙이 일부를 막지만 정지로 기록되지는 않습니다.
- **F2**: T1의 나머지 검사(의존, 바인딩, plan 상태)와 T5의 검사(열린 ticket, history)도 F2로 보고합니다.
- **F3, G2**: 시나리오가 없습니다. 둘 다 역할의 판단이라 자동 시나리오의 범위 밖입니다.

## 공백 (0.1.0 안정화 목록)

`none (gap)` 12행입니다. 코드가 아무것도 잡지 못합니다. 이 문서는 고치지 않습니다.

- C6 (금지선): push·PR·merge·release·tag를 막지 않습니다. force push와 `--no-verify` push만 막습니다.
- A2: 정식 릴리스.
- A3: 되돌릴 수 없는 데이터 변경, 운영 서버·클러스터.
- A4: pre-release 루프 밖에서 로컬을 떠나는 것.
- B2: 기록된 결정 없이 설계 불변식이 바뀜.
- D2: 해결이 기록되지 않은 red check 두 번.
- D3: flaky 테스트 감지.
- E1: 80% 예산 경고.
- E2: 범위 예산 100%.
- E3: rc·세션 예산 100%.
- F1: 역할의 금지선 시도가 정지로 기록되지 않음 (T6).
- G1: 중단 처리와 재개 기록 (T6).

부분 공백(나머지는 검출기가 동작하는 행이며, 잡지 못하는 부분을 여기에도 적습니다):

- C2 (금지선): `AGENTS.md` 관리 블록의 손 편집.
- C4 (금지선): 고정 deny 목록 밖의 비밀 같은 이름(예: `.env.custom`) 읽기. 검증기는 스테이징된 경로만 보고, V18은 문자열 세 개만 단언합니다.
- C10 (금지선): diff가 intent와 plan 안에 머무는지 확인하는 자동 검사가 없습니다(T2에 나열됨). code-review 역할이 사람 손으로 합니다.
- C5 (금지선): `git commit -n` 등 `--no-verify`의 줄임·변형 형태. 정확히 일치하는 deny 패턴이 막지 못합니다.
- A1: 태그 삭제, 그리고 자손 커밋으로의 공개 태그 전진 이동.
- D4: `reins gate`는 빈 명령 출력을 경고 없이 보고서에 씁니다.
