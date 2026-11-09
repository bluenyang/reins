---
id: "020"
slug: stabilise-units-audit-local
version: "0.3.0"
status: draft
origin: user
approvals: []
waivers: []
supersedes: null
---
## 문제
0.3.0-rc.1을 쓰고 rc.2 안정화(intent 019의 ST-1·ST-2·ST-3·ST-5, PR #23)를 감사하면서 세 가지가 남았다.

- **나만 바꾼 설정(local)에는 위임 표가 없다.** `reins config --local`(예: 나만 multi로 켬)은 `.loctx/bindings.local.yaml`만 고치고, AGENTS.md의 위임 표와 `.claude/agents/rs-*.md`는 팀 설정(project)으로만 만든다. AGENTS.md에는 "로컬 파일이 있으면 그것을 따르라"는 문장만 있어서, 로컬로 켠 역할을 PM이 부를 이름이나 실행 줄이 없다. Claude 역할에는 `rs-*` 파일도 없다.
- **작업 단위를 묶은 커밋이 두 번 나왔다.** spec의 작업 단위(W-n, ST-n)는 하나가 커밋 하나여야 하고, 묶거나 순서를 바꾸려면 구현 전에 spec에 적고 승인받아야 한다. 0.3.0 감사에서 W-4~W-7을 한 커밋(`f4d7e4f`)에 묶은 것이 위반으로 나왔고 사용자가 수용했는데, rc.2에서 ST-1·2·3·5를 다시 한 커밋(master `8ce91e3`)에 묶었다. 규칙이 AGENTS.md 흐름과 `implement` 스킬에 분명히 적혀 있지 않고, 감사의 판정 항목에도 없다.
- **감사자가 GitHub 기록을 읽지 못한다.** 감사는 네트워크 없는 읽기 전용 실행(`codex exec -s read-only`)이라 `gh`로 PR·CI를 볼 수 없다. 그래서 0.3.0 감사와 rc.2 감사 모두 "머지·CI 통과"가 확인 불가로 나왔다. 설계 §3-3의 "읽는 것"에 PR·CI 기록이 없다.

근거(로컬): `.agents/audit/0.3.0.md`, `.loctx/reports/0.3.0/audit-rc2-astra.md`(rc.2 추가 감사), `.loctx/reports/0.3.0/review-rc2-sol.md`.

## 바라는 결과
- **ST-4 로컬 위임 표.** 개인 설정(`.loctx/bindings.local.yaml`)이 팀 설정과 다르면, `config --local`이 쓸 때 그 사람의 실제 설정(팀 + 개인)으로 위임 표를 `.loctx/delegation.local.md`에 만든다. 팀 생성물(AGENTS.md 블록, `rs-*`, `generated.yaml`)은 건드리지 않는다. AGENTS.md 위임 블록은 "`.loctx/delegation.local.md`가 있으면 이 절 대신 그것을 따른다"로 가리킨다. 로컬 표에서 Claude 역할은 `rs-*` 파일이 없을 수 있으므로 "그 모델의 일반 서브에이전트에 `.agents/harness/roles/<group>.md`의 해당 역할을 넘겨 부른다"고 적는다. 다른 벤더 역할은 팀 표와 같은 실행 줄이다. 개인 설정이 사라지거나 팀과 같아지면 그 파일을 지운다(수명: `config`가 만들고 `config`가 지움).
- **ST-6 작업 단위 ↔ 커밋.** `implement` 스킬은 커밋하기 전에 "이 커밋이 spec의 작업 단위 하나인가"를 확인한다. 묶거나 나누거나 순서를 바꿔야 하면 구현을 멈추고, spec에 바뀐 단위와 이유를 적어 사용자 승인을 받은 뒤 진행한다. AGENTS.md 흐름 블록에 같은 규칙을 한 줄로, 감사(`audit` 스킬, auditor 역할, 설계 §3-3)의 판정 항목에 "작업 단위 ↔ 커밋 대응"을 넣는다. 차단 장치(훅 등)는 두지 않는다(0.3 원칙).
- **ST-7 감사 입력에 PR·CI 기록.** PM이 감사 전에 PR 번호, 머지한 사람과 시각, 대상 SHA, CI 결과, PR 본문의 게이트 출력을 원본 그대로 `.loctx/reports/<version>/`에 모아 감사에 넘긴다. 감사자는 네트워크 없는 실행을 유지한다. `audit` 스킬, auditor 역할, 설계 §3-3(읽는 것)을 고친다.
- 설계서 양판(§3-1, §3-3, §5)과 README가 바뀐 동작과 맞는다.

## 계획
1. spec 작성: 이 intent가 승인되면 `spec.md`에 S-n, 작업 단위 W-1(ST-4), W-2(ST-6), W-3(ST-7), 검증 기준 V-n을 쓰고 요약에 진행/수정을 받는다.
2. 구현: **작업 단위 셋을 각각 별도 커밋**으로 한다(ST-6의 규칙을 이번부터 지킨다). 설계서 변경은 해당 단위의 커밋에 함께 넣는다.
3. 리뷰: GPT-6.1 Sol(읽기 전용, `codex exec -m gpt-6.1-sol -s read-only`). 지적을 고친다.
4. 머지: `fix/…` 브랜치 → PR → CI → 사용자가 머지(에이전트의 머지는 Claude Code 권한 검사에 막힌다).
5. 감사: GPT-6 Astra 새 실행. ST-7대로 PM이 PR·CI 기록을 먼저 `.loctx/reports/0.3.0/`에 모아 넘긴다.
6. 릴리스: 0.3.0-rc.3. 릴리스 문서 PR → `gh workflow run publish.yml -f version=0.3.0-rc.N -f dry_run=false`(사용자 지시) → npm staged → 사용자 2FA 승인.

## 현재 상태 (다른 세션이 이어받을 때)
- master: PR #23(rc.2 안정화 ST-1·2·3·5)까지 머지됨(`50199c2`). npm에는 0.3.0-rc.1이 `rc` 태그로 있고 rc.2는 아직 내지 않았다.
- 브랜치 `chore/audit-0.3.0-rc.2`: spec 019에 ST-4 처리 기록과 이 intent가 있다(push됨, PR 없음).
- rc.2 추가 감사: 사용자 처리 "위반 1수용, 2 보완"(2026-11-09) — `.agents/audit/0.3.0.md`의 추가 감사 절에 기록됨. (아래는 그 전의 기록)
- ~~rc.2 추가 감사의 사용자 처리가 아직 없다.~~ 결과는 `.loctx/reports/0.3.0/audit-rc2-astra.md`(로컬): 단위 묶음 위반, S-12 누락 위반, 커밋별 `pnpm check`·CI 확인 불가. PM 제안은 위반 1(단위 묶음) 수용, 위반 2와 확인 불가는 보완(실제 반영 커밋 연결, PR #23 CI 증거)이다. 사용자 결정을 받아 `.agents/audit/0.3.0.md`에 "## 추가 감사 — rc.2 안정화" 절로 커밋해야 한다.
- 릴리스 순서(사용자 2026-11-09 "rc.2 릴리스 후 rc.3 진행"): rc.2를 먼저 내고 이 intent는 0.3.0-rc.3로 낸다.

## 영향 범위
`cli/src/commands/configure.ts`(local 쓰기 뒤 로컬 위임 표), `cli/src/lib/agents-md.ts`(위임 렌더러 재사용, 로컬 표), `harness/templates/agents-md-blocks.md`(위임·흐름 블록), `skills/implement/SKILL.md`, `skills/audit/SKILL.md`, `harness/roles/auditor.md`, `docs/design.md`·`design.ko.md`(§3-1, §3-3, §5), README 양판(필요하면), 테스트.

## 제약
- reins는 작업 중에 불리지 않는다(0.3 원칙). 로컬 위임 표도 `config`가 쓸 때만 만든다.
- 개인 설정은 팀 생성물을 바꾸지 않는다(drift 없음).
- 감사자는 네트워크 없는 실행을 유지한다(사용자 2026-11-09 "감사자 부분은 a로").
- 출시물은 TypeScript(R65).

## 열린 질문
—

## 질의서 기록
- "그 두 개랑, 아까 미뤄둔 ST-4까지 하자"(사용자 2026-11-09): ST-6·ST-7과 ST-4를 함께 한다. ST-4는 처음에 "ST-4는 c, 다음 버전에서 a로 하자"였다가 이 말로 당겼다.
- "작업 단위별 커밋을 묶어서 했다는 의미라면, rc.3로 개선한다"(사용자 2026-11-09): ST-6.
- "감사자 부분은 a로"(사용자 2026-11-09): ST-7 — PM이 PR·CI 기록을 모아 넘김. 대안 (b) 감사자에게 네트워크를 열어 `gh`로 읽게 함은 채택하지 않음.
- "intent부터 적어라. 다른 세션에서 하게"(사용자 2026-11-09): spec 019에 덧붙이지 않고 이 intent로 분리.

### 에이전트가 정한 것
| # | 정한 것 | 대안 | 이유 |
|---|---|---|---|
| 1 | 로컬 위임 표 파일 이름 `.loctx/delegation.local.md` | AGENTS.md에 로컬 절을 씀 | AGENTS.md는 커밋되는 팀 파일이라 개인 설정을 쓰면 다른 사람에게 drift가 생긴다 |
| 2 | 로컬 표의 Claude 역할은 일반 서브에이전트 + 역할 파일 본문 | 로컬용 `rs-*` 파일 생성 | `.claude/agents/`는 커밋되는 팀 생성물이다 |
| 3 | ST-6을 차단 없이 문서·감사로만 | commit-msg 훅으로 W-n 표기 강제 | 0.3 원칙(작업 중 차단 없음, 훅은 프로젝트 게이트만) |

## 하지 않을 것
- PC 전체 기본값(사용자 2026-11-09 "PC 전체 기본값은 안 넣을 거야").
- 감사자에게 네트워크·`gh` 권한을 여는 것.
- 과거 커밋 이력을 다시 쓰는 것.
