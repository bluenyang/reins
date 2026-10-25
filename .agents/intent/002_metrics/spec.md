---
intent: "002"
status: draft
approvals: []
summary_for_user: |
  `reins check`·`reins gate`가 돌 때마다 `.loctx/reports/metrics.jsonl`에 한 줄씩 남는다(단계·ticket·판정·사유 id·정지 종류).
  역할 실행 뒤에는 `reins metrics record --role … --tokens …`로 토큰을 남기고, `reins metrics`가 intent·ticket·역할·벤더별 토큰과 항목당 knowledge 정지 수를 요약한다.
  `reins-loop` 스킬이 기록 시점을 안내하고, 이 intent의 실행이 첫 수치가 된다.
  예산 집행(E1~E3)과 벤더 출력 자동 수집은 0.2.
---
## 요구 해석
- S-1 기록 형식: JSON 한 줄, 공통 키 `schema: "reins/metric@1"`, `ts`(로컬 ISO 초 단위), `kind`. ← "한 줄씩 자동으로 쌓인다"
  - `kind: check` — `stage`(없으면 `all`/`drift`), `ticket`, `intent`(ticket id 앞 3자리), `verdict`, `reasons`(blocking 사유 id 배열, WARN 제외), `warns`(WARN 사유 id), `stops: {intent: n, knowledge: n}`(blocking 사유를 stops.yaml의 kind로 센 것; C·F처럼 stops.yaml에 없는 공통 레드라인 C1~C10은 `redline`으로 따로 센다).
  - `kind: gate` — `ticket`, `gate`, `exit`, `report`.
  - `kind: usage` — `role`, `vendor`, `model`, `tokens`(정수 ≥ 0), 선택 `ticket`·`intent`·`note`.
- S-2 `reins check …`(모든 stage와 `--drift`)와 `reins gate …`의 CLI 실행이 끝날 때 S-1 한 줄을 덧붙인다. `.loctx/`가 없으면 건너뛰고, 쓰기 실패는 무시한다 — 종료 코드와 출력은 기록과 무관하다. 함수(`runCheck`·`runGates`)는 쓰지 않는다(테스트·status가 부작용 없이 쓰도록). ← "자동으로 쌓인다", 제약
- S-3 `reins metrics record --role <r> --tokens <n> [--ticket <id> | --intent <NNN>] [--vendor <v>] [--model <m>] [--note <t>]`. vendor·model을 빼면 bindings.yaml의 그 역할 값. 모르는 역할, 음수·정수 아닌 토큰은 거부(exit 2). ← "역할을 한 번 돌릴 때마다 쓴 토큰을 한 줄로"
- S-4 `reins metrics [--intent <NNN>] [--json]` 요약: 기록 수; 토큰 합계 역할별·벤더별; intent별(토큰, check 횟수, blocking 정지 intent/knowledge/redline 수, 그 intent의 ticket 수, **ticket당 knowledge 정지 수**); 파일이 없으면 "no metrics yet". 깨진 줄은 건너뛰고 개수를 보고. ← "요약해 볼 수 있다"
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
- C-1 (S-1·S-2) 설치된 임시 저장소에서 `check --stage ticket-start`(HOLD), `check --drift`(ok), `gate` 실행 → 세 줄, 각 키와 값이 기대대로(B3 → stops.intent, F2 → knowledge). `.loctx/` 없는 저장소 → 파일 없음, 종료 코드 동일.
- C-2 (S-2) metrics 파일을 쓸 수 없는 경우(디렉터리로 막음)에도 check의 종료 코드·출력이 같다.
- C-3 (S-3) record: 기본 vendor·model이 bindings에서 채워짐; 모르는 역할·`--tokens -1`·`--tokens 1.5` → exit 2.
- C-4 (S-4) 혼합 기록 + 깨진 줄 1개 → 요약 수치가 손계산과 같음, `broken: 1`; `--intent` 필터; `--json`이 같은 객체.
- C-5 (S-5·S-6) 스킬과 설계서 양판에 문구가 있고 drift ok(update 후).
- C-6 (S-7) 이 레포 `reins metrics --intent 002` 출력에 토큰 > 0.
- `pnpm check` 통과.

## 범위 밖
E1~E3 집행, 벤더 출력 자동 수집, 비용 환산, 파일 회전.
