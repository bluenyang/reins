---
intent: "008"
status: done
approvals:
  - { role: qa-design, at: 2026-10-26, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["008-1", "008-2"]
---
## 바뀌는 파일
- `skills/reins-{roadmap,intent,spec,implement,review,test,release,retro,loop}/SKILL.md`, `cli/src/lib/upstream.ts`(tier), `harness/roles/*.md`(스킬 한 줄), `docs/ROADMAP.md`·`docs/ROADMAP.ko.md`(새), README 양판, `docs/design*.md`, `reins update`

## 작업 순서
0.1.3 순서(pm 결정 2026-10-26): 009 → 011 → 008 → 010. 008-1은 009·011이 done이어야 시작한다(T1 asks).
1. 설계서 §4·§9 양판, 단계 스킬 8개(description 포함) + reins-loop 지휘자, reins-intent 정리, tier(`upstream.ts`)·SKILLS.md·install 목록, 스키마·tier 테스트 (S-1~S-7, S-8의 tier·SKILLS.md·플러그인) → ticket 008-1
2. 공개 로드맵 `docs/ROADMAP.md`(양판, 새로 만듦)·역할 파일의 스킬 참조·README 양판 Skills 표와 Roadmap 링크, `reins update` (S-8의 역할·README, S-9) → ticket 008-2

## 위험
- reins-release는 009의 흐름을 담아 완성한다. reins-retro는 입구만 쓰고 본문은 010이 채운다.
- 옛 reins-loop·reins-intent 절차가 옮기는 중에 빠질 수 있다 — 옛 단계 대조표로 리뷰(C-2).

## 증명
- `pnpm check`(스키마·tier·SKILLS.md·역할 참조 테스트 포함), `reins gate`, `reins update` 뒤 `check --drift`.
- 수동 시나리오(history 기록): 빈 임시 저장소에서 `reins-implement` 단독 → T1 HOLD/STOP, 승인 intent 없이 `reins-spec` → HOLD, ticket 없는 `reins-review` → T3 없이 끝나고 close 없음(C-3).

## 테스트 체크리스트
- [ ] spec C-1~C-6

## 이탈 기록
—
