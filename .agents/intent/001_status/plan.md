---
intent: "001"
status: done
approvals:
  - { role: qa-design, at: 2026-10-25, kind: light-review }
agents:
  implement: [implementer]
  verify: [verify-tool]
  review: [code-review]
budget: {}
tickets: ["001-1", "001-2"]
---
## 바뀌는 파일
- `cli/src/commands/status.ts` (새), `cli/src/reins.ts` (status 명령), `cli/test/status.test.ts` (새)
- `AGENTS.md` 프로젝트 절 (Conventions 첫 항목)

## 작업 순서
1. `reins status` — 수집·출력·`--json`, 테스트 (S-1~S-7) → ticket 001-1
2. AGENTS.md 임시 규칙을 `reins status`로 교체, 이 레포에서 실행 확인 (S-8) → ticket 001-2 (001-1에 의존)

## 위험
- 재사용하는 `ticketStart`를 바꾸면 T1 동작이 달라진다 → 바꾸지 않고 호출만. stages.test.ts 그대로 통과.
- 깨진 frontmatter·없는 파일에서 예외 → 모든 읽기는 `lib/work.ts`(예외 대신 error 필드) 경유, C-4로 확인.
- 재사용하는 검사 로직이 파일을 쓰면 S-7 위반 → `runCheck`는 보고서를 돌려줄 뿐 bus에 쓰지 않음; C-7 해시로 확인.
- 드리프트 시간 → 0.24s 실측, 문제 없음.

## 증명
- `reins gate --ticket <id>`의 보고서(`.loctx/reports/`)를 T3 증거로 쓴다.
- 001-2는 이 레포에서 `reins status` 실제 출력을 history에 남긴다.

## 테스트 체크리스트
- [ ] C-1 하네스 없음 / 설치됨 / 드리프트
- [ ] C-2 superseded 숨김
- [ ] C-3 S-3 표 각 행
- [ ] C-4 T1 판정 일치(B1), doing·blocked·orphan·invalid
- [ ] C-5 bus 개수·마지막 history
- [ ] C-6 `--json` 대조
- [ ] C-7 `.loctx/` 포함 트리 해시 불변, 레포 밖 exit 2
- [ ] C-8 이 레포에서 001 표시

## 이탈 기록
- 2026-10-25 (001-1, code-review 001-1_02): S-4 "CONTINUE면 implementer: start"를 "ticket의 role: start"로 해석한다. role이 docs인 ticket에 "implementer"라고 쓰면 틀린 안내가 되기 때문. 이 레포 ticket은 모두 implementer라 화면은 같다. — pl
