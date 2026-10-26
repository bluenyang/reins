---
intent: "008"
status: accepted
approvals:
  - { role: qa-design, at: 2026-10-26, kind: first-review }
  - { role: pm, at: 2026-10-26 }
  - { role: user, at: 2026-10-26, kind: summary }
summary_for_user: |
  스킬을 workflow 단계별로 나눈다: roadmap·intent·spec·implement·review·test·release·retro 여덟 개로 늘려 setup·loop와 함께 열 개가 되고, reins-loop는 이들을 순서대로 부르는 지휘자로 남는다.
  각 스킬은 맨 먼저 자기 단계의 check(T1·T3·T5 또는 drift)를 부르고, 앞 단계 산출물이 없으면 그 결과(HOLD/STOP)를 따른다. 따로 하나만 불러도 그 단계가 끝난다.
  reins-intent에서 spec 부분을 떼어 reins-spec으로 옮기고, reins-loop의 plan·구현·리뷰·릴리스 절차는 각 단계 스킬로 옮긴다.
  0.1.3 순서는 009 → 011 → 008 → 010이다. 그래서 reins-release는 009의 흐름을 담아 완성하고, reins-retro는 입구만 두며 본문은 010이 채운다.
  공개 로드맵 `docs/ROADMAP.md`(양판)도 이번에 처음 만든다.
  플러그인은 계속 setup만 싣고, 새 스킬은 loop 계층 설치에만 들어간다. README 양판의 스킬 표를 고친다.
---
## 요구 해석
- S-1 스킬 `reins-roadmap`·`reins-spec`·`reins-implement`·`reins-review`·`reins-test`·`reins-release`·`reins-retro`를 `skills/`에 새로 둔다. ← 바라는 결과(목록)
- S-2 `reins-intent`는 intent 작성·승인까지만 맡는다. spec 절차는 `reins-spec`으로 옮긴다. ← "지금 것에서 spec을 뗀다"
- S-3 `reins-loop`는 단계 스킬을 순서대로 부르는 지휘자다. 단계 절차를 직접 담지 않는다. ← "지휘자로 남는다"
- S-4 각 스킬은 시작할 때 자기 단계의 check를 부르고 판정(CONTINUE/HOLD/STOP/ESCALATE)을 따른다. ← "각 스킬은 시작할 때…"
- S-5 각 스킬은 단독으로 불려도 그 단계를 끝낸다. 앞 단계 산출물이 없으면 check 결과가 알려 준다. ← 제약 2
- S-6 스킬은 얇은 입구다. CLI 기능을 다시 구현하지 않고, 판단은 역할에, 강제는 스크립트에 둔다. ← 제약 1
- S-7 사용자와 에이전트 모두 부를 수 있다. description이 무엇과 언제를 함께 적어 자동 호출도 된다. ← 바라는 결과
- S-8 install의 스킬 목록·SKILLS.md·역할 절차의 스킬 참조·README 양판을 맞추고, 플러그인은 setup만 싣는다. ← 영향 범위
- S-9 `reins-roadmap`이 고칠 공개 로드맵 `docs/ROADMAP.md`·`docs/ROADMAP.ko.md`를 이번에 만든다(README Roadmap 표가 원본). ← "로드맵을 언제든 고치고"(pm 결정 2026-10-26)
## 설계
- **스킬 표.** 이름 / 맡는 역할 / 먼저 부르는 check / 입력 → 출력 / 다음 스킬.
  - `reins-roadmap` / pm / `reins status` + `check --drift` / 사용자 지시 → `docs/ROADMAP.md`(양판) 갱신과 대상 버전 / `reins-intent`
  - `reins-intent` / pm / `check --drift` / 요청 → 승인된 `intent.md`(`Approved-by` 커밋) / `reins-spec`
  - `reins-spec` / planner → pm·qa-design → pl / `check --drift`, intent `status: approved` 확인 / 승인된 intent → accepted `spec.md`(요약 거부권), `plan.md`, ticket 파일 / `reins-implement`
  - `reins-implement` / implementer / **T1** `ticket-start` / ticket → 커밋들(훅이 **T2**) / `reins-review`
  - `reins-review` / verify-tool → code-review, 판정은 pl / 시작은 `check --drift`, ticket이 있으면 검증 교환(`kind: verify`) 뒤 **T3** `verdict` / ticket → bus 응답·리뷰 결과·ticket close와 history / 다음 ticket이면 `reins-implement`, 없으면 `reins-test`
    - ticket 없는 경우(사용자가 직접 고친 diff 범위): `check --drift`만 부르고 검증 교환과 T3는 건너뛴다. 리뷰 전용 bus 쌍(`kind: review`, ticket 자리에 범위)을 남기고, ticket close·history는 하지 않는다.
  - `reins-test` / qa-design → qa-run, verify-tool / `reins status` + `check --drift`: 그 버전에 열린 ticket이 없고 계획된 ticket이 모두 done이어야 한다(닫힌 ticket에 T3를 다시 부르지 않는다). 남아 있으면 HOLD / 버전·spec 검증 기준 → e2e 시나리오, 실행 결과, `pnpm build` 결과 / `reins-release`
  - `reins-release` / deploy / **T5** `rc-close`(push 때 훅이 **T4**) / 버전 → PR·CI·merge·rc. 009가 먼저 들어오므로 009의 흐름을 그대로 담아 완성한다 / `reins-retro`
  - `reins-retro` / pm / `reins status` / 버전 → 회고 요약·승격 후보 제안. 008은 입구(첫 check·입출력·다음 스킬)만, 본문은 010 / `reins-roadmap` 또는 다음 intent
- **check가 없는 단계.** roadmap·intent·spec·test·retro와 ticket 없는 review에는 `--stage`가 없다. 새 stage를 만들지 않고 `--drift`와 `reins status`로 시작하며, 앞 산출물(승인된 intent 등)이 없으면 스킬이 HOLD로 사용자에게 묻는다. 새 stage가 필요하면 별도 intent로 낸다(C10).
- **지휘자.** `reins-loop`는 판정 규칙(0/10/20/30)·metrics 기록·중단 기록(G1) 같은 공통 규칙과 스킬 순서만 담는다. 재개는 `reins status`가 가리키는 단계의 스킬을 다시 부른다.
- **파일 생성.** 011이 먼저 들어오므로 ticket·bus 요청은 011의 `reins new`로 만든다. 008은 `reins new`를 만들지 않는다.
- **로드맵.** `docs/ROADMAP.md`·`.ko.md`를 README Roadmap 표 내용으로 만들고 서로 링크한다. README 양판의 Roadmap 절은 이 파일을 가리킨다.
- **계층과 배포.** `tierSkills`: harness = `['reins-setup']` 유지, loop = setup + 위 여덟 개 + `reins-loop`(10개). 마켓플레이스 항목은 `./skills/reins-setup` 그대로. `.agents/SKILLS.md`와 install 출력이 새 목록을 반영한다. 역할 파일(`harness/roles/*.md`) 절차에 그 역할이 들어가는 스킬 이름을 한 줄씩 적는다.
- **README 양판.** Skills 절 "Three skills"를 열 개 표(스킬 / 언제)로 바꾸고, plugin은 setup만이라는 문장을 둔다.
## 우려 표시
- 불변식 점검: 설계서 우선 — design §4(사람이 정하는 두 지점)·§9(skills) 양판을 코드보다 먼저 같은 커밋에서 고친다. 충돌 없음. R65(TS만) 충돌 없음. R67(양판) — README·ROADMAP·design 양판 동시 수정. 플러그인 setup만(007 S-3) 유지, 충돌 없음.
- 009·010·011과 순서: pm 결정(2026-10-26)으로 009 → 011 → 008 → 010. 008은 009의 release 흐름과 011의 `reins new`를 전제로 쓰고, reins-retro 본문만 010에 남긴다. 009나 011이 늦어지면 008-1은 시작하지 않는다(T1 asks).
- 스킬 수가 늘어 description이 서로 겹치면 자동 호출이 엇갈릴 수 있다. 각 description에 단계 경계(무엇을 하지 않는지)를 넣는다.
## 검증 기준
- C-1 (S-1, S-7) 열 개 SKILL.md가 Agent Skills 형식(name = 디렉터리명, description에 무엇과 언제)을 지킨다. 스키마 테스트로 확인.
- C-2 (S-2, S-3) `reins-intent`에 spec 절차가 없고, `reins-loop` 본문은 단계 스킬 이름과 공통 규칙만 담는다. 옛 절차(spec·plan·ticket·구현·검증·리뷰·close·rc)가 하나도 빠짐없이 `reins-spec`·`reins-implement`·`reins-review`·`reins-release`로 옮겨졌다(옛 단계 대조표로 리뷰).
- C-3 (S-4, S-5) 각 SKILL.md 첫 단계가 위 표의 check다(테스트로 문자열 확인). 수동 시나리오(history 기록): (a) 빈 임시 저장소에서 `reins-implement`만 부르면 T1이 HOLD/STOP을 내고 구현을 시작하지 않는다. (b) 승인된 intent가 없을 때 `reins-spec`은 drift 뒤 HOLD로 묻는다. (c) ticket 없이 diff 범위로 `reins-review`를 부르면 T3 없이 리뷰가 끝나고 ticket close를 시도하지 않는다.
- C-4 (S-6) 새 스킬이 CLI에 없는 판정 로직을 담지 않는다(code-review).
- C-5 (S-8) `tierSkills('loop')`가 10개, `tierSkills('harness')`가 `['reins-setup']`, 마켓플레이스 skills가 `["./skills/reins-setup"]`(테스트). install·`reins update` 뒤 `check --drift` ok. `.agents/SKILLS.md`가 10개를 나열하고, 역할 파일마다 스킬 참조 줄이 위 표와 맞는다(테스트). README 양판 표가 같은 10행.
- C-6 (S-9) `docs/ROADMAP.md`·`.ko.md`가 있고 서로 링크하며, README 양판 Roadmap 절이 이를 가리킨다.
## 범위 밖
- 새 `check --stage` 추가, `reins new`(011), release 흐름의 CLI·CI 쪽(009), retro 본문·집계·knowledge 승격(010).
- CLI가 모델·벤더를 직접 부르는 것, 다른 벤더용 플러그인.
