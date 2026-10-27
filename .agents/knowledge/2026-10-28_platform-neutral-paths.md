---
id: 2026-10-28_platform-neutral-paths
kind: decision
status: active
supersedes: null
topics: []
decisions: [platform-neutral-paths]
symptoms: []
applies_to: all
source: ".loctx/history/2026-10-28-0142_retro-note-paths.md"
approved: { by: user, at: 2026-10-28 }
---
## 결정
저장소 상대 경로(git 경로, 파일에 쓰거나 비교하는 경로)는 posix 구분자로, 파일 시스템 호출은 OS 경로로 다룬다. 파일 URL은 `fileURLToPath`, 이름은 `basename`, 경로 포함 비교는 `realpathSync.native` 뒤 `relative`로 한다.
## 이유
첫 Windows CI(013-6)에서 `URL.pathname`이 `/D:/…`가 되고, OS 경로를 `split(/)`해 branch 이름이 깨지고, 8.3 짧은 임시 경로 때문에 증거가 저장소 밖으로 판정됐다.
## 적용
새 코드와 리뷰에서 `.pathname`, OS 경로의 `split(/)`, 문자열 `startsWith(root + /)`를 찾는다. CI 매트릭스(Windows·macOS)가 마지막 확인이다.
## 바뀌면
Windows를 지원 대상에서 빼면 다시 본다.
