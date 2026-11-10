---
id: 2026-11-10_branch-from-fresh-master
kind: decision
status: active
supersedes: null
topics: [git, branch]
decisions: [branching]
symptoms: []
applies_to: all
source: ".agents/audit/0.3.0.md; .loctx/history/0.3.0.md"
approved: { by: user, at: 2026-11-10, words: "B. 1, 2, 3, 4, 8 인용" }
---
## 결정
작업 브랜치는 방금 `git pull --ff-only origin master`한 master에서 딴다. 릴리스 workflow가 master에 커밋(버전 올림)을 넣으므로, 배포 직후의 로컬 master는 낡았을 수 있다.
## 이유
PR #28 브랜치를 rc.3 릴리스 커밋(`b2eec45`) 전의 로컬 master에서 따서 BEHIND로 머지가 막혔다. 로컬 force push는 금지라 GitHub에서 `gh pr update-branch 28 --rebase`로 갱신하고 CI를 다시 돌렸다.
## 적용
브랜치를 만들기 전에 `git fetch`와 `git log -1 origin/master`로 확인한다. 이미 뒤처졌으면 `gh pr update-branch <n> --rebase`.
## 바뀌면
릴리스 workflow가 master에 커밋하지 않게 바뀌면.
