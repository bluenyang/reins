---
id: "005"
slug: bindings-and-permissions
version: 0.1.1
status: draft
origin: agent
approvals: []
supersedes: null
---
## 문제
- 새 저장소에 설치하면 qa 역할의 기본 바인딩이 `gemini-3.1-pro`·`gemini-3.8-flash`인데, 실제 agy에는 이 ID가 없다(`gemini-4-argon-*`, `gemini-3.8-flash-*`처럼 effort 접미사가 붙는다). 설치 직후 바인딩이 틀린 상태로 시작한다.
- 모델 ID를 실제 CLI와 대조하지 않는다 — 전부 `unverified`로만 남는다(설계 §5는 "바인딩 때 CLI로 한 번 확인").
- 벤더 추론이 두 곳에 따로 있다: `configure`는 `cursor-` 모델을 Cursor로 아는데 `install`은 모른다.
- 생성되는 `settings.json`의 거부 규칙에 구멍이 있다: `.env.*`를 고정 목록으로 좁혀 `.env.custom` 같은 이름은 읽을 수 있고(C4), `git commit -n`(= `--no-verify`)은 막지 않는다(C5).

## 바라는 결과
- 새로 설치하면 감지된 벤더 CLI가 실제로 제공하는 모델 ID로 바인딩된다.
- 바인딩할 때(install·configure) 모델 목록을 내주는 CLI(agy `models`, cursor-agent `models`)로 ID를 확인하고, 확인되면 `unverified`를 떼고 없으면 경고한다. 목록이 없는 CLI는 지금처럼 `unverified`.
- 벤더 추론은 한 함수에서.
- 거부 규칙이 `.env.*` 전체(`*.example*` 허용)와 `git commit -n`을 막는다.

## 영향 범위
`harness/roles/*.md`의 default·fallback 바인딩, `cli/src/commands/{install,configure}.ts`, `cli/src/lib/{detect,generate}.ts`, 이 레포 재생성(update), e2e 시나리오(V18 확장), `docs/violations*.md` C4·C5 행.

## 제약
- **CLI는 모델을 부르지 않는다**(설계 §0·§9) — 확인은 목록 명령만. 시험 프롬프트를 보내지 않는다.
- 사용자가 `configure`로 정한 바인딩은 덮지 않는다(프로젝트 소유).
- 거부 규칙을 넓혀도 `*.example*`은 읽을 수 있어야 한다.

## 열린 질문
—

## 질의서 기록
0.1.0 안정화 목록에서 바인딩·권한 항목을 묶음(2026-10-26). 기본값:
- qa-design 기본 → `gemini-4-argon-high`, qa-run 기본 → `gemini-3.8-flash-medium`(이 레포에서 쓰는 값). lookup 기본은 Haiku 유지(Cursor는 이 레포의 선택).
- 목록 확인 실패(CLI 오류·네트워크)는 설치를 막지 않고 경고만.

## 하지 않을 것
- 벤더별 생성물(`.codex/` 등) — 0.2
- 모델 가격·비용 비교
