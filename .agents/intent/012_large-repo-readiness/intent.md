---
id: "012"
slug: large-repo-readiness
version: "0.1.4"
status: draft
origin: user
approvals: []
supersedes: null
---
## 문제
reins를 이 저장소 밖의 큰 저장소(croffle, AI-GW, pipit-hub)에 붙이기에는 아직 막히는 곳이 있다(읽기 전용 분석 2026-10-26, `.loctx/ROADMAP.local.md` 0.1.4 후보).
- 릴리스 흐름이 reins 전용이다. deploy 역할이 `publish.yml`, npm 승인, `master`를 직접 가정한다. croffle은 데스크톱(changesets), 서버(Go 이미지), 패키지를 따로 릴리스한다.
- 게이트 탐색이 루트 `package.json`만 본다. croffle에서는 데스크톱 `build` 하나만 잡히고 typecheck, Go 테스트, 하위 패키지 스크립트가 빠진다.
- migrate가 `.ai/work`를 ticket으로 바꿀 때 id가 겹친다(croffle: `000-1` 네 개). intent 000이 없어 T1에서 멈출 것으로 보인다.
- 하네스가 없는 저장소는 install 대상인데, install은 `.claude/memory` 같은 기존 기억을 knowledge로 옮기지 않는다. migrate 쪽의 같은 경로는 도달할 수 없는 코드다.
- 비밀 파일 패턴에 `*.env`가 없다(AI-GW에 `langfuse.env`가 커밋되어 있음).
- 0.1.0 설치본을 update하면 `.agents/harness/CHANGELOG.md`가 남아 drift가 F2 STOP한다(지금은 설치하지 않는 파일). update가 더 이상 설치하지 않는 파일을 지워야 한다(0.1.3 update 테스트 2026-10-27).
- 작은 것: status와 update 출력이 하네스 버전만 보여 준다(`harness v0.1.2 → v0.1.2`, "package v0.1.2"). CLI 버전과 "already up to date"를 보여야 한다. ticket이 열린 intent의 다음 할 일이 비어 있다.

## 바라는 결과
- croffle을 graph 단계로 migrate해 실제로 쓸 수 있다. 사용자의 `migrate --dry-run` 결과를 범위 확정에 반영한다.
- 하네스가 없는 저장소(AI-GW 같은)는 install로 시작하고, 기존 기억 파일은 잃지 않는다.
- 릴리스 방식은 저장소 설정(`install.yaml` 등)으로 정하고, reins 자신의 npm staged 흐름은 그 설정의 한 값이 된다.

## 영향 범위
`cli/`(detect·install·migrate·secrets·status), deploy 역할과 reins-release 스킬, 스키마(install 설정), 설계서 §4·§5·§9 양판.

## 제약
- 기존 설치(이 저장소 포함)는 `update`로 그대로 옮겨 간다. 파일 형식은 추가만 한다.
- 대상 저장소는 읽기만 한다. 적용은 사용자가 직접 한다.

## 열린 질문
- (사용자) croffle에서 deploy 역할이 할 일: PR·merge까지만? 세 릴리스 워크플로 dispatch까지?
- (사용자) 게이트: 하위 디렉터리에서 찾은 명령을 제안만 할지, 자동으로 넣을지.
- (사용자) migrate가 커밋된 `.claude/commands`·스킬을 로컬 `_legacy`로 옮기는 것: 공개 저장소(pipit-bot)를 위해 커밋된 위치에 남기는 선택지가 필요한가?
- (사용자) AI-GW 적용은 0.1.4 범위에 넣는가(회사 허락).

## 질의서 기록
사용자: "하네스가 없으면 지금 하네스를 적용하고, 있으면 migration" · "2번을 기획하여 진행. migrate --dry-run은 내가 직접 해볼게"(2026-10-27). 위 열린 질문은 pm이 정리, 답을 기다림.

## 하지 않을 것
- loop·harness 단계 깎기, 벤더 생성물, .env 차단 훅(0.2)
- pipit-hub 허브 전체(멀티 레포 워크스페이스, 0.3+)
- 대상 저장소에 직접 쓰기
