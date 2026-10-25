---
intent: "005"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-26, kind: first-review }
  - { role: pm, at: 2026-10-26 }
summary_for_user: |
  qa-design·qa-run 기본 바인딩을 실제 agy ID(gemini-4-argon-high, gemini-3.8-flash-medium)로 바꾼다.
  벤더 추론은 detect.ts의 함수 하나로 모으고, install·configure 때 agy·cursor-agent의 `models` 목록으로만 ID를 확인한다(모델 호출 없음, 실패해도 막지 않음).
  `.env.*` 거부는 `.env.example`·`.env.example.*`만 빼고 전부 막는 glob 묶음으로 바꾸고, `git commit -n *`를 막는다.
  `.env.sample`·`.env.local.example`도 막히게 된다. deny가 allow를 이기므로 더 안전한 쪽을 골랐다.
---
## 요구 해석
- S-1 qa-design `default_binding`을 `gemini-4-argon-high`로, qa-run을 `gemini-3.8-flash-medium`으로 바꾼다. fallback·나머지 역할(lookup=Haiku 포함)은 그대로 둔다. ← "감지된 벤더 CLI가 실제로 제공하는 모델 ID로 바인딩된다", 질의서 기본값
- S-2 벤더 추론을 `cli/src/lib/detect.ts`의 `vendorOf(model)` 하나로 모으고 install의 `VENDOR_OF`, configure의 `vendorOf`를 없앤다. 규칙은 접두어 순서대로 `gpt`→openai, `gemini`→google, `cursor-`→cursor, 그 밖에는 claude다(configure의 현재 규칙). 확인된 모델 집합(`CONFIRMED_MODELS`/`CONFIRMED`)도 같은 곳에 하나로 둔다. ← "벤더 추론은 한 함수에서"
- S-3 모델 목록 확인. ← "바인딩할 때(install·configure) 모델 목록을 내주는 CLI로 ID를 확인하고…"
  - 언제: `install`의 buildBindings, `configure`의 `--set`·대화형 쌍·재구성 때. `update`에서는 하지 않는다.
  - 어떤 CLI: google 벤더는 `agy models`, cursor 벤더는 `cursor-agent models`. 해당 CLI가 PATH에 있을 때만 실행한다(`gemini`만 있으면 확인하지 않는다). claude·openai(codex)는 목록 명령이 없으므로 확인하지 않는다.
  - 방식: 한 번 실행할 때 CLI당 한 번만 부르고 결과를 재사용한다. 셸 없이 `spawnSync`로 띄우고 stdin은 닫으며 제한 시간은 10초다. 인자는 `models` 하나뿐이다. 프롬프트를 보내거나 모델을 부르는 경로는 만들지 않는다.
  - 파싱: ANSI 코드를 지운 뒤 agy는 탭이 있는 줄의 첫 필드를, cursor-agent는 `^(\S+) - .+$`에 맞는 줄의 첫 필드를 ID로 읽는다. 머리말처럼 형식에 맞지 않는 줄은 버린다. 비정상 종료·시간 초과·ID 0개는 "확인 실패"로 본다.
  - 기록(bindings.yaml, 스키마 `reins/bindings@1` 그대로): 목록에 있으면 `unverified`를 쓰지 않는다. 목록에 없으면 `unverified: true`와 `note: "not in <cli> models"`를 쓰고 stderr로 경고한다. 확인 실패면 `unverified: true`와 `note: "<cli> models failed: <이유>"`를 쓴다. 기존 note(벤더 대체)가 있으면 `; `로 잇는다. 목록 대상이 아닌 벤더는 지금처럼 `unverified: true`다(S-2의 확인 집합은 예외).
  - 막지 않음: 결과가 무엇이든 종료 코드와 쓰인 모델을 바꾸지 않는다. 없는 ID를 fallback으로 바꾸지 않으며, 사용자가 `--set`으로 준 모델도 그대로 쓴다. ← 제약 "configure로 정한 바인딩은 덮지 않는다", 질의서 "경고만"
- S-4 `.env.*` 거부. ← "거부 규칙이 `.env.*` 전체(`*.example*` 허용)…", 제약 "`*.example*`은 읽을 수 있어야 한다"
  - Claude Code에서는 deny가 allow를 이기므로 `Read(**/.env.*)`에 allow 예외를 붙이는 방식은 쓸 수 없다. 대신 denyRules가 `.env.*`를 `example` 접두어의 여집합 glob으로 펼친다(gitignore 문자 클래스 `[!…]` 사용). `.env.[!e]*`, k=1..6마다 `.env.<example 앞 k자>`와 `.env.<앞 k자>[!<k+1번째 글자>]*`, 마지막으로 `.env.example[!.]*`를 둔다. 모두 14개 glob이고, 각각 `Read`·`Edit` 규칙이 된다.
  - 결과: `.env.example`과 `.env.example.*`만 읽을 수 있고 나머지 `.env.*` 이름은 모두 막힌다. `.env.sample`·`.env.local.example`처럼 C4 `allowed`에 들어가는 이름도 막히는데, 이는 더 엄격한 쪽이라 받아들인다. 끝 글자로 예외를 거는 glob은 접두어 여집합으로 만들 수 없고, 그렇다고 `.env.*`를 통째로 막으면 `.env.example`까지 막혀 제약을 어기게 된다. 그래서 이 방식이 표현 가능한 규칙 가운데 가장 안전하다.
  - C4의 `patterns`·`allowed`와 pre-commit 스테이징 검사는 바꾸지 않는다.
- S-5 denyRules에 `Bash(git commit -n *)`를 더한다. `-nm`처럼 묶은 형태와 다른 인자 뒤에 오는 `-n`은 기존 `--no-verify` 규칙과 마찬가지로 남는 틈으로 문서에 적는다. ← "`git commit -n`을 막는다"
- S-6 V18을 넓혀 S-4의 대표 규칙(`Read(**/.env.[!e]*)`, `Read(**/.env.example[!.]*)`), `Bash(git commit -n *)`가 있고 `Read(**/.env.*)`는 없음을 단언한다. `docs/violations.md`·`.ko.md`의 C4·C5 행과 C4 틈 설명 문단을 새 규칙과 남는 틈(Bash 경유 읽기, `-n`의 다른 위치, `.env.sample` 과차단)에 맞춘다. ← 영향 범위
- S-7 이 레포에서 `reins update`를 실행해 `.agents/harness/roles`와 `.claude/settings.json`을 재생성한다. 프로젝트 소유인 `bindings.yaml`은 손대지 않는다. ← 영향 범위 "이 레포 재생성"
## 설계
- detect.ts: `vendorOf`, `CONFIRMED`, `listModels(vendor, run?)`. `run`은 주입할 수 있게 해서(기본값 spawnSync) 테스트에서 실제 CLI를 띄우지 않는다. 검증 메모를 붙이는 `checkBinding(model, cache)`를 install과 configure가 함께 쓴다.
- generate.ts: `envComplement('example')`가 S-4의 glob을 만든다. `.env.*` 이외 패턴은 지금과 같다.
## 우려 표시
- 불변식 "CLI는 모델을 부르지 않는다"(설계 §0·§9): 충돌 없음. 목록 명령만 쓴다.
- 불변식 "바인딩은 프로젝트 소유": 충돌 없음. 확인은 note만 붙이고 모델은 바꾸지 않는다.
- R65(파이썬 금지), C10(요구 추가 금지): 충돌 없음.
- "설계 문서 먼저": design §5와 §0의 거부 목록 서술이 기본값이나 `.env.*` 축소를 다루고 있다면, 같은 커밋에서 `docs/design.md`·`.ko.md`를 고친다. plan에서 확인한다.
- 실현성(plan으로 넘김): Claude Code의 Read/Edit 매처가 `[!…]`를 gitignore처럼 다루는지 이 레포 세션에서 직접 확인한다(가짜 `.env.zz`·`.env.example`을 두고 읽어 본다). 지원하지 않으면 HOLD로 사용자에게 묻는다.
## 검증 기준
- C-1 (S-1) qa-design·qa-run 역할 파일의 default가 새 ID이고, 기존 install 테스트가 새 ID로 통과한다.
- C-2 (S-2) `VENDOR_OF`와 configure의 `vendorOf`가 없어진다. `vendorOf` 단위 테스트가 네 접두어와 그 밖의 경우를 다룬다. `cursor-grok-4.5-high-fast`를 install과 configure 모두 cursor로 판정한다.
- C-3 (S-3) `run`을 주입한 단위 테스트로 확인한다. 두 출력 형식의 파싱(머리말 무시 포함), 목록에 있음→`unverified` 없음, 없음→note와 경고, 비정상 종료·시간 초과→실패 note, 모든 경우 종료 코드 0과 모델 불변을 본다. CLI당 한 번만 호출하고 인자가 `['models']`뿐인지 단언한다.
- C-4 (S-3) `--set qa-run=<없는 ID>`를 주면 그 ID가 그대로 기록되고 경고만 나온다.
- C-5 (S-4) 생성된 glob을 정규식으로 옮긴 단위 테스트로 판정한다. `.env.custom`, `.env.local`, `.env.e`, `.env.exam`, `.env.examples`, `.env.sample`은 막히고 `.env.example`, `.env.example.local`은 열린다.
- C-6 (S-5, S-6) V18이 S-6의 규칙 문자열을 단언하고 `violations: 18/18 stopped`를 유지한다. violations 두 판의 C4·C5 행과 C4 문단이 S-6 내용과 같다.
- C-7 (S-7) 재생성 뒤 `bindings.yaml`에 diff가 없고, `reins check`와 `pnpm check`가 통과한다.
## 범위 밖
- 벤더별 생성물(`.codex/` 등, 0.2), 모델 가격·비용 비교
- Bash 경유 비밀 읽기(`cat .env.x`), `-n`의 다른 위치·묶은 형태 차단, C4 `allowed` 목록 변경
- 목록 명령이 없는 CLI(claude, codex)의 확인, `update` 때의 재확인
