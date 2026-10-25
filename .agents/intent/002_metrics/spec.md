---
intent: "002"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-25, kind: first-review }
  - { role: pm, at: 2026-10-25 }
summary_for_user: |
  `reins check`·`reins gate`가 돌 때마다 `.loctx/reports/metrics.jsonl`에 한 줄씩 남는다(단계·ticket·판정·사유 id·정지 종류).
  역할 실행 뒤에는 `reins metrics record --role … --tokens …`로 토큰을 남기고, `reins metrics`가 intent·ticket·역할·벤더별 토큰과 항목당 knowledge 정지 수를 요약한다.
  `reins-loop` 스킬이 기록 시점을 안내하고, 이 intent의 실행이 첫 수치가 된다.
  예산 집행(E1~E3)과 벤더 출력 자동 수집은 0.2.
---
## 요구 해석
- S-1 기록 형식: JSON 한 줄, 공통 키 `schema: "reins/metric@1"`, `ts`(로컬 ISO 초 단위), `kind`. ← "한 줄씩 자동으로 쌓인다"
  - `kind: check` — `stage`(없으면 `all`/`drift`), `ticket`, `intent`, `verdict`, `reasons`(blocking 사유 id 배열, WARN 제외), `warns`(WARN 사유 id), `stops: {intent: n, knowledge: n, redline: n}`. 분류 규칙: 사유 id를 **stops.yaml에서 먼저** 찾아 그 `kind`(intent|knowledge)로 센다 — 그래서 stops.yaml에도 있는 C1·C2(전제 무너짐·plan 이탈)는 knowledge다. stops.yaml에 없고 common-red-lines.yaml에 있으면(C3~C10) `redline`. 둘 다 없으면 세지 않고 `reasons`에만 남는다. (C1·C2가 두 목록에 같은 id로 있는 것은 설계의 id 충돌 — 0.1.0 안정화 목록에 올린다.)
  - `kind: gate` — `ticket`, `gate`, `exit`, `report`.
  - `kind: usage` — `role`, `vendor`, `model`, `tokens`(정수 ≥ 0), 선택 `ticket`·`intent`·`note`.
  - `intent` 도출: `ticket`이 있는 모든 기록(check·gate·usage)은 ticket id 앞 3자리를 `intent`로 채운다.
- S-2 `reins check …`(모든 stage와 `--drift`)와 `reins gate …`의 CLI 실행이 끝날 때 S-1 한 줄을 덧붙인다. `.loctx/`가 없으면 건너뛰고, 쓰기 실패는 무시한다 — 종료 코드와 출력은 기록과 무관하다. 함수(`runCheck`·`runGates`)는 쓰지 않는다(테스트·status가 부작용 없이 쓰도록). ← "자동으로 쌓인다", 제약
- S-3 `reins metrics record --role <r> --tokens <n> [--ticket <id> | --intent <NNN>] [--vendor <v>] [--model <m>] [--note <t>]`. vendor·model을 빼면 bindings.yaml의 그 역할 값. `--ticket`과 `--intent`를 같이 주면 ticket 앞 3자리와 같아야 한다. 모르는 역할, 음수·정수 아닌·숫자 아닌 토큰, 어긋난 ticket·intent는 거부(exit 2)하고 아무것도 쓰지 않는다. `--tokens 0`은 허용. ← "역할을 한 번 돌릴 때마다 쓴 토큰을 한 줄로"
- S-4 `reins metrics [--intent <NNN>] [--json]` 요약: 종류별 기록 수(check·gate·usage)와 깨진 줄 수; 토큰 합계 역할별·벤더별; **ticket별**(토큰, check 횟수, knowledge 정지 수); intent별(토큰, check 횟수, blocking 정지 intent/knowledge/redline, ticket 수, ticket당 knowledge 정지 수 — ticket이 0개면 텍스트 `—`, JSON `null`). ticket 없는 기록은 intent에만 더한다. 파일이 없으면 "no metrics yet". ← "intent·ticket·역할·벤더별로 요약", "항목당 knowledge 정지 수"
- S-5 `skills/reins-loop/SKILL.md`: 역할을 돌린 뒤 `reins metrics record`로 토큰을 남기라는 한 줄(벤더별로 토큰이 나오는 곳: Claude 서브에이전트 사용량, `codex exec`의 "tokens used", agy·cursor-agent의 json 출력). ← "스킬이 안내"
- S-6 설계서 §3(지표)·§9(CLI)에 metrics를 적는다(양판, 같은 커밋). ← R45
- S-7 이 intent의 역할 실행 토큰을 기록해 `reins metrics --intent 002`가 0이 아닌 토큰을 보인다. ← "첫 수치"

## 설계
- `cli/src/lib/metrics.ts`: 타입, `appendMetric(root, rec)`(.loctx 없으면 no-op, try/catch), `readMetrics(root)` → {records, broken}, `summarize(records, filter)`.
- `cli/src/commands/metrics.ts`: record·summary. CLI `reins.ts`: check·gate 액션 끝에서 appendMetric, `metrics` 명령.
- 정지 종류는 `harness.ts`의 `stops()`에서 읽는다(하네스 없으면 전부 `unknown`).
- 불변 조건 충돌: 없음 — "CLI는 모델을 부르지 않는다"(토큰은 호출한 쪽이 기록), "status는 쓰지 않는다"(기록은 check·gate CLI만).

## 우려 표시
- pre-commit 훅마다 한 줄씩 늘어 파일이 커진다 — 0.1에서는 그대로(로컬, 줄 단위). 회전은 0.2 예산 작업 때.
- ts는 로컬 시각(history와 같은 기준).

## 검증 기준
- C-1 (S-1·S-2) 설치된 임시 저장소에서 `check --stage ticket-start`(HOLD), `check --drift`(ok), `gate` 실행 → 세 줄, 각 키와 값이 기대대로(B3 → stops.intent, F2 → knowledge, C4 → redline, C2 → knowledge). `.loctx/` 없는 저장소 → 파일 없음, 종료 코드·출력 동일.
- C-2 (S-2) metrics 파일을 쓸 수 없는 경우(디렉터리로 막음)에도 check의 종료 코드·출력이 같다.
- C-3 (S-3) record: 기본 vendor·model이 bindings에서, intent가 ticket에서 채워짐; `--tokens 0` 통과; 모르는 역할·`-1`·`1.5`·`abc`·어긋난 `--ticket 002-1 --intent 003` → exit 2, 파일에 줄 추가 없음.
- C-4 (S-4) check·gate·usage 혼합 + 깨진 줄 1개 + ticket 없는 `--intent 003` usage → 종류별 수, 역할·벤더·ticket·intent 합계, ticket당 knowledge 정지 수(ticket 0개 intent는 `—`/`null`)가 손계산과 같음, `broken: 1`; `--intent` 필터; `--json`이 같은 객체; 파일 없음 → "no metrics yet".
- C-5 (S-5·S-6) 스킬과 설계서 양판에 문구가 있고 drift ok(update 후).
- C-6 (S-7) 이 레포 `reins metrics --intent 002` 출력에 토큰 > 0.
- `pnpm check` 통과.

## 범위 밖
E1~E3 집행, 벤더 출력 자동 수집, 비용 환산, 파일 회전.
