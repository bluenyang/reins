---
intent: "001"
status: accepted
approvals:
  - { role: qa-design, at: 2026-10-25, kind: first-review }
  - { role: pm, at: 2026-10-25 }
  - { role: user, at: 2026-10-25, kind: summary }
summary_for_user: |
  `reins status`가 하네스(버전·드리프트), intent별 진행 단계와 다음 할 일(누가 무엇을), 열린 ticket과 다음 check, 남은 버스 파일, 마지막 history를 한 화면에 보여준다.
  todo ticket은 T1(`check --stage ticket-start`)을 실제로 돌린 결과를 그대로 보여줘서, status와 check가 다른 말을 하지 않는다.
  읽기 전용이고 종료 코드는 0이다(git 레포 밖이면 2). `--json`도 같은 내용.
  끝나면 AGENTS.md의 임시 규칙에서 status 부분을 `reins status`로 바꾼다.
---
## 요구 해석
- S-1 하네스 줄: tier, 설치 버전(install.yaml)과 패키지 버전, 드리프트 결과(`ok` 또는 사유 id 목록 — `check --drift`와 같은 함수). 하네스가 없으면 `not installed — run reins install` 한 줄. ← "하네스 버전과 드리프트가 전부 따로 있다"
- S-2 intent 줄: id·slug·version, intent/spec/plan 각각의 status(파일이 없으면 `—`), ticket 수 = 열린 것 / plan.md `tickets:`에 있는 것. `superseded` intent는 줄을 숨기고 개수만 따로. ← "intent·spec·plan 상태"
- S-3 intent마다 다음 할 일 한 개(역할: 행동). 첫 번째로 해당하는 행을 쓴다:

  | 상태 | 다음 할 일 |
  |---|---|
  | intent `draft` | user: approve the intent |
  | intent `approved`, spec 없음 | planner: write spec.md |
  | spec `draft` | pm + qa-design: review the spec |
  | spec `reviewed` | user: read summary_for_user (veto or accept) |
  | spec `rejected` | planner: revise spec.md |
  | spec `accepted`, plan 없음 | pl: write plan.md |
  | plan `draft` | qa-design: review the plan |
  | plan `reviewed`/`active`, 열린 ticket 0, history에 없는 계획 ticket 있음 | pl: create tickets |
  | 계획 ticket 전부 닫힘·history 있음 | pm: close the rc (`reins check --stage rc-close --release <version>`) |

  허용 status — intent: draft·approved·superseded / spec: draft·reviewed·accepted·rejected / plan: draft·reviewed·active·done (스키마와 같음). ← "사람이 할 일을 보여준다"
- S-4 ticket 줄: id·status·role·asks 수, 다음 할 일:
  `todo` → T1을 실제로 실행한 판정(`ticketStart`, `check --stage ticket-start`와 같은 함수)과 사유 id. CONTINUE면 "implementer: start".
  `doing` → `reins check --stage verdict --ticket <id>`.
  `blocked` → asks 개수와 각 질문 원문.
  `done` → "write history, delete the ticket".
  frontmatter가 깨졌거나 status가 그 밖이면 `invalid (F2)`.
  intent 폴더가 없는 ticket은 `orphan` 표시. 예외로 멈추지 않는다. ← "ticket마다 다음에 돌릴 check"
- S-5 남은 버스 파일 수(`.loctx/bus/*.yaml`), 마지막 history = 파일 이름 정렬의 마지막(이름이 시각으로 시작). ← "버스에 남은 인계 파일, 마지막 history"
- S-6 `--json`은 텍스트와 같은 데이터(같은 객체에서 둘 다 만든다). ← "사람이 읽는 출력과 `--json`"
- S-7 파일을 쓰지 않는다(`.loctx/` 포함). 종료 코드 0, git 레포 밖이면 2. ← 제약
- S-8 AGENTS.md Conventions의 "Until `reins status` and `reins recall` ship" 항목에서 status 부분을 `reins status`로 바꾸고 recall 부분(grep 방법)은 남긴다. ← "임시 규칙을 걷어낸다"

## 설계
- `cli/src/commands/status.ts`: `collectStatus(root)` → 데이터, `formatStatus(data)` → 텍스트. CLI는 `reins.ts`의 `status` 자리(지금은 not implemented)를 바꾼다.
- 재사용: `lib/work.ts`(읽기), `stages.ts`의 `ticketStart`(S-4 todo), 드리프트 네 층 함수(S-1). S-3 표는 status.ts 안의 순수 함수 하나.
- 불변 조건(AGENTS.md·설계 §0) 충돌: 없음 — "CLI는 모델을 부르지 않는다", "역할은 판단, 스크립트는 강제" 둘 다 지킨다(status는 보여줄 뿐).

## 우려 표시
- 드리프트 검사 시간: 이 레포에서 0.24s(2026-10-25 실측) → `--no-drift`는 만들지 않는다.

## 검증 기준
- C-1 (S-1) 하네스 없음 → `not installed` 줄, exit 0. 설치됨 → tier·두 버전·`drift: ok`. 관리 블록 손편집 → 드리프트에 사유 id, exit 여전히 0.
- C-2 (S-2) superseded 하나 + 활성 하나 → 줄 하나, superseded 개수 1. ticket 수 = 열린/계획.
- C-3 (S-3) 표의 각 행에 해당하는 상태 하나씩 → 기대 문구.
- C-4 (S-4) 열린 asks가 있는 todo ticket → status와 `check --stage ticket-start`가 같은 B1 HOLD. doing → verdict 명령, blocked(asks 2) → 2와 질문, intent 없는 ticket → orphan, 깨진 frontmatter → invalid, 예외 없음.
- C-5 (S-5) 응답 없는 request 1개 + history 3개 → bus 1, 이름순 마지막 history.
- C-6 (S-6) `--json`과 텍스트가 같은 객체에서 나온다(필드 대조).
- C-7 (S-7) 실행 전후 `.loctx/` 포함 트리 해시가 같다. 레포 밖 exit 2.
- C-8 (S-8) AGENTS.md에서 status 임시 규칙이 사라지고 recall grep 문장은 남는다. 이 레포에서 `reins status`가 intent 001과 ticket을 보여준다.
- `pnpm check` 통과, `reins check --drift` ok.

## 범위 밖
`reins recall`, 예산 표시, 상태 변경, 원격 상태.
