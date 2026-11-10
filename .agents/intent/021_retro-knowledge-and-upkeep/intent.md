---
id: "021"
slug: retro-knowledge-and-upkeep
version: "0.3.1"
status: draft
origin: user
approvals: []
waivers: []
supersedes: null
---
## 문제
0.3.0을 내고 회고하면서 여섯 가지가 남았다. 모두 사용자가 0.3.1로 정했다(`.loctx/ROADMAP.local.md` "0.3.1 예약", `docs/ROADMAP.md` "0.3.1 — planned").

- **회고가 knowledge 후보를 내지 않는다.** 설계 §8은 "retrospector나 PM이 history·감사에서 반복된 결정·실패를 찾아 제안"한다고 적는데, `retro` 스킬 ②는 AGENTS.md·스킬·하네스 개선안만 말한다. 0.2.0은 회고 없이 지나갔고 0.3 동안 knowledge 승격이 없었다(사용자 "회고 하면서 주요한 결정은 knowledge 승격 하고 있는거야?").
- **`.claude/settings.json`에 허가 한 줄만 더해도 update가 건너뛴다.** 생성물을 통째 해시로 비교해서 "손으로 고침"으로 보고, `--force`면 사용자가 넣은 허가(allow 등)가 사라진다. 이 저장소에서 확인했다(`3b2709d` 뒤).
- **감사자 실행 줄이 쓰기 가능이다.** auditor 역할의 `tools.write: true` 때문에 위임 표가 `codex exec … -s workspace-write`를 낸다. 설계 §3-3과 실제 운영은 읽기 전용·오프라인 실행이고, 감사 기록은 PM이 받아 커밋해 왔다.
- **커밋별 검사 출력이 남지 않는다.** 훅이 `pnpm check`를 돌리지만 출력을 남기지 않아, 0.3.0 감사가 네 번 "커밋별 통과 확인 불가"로 적었다(rc.3 감사 지적 2).
- **알려진 모델 목록이 낡았다.** `harness/models.yaml`, `cli/src/lib/detect.ts`의 `CONFIRMED_MODELS`, 설계서 예시에 `claude-fable-5-2`, `gpt-6-luna`, `gpt-6-sol`이 없다.
- **`AGENTS.previous.md`에 옛 reins 명령이 그대로 남는다.** 0.2.0 이하 설치를 update로 옮기면 옛 AGENTS.md가 그대로 복사되어 `reins status`·`reins check` 줄이 남는다. "참고 자료, 지침 아님"은 AGENTS.md의 재구성 표시와 `onboard` 스킬에만 적혀 있고 사본 자체에는 없다.

## 바라는 결과
- **retro 스킬.** ②에 "history·감사에서 반복된 결정·실패를 knowledge 후보로 제안한다"가 들어가고, ③의 승격 절차(`approved: {by, at, words}`)와 이어진다. retrospector 역할 문장과 설계 §3-4·§8이 같은 말을 한다.
- **settings.json 합치기.** `update`(와 생성물을 다시 만드는 `config`)가 `.claude/settings.json`에서 reins가 소유한 부분만 고치고 사용자 항목은 남긴다. 사용자 항목이 있다는 이유로 건너뛰지 않고, `--force`로도 사용자 항목은 사라지지 않는다. 유효한 JSON이 아니면 지금처럼 손대지 않고 알린다.
- **감사자 읽기 전용.** 위임 표(팀·개인)의 auditor 실행 줄이 읽기 전용이다. `audit` 스킬·auditor 역할·설계 §3-3이 "감사자는 판정을 돌려주고, PM이 `.agents/audit/<version>.md`를 쓰고 커밋한다"로 맞는다.
- **커밋별 검사 출력.** 훅이 프로젝트 검사를 돌릴 때 출력을 로컬 파일로 남기고, 감사가 커밋과 그 출력을 대응시킬 수 있다. `audit` 스킬과 설계 §3-3의 "읽는 것"에 들어가고, 수명(회고 뒤 삭제)이 정해진다. 훅은 프로젝트 검사만 돌리고 reins를 부르지 않는다.
- **모델 목록.** `models.yaml`·`CONFIRMED_MODELS`·설계서 예시가 구현 시점에 다시 확인한 목록과 맞는다.
- **previous 머리 경고.** 0.2.0 이하 설치를 update로 옮길 때 만드는 `.agents/AGENTS.previous.md` 머리에 "0.2.0 이하의 지시 사본 — 여기 적힌 reins 명령(`reins status`·`reins check` 등)은 0.3에 없으니 실행하지 말 것"이 붙는다.
- 설계서 양판, README 양판(해당되면), `harness/CHANGELOG.md`가 바뀐 동작과 맞는다.

## 계획
1. spec: 승인되면 `spec.md`에 S-n, 작업 단위, V-n을 쓰고 plan-reviewer 검토 뒤 요약에 진행/수정을 받는다. 작업 단위 초안(각각 따로 되돌릴 수 있는 단위):
   - W-1 retro 스킬의 knowledge 후보 제안(+ retrospector 역할, 설계 §3-4·§8)
   - W-2 `.claude/settings.json` 합치기(+ 설계 §6, 테스트)
   - W-3 auditor 읽기 전용(+ `audit` 스킬, 역할, 설계 §3-3, 테스트)
   - W-4 커밋별 검사 출력(+ install의 훅 제안, 이 저장소의 `.husky/`, `audit` 스킬, 설계 §3-3·§4-2)
   - W-5 모델 목록 갱신
   - W-6 `AGENTS.previous.md` 머리 경고
2. 구현: 브랜치 `feat/retro-knowledge-upkeep`. 설계서 변경은 해당 단위의 커밋에 함께 넣는다.
3. 리뷰: GPT-6.1 Sol(읽기 전용, diff만).
4. 테스트 → 머지: PR 본문에 검사 로그 경로와 마지막 출력, CI, 머지는 사용자 지시("PR #N 머지해").
5. 감사: GPT-6 Astra 새 실행. PM이 PR·CI 기록을 `.loctx/reports/0.3.1/`에 모아 넘긴다.
6. 릴리스: 0.3.1-rc.1 → 사용자 확인 → stable은 사용자 지시. 그 뒤 이 저장소를 `reins update`로 0.3.1 하네스로 옮긴다(별도 커밋).
7. 회고: 새 retro 스킬로 한다.

## 영향 범위
`skills/retro/SKILL.md`, `skills/audit/SKILL.md`, `harness/roles/auditor.md`, `harness/roles/pl.md`(retrospector), `harness/models.yaml`, `harness/CHANGELOG.md`, `cli/src/commands/update.ts`, `cli/src/commands/install.ts`(훅 제안), `cli/src/lib/generate.ts`, `cli/src/lib/agents-md.ts`(실행 줄), `cli/src/lib/detect.ts`, `docs/design.md`·`design.ko.md`(§3-3, §3-4, §4-2, §6, §8, §9), README 양판, `.husky/`, 테스트.

## 제약
- reins는 작업 중에 불리지 않는다. 훅은 프로젝트 검사만 돌린다(0.3 원칙).
- 감사자는 네트워크 없는 실행을 유지한다.
- 생성 파일(`.agents/harness/`, `.agents/skills/`, `.claude/…`, `reins:` 블록)은 손으로 고치지 않는다. 이 저장소에는 stable 뒤 `reins update`로 들어온다.
- 설계와 달라지면 설계서 양판을 같은 커밋에서 먼저 고친다.
- 출시물은 TypeScript(R65).

## 열린 질문
1. **커밋별 검사 출력의 범위(W-4).** 로드맵은 "훅 출력을 남기는 방법 등"까지만 정했다. PM 안은 아래 "에이전트가 정한 것" 3·4번이다: reins가 설치하는 훅 줄(`install --hooks`)이 출력을 남기게 하고, 이 저장소의 `.husky/`도 같은 방식으로 고친다. 이 저장소의 훅만 고치고 적용 저장소용은 0.4로 미루는 안도 있다. 이대로 가도 되는가?

## 질의서 기록
- "어. 그럼 0.3.1로 예약하자"(사용자 2026-11-10): retro 스킬의 knowledge 후보 제안.
- "C. 개선안 … ok"(사용자 2026-11-10, 0.3 회고): settings.json 합치기, auditor 읽기 전용, 커밋별 게이트 출력, 모델 목록 갱신.
- "다음 버전 아이디어로 적어놔"(사용자 2026-11-10, rc.3 감사 지적 2): 커밋별 게이트 출력.
- "C-2. 이해함. 그러면 0.2.0 이하일 때라고 해줘야지. 인용할게."(사용자 2026-11-10): `AGENTS.previous.md` 머리 경고는 0.2.0 이하 이전일 때.
- "0.3.1 준비"(사용자 2026-11-10): 이 intent.

### 에이전트가 정한 것
| # | 정한 것 | 대안 | 이유 |
|---|---|---|---|
| 1 | 여섯 항목을 intent 하나(021)로 | 항목마다 intent | 모두 0.3 회고에서 나온 작은 보완이고 한 버전으로 함께 나간다. 되돌리는 단위는 작업 단위(W-n)로 나눈다 |
| 2 | settings.json은 reins 소유 부분(금지선에서 만드는 `permissions.deny`, `$schema`)만 고치고 나머지 키·항목은 보존 | 파일 전체를 사용자 것으로 두고 reins는 제안만 | deny 규칙은 금지선의 생성물이라 update로 따라가야 한다. 세부(사용자가 deny에 더한 줄의 구분 방법)는 spec에서 |
| 3 | 검사 출력은 훅이 로컬 파일로 남긴다(`.loctx/reports/` 아래, 커밋되지 않음). pre-commit 시점에는 커밋 SHA가 없으므로 대응 키는 spec에서 정한다(후보: 트리 해시 `git write-tree`) | CI 기록만으로 충분하다고 봄 / 커밋 메시지 트레일러에 결과를 적음 | CI는 PR head만 돌아 커밋별 통과를 보여 주지 못한다. 트레일러는 에이전트가 쓰는 주장이지 출력 원본이 아니다 |
| 4 | W-4는 `install --hooks`가 넣는 훅 줄과 이 저장소의 `.husky/` 둘 다 | 이 저장소만 | 감사가 필수인 모든 적용 저장소에서 같은 "확인 불가"가 난다. 열린 질문 1 |
| 5 | 감사 기록 파일은 PM이 쓴다. 감사자는 판정 본문을 출력으로 돌려준다 | 감사자에게 `.agents/audit/`만 쓰게 허용 | 벤더 CLI의 샌드박스는 경로 단위 쓰기 허용이 벤더마다 다르다. 읽기 전용이 어디서나 같다 |

## 하지 않을 것
- 0.4(적용)의 일: 다른 저장소에 설치·이전.
- 훅이나 스킬에서 reins를 부르는 것, 검사 출력을 세거나 판정하는 CLI.
- 감사자에게 네트워크·쓰기 권한을 여는 것.
- PC 전체 기본값.
- knowledge 승격의 자동화(제안까지만, 승격은 사용자가 받아들일 때).
