---
intent: "003"
status: draft
approvals: []
summary_for_user: |
  일부러 규칙을 어기는 시나리오 18개를 임시 저장소에서 만들고, 빌드된 `reins` CLI를 실제로 돌려 기대한 사유 id·판정·종료 코드로 멈추는지 확인한다. 결과는 "18/18 stopped" 한 줄.
  C1~C10, A1~G2 각각을 누가 잡는지(검증기·생성 권한·역할 판단·아직 없음) 표를 `docs/violations.md`(+ .ko)에 남긴다.
  못 잡는 것이 나오면 고치지 않고 0.1.0 안정화 목록에 올린다.
---
## 요구 해석
- S-1 시나리오(검증기가 잡아야 하는 것). 각각 임시 git 저장소 + `install graph --mode auto` 후 위반을 만들고 CLI를 실행한다. ← "위반마다 시나리오 하나"

  | # | 위반 | 명령 | 기대 |
  |---|---|---|---|
  | V1 | `.env` 스테이징 | `check --stage pre-commit` | C4 STOP, exit 20 |
  | V2 | `.loctx/` 파일 강제 스테이징 | pre-commit | F2 STOP, 20 |
  | V3 | `.gitignore`에서 `.loctx/` 제거 | pre-commit | F2 STOP, 20 |
  | V4 | 설치된 역할 파일 손편집 | `check --drift` | F2 STOP, 20 |
  | V5 | 생성된 `.claude/agents/*` 손편집 | `--drift` | C3 STOP, 20 |
  | V6 | SKILL.md name ≠ 디렉터리 | `--drift` | F2 STOP, 20 |
  | V7 | ticket frontmatter 스키마 위반 | `--drift` | F2 STOP, 20 |
  | V8 | 원격 커밋을 조상으로 갖지 않는 push | `check --stage pre-push` (stdin ref) | A1 HOLD, 10 |
  | V9 | draft intent의 ticket 시작 | `ticket-start` | B3 HOLD, 10 |
  | V10 | 열린 asks | `ticket-start` | B1 HOLD, 10 |
  | V11 | plan에 없는 ticket | `ticket-start` | C2 STOP, 20 |
  | V12 | 증거 없는 pass | `verdict` | D5 STOP, 20 |
  | V13 | 파이프 거친 게이트 증거 | `verdict` | D4 STOP, 20 |
  | V14 | exit 1인데 pass로 보고 | `verdict` | D4 STOP, 20 |
  | V15 | 연속 실패 2회 | `verdict` | D1 ESCALATE, 30 |
  | V16 | 열린 ticket이 남은 rc 닫기 | `rc-close --release` | F2 STOP, 20 |
  | V17 | 단일 명령이 아닌 게이트 | `gate` | 실행 안 함(C5), exit 1 |
  | V18 | 생성된 settings.json deny | 파일 검사 | `Read(**/.env)`, `Bash(git push --force *)`, `Bash(git commit --no-verify *)` 포함 |
- S-2 실행 방식: `test/e2e/violations.test.ts`, vitest. 실제 `node cli/dist/reins.js`를 자식 프로세스로 실행해 stdout(`--json`)과 종료 코드를 본다. 테스트 전 빌드가 최신이어야 하므로 vitest globalSetup이 `tsc -p cli/tsconfig.json`을 한 번 돈다. ← "실제로 실행해", 제약 C1
- S-3 마지막 테스트가 "N/N stopped"를 출력하고 N = 표의 행 수(18)를 단언한다. ← "한 줄에"
- S-4 `docs/violations.md` + `docs/violations.ko.md`: C1~C10, A1~G2 34행 — 검출 주체(verifier 단계 / settings deny / role / none), 시나리오 번호. 설계서 §3 끝에서 링크. ← "표로 남긴다"
- S-5 시나리오가 기대와 다르게 나오면(공백) 테스트를 `it.fails`가 아니라 표에 `none (gap)`으로 적고 시나리오에서 제외, 0.1.0 안정화 목록에 추가한다. ← 제약 C10

## 설계
- `vitest.config.ts`: include에 `test/**/*.test.ts` 추가, `globalSetup: test/e2e/build.ts`.
- 시나리오마다 `mkdtemp` 저장소 + 최초 커밋(빈 저장소에서 check가 실패하는 알려진 문제 회피) + install.
- 불변 조건 충돌: 없음 — 검출 코드를 고치지 않는다.

## 우려 표시
- 시나리오마다 install로 느려질 수 있음 → 한 번 설치한 저장소를 복사해 쓴다(`cpSync`).
- V8은 실제 원격 없이 pre-push 입력(ref 줄)을 stdin으로 준다.

## 검증 기준
- C-1 (S-1·S-3) 18개 시나리오가 각자 기대한 사유 id·판정·종료 코드를 내고, "18/18 stopped".
- C-2 (S-2) 테스트가 함수가 아니라 `cli/dist/reins.js`를 자식 프로세스로 실행한다(코드에서 확인). globalSetup이 빌드한다.
- C-3 (S-4) 표에 C1~C10, A1~G2가 빠짐없이(34행) 있고 각 행의 시나리오 번호가 테스트에 존재. 양판 링크.
- C-4 (S-5) 공백이 있으면 표와 안정화 목록에 있다.
- `pnpm check` 통과.

## 범위 밖
공백 수정, 역할 판단 위반의 자동 검출.
