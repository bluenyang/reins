---
intent: "010"
status: done
approvals:
  - { role: qa-design, at: 2026-10-26, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["010-1", "010-2"]
---
## 바뀌는 파일
- 010-1: `cli/src/commands/{retro,knowledge}.ts`(새), `cli/src/reins.ts`, status 후보 수, 검사(승인 없는 knowledge → STOP), history `reasons:` 줄 형식, 테스트, `docs/design*.md` §8·§9
- 010-2: `skills/reins-retro/SKILL.md` 본문, `harness/roles/pm.md`, 첫 후보 3건 승격(사용자 승인 후 커밋)

## 작업 순서
1. 반복 세기·제안·승인 CLI (S-1~S-8) → ticket 010-1
2. reins-retro 스킬과 첫 회고(0.1.3 rc 대상), 후보 3건 (S-9~S-11) → ticket 010-2 (009-2·008-1에 의존)

## 위험
- 지난 history에는 `reasons:` 줄이 없음 → 첫 회고는 정지 id·decisions만 셈(spec에 명시).
- `Approved-by` 커밋 트레일러를 훅에서 검사하는 일은 010에 넣지 않는다(pm 결정, spec 범위 밖). 010-1·010-2 모두 검사하지 않으며, 증거는 스킬 절차와 커밋 트레일러뿐이다.

## 증명
- `reins gate`, retro 출력, 승인 커밋의 Approved-by.

## 테스트 체크리스트
- [ ] spec C-1~C-9

## 이탈 기록
- 2026-10-26 (pl): 010-2의 "첫 회고는 0.1.3 rc 대상"은 순서상 불가 — rc.1은 010까지 끝나야 나온다. 첫 회고는 지금까지의 기록 전체(0.1.0~0.1.3 진행분)를 대상으로 하고, rc.1 뒤의 회고는 정상 흐름(reins-release → reins-retro)으로 돈다.
