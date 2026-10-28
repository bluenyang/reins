---
id: "014"
slug: tui-config
version: "0.2.0"
status: approved
origin: user
approvals:
  - { role: user, at: 2026-10-28 }
supersedes: null
---
## 문제
설정 명령이 플래그와 한 줄 질문뿐이라 무엇을 고르는지 잘 보이지 않는다. install은 `vendors you can use (claude,openai,google,cursor) — detected: …` 같은 질문을 차례로 묻고, 모델 지정은 `configure bindings --set role=model`·`--local --set`을 외워 써야 한다. 역할을 끄는 방법도 없다(12개 역할이 항상 다 있다).

## 바라는 결과
`npx @bluenyang/reins`나 전역 설치한 `reins`로 다음을 TUI 화면에서 한다.
- `reins config` → 설정 메인 화면. 첫 항목 "models and roles configuration".
- models and roles 화면: 범위 선택 **local(나만, `.loctx/bindings.local.yaml`, 커밋 안 됨) / global(팀, `.agents/harness/bindings.yaml`, 커밋됨)**, 역할마다 ON/OFF(**pm·implementer·verify-tool은 ON 고정**), 역할을 고르면 다음 화면.
- 역할 화면: 이 PC에 설치된 벤더 중 하나를 고르면 그 벤더의 모델 목록을 가져와 보여 주고, 고르면 models and roles 화면으로 돌아간다. 목록을 가져올 수 없는 벤더는 알려진 모델 목록과 직접 입력.
- 상단 `< Configuration`으로 메인 설정 화면, `exit`로 종료.
- install과 update도 같은 TUI로: install의 질문(벤더·언어·게이트·하위 게이트)과 update의 변경 확인.
- 역할을 끄면 그 역할의 일은 pm이나 상위 역할이 맡는다.

## 영향 범위
`cli/`(config·install·update 명령, TUI 라이브러리 의존성 추가, 역할 ON/OFF 저장과 생성물), bindings 형식(역할 on/off, 추가만), 역할·스킬 문서(꺼진 역할의 일을 누가 맡는지), 설계서 양판 §5·§9, README 양판.

## 제약
- 터미널이 아니거나(CI·파이프) 플래그를 주면 지금처럼 비대화형으로 동작한다. 기존 플래그와 `configure` 명령은 그대로 쓸 수 있다(`config`는 별칭 또는 새 진입점).
- Windows·macOS·Linux 터미널 모두에서 동작한다(CI 매트릭스).
- 배포되는 것은 TypeScript, 런타임 의존성은 최소로(R65). 파일 형식은 추가만 한다.
- 모델 목록은 벤더 CLI가 제공할 때만 실제로 가져온다(지금은 Antigravity·Cursor의 `models`). Claude·Codex는 알려진 목록과 직접 입력.

## 열린 질문
—

## 질의서 기록
사용자(2026-10-28): "명령어 실행 시 TUI 형태였으면 좋겠다. install, update, config 모델 지정 등에서 TUI를 이용해 잘 보이게." 모델 변경 예시(위 바라는 결과 화면 흐름) 제시.
질의 답(2026-10-28): local=나만·global=팀(0.1.5 두 층 그대로) · ON 고정 역할 pm·implementer·verify-tool · 0.2.0 첫 항목 · install·update·config 세 개 모두.

## 하지 않을 것
- 역할을 꺼서 줄어든 loop·harness 단계의 확정(0.2의 단계 깎기에서 수치로 정함)
- 사용자 홈의 전역 설정(`~/.config/reins`) 층
- 벤더를 CLI가 직접 호출하는 기능(0.2 별도 항목)
