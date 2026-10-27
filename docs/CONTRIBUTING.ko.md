# reins에 기여하기

[English](../CONTRIBUTING.md)

reins는 BlueNyang이 BlueNyang과 Team Croffle의 저장소를 위해 만듭니다. 이슈와 풀 리퀘스트를
환영합니다. 이 문서는 사람이든 에이전트든 이 저장소에서 일하는 방식을 설명합니다.

## 이 저장소는 자기 루프로 자기를 고칩니다

모든 변경은 reins가 구현한 사슬을 그대로 탑니다(R66).

1. **Intent** — 문제와 바라는 결과를 `.agents/intent/<NNN>_<slug>/intent.md`에 적습니다.
   intent는 메인테이너만 승인합니다. 보통은 이슈로 제안하면 됩니다.
2. **Spec** — intent에서 나온 요구사항 `S-n`, 검증 기준, 그리고 메인테이너가 거부할 수 있는
   3~5줄 요약입니다.
3. **Plan** — 바뀌는 파일, 작업 순서(항목 하나가 ticket 하나), 위험, 테스트 체크리스트입니다.
4. **Ticket** — 구현한 뒤 `reins gate`(원본 출력이 증거)와 `reins check --stage verdict`로
   검증하고, 작성자가 아닌 다른 역할이나 사람이 리뷰합니다.

intent와 ticket이 어디까지 왔는지는 `reins status`로 봅니다. 에이전트는 `reins-intent`,
`reins-loop` 스킬을 따라 같은 단계를 밟습니다.

오타나 깨진 링크 같은 작은 수정에는 intent가 필요 없습니다. 동작이 바뀌는 변경에는 필요합니다.

## 준비

Node 22 이상과 pnpm이 필요합니다. 개발(vitest 5)에는 Node 22.12 이상이 필요하고, CLI 자체는 Node 22 어디서든 돌아갑니다.

```sh
pnpm install     # husky 훅도 함께 설치됩니다
pnpm check       # lint(oxlint), 포맷 검사(oxfmt), 타입 검사, 테스트(vitest)
pnpm build       # cli/src → cli/dist
```

훅은 `reins check --stage pre-commit`과 `--stage pre-push`를 실행합니다. 훅을 우회하지 마세요
(`--no-verify`는 레드라인 C5입니다). 훅이 멈추면 사유 id와 재개 방법을 알려 줍니다.

## 규칙

- **설계가 먼저입니다.** 기준은 `docs/design.md`입니다. 코드가 설계와 달라져야 하면 같은 커밋에서
  `docs/design.ko.md`와 `docs/design.md`를 먼저 고칩니다(R45).
- **배포되는 것**(CLI, 생성기, 검사, 빌드 산출물)은 **TypeScript**로 쓰고, Python이 필요 없어야 합니다(R65). 개발·테스트·편집용 스크립트는 Python이어도 됩니다. ESM, Node 22 이상입니다.
- **브랜치**는 `master`에서 `type/topic`으로 따고, rebase한 뒤 fast-forward로 병합합니다.
  `master`에 직접 커밋하지 않습니다.
- **커밋**은 끝난 단위마다 하나씩 하고, 커밋마다 `pnpm check`를 통과해야 합니다. 메시지는
  `type(scope): title`, 한 줄 요약, 불릿 순서입니다. 스테이징은 경로를 지정해서 합니다.
- **하네스 원본**은 `harness/`에 있습니다. `.agents/harness/`, `.claude/`, `.agents/skills/reins-*`는
  설치되거나 생성된 사본이므로 원본을 고친 뒤 `node cli/dist/reins.js update`를 실행합니다.
  `reins check --drift`가 `drift: ok`를 출력해야 합니다.
- **문서**는 영어가 기본이고 한국어판(`*.ko.md`)을 함께 두며 서로 링크합니다(R67).
- **비밀 정보** — `.env`, `.env.*.local`, `secrets/**`, `*.properties`, `*.key`, `*.pem`은 읽지도
  커밋하지도 않습니다. 이런 파일을 스테이징하면 검증기가 커밋을 멈춥니다(C4).
- `.loctx/`는 로컬 작업 공간이며 커밋하지 않습니다.

## 풀 리퀘스트

어떤 intent나 이슈를 위한 것인지, 무엇이 바뀌었는지, 어떻게 검증했는지 적어 주세요. 게이트
출력은 요약하지 말고 그대로 붙여 주세요. 작업은 `type/topic` 브랜치와 PR로만 `master`에 들어가며, `master` 직접 push는 T4가
막습니다(A4). deploy 역할이 PR을 열고 `gh pr checks --watch`로 기다린 뒤, 필수 체크가 모두 초록일
때만 `gh pr merge --rebase --delete-branch`로 머지합니다. 빨간 체크는 머지하지 않습니다. 릴리스는
메인테이너가 결정하며, stable 릴리스는 언제나 명시적인 결정이 있어야 합니다(A2).

## 릴리스

릴리스는 GitHub Actions의 **publish**(`.github/workflows/publish.yml`)로 합니다. 먼저
`CHANGELOG.md`를 고칩니다. rc는 T5(`reins check --stage rc-close --release <V>`)가 통과한 뒤 deploy
역할이 `version=<V>-rc.<N>`으로 실행합니다. rc 뒤 수정은 `release: stabilization` ticket이고, 다음
T5가 통과하면 다음 rc를 냅니다. stable은 메인테이너가 지시할 때만 `version=<V>`로 실행하며 현재
`master` 헤드에 `v<V>-rc.*` 태그가 있어야 합니다(`dry_run`은 검사와 패키징만 합니다). 전체 게이트를 돌리고, 토큰 없이 trusted publishing으로 npm에 **staged**로 올린 뒤, 버전을 커밋하고
태그를 붙입니다. 메인테이너가 2FA로 승인해야(npmjs.com → Staged Packages, 또는
`npm stage approve <stage-id>`) 실제로 배포됩니다. GitHub Releases는 쓰지 않습니다.

## 라이선스

기여한 내용은 [MIT 라이선스](../LICENSE)로 배포되는 데 동의한 것으로 봅니다.
