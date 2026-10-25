---
intent: "004"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-26, kind: first-review }
  - { role: pm, at: 2026-10-26 }
summary_for_user: |
  pre-commit은 작업 트리 대신 인덱스(커밋될 내용)를 검사하고, T3는 버스 파일 스키마와 저장소 안의 절대 경로 evidence를 확인한다.
  게이트 출력이 비면 D4 WARN, AGENTS.md 관리 블록을 손으로 고치면 F2 STOP(`reins:override`는 예외), 태그를 지우는 push는 A1 HOLD가 된다.
  커밋이 없는 저장소와 `| head`로 끊긴 출력에서는 예외 없이 끝난다.
  violations 시나리오 V19~V25가 추가되어 25/25가 되고, `docs/violations*.md`의 C2·A1·D4 행이 바뀐다.
  태그를 앞으로 옮기는 경우와 E·T6 계열 정지는 0.2로 미룬다.
---
## 요구 해석
- S-1 T2 pre-commit은 커밋될 내용을 본다. staged 경로 목록은 지금처럼 `git diff --cached`로 얻고, 검사(driftFormat·driftConvention·driftMatch·driftGenerated)가 읽는 파일 내용은 `git show :<path>`로 인덱스에서 읽는다 — staged 파일뿐 아니라 driftMatch·driftGenerated가 비교하는 짝 파일(설치본·생성물·manifest)도 인덱스 기준이고, 인덱스에서 삭제된 경로는 없는 것으로 본다. 인덱스와 작업 트리가 다르면 인덱스가 기준이다. 사유 id와 판정은 지금과 같다(어긋나면 F2 STOP). `.loctx/`·`.ai/` 존재 여부와 `.gitignore` 검사는 작업 트리를 그대로 본다. ← "스테이징된 내용이 아니라 작업 트리를 본다"
- S-2 T3 verdict는 그 ticket의 버스 파일 중 **마지막 verify 교환**의 request·response를 `bus-request`·`bus-response` 스키마로 검사한다. 어긋나면 F2 STOP(path: 버스 파일, message: `bus-response: …`). 그리고 pass 판정 검사보다 먼저 한다. ← "버스 응답의 스키마를 검사하지 않는다 — `fixes: "none"`"
- S-3 `readEvidence`: 절대 경로 토큰이 저장소 루트 안을 가리키면 상대 경로처럼 읽는다. 저장소 밖을 가리키는 절대 경로가 있으면 D5 STOP(message: `evidence path outside the repository`)이다. 상대 경로 동작은 그대로 둔다. ← "evidence에 절대 경로를 쓰면 증거로 읽지 못한다"
- S-4 T3에서 pass evidence 조각마다 `$ <cmd>` 줄과 `exit N` 줄을 빼고 공백만 남으면 D4 **WARN**(message: `gate output is empty`)이다. 판정은 바뀌지 않는다(다른 사유가 없으면 CONTINUE, exit 0). ← "게이트 출력이 비어도 pass로", 질의서 "STOP이 아니라 WARN"
- S-5 AGENTS.md 관리 블록 검사: 이름마다 블록 본문을 패키지 `templates/agents-md-blocks.md`에서 `reins update`가 렌더링할 결과와 비교한다(같은 렌더 함수, 같은 bindings). 다르면 F2 STOP비교 전 양쪽을 정규화한다: CRLF → LF, 줄 끝 공백 제거, 블록 안 앞뒤 빈 줄 제거. (path: `AGENTS.md`, message: `managed block "<name>" was edited by hand`, resume: `reins update` 또는 `<!-- reins:override <name> -->`). `overrides()`에 있는 이름은 건너뛴다. `check --drift`(match 계층)에서 돌고, pre-commit에서는 `AGENTS.md`가 staged일 때 S-1의 인덱스 내용으로 돈다. ← "관리 블록을 손으로 고쳐도 드리프트로 안 잡힌다"
- S-6 T4 pre-push: localSha가 0이고 remoteRef가 `refs/tags/`로 시작하면 A1 HOLD(path: remoteRef, message: `push deletes tag <name>`)이다. 브랜치 삭제와 새 ref는 지금처럼 통과시킨다. ← "태그 삭제를 건너뛴다", 질의서 "삭제는 A1 HOLD"
- S-7 HEAD가 없는 저장소(커밋 0개)에서 `check`는 모든 stage에서 예외 없이 보고서를 낸다. `currentBranch`가 실패하면 `git symbolic-ref --short HEAD`로 대신하고, 실패를 "git 저장소가 아님"으로 오판하지 않는다. 종료 코드는 판정을 따른다. ← "커밋이 하나도 없는 저장소에서 예외로 죽는다"
- S-8 stdout이 EPIPE로 닫히면 `reins`는 stack trace나 stderr 출력 없이 끝난다. 종료 코드는 이미 정한 판정 코드(`process.exitCode`), 정하기 전이면 0이다. ← "`| head`로 끊으면 EPIPE"
- S-9 시나리오마다 `test/e2e/violations.test.ts`에 추가하고 `docs/violations.md`·`.ko.md`의 C2·A1·D4 행에서 "none (gap)"을 지운다(태그 앞 이동만 남긴다). 그 밖에 바뀌는 행은 V19(C2)·V20(F2)·V21~V22(D5)이다. 요약 줄은 `25/25 stopped`가 된다. ← "바라는 결과"

## 설계
- `lib/git.ts`: `indexFile(cwd, path)`(또는 인덱스 사본 루트), `hasHead(cwd)`. `currentBranch`는 HEAD가 없어도 throw하지 않는다.
- `check.ts`: preCommit은 drift 함수에 읽기 루트(인덱스 사본)를 넘긴다. prePush는 태그 삭제를 처리한다. 블록 비교는 `driftMatch` 옆의 `driftBlocks(root)`가 맡는다(update의 렌더 함수를 재사용하고 `parseBlocks`·`overrides`를 쓴다).
- `stages.ts`: verdictCheck 앞부분에서 스키마를 검사한다(`loadSchemas`·`validateFile` 재사용). readEvidence는 절대 경로를 처리하고 빈 출력을 판정한다.
- `reins.ts`: `process.stdout.on('error')`에서 EPIPE이면 조용히 끝낸다. check 액션은 출력하기 전에 `process.exitCode`를 정한다.
- 설계서 반영(같은 커밋, 양판): §3 D4에 "빈 출력 = WARN", A1에 "태그 삭제 = HOLD"를 적는다. §5는 이미 F2라서 바꾸지 않는다.
- 불변 조건 충돌: AGENTS.md에 `reins:read invariants` 절이 없어 프로젝트 약속으로 대신 확인했다. 그 결과 **없음**. "설계서가 기준"은 위 설계서 반영으로 지킨다. "새 정지 조건 금지"도 지킨다. 쓰는 id는 모두 기존 것이다(F2·D4·D5·A1).

## 우려 표시
- S-1: 사본을 만들지 않고 필요한 경로만 `git show :<path>`로 읽어 훅 시간을 늘리지 않는다.

## 검증 기준
- C-1 (S-1) V19: `.agents/harness/roles/` 파일을 고쳐 stage한 뒤 작업 트리만 원본으로 되돌린다. `check --stage pre-commit` 결과가 F2 STOP, exit 20이어야 한다. 반대로 작업 트리만 고치고 stage하지 않으면 통과해야 한다.
- C-2 (S-2) V20: response에 `fixes: "none"`, verdict pass, 올바른 evidence를 넣으면 `--stage verdict`가 F2 STOP(`bus-response`), exit 20이다. request 쪽 스키마 위반도 같다. verify 교환이 둘 이상이면 마지막 교환만 검사한다(앞 교환이 깨져 있어도 마지막이 정상이면 통과).
- C-3 (S-3) V21: 저장소 안의 절대 경로 evidence 파일에 `exit 1`을 넣으면 D4 STOP `exits 1`, exit 20이다(파일을 읽었다는 증거). V22: 저장소 밖(os tmpdir)의 절대 경로를 주면 D5 STOP, exit 20이다.
- C-4 (S-4) V23: evidence가 `$ pnpm tsc --noEmit\nexit 0`이면 D4 WARN, 판정 CONTINUE, exit 0이다.
- C-5 (S-5) V24: 설치본 AGENTS.md의 workflow 블록 안에 한 줄을 넣으면 `check --drift`가 F2 STOP, exit 20이다. 같은 수정에 `reins:override workflow`를 달면 F2가 없다. 이 레포에서 `check --drift`는 계속 통과한다. AGENTS.md 수정본만 stage하면 `--stage pre-commit`도 F2 STOP, exit 20이다.
- C-6 (S-6) V25: stdin `(delete) 0000… refs/tags/v0.1.0 <sha>`를 주면 `--stage pre-push`가 A1 HOLD, exit 10이다. 브랜치 삭제 줄은 통과한다.
- C-7 (S-7) `git init` 직후 커밋 없는 설치본에서 `check`, `--stage pre-commit`, `--drift`를 돌리면 stderr에 stack trace가 없고 exit는 판정 코드(0·10·20) 중 하나다.
- C-8 (S-8) `reins check --drift | head -1`을 돌리면 stderr가 비어 있고 `EPIPE` 문자열이 없다.
- C-9 (S-9) 기존 V1~V18은 그대로 멈추고 출력은 `violations: 25/25 stopped`이다. violations 양판의 해당 행이 갱신된다. `pnpm check`가 통과하고 이 레포의 훅도 그대로 통과한다.

## 범위 밖
- 예산 정지 E1~E3, T6(G1·F1), A2~A4·B2·C6·D2·D3 같은 미검출 항목(0.2)
- 태그를 앞으로 옮기는 것의 검출(태그 정책 필요)
- `reins gate` 쪽 빈 출력 경고 — 판정은 T3(stages.ts)에서만 하고 gate.ts는 바꾸지 않는다
