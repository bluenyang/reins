---
id: "004"
slug: claude-plugin
version: 0.1.2
status: draft
origin: user
approvals: []
supersedes: null
---
## 문제
지금 reins를 쓰려면 사람이 터미널에서 `npx @bluenyang/reins install graph`를 먼저 쳐야 한다. 에이전트 안에서 시작할 길이 없다. Claude Code에는 플러그인 마켓플레이스(`/plugin marketplace add`)라는 표준 설치 경로가 있는데 reins는 그 형식(`.claude-plugin/`)을 갖추지 않았다. 설계 §9는 처음부터 "저장소 = 플러그인 + npm 패키지"로 정해 두었지만 1차에서 빠졌다.

## 바라는 결과
- Claude Code에서 `/plugin marketplace add bluenyang/reins` → `/plugin install reins@bluenyang`으로 설치된다.
- 플러그인을 켜면 `/reins:reins-setup` 하나로 시작할 수 있다. 이 스킬이 `npx @bluenyang/reins install`(또는 `migrate`)을 실행해 프로젝트에 하네스·스킬·생성물을 놓는다 — 그다음부터는 지금처럼 프로젝트에 설치된 `/reins-intent`·`/reins-loop`를 쓴다.
- 플러그인과 프로젝트에 같은 스킬이 두 벌 생기지 않는다(플러그인은 시작용 `reins-setup`만).
- 플러그인 버전과 실행되는 CLI 버전이 어긋나지 않는다.
- README(양판)와 설계서 §9가 설치 방법을 플러그인 기준으로 설명한다.

## 영향 범위
저장소 루트 `.claude-plugin/`(새), `skills/reins-setup`(플러그인에서 부를 때의 안내), 릴리스 절차(버전을 맞추는 지점), README 양판, 설계서 §9 양판. CLI 기능은 바꾸지 않는다.

## 제약
- 플러그인 루트에 `bin/`을 두지 않는다(설계 §9; claude.ai·Cowork가 설치를 거부).
- 플러그인 의존성 없음(`dependencies` 비움) — humanize-korean 등은 감지·추천만.
- 플러그인 검증은 `claude plugin validate`로 하고, CI에도 넣을 수 있으면 넣는다.
- 0.1.1 안정화와 섞지 않는다(버전이 다름).

## 열린 질문
—

## 질의서 기록
사용자 지시 "0.1.2에서 agent plugin 방식도 추가하자"(2026-10-26), "0.1.2 intent 작성해줘". 질문 없이 기본값으로 썼고 승인 때 바꿀 수 있다:
- 대상 에이전트 → Claude Code만. Codex·Antigravity·Cursor는 플러그인 경로 대신 지금처럼 `npx` 설치 후 `.agents/skills/`를 읽는다(벤더 생성물은 0.2).
- 마켓플레이스 이름 → `bluenyang` (`reins@bluenyang`). 플러그인 이름 → `reins`.
- 플러그인에 넣는 것 → `reins-setup` 스킬 하나. 훅·에이전트·MCP는 넣지 않는다(훅은 install이 프로젝트에 제안).
- 설정(userConfig) → 문서 언어(`language`, 기본 ko)와 설치 방식(`default_mode`, 기본 manual) 두 개. 설계 §9에 적힌 그대로.
- CLI 버전 → 플러그인 버전과 같은 `@bluenyang/reins@<version>`을 부른다.

## 하지 않을 것
- Codex·Gemini·Cursor용 플러그인·확장 (0.2 이후)
- Anthropic 공식 디렉터리 등록 신청
- 플러그인 안에서 CLI 기능을 다시 구현하는 것(플러그인은 입구일 뿐)
- loop·harness 단계 설치 (0.2)
