---
id: "009"
slug: release-flow
version: 0.1.3
status: draft
origin: user
approvals: []
supersedes: null
---
## 문제
설계(§4)는 "계획분 완료 = rc.1, rc.N은 안정화, stable은 사용자의 명시 결정"이고 워크플로 블록은 "기계를 떠나는 일은 pre-release 루프 안의 deploy 역할"이라고 하는데, 실제로는 로컬 ff-merge 후 master에 바로 push하고 사용자 지시로 stable만 배포했다. PR·CI 검증·rc 배포·안정화 단계가 없었다(0.1.0~0.1.2).

## 바라는 결과
- 작업은 브랜치 → **PR** → CI(GitHub Actions) 통과 → merge로만 master에 들어간다. 이 레포도 같다.
- 버전의 계획분이 끝나고 T5가 통과하면 **deploy 역할이 rc.1을 자동으로 staged 배포**한다(dist-tag `rc`). 사용자는 npm에서 승인만 한다.
- rc 이후 고칠 것은 안정화 ticket(`release: stabilization`)으로 처리하고 rc.N으로 다시 낸다.
- **stable은 사용자가 지시할 때만**, 검증된 rc와 같은 커밋에서 staged로 낸다.

## 영향 범위
publish 워크플로(rc 유형·rc→stable 승격), deploy 역할 절차, `reins-release` 스킬(008), T4·T5 검사(rc 단계 확인), 설계서 §4 양판, CONTRIBUTING 양판, 이 레포의 진행 방식.

## 제약
- stable 배포·force push는 언제나 사용자 결정(A1·A2). rc도 staged라서 공개는 사용자 승인 뒤다(사용자 결정 2026-10-26).
- PR 머지는 CI가 초록일 때만. 에이전트가 자기 코드를 머지 판단하지 않는다(pl must_not) — deploy 역할이 CI 결과로 머지한다.

## 열린 질문
—

## 질의서 기록
사용자 지시(2026-10-26): "하나를 완료하면 rc.1으로 자동 배포, rc.X로 안정화, stable은 manual". rc는 staged(사용자 선택).

## 하지 않을 것
- GitHub Releases(npm만)
- 자동 stable 배포
