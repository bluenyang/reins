---
intent: "009"
status: reviewed
approvals:
  - { role: qa-design, at: 2026-10-26, kind: first-review }
  - { role: pm, at: 2026-10-26 }
summary_for_user: |
  master에는 브랜치 → PR → CI 초록 → deploy 역할의 rebase 머지로만 들어간다. 이 레포도 같다. T4는 master 직접 push를 막는다(publish 워크플로의 release 커밋만 예외).
  계획분 ticket이 다 닫히고 T5(`rc-close --release <V>`)가 통과하면 deploy가 publish를 `version: <V>-rc.1`로 돌린다. staged라서 사용자가 npm에서 승인해야 dist-tag `rc`로 공개된다.
  rc 뒤 수정은 `release: stabilization` ticket으로 하고, 다 닫히면 T5를 다시 통과시킨 뒤 rc.N+1을 낸다. 어떤 rc를 냈는지는 `.loctx/release/<V>.md`에 남긴다.
  stable은 사용자가 지시할 때만 `version: <V>`로 낸다. 워크플로는 master HEAD가 마지막 rc 태그 커밋과 같을 때만 진행한다.
  설계서 §3·§4 양판, CONTRIBUTING 양판, deploy 역할, reins-release 스킬(008)을 이 흐름에 맞춘다.
---
## 요구 해석
- S-1 작업은 `type/topic` 브랜치 → PR → CI 통과 → merge로만 master에 들어간다. 이 레포 포함. ← 바라는 결과 1
- S-2 머지는 deploy 역할이 `gh pr checks --watch`로 모든 필수 체크가 초록인 것을 확인한 뒤 `gh pr merge --rebase --delete-branch`로 한다. pl·implementer는 머지하지 않는다. ← 제약 2
- S-3 계획분(`release: planned`) ticket이 다 닫히고 T5가 통과하면 deploy가 rc.1을 staged 배포한다(dist-tag `rc`). ← 바라는 결과 2
- S-4 rc 이후 수정은 `release: stabilization` ticket이다. 다 닫히고 T5가 다시 통과하면 rc.N+1을 낸다. ← 바라는 결과 3
- S-5 stable은 사용자 지시가 있을 때만, 마지막 rc와 같은 커밋에서 staged로 낸다. ← 바라는 결과 4, 제약 1
- S-6 rc도 staged다. 공개는 사용자의 npm 승인 뒤다. ← 제약 1
- S-7 설계서 §3·§4 양판, CONTRIBUTING 양판, deploy 역할, reins-release 스킬이 이 흐름을 설명한다. ← 영향 범위
## 설계
- **PR 흐름.** deploy가 브랜치를 push하고 `gh pr create`로 PR을 연다(본문 초안은 docs 역할). `gh pr checks --watch`가 하나라도 실패하면 머지하지 않고 D2(빨간 체크 두 번)로 pl에게 돌려준다. 머지 방식은 rebase다. 지금의 "rebase 후 fast-forward" 규칙과 deploy 역할 `may`의 "rebase-merge"에 맞춘다. GitHub의 master 보호 규칙(PR 필수, 필수 체크 `ci`)은 저장소 설정이라 사용자가 한 번 켠다. plan에 사용자 단계로 적는다.
- **T4 추가 검사.** pre-push에서 원격 ref가 기본 브랜치(`refs/heads/master` 또는 `main`)를 갱신하면 A4로 STOP한다. 예외는 하나다. `GITHUB_ACTIONS=true`이고 push 범위의 새 커밋이 모두 `release: v` 제목이면 통과한다(publish 워크플로의 버전 커밋). 하나라도 다른 커밋이 섞이면 A4다. 기존 A1 검사(force push·태그 삭제)는 그대로 둔다.
- **rc.1 트리거.** deploy는 `reins check --stage rc-close --release <V>`가 CONTINUE일 때만 `gh workflow run publish.yml -f version=<V>-rc.1 -f dry_run=false`를 실행한다. `release_type: rc`는 0.1.x 다음 패치만 만들 수 있어서 minor/major 버전을 못 맞춘다. 그래서 정확한 버전을 넘긴다. 워크플로는 prerelease id에서 dist-tag `rc`를 이미 고른다.
- **T5 추가 검사·기록.** T5는 지금처럼 `--release <V>`(rc 번호 없는 core 버전)만 받는다. 열린 ticket이 `release: planned`든 `stabilization`이든 하나라도 있으면 막는다(지금 동작 유지). 다음 rc 번호는 `.loctx/release/<V>.md`의 마지막 rc + 1로 T5가 계산해 보고한다. 파일이 없으면 rc.1이다. 그 번호가 이미 파일에 있거나 npm에 있으면 F2로 멈춘다. dispatch 뒤 deploy가 이 파일에 rc 번호, 커밋, stage id, 날짜를 한 줄 붙인다. `.loctx/`는 gitignore된 로컬 장부라서 커밋하지 않는다. 그래서 master push나 T4와 엮이지 않는다(pm 결정 2026-10-26).
- **rc.N.** rc 공개 뒤 나온 문제는 pl이 `release: stabilization` ticket으로 연다. 루프는 같다(T1~T3, PR, 머지). 다 닫히면 T5 → rc.N+1. D1은 rc 단위로 센다(설계서 그대로).
- **stable 승격.** 사용자 지시가 있을 때만 deploy가 `version=<V>`로 dispatch한다. 워크플로에 단계를 하나 더한다. 정확한 비-prerelease 버전이면 태그 `v<V>-rc.*` 중 가장 큰 것이 있어야 하고, 그 태그의 커밋 다음에 release 커밋 말고 다른 커밋이 없어야 한다. 아니면 실패한다. `release_type: patch|minor|major`로 rc 없이 stable을 내는 경로도 이 검사를 받는다(rc 태그가 없으면 실패). 첫 도입 전 버전(0.1.2 이하)은 해당 없다.
- **문서.** 설계서 §4 "Version and rc convention"과 §3 T4·T5 줄에 위 규칙을 넣는다(양판, 코드보다 먼저 같은 커밋). CONTRIBUTING Releases 양판은 "maintainer가 Actions를 돌린다"를 "rc는 deploy가 T5 뒤 dispatch, stable은 사용자 지시, 둘 다 npm 승인 필요"로 바꾸고 PR 흐름 절을 더한다. deploy 역할 본문 절차를 PR → 체크 대기 → 머지 → (T5 통과 시) rc dispatch → 기록 순으로 고친다. reins-release 스킬(008)은 같은 순서를 따른다.
## 우려 표시
- 불변식 점검: 설계서 우선 — §3·§4를 먼저 고치므로 충돌 없음. 역할이 판단하고 스크립트가 강제(R5·R7) — 머지 판단은 CI 결과라는 결정적 조건이고 deploy는 그것을 적용만 하므로 충돌 없음. C6(push/PR/merge/release는 deploy만) — 강화하는 방향이라 충돌 없음. A2(stable은 사용자) — 유지. TS만(R65) — 충돌 없음.
- `GITHUB_ACTIONS` 환경변수 예외는 로컬에서 흉내 낼 수 있다. 막는 근거는 GitHub 보호 규칙이고 T4는 실수를 막는 장치다. 보호 규칙이 Actions 봇의 master push를 막으면 워크플로가 bypass 권한을 받아야 한다(사용자 설정).
- 0.1.3 자체가 이 흐름의 첫 적용이다. 009가 머지되기 전에는 지금 방식을 쓴다.
## 검증 기준
- C-1 (S-1) T4 테스트: 로컬에서 master로 가는 push는 STOP(A4). `GITHUB_ACTIONS=true` + `release: v` 커밋만이면 CONTINUE, 다른 커밋이 하나라도 섞이면 STOP(A4). 기능 브랜치 push는 CONTINUE.
- C-2 (S-2) deploy 역할·reins-release 스킬에 `gh pr checks --watch` 후 `gh pr merge --rebase`만 있고, 실패 시 머지하지 않는다는 문장이 있다. 0.1.3의 실제 PR이 이 경로로 머지됐다(history 기록).
- C-3 (S-3, S-6) 열린 ticket이 있으면 rc-close가 STOP이고 deploy는 dispatch하지 않는다. 0.1.3-rc.1이 dist-tag `rc`로 staged됐다(npm stage list 출력 첨부).
- C-4 (S-4) T5 테스트: `--release <V>`에서 `.loctx/release/<V>.md`가 없으면 rc.1, 있으면 마지막 rc + 1을 보고한다. 계산한 번호가 이미 기록돼 있거나 npm에 있으면 F2.
- C-5 (S-5) publish dry_run: `version=<V>`에서 rc 태그가 없거나 rc 태그 뒤에 다른 커밋이 있으면 실패, 마지막 rc 커밋이면 통과.
- C-6 (S-7) 설계서·CONTRIBUTING 양판에 같은 규칙이 있고 `reins check --drift`가 ok다.
## 범위 밖
GitHub Releases, 자동 stable 배포, 보호 규칙을 코드로 설정하는 일, 머지 큐, squash/merge 커밋 방식.
