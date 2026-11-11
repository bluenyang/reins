---
id: "021"
slug: retro-knowledge-and-upkeep
version: "0.3.1"
status: approved
origin: user
approvals:
  - { role: user, by: BlueNyang, at: 2026-11-10, words: "승인", rev: 5dc135a }
  - { role: user, by: BlueNyang, at: 2026-11-11, words: "승인", rev: 6713615 }
waivers:
  - { step: "local roadmap, public roadmap and spec before the commit of W-10 (the e2e test fix was committed first, because the commit hook failed on that test)", words: "그렇게 해라", at: 2026-11-11, scope: once, recorded: "2026-11-11, after the 0.3.1 audit (finding 1) — the user: \"그래. 그렇게 기록해라.\"; it does not cover the review of W-10, which was made after the merge" }
  - { step: "PL and Advisor opinions on the remedies of the first 0.3.1 audit", words: "해결책이 문제 없는 것 같으면 패스. 애매하면 받아.", at: 2026-11-11, scope: once, recorded: "2026-11-11, after the supplementary audit (finding A2) — the user: \"A2. 응. 그렇게 해\"; the PM judged the remedies to be the auditor's own proposals with nothing left to weigh; it covers those remedies only" }
supersedes: null
---
## 문제
0.3.0을 내고 회고하면서 여섯 가지가 남았고, 준비 중에 둘(대체 모델, 검사 다시 찾기)을 더했다. 검사 다시 찾기는 첫 승인(개정 `5dc135a`) 뒤 2026-11-11에 더했고, 그 개정(`6713615`)을 다시 승인받았다. 모두 사용자가 0.3.1로 정했다(`.loctx/ROADMAP.local.md` "0.3.1 예약", `docs/ROADMAP.md` "0.3.1 — planned").

- **회고가 knowledge 후보를 내지 않는다.** 설계 §8은 "retrospector나 PM이 history·감사에서 반복된 결정·실패를 찾아 제안"한다고 적는데, `retro` 스킬 ②는 AGENTS.md·스킬·하네스 개선안만 말한다. 0.2.0은 회고 없이 지나갔고 0.3 동안 knowledge 승격이 없었다(사용자 "회고 하면서 주요한 결정은 knowledge 승격 하고 있는거야?").
- **`.claude/settings.json`에 허가 한 줄만 더해도 update가 건너뛴다.** 생성물을 통째 해시로 비교해서 "손으로 고침"으로 보고, `--force`면 사용자가 넣은 허가(allow 등)가 사라진다. 이 저장소에서 확인했다(`3b2709d` 뒤).
- **감사자 실행 줄이 쓰기 가능이다.** 위임 표가 auditor의 실행 줄을 `codex exec … -s workspace-write`로 낸다(실행 줄의 쓰기 여부는 `agents-md.ts`의 군 목록에서 나오고, auditor 역할 파일도 `tools.write: true`다). 설계 §3-3과 실제 운영은 읽기 전용·오프라인 실행이고, 감사 기록은 PM이 받아 커밋해 왔다.
- **커밋별 검사 출력이 남지 않는다.** 훅이 `pnpm check`를 돌리지만 출력을 남기지 않아, 0.3.0 감사가 네 번 "커밋별 통과 확인 불가"로 적었다(rc.3 감사 지적 2).
- **알려진 모델 목록이 낡았다.** `harness/models.yaml`, `cli/src/lib/detect.ts`의 `CONFIRMED_MODELS`, 설계서 예시에 `claude-fable-5-2`, `gpt-6-luna`, `gpt-6-sol`이 없다.
- **`AGENTS.previous.md`에 옛 reins 명령이 그대로 남는다.** 0.2.0 이하 설치를 update로 옮기면 옛 AGENTS.md가 그대로 복사되어 `reins status`·`reins check` 줄이 남는다. "참고 자료, 지침 아님"은 AGENTS.md의 재구성 표시와 `onboard` 스킬에만 적혀 있고 사본 자체에는 없다.
- **대체 모델을 적을 곳이 없다.** bindings 2판은 `fallback` 키를 뺐다(설계 §5 "실행 중 해석이 필요한 키는 없다"; reins가 작업 중에 불리지 않아 대신 골라 줄 주체가 없음). 그래서 역할의 모델 호출이 안 되면(한도, CLI 오류, 모델 없음) 정해진 동작이 없고 PM이 멈추고 묻는다.
- **`gates.yaml`을 프로젝트 변화에 맞출 방법이 없다.** `config gates`는 하위 디렉터리 제안을 보여 주고 `--add`로 덧붙이기만 한다. 루트 검사를 다시 찾지 않고, 적힌 검사의 명령이 바뀌었거나 출처가 사라진 것을 알려 주지 않으며, `config` 화면에는 검사 항목이 없다. 검사 스크립트(커밋별 검사 출력)가 `gates.yaml`을 따라가게 되므로 훅이 낡은 검사를 돌릴 수 있다.

## 바라는 결과
- **retro 스킬.** ②에 "history·감사에서 반복된 결정·실패를 knowledge 후보로 제안한다"가 들어가고, ③의 승격 절차(`approved: {by, at, words}`)와 이어진다. retrospector 역할 문장과 설계 §3-4·§8이 같은 말을 한다.
- **settings.json 합치기.** `update`(와 생성물을 다시 만드는 `config`)가 `.claude/settings.json`에서 reins가 소유한 부분만 고치고 사용자 항목은 남긴다. 사용자 항목이 있다는 이유로 건너뛰지 않고, `--force`로도 사용자 항목은 사라지지 않는다. 유효한 JSON이 아니면 지금처럼 손대지 않고 알린다.
- **감사자 읽기 전용.** 위임 표(팀·개인)의 auditor 실행 줄이 읽기 전용이다. `audit` 스킬·auditor 역할·설계 §3-3이 "감사자는 판정을 돌려주고, PM이 `.agents/audit/<version>.md`를 쓰고 커밋한다"로 맞는다.
- **커밋별 검사 출력.** 프로젝트 안의 셸 스크립트 하나가 `gates.yaml`의 검사를 돌리고, 출력을 화면과 로컬 파일에 내며, 검사의 종료 코드를 그대로 돌려준다. 어느 훅 도구든 그 스크립트를 부르는 한 줄을 쓴다: husky는 `install`이 확인받고 넣고, lefthook·pre-commit은 지금처럼 한 줄을 제안하고, 훅 도구를 나중에 정하면 그때 PM이 넣는다(그 줄은 `onboard` 스킬에 적는다). 이 저장소의 `.husky/`도 같은 방식으로 바꾼다. 감사가 커밋과 그 출력을 대응시킬 수 있다. `audit` 스킬과 설계 §3-3의 "읽는 것"에 들어가고, 수명(회고 뒤 삭제)이 정해진다. 훅은 프로젝트 검사만 돌리고 reins를 부르지 않는다.
- **모델 목록.** `models.yaml`·`CONFIRMED_MODELS`·설계서 예시가 구현 시점에 다시 확인한 목록과 맞는다.
- **previous 머리 경고.** 0.2.0 이하 설치를 update로 옮길 때 만드는 `.agents/AGENTS.previous.md` 머리에 "0.2.0 이하의 지시 사본 — 여기 적힌 reins 명령(`reins status`·`reins check` 등)은 0.3에 없으니 실행하지 말 것"이 붙는다.
- **대체 모델(fallback).** `bindings.yaml`과 `bindings.local.yaml`에서 역할(군 또는 상세 역할)에 대체 모델을 적을 수 있다. `config`가 쓸 때 위임 표(AGENTS.md 블록과 `.loctx/delegation.local.md`)의 그 행에 대체 실행 줄을 함께 적고, 위임 절에 "첫 실행 줄로 호출이 안 되면 대체 줄을 쓰고, 썼다는 것을 보고에 적는다"가 들어간다. 작업 중에 reins가 해석하는 것은 없다. 설계 §5의 "`fallback` 키 없음"을 이에 맞게 고친다. 0.2.0 이하 설정의 `fallback`을 옮길 때 버리던 동작도 다시 정한다.
- **검사 다시 찾기.** `config gates --refresh`가 설치 때와 같은 탐색을 다시 돌려 지금 `gates.yaml`과의 차이를 세 가지로 보여 준다: 새로 찾은 검사, 명령이 달라진 검사, 출처가 사라진 검사. 사용자가 고른 것만 반영하고, 손으로 넣은 검사는 건드리지 않으며, 자동으로 덮어쓰지 않는다. 반영하면 검사 스크립트도 다시 만들어지고 훅 줄은 그대로다. `config` 화면에 검사 항목이 생겨 지금 설정을 보고 같은 다시 찾기를 할 수 있다.
- 설계서 양판, README 양판(해당되면), `harness/CHANGELOG.md`가 바뀐 동작과 맞는다.

## 계획
1. spec: 승인되면 `spec.md`에 S-n, 작업 단위, V-n을 쓰고 plan-reviewer 검토 뒤 요약에 진행/수정을 받는다. 작업 단위 초안(각각 따로 되돌릴 수 있는 단위):
   - W-1 retro 스킬의 knowledge 후보 제안(+ retrospector 역할, 설계 §3-4·§8)
   - W-2 `.claude/settings.json` 합치기(+ 설계 §6, 테스트)
   - W-3 auditor 읽기 전용(+ `audit` 스킬, 역할, 설계 §3-3, 테스트)
   - W-4 커밋별 검사 출력(+ install의 훅 제안, 이 저장소의 `.husky/`, `audit` 스킬, 설계 §3-3·§4-2)
   - W-5 모델 목록 갱신
   - W-6 `AGENTS.previous.md` 머리 경고
   - W-7 대체 모델: bindings 스키마, `config`(플래그와 화면), 위임 표 렌더러, 설계 §5·§9, 테스트
   - W-10 e2e 테스트 수정(준비 중 발견한 안정화, 가장 먼저 커밋)
   - W-11 실행 줄의 기본 명령 이름(리뷰에서 나온 안정화)
   - W-9 검사 다시 찾기: `config gates --refresh`, 화면의 검사 항목, 설계 §9, 테스트 (W-8은 릴리스 뒤 이 저장소의 훅)
2. 구현: 브랜치 `feat/retro-knowledge-upkeep`. 설계서 변경은 해당 단위의 커밋에 함께 넣는다.
3. 리뷰: GPT-6.1 Sol(읽기 전용, diff만).
4. 테스트 → 머지: PR 본문에 검사 로그 경로와 마지막 출력, CI, 머지는 사용자 지시("PR #N 머지해").
5. 감사: GPT-6 Astra 새 실행. PM이 PR·CI 기록을 `.loctx/reports/0.3.1/`에 모아 넘긴다.
6. 릴리스: 0.3.1-rc.1 → 사용자 확인 → stable은 사용자 지시. 그 뒤 이 저장소를 `reins update`로 0.3.1 하네스로 옮긴다(별도 커밋).
7. 회고: 새 retro 스킬로 한다.

## 영향 범위
`skills/retro/SKILL.md`, `skills/audit/SKILL.md`, `harness/roles/auditor.md`, `harness/roles/pl.md`(retrospector), `skills/onboard/SKILL.md`, 검사 스크립트(새 파일, 위치는 spec), `harness/schemas/bindings.schema.json`, `harness/templates/agents-md-blocks.md`, `cli/src/lib/bindings.ts`, `cli/src/commands/configure.ts`, `cli/src/commands/config.ts`(화면), `cli/src/reins.ts`, `cli/src/lib/local-delegation.ts`, `harness/models.yaml`, `harness/CHANGELOG.md`, `cli/src/commands/update.ts`, `cli/src/commands/install.ts`(훅 제안), `cli/src/lib/generate.ts`, `cli/src/lib/agents-md.ts`(실행 줄), `cli/src/lib/detect.ts`, `docs/design.md`·`design.ko.md`(§3-3, §3-4, §4-2, §5, §6, §8, §9), README 양판, `.husky/`, 테스트.

## 제약
- reins는 작업 중에 불리지 않는다. 훅은 프로젝트 검사만 돌린다(0.3 원칙).
- 감사자는 네트워크 없는 실행을 유지한다.
- 생성 파일(`.agents/harness/`, `.agents/skills/`, `.claude/…`, `reins:` 블록)은 손으로 고치지 않는다. 이 저장소에는 stable 뒤 `reins update`로 들어온다.
- 설계와 달라지면 설계서 양판을 같은 커밋에서 먼저 고친다.
- 출시물은 TypeScript(R65).

## 열린 질문
—

## 질의서 기록
- "어. 그럼 0.3.1로 예약하자"(사용자 2026-11-10): retro 스킬의 knowledge 후보 제안.
- "C. 개선안 … ok"(사용자 2026-11-10, 0.3 회고): settings.json 합치기, auditor 읽기 전용, 커밋별 게이트 출력, 모델 목록 갱신.
- "다음 버전 아이디어로 적어놔"(사용자 2026-11-10, rc.3 감사 지적 2): 커밋별 게이트 출력.
- "C-2. 이해함. 그러면 0.2.0 이하일 때라고 해줘야지. 인용할게."(사용자 2026-11-10): `AGENTS.previous.md` 머리 경고는 0.2.0 이하 이전일 때.
- "0.3.1 준비"(사용자 2026-11-10): 이 intent.
- "안 A로 가자. 이해했어."(사용자 2026-11-10): 커밋별 검사 출력은 설치되는 훅 줄과 이 저장소의 훅 둘 다. 대안 (B) 이 저장소만 고치고 적용 저장소용은 0.4로 — 채택하지 않음.
- "현재는 install 이후에 husky나 lefthook을 하면 나중에 설정해야 하는데, 지금 이거 자체는 맞는 방향으로 보임"(사용자 2026-11-10): 훅 도구를 나중에 정하면 그때 설정하는 방식은 유지.
- "fallback은 0.3.1에 포함해 보자"(사용자 2026-11-10): 대체 모델. PM이 설명한 방식(설정에 적으면 `config`가 위임 표에 대체 실행 줄을 미리 적고, 실패 때 PM이 따름)에 대한 답.
- "맞다. config에 gate재감지? 같은 거도 필요할 듯"(사용자 2026-11-10) → "0.3.1에서 `config gates --refresh`를 넣고, TUI에서도 gate 쪽 설정을 볼 수 있게"(사용자 2026-11-11): 검사 다시 찾기. PM이 낸 모양(차이를 보여 주고 고른 것만 반영)에 "ㅇㅇ".
- "응. 항상 머지"(사용자 2026-11-11): reins가 만든 적 없는 기존 `.claude/settings.json`에도 합쳐 쓴다(spec S-5).
- "그렇게 해"(사용자 2026-11-11): 이 저장소의 훅 전환은 stable 뒤 자기 업데이트 다음(spec W-8). 0.3.1 자신의 감사에는 커밋별 로그가 없다.
- "커밋 해시를 꼭 이용해야 해? 다르게 할 수 없어? 애초에 감사할 때만 쓰잖아"(사용자 2026-11-11): rebase로 다시 만든 커밋의 로그 문제에 대한 되물음 — spec S-10의 그 부분은 답을 받아 고친다.
- "ㅇㅇ"(사용자 2026-11-11): 위 되물음에 PM이 낸 새 안 — 평소엔 훅 로그만 남기고, 로그가 없는 커밋은 감사 전에 PM이 그 커밋에서 검사를 돌려 채운다. `git rebase -x` 안은 버림.
- "그렇게 해라"(사용자 2026-11-11): e2e 테스트 수정을 작업 단위 W-10으로 spec에 더하고 먼저 커밋. node 폴더에 전역 설치된 reins 때문에 `harness-only` 테스트가 실패해 커밋 훅이 막힌 것을 PM이 보고한 데 대한 답.
- "CLI 이름 fix 제안: 넣어."(사용자 2026-11-11): W-7 리뷰에서 미룬 지적 — 설정에 벤더의 CLI가 없으면 위임 표가 벤더 이름을 명령으로 쓰던 것을 그 벤더의 기본 명령으로. spec W-11로 PR #34에 더함.
- 감사 뒤(2026-11-11): "1. 그렇게 해."(안정화 W-12·W-13을 0.3.1에), "그래. 그렇게 기록해라."(W-10 선행 커밋의 waiver 사후 기록), "ㅇㅇ. 진행."(W-11 요약 확인), "수용해."(감사 비판 3·6), "해결책이 문제 없는 것 같으면 패스. 애매하면 받아."(위원회 의견), "claude-fable-5-2는 어제 공개된 모델이라 확인이 안된 것일 수도 있어. 나는 지금 잘 되는 것 같은데?"(모델 목록 유지). 처리 표는 `.agents/audit/0.3.1.md`의 사용자 처리 절.
- 추가 감사 뒤(2026-11-11): "A1. 그렇게 해."(W-12·W-13 요약과 changelog 예외 확인), "선택은 가능(알려진 모델)한데 확인 목록에서는 빼던지."(`claude-fable-5-2`를 `CONFIRMED_MODELS`에서 뺌 — W-14), "A2. 응. 그렇게 해"(위원회 생략 waiver), "A6. 수용.", "감사는 패스하고"(감사를 더 받지 않음). 처리 표는 `.agents/audit/0.3.1.md`의 "사용자 처리 (추가 감사)".

### 에이전트가 정한 것
| # | 정한 것 | 대안 | 이유 |
|---|---|---|---|
| 1 | 여섯 항목을 intent 하나(021)로 | 항목마다 intent | 모두 0.3 회고에서 나온 작은 보완이고 한 버전으로 함께 나간다. 되돌리는 단위는 작업 단위(W-n)로 나눈다 |
| 2 | settings.json은 reins 소유 부분(금지선에서 만드는 `permissions.deny`, `$schema`)만 고치고 나머지 키·항목은 보존 | 파일 전체를 사용자 것으로 두고 reins는 제안만 | deny 규칙은 금지선의 생성물이라 update로 따라가야 한다. 세부(사용자가 deny에 더한 줄의 구분 방법)는 spec에서 |
| 3 | 검사 출력은 훅이 로컬 파일로 남긴다(`.loctx/reports/` 아래, 커밋되지 않음). pre-commit 시점에는 커밋 SHA가 없으므로 대응 키는 spec에서 정한다(후보: 트리 해시 `git write-tree`) | CI 기록만으로 충분하다고 봄 / 커밋 메시지 트레일러에 결과를 적음 | CI는 PR head만 돌아 커밋별 통과를 보여 주지 못한다. 트레일러는 에이전트가 쓰는 주장이지 출력 원본이 아니다 |
| 4 | 검사 실행과 출력 저장은 프로젝트 안의 셸 스크립트 하나에 두고 훅 도구는 그것을 부른다 | 도구마다 `검사 2>&1 \| tee 파일`을 직접 씀 | `tee`가 실패 코드를 가리는 문제를 도구마다 따로 풀지 않아도 되고, 넣는 줄이 어느 도구든 같다. Windows의 lefthook 실행은 spec에서 확인 |
| 5 | 감사 기록 파일은 PM이 쓴다. 감사자는 판정 본문을 출력으로 돌려준다 | 감사자에게 `.agents/audit/`만 쓰게 허용 | 벤더 CLI의 샌드박스는 경로 단위 쓰기 허용이 벤더마다 다르다. 읽기 전용이 어디서나 같다 |
| 6 | 대체 모델은 모델과 같은 상속(상세 역할 > 군)으로 적고, 팀·개인 설정 모두에서 쓴다 | 벤더 단위 대체("openai가 안 되면 claude") | 역할마다 맞는 대체가 다르다(리뷰는 구현과 다른 모델이어야 함). 세부 형식은 spec에서 |
| 7 | 대체 줄을 썼으면 PM이 보고와 기록에 적는다 | 조용히 대체 | 감사·리뷰가 어느 모델이 했는지 알아야 한다 |

## 하지 않을 것
- 0.4(적용)의 일: 다른 저장소에 설치·이전.
- 훅이나 스킬에서 reins를 부르는 것, 검사 출력을 세거나 판정하는 CLI.
- 감사자에게 네트워크·쓰기 권한을 여는 것.
- PC 전체 기본값.
- 작업 중에 reins가 대체 모델을 고르거나 호출하는 것, 실패 감지·재시도 장치.
- 화면에서 검사 명령을 직접 고쳐 쓰는 편집기(보기와 다시 찾기까지).
- knowledge 승격의 자동화(제안까지만, 승격은 사용자가 받아들일 때).
