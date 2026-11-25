---
id: 2026-11-25_apply-to-real-clones-before-rc
kind: decision
status: active
supersedes: null
topics: [release, verification, gates, hooks]
decisions: [apply-to-real-clones-before-rc]
symptoms: ["fixture는 통과했는데 실제 프로젝트에서 감지·제안이 틀림", "rc를 실제 프로젝트에 적용해 보지 않고 냄"]
applies_to: all
source: ".agents/audit/0.3.3.md (회고 H-9, husky); .agents/intent/024_gates-and-retro-fixes/ (문제: croffle·allot·pipit 실측, A-20 allot lefthook); .agents/audit/0.3.4.md (2차 감사 회고 2); .loctx/history/0.3.4.md"
approved: { by: user, at: 2026-11-25, words: "K-1. 수용" }
---
## 결정
제3자 파일(훅 도구 설정, CI 워크플로, `package.json`·lockfile·워크스페이스 파일, Makefile 등)을 읽어 감지하거나 제안하는 변경은 fixture 테스트만으로 rc를 내지 않는다. 로컬 빌드를 기준 프로젝트의 복제본(원본은 건드리지 않음)에 적용하고(`install`·`update`·`migrate`, `config gates --refresh`), 로그를 `.loctx/reports/<version>/apply/`에 남긴 뒤 rc를 낸다.
## 이유
세 번 반복됐다. 0.3.3에서 husky에 이미 게이트 줄이 있는데 다시 제안했고(H-9), 0.3.4는 실제 프로젝트에서 refresh가 멀쩡한 게이트를 gone이라 해서 시작됐으며, 0.3.4-rc.1을 복제본에 적용하자 allot의 lefthook(`jobs:` 형식)에 줄을 다시 제안했다(A-20, rc.2). fixture는 알려진 모양만 담고 있어 세 번 모두 실제 파일에서만 드러났고, 마지막 건은 사용자가 "어디 테스트 할만한 폴더에다가 적용 테스트 안됨?"이라고 물어서야 잡혔다.
## 적용
`test` 단계의 V-n과 rc 직전(R-1 전). 기준 프로젝트 목록은 이 저장소 AGENTS.md(Stack and commands)에 있다.
## 바뀌면
기준 프로젝트 목록이 바뀌거나, 실제 모양을 자동으로 모아 fixture로 만드는 도구가 생기면 다시 본다.
