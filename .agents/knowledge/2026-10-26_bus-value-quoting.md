---
id: 2026-10-26_bus-value-quoting
kind: decision
status: active
supersedes: null
topics: [bus, yaml]
decisions: [bus-value-quoting]
symptoms: [bus-value-quoting]
applies_to: all
source: ".loctx/history/2026-10-26-1900_retro-0.1.0-0.1.3.md"
approved: { by: user, at: 2026-10-26 }
---
## 결정
버스 파일(request·response)의 값에 `: `나 ` #`가 있거나 특수 문자로 시작하면 큰따옴표로 감싼다. grounds·why는 한 줄 문자열로 쓴다.
## 이유
따옴표 없는 `: `가 YAML을 깨뜨렸고(001-1_03), grounds를 목록으로 쓴 응답이 스키마를 어겼다(006-3_01). 둘 다 검증이 돈 뒤에야 드러났다.
## 적용
모든 역할이 버스 파일을 쓸 때. 템플릿 주석과 reins-loop 스킬에 같은 규칙이 있다. 0.1.1부터 T3가 깨진 버스 파일을 F2로 잡는다.
## 바뀌면
버스 파일을 CLI(`reins new request`, `gate --respond`)만 쓰게 되면 이 규칙은 생성기 안으로 옮긴다.
