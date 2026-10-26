---
id: 2026-10-26_unpinned-cli-in-skills
kind: decision
status: active
supersedes: null
topics: [skills, version]
decisions: [unpinned-cli-in-skills]
symptoms: [unpinned-cli-in-skills]
applies_to: all
source: ".loctx/history/2026-10-26-1900_retro-0.1.0-0.1.3.md"
approved: { by: user, at: 2026-10-26 }
---
## 결정
프로젝트에 설치된 스킬은 CLI를 `npx @bluenyang/reins@<.agents/harness/install.yaml의 version>`으로 부른다(플러그인 setup은 고정 버전).
## 이유
버전 없이 부르자 npm latest(0.1.1)가 설치된 하네스(0.1.2)와 어긋나 drift F2가 났다(008 C-3 수동 시나리오).
## 적용
모든 단계 스킬과 그 스킬을 쓰는 에이전트.
## 바뀌면
CLI가 설치된 버전을 스스로 찾게 되면(예: 로컬 바이너리) 이 규칙을 그 방식으로 바꾼다.
