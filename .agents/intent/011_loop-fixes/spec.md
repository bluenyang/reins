---
intent: "011"
status: accepted
approvals:
  - { role: qa-design, at: 2026-10-26, kind: first-review }
  - { role: pm, at: 2026-10-26 }
  - { role: user, at: 2026-10-26, kind: summary }
summary_for_user: |
  `reins new intent|ticket|request`가 템플릿에서 번호를 매겨 스키마를 통과하는 파일을 만들고, 이미 있는 파일은 덮어쓰지 않는다. 스킬은 역할 실행마다 `reins metrics record`를 한 줄 부른다.
  intent 상태에 `released`를 추가한다. 009의 릴리스 흐름이 이 값을 쓰고, 001~007은 이번에 한 번 손으로 바꾼다. status는 이런 intent를 released로 표시하고 할 일을 띄우지 않는다.
  verify-tool은 `reins gate --respond` 한 번으로 응답 파일까지 받고 이어서 `reins check`만 부른다. 원시 출력은 보고서 파일에만 남는다. 검증 단계는 CLI 한 번으로 끝난다.
  publish 요약에서 `npm stage list` 줄을 지우고, sync-version은 버전 문자열만 바꾼다. 설계서 §9 양판의 경로를 `cli/src/scripts/`로 바로잡는다.
---
## 요구 해석
- S-1 `reins new intent <slug> [--version v] [--origin user|agent|incident]`: id는 `.agents/intent/`의 최대 번호 +1(3자리)로 정하고, `NNN_<slug>/intent.md`를 템플릿에서 만든다(status draft, approvals [], 본문 "—"). 근거: "`reins new intent|ticket|request` 같은 명령이 템플릿에서 올바른 파일을 만든다".
- S-2 `reins new ticket <intent> <step> <slug> [--title t] [--depends id,..] [--release planned|stabilization] [--role r]`: n은 그 intent의 열린 ticket, `.loctx/history/`에 기록된 ticket, plan의 계획 id 가운데 최댓값 +1이다. `.loctx/ticket/<intent>-<n>_<slug>.md`를 만든다. `<step>`은 frontmatter `plan_step`에 쓰고, plan.md의 작업 순서 범위를 벗어나면 exit 1이다. branch는 plan의 branch를 따른다(없으면 `feat/<intent>-<intent slug>`). 근거: 같은 문장과 "007에서 생성 명령이 깨져 잘못된 ticket이 생겼다".
- S-3 `reins new request <ticket> <kind> [--from r] [--to r]`: id는 `<ticket>_<nn>`으로, `.loctx/bus/`에서 그 ticket의 다음 두 자리 번호를 쓴다. from/to 기본값은 kind에서 정한다(implement pl→implementer, verify pl→verify-tool, review pl→reviewer). question·stop-report는 to만 pl로 정해지고 `--from`이 필수다. 빠지면 exit 1이다. 만든 파일은 template의 자리표시를 그대로 둔다. 근거: 같은 문장.
- S-4 S-1~S-3 공통: 대화형 질문 없이 위치 인자와 플래그만 받는다(에이전트가 부른다). 출력은 해당 스키마로 검증한 뒤 쓴다. 대상 파일이 이미 있으면 exit 1로 거부하고 덮어쓰지 않는다. 경로는 stdout에 한 줄로 출력한다.
- S-5 `skills/reins-loop/SKILL.md`와 `skills/reins-intent/SKILL.md`의 절차에, 역할 실행이 끝날 때마다 다음 한 줄을 부르라고 적는다: `reins metrics record --role <role> --tokens <n> --intent <id> [--ticket <id>] --vendor <v> --model <m>`(기존 옵션 그대로). 토큰 수를 모르면 부르지 않는다. 근거: "역할 실행 토큰 기록을 스킬이 한 줄로 남긴다".
- S-6 intent 스키마 status enum에 `released`를 추가한다. 기존 값은 그대로 둔다. 근거: "릴리스가 끝난 intent는 status에서 released로 보이고", 제약 "새 상태는 추가만".
- S-7 `nextForIntent`는 intent가 `released`면 할 일을 내지 않는다. `reins status`는 그 intent를 `released` 한 줄로 접는다. 근거: 같은 문장과 "status가 이미 릴리스된 intent(001~007)에 'pm: close the rc'를 계속 띄운다".
- S-8 `released`는 stable 배포 뒤 릴리스 흐름(009)의 deploy 단계가 쓴다. 001~007은 이번 작업에서 한 번 직접 `released`로 바꾼다.
- S-9 `reins gate --ticket <id> --respond`는 게이트를 돌린 뒤 bus 응답 `<ticket>_<nn>.response.yaml`(verdict, evidence 경로, may_proceed)을 쓴다. `<nn>`은 그 ticket의 `kind: verify` 요청 가운데 응답 파일이 아직 없는 가장 최근 것이다. 그런 요청이 없으면 게이트는 돌리되 응답은 쓰지 않고 exit 1로 알린다. stdout에는 게이트마다 pass/fail 한 줄과 실패 요약(시그니처, file:line)만 내고, 원시 출력은 보고서 파일에만 남긴다(C5 유지). verify-tool 절차는 `gate --respond`와 `check --stage verdict` 두 번의 호출로 줄인다. 근거: "verify-tool의 게이트 실행이 가벼워진다(토큰 크게 감소)".
- S-10 publish.yml의 stage 단계에서 `npm stage list` 줄을 지운다. 승인 안내 두 줄은 남긴다. 근거: "publish 요약 단계 정리".
- S-11 sync-version은 plugin.json의 `"version": "<x>"` 값만 정규식으로 바꾸고, 나머지 바이트는 건드리지 않는다. 버전 필드를 못 찾으면 exit 1. 근거: "plugin.json 형식 보존(버전 한 줄만 diff)".
- S-12 설계서 §9 양판의 `scripts/sync-version.ts`를 `cli/src/scripts/sync-version.ts`로 고친다. S-1~S-9의 명령, 상태, 절차도 같은 커밋에서 설계서 양판에 반영한다. 근거: "설계서 경로 정정".
## 설계
- `cli/src/commands/new.ts` 하나에 세 하위 명령을 둔다. 템플릿은 `harness/templates/`를 읽고 frontmatter만 채운다. 번호 계산 함수는 테스트할 수 있게 순수 함수로 분리한다.
- status: `nextForIntent`의 첫 분기를 released로 두고, 출력 표에서는 released를 따로 묶는다. 스키마 변경은 enum 추가뿐이다.
- gate: `--respond`는 기존 실행 경로를 재사용하고, 응답은 bus-response 스키마로 검증한 뒤 쓴다. verdict는 모든 게이트의 exit 0일 때만 pass다.
- sync-version: `JSON.parse`로 현재 값만 확인하고, 쓰기는 `/("version"\s*:\s*")[^"]*(")/` 첫 매치만 치환한다.
## 우려 표시
- 불변식 "설계서가 기준, 다르면 같은 커밋에서 양판 수정": S-12로 충족한다. 충돌 없음.
- 불변식 "Python 금지(R65)": TS만 쓴다. 충돌 없음.
- C5(게이트 출력을 자르지 않음): S-9는 stdout만 줄이고 원시 출력은 보고서에 전부 남긴다. 축약 출력을 근거로 삼지 않으면 충돌 없음. reviewer가 확인할 것.
- S-8은 009의 명세에 기대므로, 009 spec에서 `released`를 쓰는 단계를 받아야 한다. plan으로 넘긴다.
## 검증 기준
- C-1 세 `new` 명령의 출력이 각 스키마(intent, ticket, bus-request)를 통과한다(vitest).
- C-2 번호 계산: 빈 디렉터리, 구멍 있는 번호, history에만 있는 ticket, 기존 bus 파일 경우에 기대한 id가 나온다.
- C-3 대상 파일이 있으면 exit 1이고 파일 내용이 바뀌지 않는다.
- C-4 `released` intent는 `nextForIntent`가 할 일을 내지 않고 status에 released로 보인다. 기존 enum 값의 intent 파일은 계속 통과한다.
- C-5 001~007의 status가 `released`이고 `reins status`에 "close the rc"가 없다.
- C-6 `gate --respond`가 열린 verify 요청의 `<nn>`으로 스키마를 통과하는 응답을 쓴다. 실패 시 verdict fail·may_proceed false이고 stdout은 요약만, 보고서에는 원시 출력이 전부 남는다. 열린 verify 요청이 없으면 응답 없이 exit 1이다.
- C-7 검증 단계가 CLI 한 번(`reins gate --ticket <id> --respond`)으로 게이트 실행·원본 보고서·스키마에 맞는 버스 응답까지 끝낸다. verify-tool 서브에이전트 없이도 된다(pm 결정 2026-10-26: 서브에이전트 기동만 약 4.5만 토큰이라 토큰 상한 대신 호출 수로 잰다).
- C-8 sync-version 뒤 `git diff .claude-plugin/plugin.json`이 version 한 줄뿐이다. 들여쓰기(탭·공백)가 다른 fixture로도 테스트한다. version 키가 없는 JSON이면 파일이 바뀌지 않고 exit 1이다.
- C-9 publish.yml에 `npm stage list`가 없고 승인 안내 두 줄은 남아 있다. 설계서 양판에 `cli/src/scripts/sync-version.ts`가 있고 `` `scripts/sync-version.ts` ``는 없다. 설계서 양판에 `reins new`, intent status `released`, `gate --respond`, verify-tool 절차(S-1~S-9)가 반영되어 있다.
- C-11 `skills/reins-loop/SKILL.md`와 `skills/reins-intent/SKILL.md`에 역할 실행 뒤 `reins metrics record` 한 줄 호출이 있고, `reins update` 후 설치본에도 같은 줄이 있다.
- C-12 `new ticket`의 `<step>`이 `plan_step`에 들어가고 범위 밖이면 exit 1이다. `new request`의 question·stop-report에서 `--from`이 빠지면 exit 1이다.
- C-10 `pnpm check`와 `reins check`가 통과한다.
## 범위 밖
- 0.2 항목(loop·harness 깎기, 벤더 생성물, recall, 예산, .env 훅).
- 대화형 프롬프트, 기존 파일 갱신이나 편집용 `new`.
- 009의 rc·stable 흐름 자체(S-8은 그 흐름이 쓸 값만 정한다).
