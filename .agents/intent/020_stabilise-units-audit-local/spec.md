---
intent: "020"
status: draft
approvals: []
summary_for_user: |
  W-1(ST-4): 개인 설정 때문에 실제 위임이 팀 표와 달라지면, reins가 `.loctx/delegation.local.md`에 그 사람의 위임 표를 만든다(같아지면 지운다). AGENTS.md 위임 절은 "이 파일이 있으면 이것을 따르라"고 가리킨다. 위임 블록을 쓰는 명령(config 두 범위, install, update)이 이 파일도 맞춘다.
  W-2(ST-6): implement 스킬·AGENTS.md 흐름 블록·감사 판정에 "작업 단위 하나 = 커밋 하나, 묶기·나누기·순서 변경은 먼저 spec을 고치고 승인"을 넣는다. 차단은 없다. 이 저장소 AGENTS.md에도 같은 줄.
  W-3(ST-7): 감사 전에 PM이 PR·CI 기록을 원본 그대로 `.loctx/reports/<version>/`에 모아 넘긴다. 감사자는 네트워크를 쓰지 않고, 없는 기록은 "확인 불가"로 두고 PM에게 요청한다.
  단위마다 커밋 하나, 설계서 양판은 그 단위의 커밋에 함께. 검증 V-1~V-4.
---
## 요구 해석
intent 020의 "바라는 결과"를 아래로 옮긴다. 각 줄 끝의 ← 는 intent의 근거다.

### ST-4 로컬 위임 표
- S-1 **언제 있나.** 이 사람의 실제 설정(팀 `bindings.yaml` + `.loctx/bindings.local.yaml`)으로 그린 위임 절이 팀 설정으로 그린 위임 절과 다를 때만 `.loctx/delegation.local.md`가 있다. 같아지거나 개인 설정 파일이 없으면 지운다. 비교는 그린 결과(텍스트)로 한다 — 개인 파일에 팀과 같은 값만 있으면 파일을 만들지 않는다. ← "개인 설정이 팀 설정과 다르면", "같아지면 그 파일을 지운다"
- S-2 **누가 맞추나.** AGENTS.md 위임 블록을 쓰는 명령이 같은 때에 이 파일도 맞춘다: `config`(project·local 두 범위, TTY 화면과 플래그 모두), `install`, `update`. 작업 중에는 아무것도 이 파일을 쓰지 않는다. `config --local`은 지금처럼 팀 생성물(AGENTS.md 블록, `.claude/agents/rs-*`, `generated.yaml`)을 건드리지 않는다. ← "config --local이 쓸 때", "팀 생성물은 건드리지 않는다", 제약 "작업 중에 불리지 않는다"
- S-3 **내용.** 맨 위에 "reins가 만든 개인 위임 표(이 기계에서만, 손으로 고치지 말고 `reins config --local`로)"와 근거 파일 두 개를 적고, 그 아래는 팀 표와 같은 형식의 `## Delegation` 절이다(모드, 역할 표, 감사 줄). Claude 역할은 팀이 같은 이름·같은 모델의 `rs-*` 파일을 생성했으면 그 이름을, 아니면 "일반 서브에이전트(모델 `<model>`)에 `.agents/harness/roles/<group>.md`의 `<role>` 절을 넘겨"를 적는다. 다른 벤더 역할은 팀 표와 같은 실행 줄이다. ← "Claude 역할은 일반 서브에이전트 + 역할 파일", "다른 벤더 역할은 팀 표와 같은 실행 줄"
- S-4 **AGENTS.md가 가리킴.** 위임 블록의 마지막 줄 "If `.loctx/bindings.local.yaml` exists, it overrides this section for you."를 "If `.loctx/delegation.local.md` exists, follow it instead of this section (your personal settings; `reins config --local` writes it)."로 바꾼다. 레이아웃 블록의 `.loctx/` 목록에 `delegation.local.md`를 더한다. ← "AGENTS.md 위임 블록은 … 가리킨다"

### ST-6 작업 단위 ↔ 커밋
- S-5 `implement` 스킬: 커밋하기 전에 "이 커밋이 spec의 작업 단위 하나(W-n 또는 안정화 단위)이고 그 단위 전부인가"를 확인한다. 묶거나 나누거나 순서를 바꿔야 하면 구현을 멈추고, spec의 작업 단위를 바꾼 내용과 이유로 고쳐 요약에 진행/수정을 받은 뒤 진행한다. ⑥에 같은 정지 조건. ← "implement 스킬은 커밋하기 전에 확인"
- S-6 AGENTS.md 흐름 블록 4번 줄에 "Merging, splitting or reordering units needs the spec changed and approved first."를 더한다. 이 저장소의 손 관리 `AGENTS.md` 흐름 3번에도 같은 뜻을 적는다. ← "AGENTS.md 흐름 블록에 같은 규칙을 한 줄로"
- S-7 감사 판정(`audit` 스킬 ③, `auditor` 역할, 설계 §3-3): "커밋 ↔ 작업 단위 대응: 한 커밋이 여러 단위를 담거나, 한 단위가 승인 없이 나뉘거나, 순서가 승인 없이 바뀌면 위반"을 판정 항목으로 넣는다. ← "감사의 판정 항목에 넣는다"
- S-8 차단 장치(훅, commit-msg 검사)는 두지 않는다. ← "차단 장치는 두지 않는다(0.3 원칙)"

### ST-7 감사 입력에 PR·CI 기록
- S-9 `audit` 스킬 ②에 첫 단계를 더한다: 감사를 맡기기 전에 PM이 버전에 머지된 PR마다 PR 번호, 머지한 사람과 시각, 머지 커밋과 head SHA, CI 검사 이름·결과, PR 본문의 게이트 출력을 저장소 호스트의 CLI 출력 **원본 그대로**(예: `gh pr view <n> --json number,mergedBy,mergedAt,mergeCommit,headRefOid,body`, `gh pr checks <n>`) `.loctx/reports/<version>/` 아래 파일로 남기고, 그 경로들을 감사에 넘긴다. 요약하거나 고쳐 쓰지 않는다. ← "PM이 감사 전에 … 원본 그대로 모아"
- S-10 감사자는 네트워크 없는 실행을 유지한다. `auditor` 역할의 하지 않을 일에 "fetch from the network; records it lacks are \"cannot confirm\" and asked of the PM"를 더하고, "Reads"에 이 기록을 더한다. 설계 §3-3 "읽는 것"을 같게 고친다. ← "감사자는 네트워크 없는 실행을 유지한다", 하지 않을 것 "감사자에게 네트워크·gh 권한을 여는 것"
- S-11 수명: 이 기록은 `.loctx/reports/<version>/`의 다른 로그와 같다(회고 뒤 정리, 지우기 전 감사 기록에 요약). 설계 §4-2 표는 이미 이 폴더를 다루므로 행을 더하지 않는다.

### 설계서와 문서
- S-12 설계서 양판: §3-1(implement 행에 단위 규칙), §3-3(판정·읽는 것), §4-2 수명 표에 `.loctx/delegation.local.md`(만드는 쪽 `config`·`install`·`update`, 지우는 쪽 같은 명령 — 팀과 같아지거나 개인 설정이 없어질 때), §1 배치의 `.loctx/` 목록, §5 bindings 문단의 "위임 표에 '로컬 설정이 있으면 그것을 따른다'" 문장. 각 내용은 그 단위의 커밋에 넣는다. README 양판에 개인 설정 설명이 있으면 같이 고친다. ← "설계서 양판과 README가 바뀐 동작과 맞는다"

## 설계
- ST-4는 `cli/src/lib/agents-md.ts`의 `renderDelegation(doc)`에 선택 인자(로컬 표 여부, 팀이 만든 Claude 에이전트 이름·모델 목록)를 더해 같은 렌더러로 그린다. 파일 쓰기·지우기는 `syncLocalDelegation(root)` 하나(새 함수, `configure.ts` 또는 `lib/`)가 하고, `configureBindings`(두 범위)와 install·update의 블록 쓰기 뒤에 부른다. 팀 `rs-*` 목록은 `generateVendorFiles`가 만드는 이름과 같은 규칙(`claudeAgents`)으로 팀 설정에서 구한다.
- ST-6·ST-7은 문서(스킬·역할·템플릿·설계서)만 바뀐다. 블록 템플릿이 바뀌므로 생성된 AGENTS.md 블록 테스트의 기대값이 바뀐다.

## 작업 단위
- [ ] W-1 ST-4 로컬 위임 표(S-1~S-4, S-12의 §1·§4-2·§5): 렌더러·동기화 함수·호출 지점, 위임·레이아웃 블록 문장, 설계서 양판, README(있으면), 테스트.
- [ ] W-2 ST-6 작업 단위 ↔ 커밋(S-5~S-8, S-12의 §3-1·§3-3 판정): `skills/implement`, 흐름 블록, `skills/audit` ③, `harness/roles/auditor.md`, 이 저장소 `AGENTS.md`, 설계서 양판, 테스트 기대값.
- [ ] W-3 ST-7 감사 입력(S-9~S-11, S-12의 §3-3 읽는 것): `skills/audit` ②, `harness/roles/auditor.md`, 설계서 양판.

순서는 W-1 → W-2 → W-3. 단위마다 커밋 하나. W-2와 W-3은 같은 파일(`skills/audit`, `auditor.md`, §3-3)을 고치지만 다른 줄이라 나눠 커밋한다.

## 검증 기준
- V-1 로컬 위임 표: 표 기반 테스트 — (a) 개인 설정 없음 → 파일 없음 (b) `config --local`로 multi를 켬 → 파일이 생기고 그 표에 켠 역할과 실행 줄이 있으며, AGENTS.md·`rs-*`·`generated.yaml`은 바뀌지 않음 (c) 개인 파일이 팀과 같은 값만 가짐 → 파일 없음 (d) 개인 설정을 지우거나 팀을 개인과 같게 project로 바꿈 → 파일 삭제 (e) 팀에 없는 Claude 역할 → "일반 서브에이전트 + 역할 파일" 문장, 팀에 같은 이름·모델의 `rs-*`가 있으면 그 이름 (f) install·update 뒤에도 같은 규칙.
- V-2 생성물 불변식(019 V-1)이 로컬 표에도 성립: `.loctx/delegation.local.md`에 reins를 실행하는 줄이 없다(사람용 안내 `reins config --local`은 허용 형식). 기존 e2e에 이 파일을 넣는다.
- V-3 문서 대조: `skills/implement`(②·⑥), 흐름 블록, `skills/audit`(②·③), `auditor.md`, 설계서 양판 §3-1·§3-3·§4-2에 S-5~S-10의 문장이 있다(스킬·하네스 테스트에 검사 추가). 양판의 같은 절이 같은 내용이다.
- V-4 이번 구현 자체가 ST-6을 지킨다: W-1·W-2·W-3이 각각 커밋 하나이고, 각 커밋이 `pnpm check`를 통과한다(훅 출력). 감사(ST-7)에서 확인한다.

## 우려 표시
- 로컬 표가 있는 사람의 PM은 AGENTS.md의 표 대신 로컬 표를 따라야 한다. 이것은 문장 하나(S-4)에 기대므로, 에이전트가 놓치면 팀 표로 위임한다. 차단은 0.3 원칙상 두지 않는다.
- update가 `.loctx/`에 파일을 쓰게 된다(지금은 지우기만 함). 위임 블록과 같은 때에 맞추지 않으면 새 버전의 표 형식과 어긋나므로 이렇게 했다.

## 사용자에게 묻는 것
—

## 범위 밖
- PC 전체 기본값, 감사자의 네트워크·`gh` 권한, 과거 커밋 이력 재작성(intent 020 "하지 않을 것").
- 로컬용 `rs-*` 에이전트 파일 생성(intent 020 에이전트가 정한 것 2).
