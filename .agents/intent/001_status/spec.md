---
intent: "001"
status: draft
approvals: []
summary_for_user: |
  `reins status`가 하네스(버전·드리프트), intent별 진행 단계와 사람이 할 일, 열린 ticket과 다음 check, 남은 버스 파일, 마지막 history를 한 화면에 보여준다.
  "사람이 할 일"은 T1과 같은 코드로 판단해서, status와 check가 다른 말을 하지 않는다.
  읽기 전용이고 종료 코드는 0이다. `--json`도 같은 내용.
  끝나면 AGENTS.md의 임시 규칙(4_implementation.md + 최신 history)을 `reins status`로 바꾼다.
---
## 요구 해석
- S-1 하네스 줄: tier, 설치 버전과 패키지 버전, `check --drift` 결과 한 줄. ← "하네스 버전과 드리프트가 전부 따로 있다"
- S-2 intent 줄: id·slug·version, intent/spec/plan 각각의 status, ticket 수(열린 것/계획된 것). ← "intent·spec·plan 상태"
- S-3 intent마다 다음 할 일: 첫 번째로 막히는 지점을 역할과 함께 표시(예: "user: approve the intent", "planner: write spec.md"). 판단은 T1의 승인 사슬을 그대로 쓴다. ← "루프가 실제로 멈추는 규칙(T1)과 같은 판단"
- S-4 ticket 줄: id·status·role·asks 수, 다음 check(`todo` → ticket-start, `doing` → verdict, `blocked` → asks). ← "ticket마다 다음에 돌릴 check"
- S-5 남은 버스 파일 수, 마지막 history 파일 이름. ← "버스에 남은 인계 파일, 마지막 history"
- S-6 `--json`은 같은 데이터. ← "사람이 읽는 출력과 `--json`"
- S-7 파일을 쓰지 않는다, 종료 코드 0, git 레포 밖이면 2. ← 제약
- S-8 AGENTS.md "Until `reins status` … ship" 항목을 status 기준으로 고친다(recall 부분은 남김). ← "임시 규칙을 걷어낸다"

## 설계
- `cli/src/commands/status.ts`: `collectStatus(root)` → 데이터, `formatStatus(data)` → 텍스트. CLI는 `reins.ts`의 `status` 자리(지금은 not implemented)를 바꾼다.
- 재사용: `lib/work.ts`(intent·ticket·bus·history 읽기), `stages.ts`의 승인 사슬을 export해서 S-3에 쓴다, `driftFormat/Convention/Match` + `driftGenerated`로 S-1.
- 불변 조건(AGENTS.md·설계 §0) 충돌: 없음 — "CLI는 모델을 부르지 않는다", "역할은 판단, 스크립트는 강제" 둘 다 지킨다(status는 보여줄 뿐).

## 우려 표시
- 드리프트 검사는 하네스 전체를 읽어 느릴 수 있다 — 이 레포에서 1초 안이면 그대로, 넘으면 `--no-drift` 추가.
- intent가 많아지면 출력이 길어진다 — `superseded`는 숨기고 개수만.

## 검증 기준
- 임시 프로젝트 테스트: intent 없음 / draft intent(→ user 할 일) / 승인된 사슬 + 열린 ticket(→ ticket-start) 세 경우가 기대 출력과 같다.
- S-3의 판단이 같은 입력에서 `check --stage ticket-start`의 HOLD/STOP 사유와 일치한다(같은 함수).
- 이 레포에서 `reins status`가 intent 001과 그 ticket을 보여준다.
- `pnpm check` 통과, `reins check --drift` ok.

## 범위 밖
`reins recall`, 예산 표시, 상태 변경, 원격 상태.
