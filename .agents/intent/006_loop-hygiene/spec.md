---
intent: "006"
status: accepted
approvals:
  - { role: qa-design, at: 2026-10-26, kind: first-review }
  - { role: pm, at: 2026-10-26 }
  - { role: user, at: 2026-10-26, kind: summary }
summary_for_user: |
  정지 조건의 전제 그룹 C1·C2를 P1·P2로 바꾸고 하네스를 0.1.1로 올린다. 레드라인 C1~C10은 그대로 둔다.
  metrics는 옛 기록의 C1·C2를 P1·P2로 읽는다. 지난 커밋과 history는 고치지 않는다.
  harness.test는 이 머신의 .loctx를 읽지 않게 바꾼다. 버스 템플릿과 스킬에는 값 인용 규칙을 넣는다.
  리뷰는 변경분만 본다. pl이 변경마다 의도, S-n, 증거를 적고, 리뷰어 프롬프트에는 금지선, 요청, diff만 넣는다.
  벤더 CLI 호출법은 skills/reins-loop/references/vendor-cli.md에 둔다.
---
## 요구 해석
- S-1 전제 정지 C1·C2를 P1·P2로 바꾼다 ("정지 사유 id가 하나의 뜻만 갖는다", 질의서 "전제 그룹 C1·C2 → P1·P2"). 바꿀 곳: `harness/policy/stops.yaml`(premise 두 줄), `harness/policy/transitions.yaml`(T2의 C2), `cli/src/commands/stages.ts`(107·391행 reason), `cli/src/lib/metrics.ts`(170행 주석), `cli/test/stages.test.ts`(101행), `cli/test/metrics.test.ts`(69~73행), `test/e2e/violations.test.ts`(277행), `docs/design.md`·`design.ko.md`(§3 표의 C 전제 행, §T2 줄), `docs/violations.md`·`violations.ko.md`(정지 행 35·36, 51행 충돌 문단, 66·67행), `skills/reins-loop/SKILL.md`(25행 "(C2)"). 그룹 이름도 `C premise`에서 `P premise`로 바꾼다. 레드라인 C1~C10(`common-red-lines.yaml`, `generate.ts`, `harness.test.ts` 39~43행, 설계 §2)은 그대로 둔다.
- S-2 `harness/VERSION`을 0.1.0에서 0.1.1로 올리고 `harness/CHANGELOG.md`에 `## 0.1.1` 항목(C1·C2 → P1·P2)을 적는다. 이 레포의 `.agents/harness/`(policy 3개, VERSION)는 `reins update`로 옮긴다 ("id를 바꾸면 하네스 버전 노트에 적고 reins update가 설치본을 옮긴다").
- S-3 `metrics.classify`는 옛 id C1·C2를 P1·P2로 바꿔 읽는다 ("기존 기록(metrics·history)은 그대로 읽힌다"). 검증기는 레드라인 C1·C2를 reason으로 내지 않는다(C2 위반은 F2로 보고된다). 그래서 reason 값이 C1·C2이면 언제나 전제 정지이고, 조건 없는 별칭으로 처리해도 된다. 지난 커밋과 history 본문은 손대지 않는다 (제약 2).
- S-4 `cli/test/harness.test.ts` 71행의 `driftConvention(ROOT)`는 `.loctx/ticket`·`.loctx/bus`를 훑는다. 이 테스트가 개발자 로컬의 `.loctx/` 상태와 상관없이 같은 결과를 내게 한다 ("`pnpm check`가 로컬 `.loctx/` 상태와 무관하게"). 방법은 plan이 고른다. 임시 디렉터리 fixture를 쓰거나 검사 대상에서 `.loctx`를 빼는 방법이 있다.
- S-5 버스 값 인용 규칙: `: `, ` #`가 들어 있거나 `- [ { * & ! | > ' " % @`로 시작하는 문자열은 큰따옴표로 감싼다. 이 규칙을 `harness/templates/bus/request.yaml`·`response.yaml`의 주석과 `skills/reins-loop/SKILL.md`에 적는다 ("버스 템플릿·스킬에 값 인용 규칙").
- S-6 버스 파일이 YAML로 읽히지 않으면 검사가 그 파일을 읽는 자리에서 경로와 파서 메시지 첫 줄을 담아 F2로 보고한다 ("bus 파일이 깨지면 그 자리에서 F2로"). `driftConvention`→`validateFile`은 이미 `not valid YAML`을 F2로 낸다. 버스를 읽는 다른 단계(T3 verdict의 response 읽기 등)도 크래시하거나 그냥 건너뛰지 않고 같은 형태로 보고하게 한다.
- S-7 pl의 review 요청은 변경마다 `changes[]: {path, what, why: S-n, evidence: <경로>}`를 채운다 ("pl이 버스 요청에 변경마다 무엇을 왜…"). `harness/roles/pl.md`에 이 절차를 한 단계로 넣고, request 템플릿 예시에도 반영한다. 스키마는 items가 열려 있으므로 바꾸지 않는다.
- S-8 `harness/roles/code-review.md` 절차를 이렇게 바꾼다 ("리뷰어는 저장소를 탐색하지 않고…"). 리뷰어는 받은 diff와 요청만 읽고 저장소를 탐색하지 않는다. 문서는 영문판만 보고 `.ko.md`는 보지 않는다. 게이트·명령을 다시 돌리지 않고 증거 경로를 인용한다. 판정 근거는 changes[].why의 S-n과 대조한다.
- S-9 리뷰어 프롬프트는 역할 must_not, 버스 요청 본문, `git diff <range> -- <changes의 path들>` 출력만 담고 "do not run commands, do not re-run checks"를 넣는다. 재검토 때는 수정 커밋의 diff만 넣는다 ("수정 후 재검토는 수정 diff만"). 이 형식은 SKILL.md 7단계와 vendor-cli.md에 적는다.
- S-10 `skills/reins-loop/references/vendor-cli.md`를 새로 만든다 ("역할 → 벤더 CLI 호출 방법(읽기 전용 모드, 출력 파일, 토큰 위치)", 질의서 "references/ 파일로"). 내용은 이 레포에서 확인한 레시피다. code-review는 `codex exec -m <model> -s read-only --ephemeral -C <repo> -o <response.yaml> - < prompt.md`로 부르고, 토큰은 "tokens used" 다음 줄에서 읽는다. qa-design은 `agy -p "<prompt>" --model <model> --mode plan`에 spec·plan 본문을 인라인으로 넣는다. lookup은 `cursor-agent -p --plan --model <model> "<prompt>"`, Claude 역할은 `reins-<role>` 서브에이전트로 부르고 토큰은 Agent 결과에서 읽는다. `SKILL.md`에는 이 파일을 가리키는 줄 하나만 넣어 500줄 제한을 지킨다.
## 설계
- id 변경은 `stops.yaml`을 원본으로 삼는다. stages.ts는 문자열 'P2'를 내보내고 metrics에는 `LEGACY_IDS = {C1:'P1', C2:'P2'}`를 둔다. classify가 kinds를 조회하기 전에 이 표로 정규화한다.
- 설계서 §3 표와 T2 줄은 영문·한국어판을 같은 커밋에서 고친다 (AGENTS.md "design first"). violations 51행의 충돌 문단은 "0.1.1에서 P1·P2로 분리됨, 옛 기록의 C1·C2(정지)는 P1·P2로 읽는다"로 바꾼다.
- 벤더 레시피와 프롬프트 조립은 문서로만 둔다. CLI가 벤더를 부르지 않는다 (하지 않을 것 1).
## 우려 표시
- 설계 불변식(design first): 충돌 없음. §2·§3 수정이 코드보다 앞서거나 같은 커밋에 들어가야 한다.
- R65(TypeScript만), 레드라인 C2(policy·roles 수정은 pm·update만): `harness/policy`·`harness/roles` 원본 수정은 이 intent가 승인한 범위다. `.agents/harness/`는 손으로 고치지 않고 `reins update`로만 옮긴다. 이 조건을 지키면 충돌은 없다.
- 레드라인 C10: S-5~S-9가 바꾸는 파일은 모두 intent의 영향 범위 목록 안에 있다. `response.yaml`, `references/` 신규 파일, 테스트 파일은 그 목록에 딸린 것으로 읽는다.
- 기록 불변(제약 2): history와 커밋은 고치지 않는다. metrics.jsonl도 다시 쓰지 않고 읽을 때 별칭으로 처리한다. 충돌 없음.
## 검증 기준
- C-1 (S-1) `grep -rnw 'C1\|C2'`를 `harness/policy/stops.yaml`·`transitions.yaml`, `stages.ts`, `skills/reins-loop`에 돌리면 0건이다. 레드라인 파일과 설계 §2에는 C1·C2가 남아 있다. ticket-start에서 plan 밖 ticket은 `reason: 'P2'`를 낸다(stages.test, e2e violations.test).
- C-2 (S-2) `harness/VERSION`이 0.1.1이고 CHANGELOG에 0.1.1 항목이 있다. `reins update` 뒤 `.agents/harness/VERSION`이 0.1.1이 되고 `reins check --drift`가 F2를 내지 않는다.
- C-3 (S-3) `classify(['C2'])`, `classify(['P2'])`, `classify(['C1'])`가 모두 `knowledge: 1`이다. C4 같은 다른 레드라인은 여전히 redline이다.
- C-4 (S-4) `.loctx/bus/`에 깨진 YAML 파일을 두고 돌려도, `.loctx/`를 비우고 돌려도 `pnpm check`가 같은 결과로 통과한다.
- C-5 (S-5) 두 버스 템플릿과 SKILL.md에 인용 규칙 문장이 있다. 템플릿은 그대로 YAML로 파싱된다.
- C-6 (S-6) 값에 `: `가 인용 없이 들어간 bus fixture에서, 버스를 읽는 각 check 단계가 그 경로로 F2를 내고 크래시하지 않는다(테스트).
- C-7 (S-7) `pl.md` 절차와 request 템플릿에 `changes[].what/why/evidence`가 있다. 그렇게 채운 요청이 bus-request 스키마를 통과한다.
- C-8 (S-8) `code-review.md` 절차에 탐색 금지, 영문 문서만, 재실행 금지, S-n 대조가 들어 있다.
- C-9 (S-9) SKILL.md 7단계와 vendor-cli.md에 프롬프트 구성(must_not, 요청, diff)과 재검토 때 수정 diff만 넣는 규칙이 있다.
- C-10 (S-10) `vendor-cli.md`에 네 레시피가 읽기 전용 모드, 출력 위치, 토큰 위치와 함께 있다. SKILL.md에 그 참조 줄이 있고 500줄을 넘지 않는다.
- 모든 커밋 단위에서 `pnpm check`가 통과한다.
## 범위 밖
- CLI가 벤더를 직접 호출하는 디스패치(0.2).
- 과거 커밋 메시지, history, metrics.jsonl의 id 일괄 치환.
- 레드라인 C1~C10의 번호 변경. diff와 plan.md를 비교하는 P2·C10 검사(T2) 구현은 violations의 기존 gap으로 남는다.
- 버스 스키마 필드 추가, 관리 블록 비교(C2 레드라인 gap).
