---
intent: "021"
status: accepted
approvals:
  - { role: user, by: BlueNyang, at: 2026-11-11, words: "진행", rev: 6713615, kind: summary }
  - { role: user, by: BlueNyang, at: 2026-11-11, words: "ㅇㅇ", rev: 6713615, kind: change, scope: "S-10 rewritten commits: no rebase -x; the PM fills missing logs before the audit (on the proposal shown in chat)" }
  - { role: user, by: BlueNyang, at: 2026-11-11, words: "그렇게 해라", rev: 6713615, kind: change, scope: "W-10 e2e test fix, committed first (on the proposal shown in chat)" }
summary_for_user: |
  작업 단위 아홉: W-1 retro 스킬이 반복된 결정·실패를 knowledge 후보로 제안 · W-2 `.claude/settings.json`은 reins가 만든 deny 규칙만 고치고 나머지는 보존(`--force`로도) · W-3 감사자 읽기 전용, 감사자가 돌려준 기록 전문을 PM이 고치지 않고 씀 · W-4 `.agents/harness/run-gates.sh`가 검사를 돌리고 `.loctx/reports/gates/<트리 해시>.log`에 남김, 훅 줄은 어느 도구든 한 줄 · W-5 모델 목록 · W-6 `AGENTS.previous.md` 머리 경고(update의 0.2.0 이하 이전만) · W-7 대체 모델(군·상세 역할에 하나, 위임 표 칸에 대체 실행 줄, `config bindings --fallback`과 화면) · W-9 `config gates --refresh [--apply]`와 화면의 gates 항목 · W-8 이 저장소 훅 전환(stable 뒤).
  intent와 다르게 옮긴 곳: 검사 스크립트는 실행 중에 gates.yaml을 읽지 않고 reins가 쓸 때 명령을 넣어 둔다(S-9). 대체가 없는 설정의 위임 표는 0.3.0과 글자까지 같다(S-17).
  검토(독립 검토 1회, 지적 10건 반영): rebase하면 트리 해시가 바뀜, 일부만 스테이징하면 로그가 그 커밋의 증거가 아님(`worktree: dirty`로 표시), 게이트 차이의 짝짓기 규칙, 모델 없는 군의 대체 거부 등.
  받은 답(2026-11-11): 기존 settings.json에도 합쳐 씀 · 이 저장소 훅 전환은 stable 뒤(0.3.1 감사에는 커밋별 로그 없음) · 로그가 없는 커밋은 감사 전에 PM이 그 커밋에서 검사를 돌려 채움(`rebase -x` 안은 버림) · W-10 e2e 테스트 수정을 더해 가장 먼저 커밋.
  검증 V-1~V-11: 표 기반 테스트, 임시 git 저장소에서 스크립트 실제 실행(Windows·macOS CI 포함), `pnpm check`, rc 뒤 배포본 smoke.
---
## 요구 해석
intent 021의 "바라는 결과"를 아래로 옮긴다. 각 줄 끝의 ← 는 intent의 근거다.

### 회고의 knowledge 후보 (W-1)
- S-1 `retro` 스킬 ②에 단계를 더한다: history와 감사 기록에서 **두 번 이상 나온 결정·실패**를 찾아 knowledge 후보로 제안한다. 후보마다 제목, 몇 번·어디서 나왔는지(파일 경로), 결정·이유·적용 초안을 적는다. 제안 전에 `.agents/knowledge/`에 같은 것이 있는지 찾고(`grep -l 'decisions:.*<keyword>'`), 있으면 새 후보 대신 그 항목의 갱신을 제안한다. 후보가 없으면 "없음"이라고 적는다(빠뜨린 것과 구분). 스킬 문장에는 `knowledge candidates`, `repeated`, `none`이 들어간다(V-1이 확인). 승격은 지금의 ③ 그대로다(사용자가 받아들인 것만, `approved: {by, at, words}`). ← "②에 … knowledge 후보로 제안한다가 들어가고, ③의 승격 절차와 이어진다"
- S-2 `harness/roles/pl.md`의 retrospector `does`에 knowledge 후보 제안을 더하고, 설계 §3-4 회고 문장에 같은 말을 넣는다. §8은 이미 그렇게 적혀 있으므로 스킬 이름만 가리키게 맞춘다. ← "retrospector 역할 문장과 설계 §3-4·§8이 같은 말을 한다"

### `.claude/settings.json` 합치기 (W-2)
- S-3 **reins가 소유하는 것**은 `permissions.deny` 안에서 reins가 금지선으로부터 만든 규칙들뿐이다. `$schema`는 없을 때만 넣는다. 그 밖의 모든 키와 항목(`permissions.allow`·`ask`, 사용자가 `deny`에 더한 줄, `hooks`, `env` …)은 사용자 것이고 순서까지 그대로 둔다. ← "reins가 소유한 부분만 고치고 사용자 항목은 남긴다", 에이전트가 정한 것 2
- S-4 **구분 방법.** reins가 마지막으로 쓴 deny 규칙 목록을 `.agents/harness/generated.yaml`에 적어 둔다(새 키, 기존 `files:` 해시는 그대로). 다시 만들 때: 지금 만드는 규칙은 넣고(이미 있으면 그대로), 지난번 목록에 있었는데 이제 만들지 않는 규칙은 빼고, 지난번 목록에 없는 줄은 사용자 것으로 보고 남긴다. 목록이 없는 설치(0.3.0 이하): 파일이 reins가 쓴 그대로면(해시 일치) 전부 reins 것으로 보고, 손댄 파일이면 합집합으로 합친다(빼지 않음). 새로 넣는 reins 규칙은 `deny` 끝에 붙인다. 사용자가 reins 규칙을 손으로 뺐으면 다음에 다시 들어간다(S-6의 드리프트). ← "세부(사용자가 deny에 더한 줄의 구분 방법)는 spec에서"
- S-5 **건너뛰지 않는다.** 이 파일은 "손으로 고침" 판정에서 빠진다: 사용자 항목이 있어도, reins가 만든 적 없는 기존 파일이어도 합쳐 쓴다. `--force`는 이 파일에 아무 차이도 없다(사용자 항목을 지우지 않음). 유효한 JSON이 아니거나 모양이 다르면(최상위나 `permissions`가 객체가 아님, `deny`가 배열이 아님) 쓰지 않고 그 이유를 알리며, 다른 생성물은 계속 쓴다. reins가 만든 적 없는 기존 파일에도 합쳐 쓴다(사용자 2026-11-11 "응. 항상 머지"): 설계 §6의 "만든 적 없는 파일은 둔다"에 이 파일을 예외로 적고, 더한 규칙을 출력에 보여 준다. `update`와 생성물을 다시 만드는 `config`·`install`이 같은 함수를 쓴다. ← "건너뛰지 않고, `--force`로도 사용자 항목은 사라지지 않는다. 유효한 JSON이 아니면 지금처럼 손대지 않고 알린다"
- S-6 **드리프트 판정.** 이 파일에서 사용자 항목을 바꾼 커밋은 드리프트가 아니다. reins가 만든 deny 규칙을 손으로 빼거나 고친 것만 드리프트다. 설계 §6, `audit` 스킬 ④, auditor 역할 문장에 이 예외를 적는다. ← "설계서 양판이 바뀐 동작과 맞는다"

### 감사자 읽기 전용 (W-3)
- S-7 실행 줄의 쓰기 여부는 지금 `agents-md.ts`에 따로 적힌 군 목록(`WRITES`: implementer, planner, auditor)에서 나오고, 역할 파일의 `tools.write`와는 따로 논다. 둘을 함께 고친다: auditor 역할의 `tools.write`를 false로, `WRITES`에서 auditor를 뺀다. 그러면 위임 표(팀·개인)의 다른 벤더 실행 줄이 읽기 전용(`-s read-only`, `--mode plan`)이 되고, Claude 감사자의 `rs-auditor` 파일에도 쓰기 도구가 없다. `WRITES`가 "역할 파일에서 `tools.write: true`인 역할이 있는 군"과 같다는 것을 테스트로 묶는다. ← "위임 표(팀·개인)의 auditor 실행 줄이 읽기 전용이다"
- S-8 **기록은 PM이 쓴다.** 감사자는 `.agents/harness/templates/audit.md` 형식의 기록 전문을 출력으로 돌려준다. PM은 그것을 **고치지 않고 그대로** `.agents/audit/<version>.md`에 쓰고, 사용자 결정(보완·수용)은 구분된 절로 덧붙인다. 감사자의 판정 문장을 PM이 바꾸거나 줄이는 것은 금지다. 대조할 수 있게 PM은 감사자의 출력 원본을 `.loctx/reports/<version>/`에 파일로 남긴다(회고 뒤 삭제). `audit` 스킬 ②의 5·6, auditor 역할(`does`와 본문), 설계 §3-3 "기록"을 고친다. 단일 모드의 새 실행도 같다. ← "감사자는 판정을 돌려주고, PM이 … 쓰고 커밋한다", 에이전트가 정한 것 5

### 커밋별 검사 출력 (W-4, W-8)
- S-9 **스크립트.** reins가 `.agents/harness/run-gates.sh`를 쓴다(POSIX sh). `gates.yaml`의 필수(optional 아님) 검사 명령이 순서대로 들어 있다. `install`과 `update`는 돌 때마다 지금의 `gates.yaml`로 다시 만들고(`update`는 `gates.yaml` 자체는 쓰지 않는다), `config gates`는 `gates.yaml`을 고칠 때 함께 다시 만든다. 다른 생성물처럼 `generated.yaml`에 해시를 적어 손 수정을 가린다(손댔으면 덮어쓰지 않고 알림, `--force`로 덮어씀). 하는 일: ① 대응 키를 구한다 ② 검사를 순서대로 돌려 출력을 화면과 로그 파일 양쪽에 낸다 ③ 첫 실패에서 멈추고 그 종료 코드를 돌려준다(모두 통과면 0). reins·npx를 부르지 않고 네트워크를 쓰지 않으며, 환경 변수(`GIT_INDEX_FILE` 등)를 바꾸지 않는다. 필수 검사가 하나도 없으면 스크립트를 만들지 않고(있던 것은 지움) 훅 줄도 제안하지 않는다(지금과 같음). ← "프로젝트 안의 셸 스크립트 하나가 `gates.yaml`의 검사를 돌리고 … 종료 코드를 그대로 돌려준다"
  - (PM 해석) "gates.yaml의 검사를 돌린다"를 스크립트가 실행 중에 YAML을 읽는 것이 아니라 **reins가 쓸 때 명령을 스크립트에 넣어 두는 것**으로 옮겼다. sh로 YAML을 읽는 것은 깨지기 쉽고, 이렇게 하면 훅 줄이 검사 목록과 무관하게 한 줄로 고정된다.
- S-10 **대응 키와 로그.** 로그는 `.loctx/reports/gates/<tree>.log`(커밋되지 않음, 폴더가 없으면 만든다). `<tree>`는 검사한 내용의 트리 해시다: pre-commit에서는 `git write-tree`(그 커밋의 임시 인덱스 기준이라 `commit -a`·`commit <경로>`에서도 그 커밋의 트리다 — 검토에서 실험으로 확인), 그 밖의 단계(`pre-push`, `audit`)에서는 `git rev-parse HEAD^{tree}`. 커밋의 트리는 `git rev-parse <commit>^{tree}`로 구하므로 감사자가 네트워크 없이 커밋 ↔ 로그를 잇는다. 실행마다 머리줄(시각, 단계, 명령, `worktree: clean|dirty`)과 출력, 마지막에 `exit: <code>`를 덧붙인다(같은 트리를 다시 돌리면 이어 붙임). `worktree`는 작업 트리가 그 트리와 같은가다(`git diff --quiet`, 그리고 git이 추적하지도 무시하지도 않는 파일이 없음; 일부만 스테이징했거나 `commit <경로>`면 dirty — 추적되지 않는 파일 조건은 W-4 리뷰에서 더함). 검사는 작업 트리에서 돌기 때문에 dirty인 실행은 그 트리의 증거가 아니다.
  - **로그가 없는 커밋은 감사 전에 채운다**(사용자 2026-11-11 "커밋 해시를 꼭 이용해야 해? 다르게 할 수 없어? 애초에 감사할 때만 쓰잖아" → 새 안에 "ㅇㅇ"). 커밋을 다시 만들면(로컬 rebase, base가 움직인 뒤의 rebase merge) 트리가 바뀌고 훅은 돌지 않는다. 평소에는 아무것도 더 하지 않는다(`git rebase -x`로 커밋마다 다시 돌리는 안은 버림). 커밋의 내용은 바뀌지 않으므로 통과 여부는 나중에 확인해도 같다: 감사를 맡기기 전에 PM이 버전의 커밋(기본 브랜치에 들어간 것)마다 그 트리의 로그에 `worktree: clean`·`exit: 0`인 실행이 있는지 보고, 없는 커밋만 깨끗한 작업 트리에서 그 커밋을 체크아웃해 `sh .agents/harness/run-gates.sh audit`을 돌린 뒤 원래 브랜치로 돌아온다. 의존성 준비(설치 등)는 프로젝트에 맞게 한다. 로그 머리줄의 단계가 `audit`이므로 커밋 때 남긴 것과 구분된다. 실패하면 고치지 않고 그대로 감사에 넘긴다. ← "감사가 커밋과 그 출력을 대응시킬 수 있다", 에이전트가 정한 것 3
- S-11 **훅 줄은 한 줄.** `sh .agents/harness/run-gates.sh pre-commit`(pre-push는 `pre-push`). husky: `install`이 확인받고 `# reins:begin hooks` 블록에 이 줄을 넣는다. `update`는 이미 있는 블록 가운데 본문이 이 한 줄이 아닌 것(0.3.0이 설치 당시의 검사 명령을 적어 둔 블록)을 이 한 줄로 바꾸고, 바꾸기 전 본문을 출력에 보여 준다(블록 안에 사용자가 더한 줄이 있었으면 거기서 보고 블록 밖으로 옮길 수 있게). 블록이 없는 husky에는 `update`가 넣지 않고 안내만 한다. 지금 코드의 "0.3 블록은 남긴다"(`update.ts`)를 이렇게 바꾸는 것이다. lefthook·pre-commit: 지금처럼 넣지 않고 그 도구 형식의 줄을 안내한다. 훅 도구 없음: 스크립트는 그래도 만들어 두고, `onboard` 스킬에 "훅 도구를 정하면 이 한 줄(`run-gates.sh pre-commit` / `pre-push`)을 넣는다"를 적는다. ← "어느 훅 도구든 그 스크립트를 부르는 한 줄", 사용자 "나중에 설정 … 맞는 방향"
- S-12 **감사와 수명.** `audit` 스킬 ②의 읽는 것, auditor 역할 "Reads", 설계 §3-3에 `.loctx/reports/gates/`와 대응 방법을 넣는다: `audit` 스킬 ②의 1에 S-10의 채우기를 PR·CI 기록 모으기와 함께 넣는다. 감사자는 버전의 커밋마다 그 트리의 로그에 `worktree: clean`이고 `exit: 0`인 실행이 있는가를 보고, 그것이 커밋 때(`pre-commit`·`pre-push`) 남긴 것인지 감사 전에 채운 것(`audit`)인지 적는다. 채운 뒤에도 로그가 없거나 dirty뿐이면 "확인 불가", `exit`가 0이 아니면 위반이다. 수명: `retro` 스킬 ⑤가 그 버전의 stable 태그 날짜 전에 마지막으로 쓰인 로그를 지운다(그 뒤 작업의 로그는 남김). 설계 §4-2 수명 표에 행을, §1 배치와 `.loctx/README`의 목록에 이 폴더를, §0의 "검사는 프로젝트 소유" 문장에 스크립트를 더한다. 스킬·역할 문장에는 `.loctx/reports/gates/`와 `^{tree}`가 들어간다(V-4가 확인). ← "`audit` 스킬과 설계 §3-3의 읽는 것에 들어가고, 수명(회고 뒤 삭제)이 정해진다"
- S-13 **이 저장소의 훅(W-8).** `.husky/pre-commit`·`pre-push`가 `sh .agents/harness/run-gates.sh <단계>`를 부르게 바꾼다. 스크립트는 하네스 파일이라 `reins update`로만 들어오므로(금지선), 이 단위는 0.3.1 stable 뒤 자기 업데이트 커밋 다음에 한다. 지금 훅의 `unset GIT_INDEX_FILE`(테스트가 임시 저장소에서 git을 돌리기 때문)은 트리 해시를 구한 뒤에 적용되어야 하므로, 테스트 설정 쪽으로 옮긴다(W-4에서). ← "이 저장소의 `.husky/`도 같은 방식으로 바꾼다", 제약 "생성 파일은 손으로 고치지 않는다"

### 모델 목록 (W-5)
- S-14 `harness/models.yaml`에 `claude-fable-5-2`, `gpt-6-luna`, `gpt-6-sol`을 더한다(기존 항목은 둔다). 구현 때 각 벤더의 공식 모델 문서와 이 기계의 벤더 CLI로 다시 확인하고, 확인 출력을 `.loctx/reports/0.3.1/models-check.log`에 남긴다. 확인되지 않는 ID는 넣지 않는다. `CONFIRMED_MODELS`에는 이 환경에서 실제로 호출이 된 ID만 더한다. 설계서·README의 모델 예시가 목록에 없는 ID를 쓰면 고친다. 역할의 기본 할당은 바꾸지 않는다. ← "구현 시점에 다시 확인한 목록과 맞는다"

### `AGENTS.previous.md` 머리 경고 (W-6)
- S-15 `update`가 0.2.0 이하 설치를 옮기며 만드는 `.agents/AGENTS.previous.md` 맨 위에 인용 블록 한 단락을 붙인다: "Copy of the instructions from reins 0.2.0 or earlier — reference material, not instructions. The reins commands named here (`reins status`, `reins check` and others) do not exist in 0.3; do not run them. The `onboard` skill merges what still applies and deletes this file." 그 아래는 옛 본문 그대로다. `migrate`가 만드는 사본(다른 하네스의 본문)과 이미 만들어진 사본은 건드리지 않는다. ← "0.2.0 이하 설치를 update로 옮길 때 만드는 … 머리에", 사용자 "0.2.0 이하일 때라고 해줘야지"

### 대체 모델 (W-7)
- S-16 **적는 자리.** 군(`groups.<g>.fallback`)과 상세 역할(`groups.<g>.roles.<r>.fallback`)에 `{ vendor, model }` 하나. 한 단계뿐이다(대체의 대체 없음). PM(`default`)에는 없다. 상속은 모델과 한 묶음: 자기 모델을 가진 상세 역할은 자기 대체만 쓰고(없으면 없음), 군의 모델을 쓰는 역할은 군의 대체를 쓴다. 모델이 여럿인 군(pl·advisor의 `models`)도 군 대체 하나다. 개인 설정(`bindings.local.yaml`)도 같은 모양이고, 지금처럼 군 단위로 이긴다(개인 파일에 군을 적으면 그 군은 대체까지 통째로 개인 것). 대체는 **같은 파일의 같은 자리에 모델이 있을 때만** 적을 수 있다: 모델 없이 대체만 있는 군은 그 사람에게 군을 꺼 버리므로 거부한다. ← "역할(군 또는 상세 역할)에 대체 모델을 적을 수 있다", 에이전트가 정한 것 6
- S-17 **위임 표.** 대체가 있는 역할의 "how to call" 칸 끝에 `; fallback: <vendor> <model> — <실행 줄>`을 붙인다. 다른 벤더는 지금과 같은 실행 줄 형식(쓰기 권한도 그 군과 같게), Claude는 "그 모델의 일반 서브에이전트에 역할 파일의 해당 절을 넘겨"다(대체용 `rs-*` 파일은 만들지 않음). 멀티 모드 안내 문장에 한 줄을 더한다: 역할의 호출을 **할 수 없을 때**(CLI 없음, 모델 거부, 한도 초과 — 답이 마음에 안 드는 것은 아님) 대체 줄을 한 번 쓰고, 썼다는 것과 이유를 사용자 보고와 그 단계의 기록에 적는다. 대체가 없거나 대체도 안 되면 멈추고 묻는다. 이 안내 문장은 대체가 하나라도 있을 때만 넣는다: 대체가 없는 설정의 위임 절은 0.3.0과 글자까지 같다. 감사 줄(`Audit: …`)은 두 모드 모두 모델 이름만 적으므로 대체가 있으면 `; fallback: <vendor> <model>`만 붙인다. AGENTS.md 블록과 `.loctx/delegation.local.md`가 같은 렌더러를 쓴다. ← "위임 표의 그 행에 대체 실행 줄을 함께 적고 … 보고에 적는다", 에이전트가 정한 것 7
- S-18 **설정 방법.** 플래그 `config bindings --fallback <군>[.<역할>]=<model|vendor:model|none>`(`--local` 가능). 자기 모델이 없는 군·상세 역할에 대체만 주면 거부하고 이유를 낸다. 대체가 본 모델과 같으면(모델이 여럿인 군은 목록의 어느 것과 같아도) 거부한다. 이 검사는 같은 호출의 `--set`·`--models`를 반영한 최종 내용에 하고, 스키마 검증을 건너뛰는 `--local`에도 한다. `harness/CHANGELOG.md`에 "`fallback`을 적은 `bindings.yaml`은 0.3.0의 `config`가 거부하므로 팀원도 0.3.1로 올린다"를 적는다. 화면(`models and roles`)에서는 모델을 고른 뒤 "fallback (optional)"을 고르게 한다. ← "`config`(플래그와 화면)"
- S-19 **0.x 이전.** 0.2.0 이하 `bindings.yaml`의 `fallback`은 옮겨 갈 자리(군 또는 상세 역할)의 모델과 함께 옮긴다. 읽을 수 없는 모양이면 지금처럼 버리고 알린다. `parallel`은 계속 버린다. ← "0.2.0 이하 설정의 `fallback`을 옮길 때 버리던 동작도 다시 정한다"
- S-20 **설계 §5.** "실행 중 해석이 필요한 키(`escalation`, `limits`, `parallel`, `fallback`)는 없다"를 "… (`escalation`, `limits`, `parallel`)는 없다. `fallback`은 reins가 실행 중에 해석하지 않는다: `config`가 쓸 때 위임 표의 대체 실행 줄로 풀어 적고, 호출이 안 될 때 PM이 그 줄을 따른다"로 고친다. §9 `config` 설명에 플래그를 더한다. ← "설계 §5의 … 고친다"

### 검사 다시 찾기 (W-9)
- S-22 **`config gates --refresh`.** 설치 때와 같은 탐색(루트와 하위 디렉터리)을 다시 돌려 `gates.yaml`과 비교한다. 짝짓기는 차례로: ① 출처(`from`)와 명령이 모두 같으면 같은 검사(차이 없음) ② 남은 것 중 출처와 이름이 같으면 **changed**(명령이 달라짐) ③ 남은 것 중 이름이 같으면 **changed**(출처와 명령이 달라짐 — 예: 루트 `check`가 다른 스크립트를 가리키게 됨) ④ 남은 탐색 결과는 **new**, 남은 파일 검사 중 `from`이 있는 것은 **gone**(탐색이 더는 제안하지 않음 — 출처가 사라졌거나 다른 검사에 포함됨; 이유를 함께 보여 줌). `from`이 없는 검사(손으로 넣은 것)는 "yours"로 표시만 하고 건드리지 않는다. new의 이름은 파일에 있는 이름과 겹치지 않게 붙인다. ← "설치 때와 같은 탐색을 다시 돌려 … 세 가지로 보여 준다", "손으로 넣은 검사는 건드리지 않으며"
- S-23 **고른 것만 반영.** 터미널(TTY)에서는 차이 목록에서 여러 개를 골라 확인한다. 비대화형에서는 `--refresh`만 주면 차이만 내고 아무것도 쓰지 않으며(종료 0), `--refresh --apply <이름…|all>`로 고른 것을 반영한다(이름은 출력에 나온 이름; 없는 이름이 하나라도 있으면 아무것도 쓰지 않고 종료 1). 반영: new는 `gates`와 `order` 끝에 더하고, changed는 명령과 출처를 바꾸고(이름과 순서는 그대로), gone은 `gates`와 `order`에서 뺀다. 파일의 주석과 다른 키는 그대로 둔다. 차이가 없으면 "up to date"를 내고 쓰지 않는다. 기존 `--add`는 그대로다. ← "사용자가 고른 것만 반영하고 … 자동으로 덮어쓰지 않는다"
- S-24 **스크립트.** 반영으로 `gates.yaml`이 바뀌면 검사 스크립트(S-9)를 같은 때에 다시 만든다. 훅 줄은 그대로다. ← "반영하면 검사 스크립트도 다시 만들어지고 훅 줄은 그대로다"
- S-25 **화면.** `config` 화면에 `gates` 항목을 더한다: 지금 검사(이름, 명령, 출처, 순서, optional 여부)와 감지한 훅 도구를 보여 주고, "refresh"(S-22·S-23의 고르기)와 지금 있는 하위 디렉터리 제안 더하기를 고를 수 있다. 명령을 직접 고쳐 쓰는 편집은 없다. ← "`config` 화면에 검사 항목이 생겨 지금 설정을 보고 같은 다시 찾기를 할 수 있다"
- S-26 설계 §9 `config` 설명과 README 양판에 `gates`(화면 항목, `--refresh`, `--apply`)를 더한다.

### e2e 테스트 수정 (W-10, 준비 중 발견한 안정화)
- S-27 `test/e2e/harness-only.test.ts`의 "reins가 PATH에 없어도 설치된 훅으로 커밋된다" 테스트는 좁힌 PATH에 node가 있는 폴더를 통째로 넣는다. 그 폴더에 전역 설치한 reins가 있으면(nvm 등, AGENTS.md가 안내하는 설치 방법) "reins가 없다"는 전제가 깨져 실패한다. 빈 임시 폴더에 node와 npm만 연결해 PATH에 넣는다. 제품 코드는 바뀌지 않는다. 2026-11-11 승인 기록을 커밋하다 훅에서 발견했고, 훅을 건너뛰지 않으려면 이 수정이 먼저 커밋되어야 해서 이 spec 변경의 커밋보다 앞선다(사용자 "그렇게 해라"). ← 사용자 2026-11-11

### 문서
- S-21 설계서 양판은 각 단위의 커밋에 함께 넣는다. `harness/CHANGELOG.md`의 0.3.1 절에 단위마다 한 줄. README 양판은 해당 문장이 있으면 그 단위에서 고친다. ← "설계서 양판, README 양판, `harness/CHANGELOG.md`가 바뀐 동작과 맞는다"

## 설계
- **W-2**: `Generated.writes`의 settings 항목에 "합치는 파일" 표시를 두고, `writeGenerated`가 이 항목만 다른 길로 처리한다: 디스크의 JSON을 읽어 S-3·S-4대로 합친 결과를 쓰고, 결과의 해시와 reins가 쓴 deny 목록을 manifest에 적는다. manifest 스키마 이름(`reins/generated@1`)은 그대로 두고 키만 더한다(없어도 읽힘). 더는 만들지 않게 된 경우에는 reins 규칙만 빼고 파일은 남긴다. `update.ts`의 0.x 런타임 훅 제거(지금 있는 것)는 그대로이고 그 뒤에 합치기가 돈다.
- **W-3**: `agents-md.ts`의 `WRITES`에서 auditor를 빼고 역할 파일의 `tools.write`와 맞춘다. 나머지는 문서다.
- **W-4**: 스크립트 본문은 한 함수(`gates.yaml` 명령 목록 → 텍스트)가 만들고, 생성물 쓰기(`writeGenerated`)에 한 항목으로 넣어 `install`·`update`·`config gates`가 같은 길로 쓴다. husky 블록은 `# reins:begin hooks … # reins:end hooks` 안만 바꾼다. 안내 줄은 도구 형식에 맞춘다(lefthook `run:`, pre-commit `entry:` + `language: system` + `pass_filenames: false`). 테스트는 임시 git 저장소에서 스크립트를 실제로 돌린다. Windows에서 lefthook이 `sh`를 어떻게 부르는지는 구현 때 확인해 안내 줄과 설계서에 적는다.
- **W-7**: `GroupSpec.fallback`, 상세 역할 binding의 `fallback`을 타입·스키마(`bindings.schema.json`)에 더하고, `resolveRoles`가 역할마다 `fallback`을 함께 내며, `renderDelegation`이 칸에 붙인다. `callLine`을 그대로 쓴다.
- **W-9**: 차이 계산은 순수 함수 하나(탐색 결과, 지금 `gates.yaml` → new·changed·gone·yours)로 두고 플래그와 화면이 같이 쓴다. 쓰기는 지금 `configureGates`처럼 yaml 문서를 고쳐 주석을 보존한다.
- W-1·W-5·W-6은 문서·목록·문자열 한 곳씩이다.

## 작업 단위
각 단위는 따로 되돌릴 수 있고, 커밋은 `pnpm check`를 통과한다. 구현 순서는 W-10 → W-1 → W-2 → W-3 → W-4 → W-5 → W-6 → W-7 → W-9이고 W-8은 릴리스 뒤다. 기대는 관계는 둘뿐이다: W-9는 W-4의 스크립트 생성 함수를 쓰고, W-7의 감사 줄 기대값은 W-3(읽기 전용) 뒤의 모양이다. W-2·W-3·W-4는 `skills/audit/SKILL.md`, `harness/roles/auditor.md`, 설계 §3-3·§6을 함께 고치지만 서로 다른 문장(드리프트 예외 / 기록을 누가 쓰나 / 읽는 것)이라 하나를 되돌려도 나머지는 남는다. 순서를 바꾸게 되면 먼저 여기에 적고 진행/수정을 받는다.

- [x] W-1 (86fa45d) retro의 knowledge 후보(S-1, S-2): `skills/retro/SKILL.md`, `harness/roles/pl.md`, 설계서 양판 §3-4·§8, 스킬 테스트.
- [x] W-2 (d186d32; 리뷰 수정 b6928ed) settings.json 합치기(S-3~S-6): `cli/src/lib/generate.ts`, `vendor-write.ts`, `skills/audit/SKILL.md` ④와 `harness/roles/auditor.md`의 드리프트 문장, 설계서 양판 §6, 테스트.
- [x] W-3 (bda3960) 감사자 읽기 전용(S-7, S-8): `harness/roles/auditor.md`, `cli/src/lib/agents-md.ts`, `skills/audit/SKILL.md` ②, 설계서 양판 §3-3, 테스트.
- [x] W-4 (3970abe; 리뷰 수정 8ca5579) 검사 스크립트와 훅 줄(S-9~S-12, S-13의 테스트 설정 부분): 스크립트 생성 함수, `generate.ts`·`install.ts`(`.loctx/README` 포함)·`update.ts`·`configure.ts`(gates), `skills/onboard`·`audit`·`retro`, auditor 역할 "Reads", 설계서 양판 §0·§1·§3-3·§4-2·§6, README 양판(훅 설명이 있으면), 테스트.
- [x] W-5 (613017b) 모델 목록(S-14): `harness/models.yaml`, `cli/src/lib/detect.ts`, 설계서·README 예시, 테스트.
- [x] W-6 (c39ee6e) previous 머리 경고(S-15): `cli/src/commands/update.ts`, 설계서 양판 §5 재구성 표시 문장, 테스트.
- [ ] W-7 대체 모델(S-16~S-20): `bindings.ts`, `bindings.schema.json`, `agents-md.ts`, `configure.ts`, `config-models.ts`, `harness/templates/agents-md-blocks.md`(해당되면), 설계서 양판 §5·§9, README 양판, 테스트.
- [ ] W-9 검사 다시 찾기(S-22~S-26): `configure.ts`(gates), `config.ts`(화면), `reins.ts`, 설계서 양판 §9, README 양판, 테스트. W-4 다음에 한다(스크립트를 다시 만드는 함수를 쓴다); 구현 순서는 W-1~W-7, W-9이고 W-8은 릴리스 뒤다.
- [x] W-10 (c3c1b97) e2e 테스트 수정(S-27): `test/e2e/harness-only.test.ts`.
- [ ] W-8 이 저장소의 훅(S-13): 0.3.1 stable 뒤, 자기 업데이트(`reins update`, 별도 커밋) 다음에 `.husky/pre-commit`·`pre-push`를 바꾼다. 릴리스 뒤 단위라 0.3.1 감사 범위 밖이고, 0.3.1 회고에서 V-11로 확인한다(사용자 2026-11-11 "그렇게 해").

## 검증 기준
모든 실행의 원본 출력은 `.loctx/reports/0.3.1/`에 둔다. 실패는 "기대와 다른 출력, 0이 아닌 종료 코드, 또는 빈 출력"이다.

- V-1 (W-1) `pnpm vitest run cli/test/skills.test.ts cli/test/harness.test.ts`: retro 스킬 ②에 `knowledge candidates`·`repeated`·`none`과 `.agents/knowledge/` 중복 확인 문장이 있고, retrospector 역할 `does`에 `knowledge candidates`가, 설계서 양판 §3-4 회고 문장에 "knowledge 후보"/"knowledge candidates"가 있다. 없으면 테스트 실패.
- V-2 (W-2) 표 기반 테스트(`vendor-write.test.ts`, `update.test.ts`): (a) 파일 없음 → 생성 (b) 사용자가 `allow` 한 줄을 더함 → `update`가 거부하지 않고, allow는 남고, deny는 최신 (c) 사용자가 `deny`에 더한 줄 → 남음 (d) reins가 더는 만들지 않는 규칙 → 목록에 있던 것만 빠짐 (e) 목록 없는 0.3.0 manifest: 안 건드린 파일 → 새 내용으로, 건드린 파일 → 합집합 (f) 유효하지 않은 JSON → 쓰지 않고 알림, 다른 생성물은 계속 (g) reins가 만든 적 없는 기존 파일 → 합침 (h) `--force`를 줘도 (b)·(c)의 사용자 항목이 남음 (i) `hooks`·`env` 같은 다른 키와 키 순서가 그대로 (j) 두 번 돌리면 두 번째는 변경 없음 (k) `permissions`가 객체가 아니거나 `deny`가 배열이 아님 → 쓰지 않고 알림 (l) 사용자가 reins 규칙을 뺌 → 다시 들어감 (m) 새 reins 규칙은 `deny` 끝에 (n) manifest에 reins 규칙 목록이 적힘 (o) `install`과 `config`(project) 경로에서도 (b)가 성립.
- V-3 (W-3) 테스트: openai 감사자의 위임 표 줄(팀·개인)에 `-s read-only`가 있고 `workspace-write`가 없다; google 감사자는 `--mode plan`; Claude 감사자의 `rs-auditor`에 쓰기 도구가 없다; `WRITES`의 군 = 역할 파일에서 `tools.write: true`인 역할이 있는 군; `audit` 스킬 ②에 `returns the record`·`unchanged`와 원본 출력을 `.loctx/reports/<version>/`에 남기라는 문장이, auditor 역할에 `returns`가, 설계서 양판 §3-3 "기록"에 같은 내용이 있다.
- V-4 (W-4) 임시 git 저장소에서 스크립트를 돌리는 테스트: (a) 통과하는 검사 → 종료 0, 커밋 뒤 `git rev-parse HEAD^{tree}`와 같은 이름의 로그가 있고 출력과 `exit: 0`이 있다 (b) 실패하는 검사 → 훅이 같은 종료 코드로 실패(커밋 안 됨), 로그에 그 코드 (c) `git commit -a`와 경로를 준 커밋에서도 (a)가 성립 (d) 검사 둘 중 첫째 실패 → 둘째는 돌지 않음 (e) pre-push 단계 → `HEAD^{tree}` 이름 (f) 스크립트와 훅 줄에 reins·npx 호출이 없다(019 V-1 불변식에 추가) (f2) 일부만 스테이징한 커밋과 `commit <경로>` → 로그 이름은 그 커밋의 트리, 머리줄은 `worktree: dirty`; 전부 스테이징 → `clean` (f3) 같은 트리를 두 번 돌림 → 한 파일에 실행 둘 (f4) `.loctx`가 없어도 만들어 씀 (f5) optional 검사는 스크립트에 없음 (f6) 커밋 둘을 rebase로 다시 만든 뒤(새 트리에 로그 없음) 각 커밋을 체크아웃해 `audit` 단계로 돌리면 `<그 커밋의 트리>.log`에 단계 `audit`, `worktree: clean`, `exit: 0`이 남는다. install·update 테스트: (g) husky + `--hooks` → 블록에 그 한 줄 (h) lefthook·pre-commit → 그 도구 형식의 안내 줄, 파일은 안 건드림 (i) 0.3.0이 넣은 husky 블록 → `update` 뒤 한 줄 (j) `config gates`로 검사를 바꾸면 스크립트가 바뀌고 훅 줄은 그대로 (k) 블록 없는 husky에 `update` → 훅 파일 그대로, 안내 줄 (l) 블록 안에 다른 줄이 있던 경우 → 한 줄로 바뀌고 옛 본문이 출력에 (m) 훅 도구 없음 → 스크립트는 생김 (n) 필수 검사 0개 → 스크립트·훅 줄 없음 (o) 스크립트를 손댄 뒤 `update` → 덮어쓰지 않고 알림. 문서: `onboard`·`audit`·`retro` 스킬과 auditor 역할에 `run-gates.sh`, `.loctx/reports/gates/`, `^{tree}`, 삭제 기준 문장이 있다. CI의 Windows·macOS에서도 (a)~(e)가 통과한다.
- V-5 (W-5) `models.test.ts`: `.loctx/reports/0.3.1/models-check.log`에 후보 ID(`claude-fable-5-2`, `gpt-6-luna`, `gpt-6-sol`)마다 확인한 출처(문서 URL 또는 CLI 출력)나 "확인 안 됨"이 있다. 확인된 ID는 모두 목록에 있고 확인 안 된 ID는 없다(테스트의 기대 목록을 그 로그에 맞춘다). `CONFIRMED_MODELS`에 더한 ID는 로그에 호출 성공 출력이 있다. 설계서·README의 모델 ID가 모두 목록에 있다.
- V-6 (W-6) `update.test.ts`: 0.2.0 설치 픽스처를 `update` → `.agents/AGENTS.previous.md`가 S-15 문단으로 시작하고 그 아래가 옛 본문과 같다; `migrate.test.ts`: migrate의 사본에는 그 문단이 없다.
- V-7 (W-7) 테스트(`bindings-v2.test.ts`, `config.test.ts`, `blocks.test.ts`): (a) 스키마가 군·상세 역할의 `fallback`을 받고, `default`의 fallback·중첩 fallback은 거부 (b) 상속 네 경우(군만, 역할만, 둘 다, 자기 모델 없는 역할) (c) 표의 칸: 다른 벤더, Claude, 쓰기 군, 감사 줄 (d) 대체가 하나라도 있으면 안내 문장이 있다 (e) `--fallback`의 설정·`none`·거부 두 가지 (f) `--local`이면 팀 생성물은 그대로이고 개인 위임 표에 대체 줄 (g) 0.2.0 설정의 `fallback`이 옮겨짐, 읽을 수 없는 모양은 버리고 알림 (h) 화면 흐름: 모델을 고른 뒤 대체를 고르면 파일에 `fallback`이 적히고, 건너뛰면 없고, 취소하면 파일이 그대로 (i) 모델 없는 군에 대체만(팀·`--local` 둘 다) → 거부, 파일 그대로 (j) `models` 군에서 대체가 목록의 하나와 같음 → 거부 (k) 감사 줄: 대체 있음 → `; fallback: …`, 단일 모드도 같음 (l) 대체가 없는 설정의 위임 절 전체가 0.3.0 기대값과 같다.
- V-10 (W-9) 테스트(`gate-proposals.test.ts`, `config.test.ts`): (a) new·changed·gone·yours가 각각 맞게 분류됨 — 다음 경우 포함: 같은 `from`의 go `test`·`vet` 둘(서로 바뀌지 않음), 루트 `check`가 다른 스크립트를 가리킴(changed 하나, new·gone 아님), check가 test를 포함하게 되어 `test`가 제안에서 빠짐(gone, 이유 표시), 하위 디렉터리 이름이 이번 탐색에서 다르게 붙음(차이 없음) (b) `--refresh`만 → 차이 출력, 파일·스크립트 변화 없음, 종료 0 (c) `--apply`로 일부만 → 고른 것만 반영, 나머지 그대로 (d) `--apply all` (e) 반영 뒤 스크립트의 명령이 `gates.yaml`과 같고 훅 파일은 그대로 (f) 주석·다른 키·`order`의 기존 순서 보존 (g) 차이 없음 → "up to date", 쓰지 않음 (h) 없는 이름을 `--apply`에 주면 아무것도 쓰지 않고 종료 1 (i) 화면 흐름: 항목 표시, 고르기, 취소 시 변화 없음.
- V-8 전체: `pnpm check > .loctx/reports/0.3.1/check.log 2>&1` 종료 0, `pnpm build` 종료 0. 설계서 양판의 고친 절이 같은 내용이다(doc-reviewer 또는 PM 대조, 대조 표를 같은 폴더에). 생성물 불변식(reins 호출 없음) e2e 통과.
- V-11 (W-8, stable 뒤) 자기 업데이트 뒤 이 저장소에서 커밋 하나 → `.loctx/reports/gates/<그 커밋의 트리>.log`에 `worktree: clean`, `exit: 0`; `git commit -a`로 한 번 더. 0.3.1 회고 기록에 경로를 적는다.
- V-12 (W-10) node 폴더에 전역 reins가 있는 이 기계에서 `pnpm check` 종료 0(`.loctx/reports/0.3.1/w10-check.log`; 고치기 전 실패는 `e2e-harness-only-rerun.log`). CI(전역 reins 없음)에서도 그 테스트가 통과한다.
- V-9 rc 뒤(릴리스 단계): `.loctx/context/scripts/smoke-published.sh`를 npm의 0.3.1-rc.N으로 돌려 0 실패, 그리고 0.3.0 설치 → 0.3.1 `update` 한 번으로 V-2(b), V-4(i)가 실제로 성립함을 임시 저장소에서 확인.

## 우려
- **0.3.1 자신의 감사에는 커밋별 로그가 없다.** 스크립트는 하네스 파일이라 이 저장소에는 stable 뒤 자기 업데이트로 들어온다(W-8). 그래서 0.3.1 감사는 커밋별 통과를 한 번 더 "확인 불가"로 적는다(사용자가 받아들임, 2026-11-11 "그렇게 해").
- **로컬 훅을 거치지 않은 커밋은 로그가 없다.** 로컬 rebase나 GitHub의 `gh pr update-branch --rebase`로 다시 만들어진 커밋 — 감사 전에 PM이 채운다(S-10), `--no-verify` 커밋, 다른 기계에서 한 커밋. 감사는 "확인 불가"로 적고 PR의 CI 기록으로 head만 확인한다.
- **settings.json을 다시 쓸 때 들여쓰기는 2칸으로 맞춰진다.** 키와 값, 순서는 보존하지만 사용자의 줄바꿈 모양은 보존하지 않는다.
- **대체 모델로 한 리뷰·감사의 독립성.** 대체가 구현 모델과 같으면 "다른 모델의 리뷰"가 아니게 된다. reins는 막지 않고, PM이 대체를 썼다고 적으므로 감사·사용자가 본다.
- **Windows의 lefthook.** `sh`를 찾는 방식을 확인하지 못했다. 구현 때 확인하고, 안 되면 그 조합은 안내 줄에 조건을 적는다.
- **W-7이 가장 크다**(스키마, 렌더러, 플래그, 화면, 0.x 이전). 화면 부분에서 막히면 사용자에게 알리고 플래그까지만 먼저 낼지 묻는다.

## 사용자에게 묻는 것
—

(답을 받은 것: 기존 settings.json에도 합쳐 씀 — "응. 항상 머지". 이 저장소 훅 전환은 stable 뒤 — "그렇게 해". 로그가 없는 커밋은 감사 전에 PM이 채움 — "ㅇㅇ". e2e 테스트 수정 W-10 — "그렇게 해라".)

## 범위 밖
- 0.4의 일(다른 저장소 설치·이전), PC 전체 기본값, 감사자의 네트워크·쓰기 권한(intent "하지 않을 것").
- 작업 중 reins가 대체 모델을 고르거나 호출하는 것, 실패 감지·재시도 장치, 대체의 대체.
- 대체용 `rs-*` 에이전트 파일, 벤더 단위 대체.
- knowledge 승격의 자동화, 검사 출력을 세거나 판정하는 CLI.
- lefthook·pre-commit 설정 파일을 reins가 직접 고치는 것.
- 화면에서 검사 명령을 직접 고쳐 쓰는 편집기.
- 역할의 기본 모델 할당 변경.
