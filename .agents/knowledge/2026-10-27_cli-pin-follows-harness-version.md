---
id: 2026-10-27_cli-pin-follows-harness-version
kind: decision
status: active
supersedes: null
topics: []
decisions: []
symptoms: [cli-pin-follows-harness-version]
applies_to: all
source: ".loctx/history/2026-10-26-2200_rc2-smoke.md, .loctx/history/2026-10-26-2230_011-6-cli-pin.md"
approved: { by: user, at: 2026-10-27 }
---
## 결정
릴리스 후보는 이 저장소가 아니라 npm에서 받은 패키지로, 빈 저장소에 설치해 스모크 테스트한다(rc마다).
## 이유
이 저장소는 스킬 대신 `node cli/dist/reins.js`를 쓰므로, 설치본이 부르는 CLI 버전 문제가 보이지 않는다. rc.2에서 단계 스킬이 하네스 버전(0.1.2)으로 옛 CLI를 부르는 결함이 npm 스모크 테스트에서만 드러났다(011-6).
## 적용
reins-test 단계에 "npm rc 패키지로 빈 저장소 install → 단계 스킬이 부르는 `@<cli>`로 핵심 명령 실행 → 옛 버전 설치를 update" 시나리오를 둔다.
## 바뀌면
이 저장소도 설치본과 같은 경로(`npx @<cli>`)로 CLI를 부르게 되면 다시 본다.
