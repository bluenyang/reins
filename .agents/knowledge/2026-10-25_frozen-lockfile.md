---
id: 2026-10-25_frozen-lockfile
kind: failure
status: active
supersedes: null
topics: [install, lockfile, ci]
decisions: []
symptoms: ["ERR_PNPM_OUTDATED_LOCKFILE", "The lockfile would have been modified by this install", "YN0028"]
applies_to: all
source: preset
symptom: "ERR_PNPM_OUTDATED_LOCKFILE | The lockfile would have been modified by this install"
cause: package.json changed without updating the lockfile
fix: run the package manager install locally and commit the lockfile with the change
check: "<pm> install --frozen-lockfile (yarn: yarn install --immutable)"
verified: 0
---
## 결정
lockfile은 package.json과 같은 커밋에서 바뀐다.
## 이유
CI의 frozen install이 어긋난 lockfile을 거부한다.
## 적용
pnpm·yarn·npm 전부.
## 바뀌면
패키지 매니저를 바꾸면 `check` 명령을 갱신한다.
