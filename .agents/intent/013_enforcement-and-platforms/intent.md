---
id: "013"
slug: enforcement-and-platforms
version: "0.1.5"
status: approved
origin: user
approvals:
  - { role: user, at: 2026-10-27 }
supersedes: null
---
## 문제
0.1.4까지 써 보고 사용자가 짚은 점(2026-10-27, reins-roadmap):
- README는 통제를 약속하지만 역할 권한·작업 범위·예산 등은 아직 에이전트의 "협조"에 기댄다. 자동으로 막는 것과 지침으로만 요구하는 것이 구분되어 있지 않다.
- 역할별 모델 할당(`bindings.yaml`)은 커밋되는데, install한 머신에서 감지한 벤더까지 함께 커밋된다. 다른 벤더 CLI가 없는 사용자의 fallback은 스킬 지침에만 있다.
- rc도 결국 기본 브랜치로 merge되는데 문서가 따라오지 않는다. 0.1.4 rc.2 시점에 로드맵은 0.1.4를 "계획"으로, README 상태 줄은 "0.1.0"으로 적고 있었다.
- 패키지는 Node 20 이상을 선언하지만 CI는 Ubuntu·Node 24만 검증한다. Windows·Node 20은 테스트되지 않는다.
- T5는 rc dispatch 줄만 내고 stable 줄은 내지 않는다(0.1.4 stable은 deploy.md를 보고 손으로 구성).

## 바라는 결과
- 규칙마다 "어떻게 지켜지는가"(스크립트·훅이 막음 / 전이 지점에서 검사 / 역할·스킬에 적혀만 있음)를 적은 표가 README 양판과 설계서에 있다. 권고에 머문 것은 0.2의 입력이 된다.
- 모델 할당이 두 층이 된다: 커밋되는 `bindings.yaml`(팀 기본값)과 gitignore되는 `.loctx/bindings.local.yaml`(사용자 덮어쓰기·감지 결과). 역할이 실제로 쓸 모델은 CLI가 정해 보여 준다.
- 릴리스 PR(rc·stable)에서 로드맵 상태, CHANGELOG 절, README 상태 줄이 함께 갱신되고, 이전 상태가 남아 있으면 T5가 경고한다.
- T5가 stable 줄도 낸다(사용자 지시가 있을 때만 실행).
- CI가 Node 20·22·24 × Ubuntu·Windows·macOS에서 `pnpm check`를 돌리고, 거기서 실패하는 것은 같은 버전에서 고친다.

## 영향 범위
README 양판, 설계서 양판(§2 레드라인·§3 정지·§5 바인딩·§9), `cli/`(bindings 해석, status, stages T5), deploy 역할과 reins-release 스킬, `.github/workflows/ci.yml`, 테스트(경로·셸 차이).

## 제약
- 기존 설치는 `update`로 그대로 옮겨 간다. 커밋된 `bindings.yaml`의 형식은 추가만 한다.
- 이번 버전은 권고를 강제로 바꾸지 않는다(그건 0.2). 표는 지금 상태를 정직하게 적는다.

## 열린 질문
—

## 질의서 기록
사용자(2026-10-27, reins-roadmap): 설명과 강제력의 차이 · rc 문서 업데이트 · CI가 Ubuntu-Node24만 검증. 바인딩 두 층: "그렇게 넣자". pm 기본값: 표는 README와 설계서 둘 다, macOS도 CI에 포함, Windows에서 드러나는 실패는 이 버전에서 고침(양이 많으면 ticket을 나눔), T5 stable 줄 추가.

## 하지 않을 것
- 권고 규칙을 실제로 막는 훅·예산 정지·역할 권한 강제(0.2)
- 버전별 intent로 migrate 나누기(0.2)
- 벤더 생성물(Codex·Gemini·Cursor, 0.2)
