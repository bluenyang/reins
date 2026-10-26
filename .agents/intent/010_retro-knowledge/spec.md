---
intent: "010"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-26, kind: first-review }
  - { role: pm, at: 2026-10-26 }
summary_for_user: |
  rc를 낸 뒤(또는 아무 때나) `reins retro`가 정지 사유·리뷰 지적·실패 라운드·토큰을 버전별로 모아 보여 준다.
  같은 키(정지 사유 id, history의 `reasons:`·`decisions:` 슬러그)가 서로 다른 티켓·기록에서 두 번 이상 나오면 승격 후보로 센다. `reins status`에 후보 수가 나온다.
  `reins knowledge propose`는 제안 초안만 만들고, `accept`는 사용자가 승인한 뒤에만 `.agents/knowledge/`에 항목을 쓴다. 커밋에는 Approved-by가 붙는다.
  첫 승격 대상은 history에 적힌 후보 3건이다. 검색(`reins recall`)은 0.2로 미룬다.
---
## 요구 해석
- S-1 `reins retro [--release <v>] [--json]`는 회고 요약을 낸다. 정지 사유 id별 횟수, 리뷰 fix-required 사유, 실패 라운드(HOLD·STOP 판정 수), 역할별 토큰을 보여 준다. ← "rc 배포 뒤(또는 언제든) … 모아 요약한다"
- S-2 `--release <v>`는 intent.md의 `version`이 v인 intent와 그 티켓(`intentOf`)으로 범위를 좁힌다. 생략하면 기록 전체를 본다. ← "이번 버전의"
- S-3 반복을 세는 키는 세 축이다. `stop:<id>`(metrics.jsonl check 기록의 `reasons`), `reason:<slug>`(history의 `reasons:` 줄), `decision:<slug>`(history의 `decisions:` 줄). 서로 다른 티켓 또는 history 페이지 두 곳 이상에 나온 키가 후보다. 한 티켓 안에서 반복된 것은 1로 센다. ← "같은 사유·결정이 두 번 이상이면 … 스크립트가 센다"
- S-4 history 형식에 선택 줄 `reasons: <slug>, …`을 추가한다. `decisions:` 바로 다음 줄에 둔다. 리뷰 fix-required와 정지 사유는 사람이 읽을 수 있는 slug로 적는다. ← "history 형식(결정·사유 줄)"
- S-5 이미 승격된 키는 후보에서 뺀다. knowledge 항목의 `decisions`·`symptoms`에는 접두어 없는 슬러그(정지 사유는 id)를 적는다. 대조할 때는 키의 접두어(`stop:`·`reason:`·`decision:`)를 떼고 두 필드 어느 쪽과든 일치하면 뺀다. `status: active` 항목만 대상이고, superseded 항목의 키는 다시 후보가 될 수 있다. ← 승격 후 반복 표시 방지(S-3의 범위)
- S-6 `reins status`에 `knowledge 후보 N`을 한 줄로 보인다(S-3·S-5와 같은 셈). ← "`reins status`에도 후보 수가 보인다"
- S-7 `reins knowledge propose <key|slug> [--from <history>…]`는 knowledge 템플릿으로 `.loctx/knowledge-proposals/<slug>.md`를 만든다. `approved`는 비워 두고 `source`에 근거 기록을 적는다. ← "pm이 후보를 knowledge 항목으로 제안"
- S-8 `reins knowledge accept <slug>`는 제안을 `.agents/knowledge/<date>_<slug>.md`로 옮기고 `approved: {by: user, at: <오늘>}`을 쓴다. 이것이 승인을 기록하는 유일한 길이다. ← "사용자가 승인하면 커밋된다"
- S-9 `reins-retro` 스킬은 다음 순서로 진행한다. retro 실행 → pm이 후보마다 propose와 요약 → 사용자 승인·거부 → 승인된 것만 accept → 커밋(트레일러 `Approved-by: user`) → 일반적인 것은 다음 intent 후보로 ROADMAP에 한 줄. ← 바라는 결과 1·3
- S-10 첫 승격 대상 3건을 제안한다. `bus-value-quoting`(001-1, 006-3: 반복 2회), `permission-glob-no-negation`(005-1), `review-diff-only`(006-3). 1회뿐인 둘은 사용자가 intent에서 지정했으므로 propose의 `--from`으로 근거를 대고 제안한다. ← "후보 3건이 첫 승격 대상"
- S-11 pm 역할 5단계를 "retro 후보 → propose → 사용자 승인 → accept"로 고친다. ← 영향 범위 "pm 역할 절차"
## 설계
- 셈은 `cli/src/lib/retro.ts`에 둔다. `readMetrics`·`classify`·`summarize`(metrics.ts)와 `historyPages`·`recordedDecisions`(work.ts)를 재사용하고, `recordedReasons`를 추가한다. 토큰 요약은 `summarize`를 그대로 쓴다.
- 티켓 id는 history 파일명(`_NNN-n-`)이나 metrics의 `ticket`에서 얻는다. 티켓이 없는 history는 페이지 하나를 한 번으로 센다.
- 제안 초안은 `.loctx/`에 둔다(사용자 언어 문서). 이렇게 하면 `.agents/knowledge/`에는 승인된 항목만 남는다. accept는 스키마 검증(knowledge@1)을 통과해야 쓴다.
- 검증기에 규칙을 하나 추가한다(검증은 C-6). `approved`가 없는 `.agents/knowledge/*.md`는 STOP이다.
- 설계 문서 §8(셈의 정의, 제안 위치)과 §9(CLI 목록에 `retro`·`knowledge`)를 en·ko 모두 같은 커밋에서 고친다(AGENTS.md 규칙).
- 불변식 점검
  - 승격에는 사용자 승인이 필요하다(§8): accept만 approved를 쓰고, 스킬이 사용자 응답 뒤에 호출한다. 충돌 없음.
  - CLI는 모델을 부르지 않는다(§9): retro는 세기만 하고, 요약 문장은 pm이 쓴다. 충돌 없음.
  - C10: 요구를 추가하지 않는다. S-11은 영향 범위에 명시돼 있다. 충돌 없음.
  - recall은 0.2로 미룬다. 이번 범위에는 grep 검색도 넣지 않는다. 충돌 없음.
## 우려 표시
- CLI는 accept를 누가 실행했는지 알 수 없다. 승인의 증거는 스킬 절차와 커밋 트레일러뿐이다. 훅에서 `Approved-by` 트레일러를 검사하는 것은 010 범위 밖이다(pm 결정, 범위 밖에 적음).
- 기존 history에는 `reasons:` 줄이 없다. 과거 기록은 소급하지 않으므로 첫 회고의 셈은 `stop:`·`decision:` 축에만 의존한다.
- `decision:` 축은 슬러그가 우연히 겹치면 잡음이 생길 수 있다. 출력에서 축별로 따로 보여 준다.
## 검증 기준
- C-1 fixture(metrics 기록 + `reasons:` 줄이 있는 history 포함 3건)로 `reins retro --json`을 돌린다. 출력에 S-3 규칙대로 축별 후보 키와 횟수가 있고, S-1의 정지 사유 id별 횟수, 실패 라운드(HOLD·STOP 수), 역할별 토큰 요약이 있다. 같은 티켓 안의 중복은 1로 세어 단독으로는 후보가 되지 않는다. 두 티켓의 `reasons:`·`decisions:`에 같은 슬러그가 있으면 `reason:`·`decision:` 후보로 따로 센다.
- C-2 `--release 0.1.3`은 해당 version intent의 기록만 센다. 다른 version이나 티켓 없는 기록은 셈과 토큰 요약에서 빠진다.
- C-3 active knowledge의 `decisions` 또는 `symptoms`에 접두어를 뗀 슬러그로 들어 있는 키는 2회 이상이어도 retro 후보와 status 후보 수에서 빠진다. superseded 항목의 키는 빠지지 않는다.
- C-4 `reins status`의 후보 수가 `reins retro`의 후보 수와 같다.
- C-5 propose는 `.loctx/knowledge-proposals/`에만 쓰고 `.agents/knowledge/`는 건드리지 않는다. accept는 스키마에 맞고 approved가 채워진 항목을 쓰며, 제안 초안을 지운다.
- C-6 approved가 없는 knowledge 항목이 있으면 `reins check`가 STOP으로 끝난다.
- C-7 skills/reins-retro/SKILL.md에 S-9의 단계가 있고, roles/pm.md 5단계가 갱신돼 있다. `reins update` 뒤 drift가 없다.
- C-8 S-10의 3건이 사용자 승인을 거쳐 `.agents/knowledge/`에 커밋돼 있다.
- C-9 `pnpm check`가 통과한다. design.md와 design.ko.md의 §8·§9가 구현과 일치한다.
## 범위 밖
- `reins recall`, 벡터 검색(0.2), 승인 없는 자동 승격, `Approved-by` 트레일러 훅 검사, 과거 history에 `reasons:` 줄 소급, 후보 문장 자동 생성(CLI의 모델 호출).
