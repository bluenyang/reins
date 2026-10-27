---
id: 2026-10-27_format-changed-files-only
kind: decision
status: active
supersedes: null
topics: []
decisions: [format-changed-files-only]
symptoms: []
applies_to: all
source: ".loctx/history/2026-10-27-0310_oxfmt-accident.md"
approved: { by: user, at: 2026-10-27 }
---
## 결정
포매터(oxfmt)는 바꾼 파일에만 돌린다. 저장소 전체(`oxfmt .`)는 돌리지 않는다.
## 이유
implementer가 `oxfmt .`로 무관한 142개 파일을 다시 포맷했고, 되돌리는 데 stash가 필요했다(012-3, 2026-10-27).
## 적용
implementer brief와 reins-implement 스킬에 "포맷은 `pnpm exec oxfmt <바꾼 파일>`"을 적는다.
## 바뀌면
pnpm check의 fmt:check가 바꾼 파일만 보게 바뀌거나, 포매터가 저장소 전체에 안전해지면 다시 본다.
