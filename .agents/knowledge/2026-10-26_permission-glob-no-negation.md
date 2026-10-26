---
id: 2026-10-26_permission-glob-no-negation
kind: decision
status: active
supersedes: null
topics: [permissions, claude-code]
decisions: [permission-glob-no-negation]
symptoms: [permission-glob-no-negation]
applies_to: all
source: ".loctx/history/2026-10-26-1900_retro-0.1.0-0.1.3.md"
approved: { by: user, at: 2026-10-26 }
---
## 결정
Claude Code 권한 규칙(settings.json deny/allow)의 glob에서 `[!…]`·`[^…]`를 부정으로 쓰지 않는다. 예외가 필요한 차단은 훅으로 판정한다.
## 이유
2026-10-26 실측: `Read(**/.env.[!e]*)`가 `.env.e*`를 막고 `.env.zz`를 열었다(정반대). 또 Haiku가 비밀처럼 보이는 파일을 스스로 거부하고 DENIED라고 답해, 모델의 자기 보고로는 판정할 수 없었다.
## 적용
권한 규칙을 생성하거나 고칠 때. 동작 확인은 stream-json의 tool_result(is_error)로만 한다.
## 바뀌면
Claude Code가 부정 문자 클래스를 지원하면 다시 실측한 뒤 이 항목을 superseded로.
