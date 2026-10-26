---
id: "004"
slug: verifier-gaps
version: 0.1.1
status: released
origin: agent
approvals:
  - { role: user, at: 2026-10-26 }
supersedes: null
---
## 문제
0.1.0을 쓰고 검증하는 동안 검증기(`reins check`·`reins gate`)가 잡아야 할 것을 놓치거나, 멀쩡한 상황에서 죽는 경우가 드러났다(intent 001~003 진행, README 빠른 시작 검증, `docs/violations.md`의 부분 공백).
- pre-commit(T2)이 **스테이징된 내용이 아니라 작업 트리**를 본다 — 설치본을 빠뜨린 커밋도 통과했다(002-2).
- T3가 버스 응답의 **스키마를 검사하지 않는다** — `fixes: "none"`인 응답이 통과했다(003-2). evidence에 **절대 경로**를 쓰면 증거로 읽지 못한다(001-1).
- 게이트 출력이 **비어도** pass로 받아들인다(D4 부분 공백).
- AGENTS.md **관리 블록을 손으로 고쳐도** 드리프트로 안 잡힌다(설계 §5는 F2, C2 부분 공백).
- pre-push(A1)가 **태그 삭제**를 건너뛴다.
- **커밋이 하나도 없는 저장소**에서 `check`가 예외로 죽는다. 출력을 `| head`로 끊으면 **EPIPE** 예외가 난다.

## 바라는 결과
- 위 각각이 기대대로 멈추거나(정지 사유 id와 함께) 조용히 정상 동작한다.
- 고친 항목마다 `test/e2e/violations.test.ts`에 시나리오가 추가되고 `docs/violations.md`(양판)의 해당 행이 갱신된다 — "N/N stopped"의 N이 늘어난다.

## 영향 범위
`cli/src/commands/{check,stages,gate}.ts`, `cli/src/lib/{blocks,git}.ts` 등 검증기 코드, e2e 시나리오, `docs/violations*.md`, 필요하면 설계서 §3·§5(같은 커밋).

## 제약
- 기존 시나리오 18개는 계속 멈춰야 한다. 검출을 넓히면서 정상 흐름(이 레포의 훅·CI)을 막지 않는다.
- 0.1.x 범위 — 새 정지 조건(E·T6 계열)은 만들지 않는다(0.2).

## 열린 질문
—

## 질의서 기록
0.1.0 안정화 목록(로드맵 0.1.1)에서 검증기 관련 항목을 묶음. 사용자 지시 "0.1.1 intent 해 달라"(2026-10-26). 기본값:
- 태그 이동: 삭제는 A1 HOLD로 잡고, 앞으로 옮기는 것은 이번에는 범위 밖(태그 정책이 필요).
- 빈 게이트 출력: STOP이 아니라 WARN(D4) — 조용한 도구(`tsc --noEmit`)가 흔하다.

## 하지 않을 것
- 예산 정지 E1~E3, T6(G1·F1), A2~A4·B2·C6·D2·D3 같은 미검출 항목 (0.2)
- 태그를 앞으로 옮기는 것의 검출
