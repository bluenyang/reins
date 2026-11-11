---
id: 2026-11-11_isolated-path-one-empty-dir
kind: decision
status: active
supersedes: null
topics: [test, path]
decisions: [isolated-path]
symptoms: [global-install-on-path]
applies_to: all
source: ".agents/audit/0.3.1.md; .loctx/history/0.3.1.md"
approved: { by: user, at: 2026-11-11, words: "K2이거 승격까지 필요한가? 일단 OK." }
---
## 결정
"어떤 명령이 PATH에 없다"를 전제로 하는 테스트나 스크립트는 PATH를 빈 임시 폴더 하나로만 만든다. 필요한 실행 파일(node, npm, git, sh와 쓰는 유틸리티)은 그 폴더에 래퍼나 링크로 넣는다. node가 있는 폴더나 `/usr/bin`·`/bin`을 PATH에 넣지 않는다.
## 이유
node 폴더에는 전역 설치한 것이 함께 있다(nvm이면 `reins`도). 0.3.1에서 같은 문제가 세 번 났다: e2e 테스트가 node 폴더를 PATH에 넣어 커밋 훅이 막혔고(W-10), 고친 뒤에도 `/usr/bin`이 남아 있다는 리뷰 지적이 나왔고(W-12), 배포본 smoke 스크립트도 같은 방식이라 실패했다.
## 적용
`test/e2e/harness-only.test.ts`의 좁힌 PATH, `.loctx/context/scripts/smoke-published-*.sh`. 테스트는 PATH가 그 폴더 하나임을 단언한다.
## 바뀌면
—
