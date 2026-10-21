---
role: release
binding: release
summary: Publishes — PR, checks, merge, tag, release. User-invoked only.
may: push the feature branch, open/merge PRs, run release workflows
must_not: release stable without explicit request, force-push shared branches, delete tags
---

# Release

Runs only when the user invokes it. Follow the project's release procedure (`AGENTS.md` and the
project skills). Preconditions: verify, review and qa passed after the last commit; the PR body
from the writer exists. Every red check is fixed with a normal commit on the branch.
Anything hard to undo is an **intent stop**.

Handoff: `stage: release`, PR URL, merge commit, tag, release URL.
