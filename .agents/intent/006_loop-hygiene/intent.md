---
id: "006"
slug: loop-hygiene
version: 0.1.1
status: approved
origin: agent
approvals:
  - { role: user, at: 2026-10-26 }
supersedes: null
---
## 문제
루프를 세 번 돌리며 드러난, 코드보다 규칙·안내 쪽의 문제들:
- 정지 사유 **id 충돌**: C1·C2가 레드라인(통과만 시키는 구현, 관리 블록 수정)과 정지 조건(전제 무너짐, plan 이탈) 양쪽에 같은 이름으로 있다. 기록·요약에서 뜻이 갈린다(qa-design 002 지적).
- `cli/test/harness.test.ts`가 이 머신의 `.loctx/bus/`를 읽어서, 로컬 작업 상태에 따라 테스트가 깨진다(두 번 실제로 깨짐).
- 버스 파일 값에 `: `가 있으면 YAML이 깨진다(pl이 두 번 겪음) — 템플릿·스킬에 인용 규칙이 없다.
- `reins-loop` 스킬은 "다른 벤더 역할은 그 CLI로"라고만 하고 호출 방법이 없다. 이번에 쓴 방법(`codex exec -m … -s read-only -o …`, `agy -p --model … --mode plan`, `cursor-agent -p --plan --model …`)이 기록돼 있지 않다.
- 코드 리뷰가 변경분이 아니라 저장소 전체를 뒤졌다. pl의 버스 요청이 "S-1..S-4에 비춰 검토"뿐이라 변경의 의도가 없었고, 리뷰어가 소스를 통째로(같은 파일을 두 번), 역할 파일 전부, 영문·한국어 문서를 다 읽고 게이트까지 다시 돌렸다 — Codex 리뷰 12번에 약 38만 토큰, GPT 한도 소진(2026-10-26).

## 바라는 결과
- 정지 사유 id가 하나의 뜻만 갖는다. 기존 기록(metrics·history)은 그대로 읽힌다.
- `pnpm check`가 로컬 `.loctx/` 상태와 무관하게 같은 결과를 낸다.
- 버스 템플릿·스킬에 값 인용 규칙이 있고, `bus` 파일이 깨지면 그 자리에서 F2로 알려 준다.
- `reins-loop` 스킬에 역할 → 벤더 CLI 호출 방법(읽기 전용 모드, 출력 파일, 토큰 위치)이 있다.
- **리뷰는 변경분만**: pl이 버스 요청에 변경마다 무엇을 왜 바꿨는지(`changes[].what`), 대응하는 S-n(`why`), 검증 증거 경로를 쓰고, 리뷰어에게는 역할의 금지선 + 그 요청 + 변경 파일의 diff만 프롬프트에 넣어 준다. 리뷰어는 저장소를 탐색하지 않고, 영문 문서만 보며, 게이트를 다시 돌리지 않는다. 수정 후 재검토는 수정 diff만.

## 영향 범위
`harness/policy/{stops,common-red-lines}.yaml`, 설계서 §2·§3(양판), `cli/src`의 사유 id 참조, `docs/violations*.md`, `cli/test/harness.test.ts`, `harness/templates/bus/*`, `skills/reins-loop/SKILL.md`, `harness/roles/code-review.md`(절차)·`pl.md`(요청 작성), 이 레포 update.

## 제약
- id를 바꾸면 하네스 버전 노트(`harness/CHANGELOG.md`)에 적고 `reins update`가 설치본을 옮긴다.
- 지난 커밋 메시지·history의 옛 id는 고치지 않는다(기록은 기록).

## 열린 질문
—

## 질의서 기록
0.1.0 안정화 목록에서 규칙·안내 항목을 묶음(2026-10-26). 기본값:
- 리뷰 범위 → 사용자 지시(2026-10-26): "리뷰어는 오로지 변경사항 코드를 리뷰만 해야돼. README는 영문만 읽어도 충분하고, 코드의 의도는 bus에 남기는 거 아니었어?" 승인된 intent에 추가.
- id 충돌 해결 → **정지 조건 쪽**을 바꾼다: 전제 그룹 C1·C2 → `P1`·`P2`(premise). 레드라인 C1~C10은 문서·커밋에 훨씬 많이 쓰여 그대로 둔다.
- 벤더 호출 방법은 스킬 본문이 아니라 스킬의 `references/` 파일로(스킬 500줄 제한).

## 하지 않을 것
- CLI가 벤더를 직접 부르는 디스패치 (0.2 — CLI는 모델을 부르지 않는다)
- 과거 기록의 id 일괄 치환
