---
id: 2026-11-15_commit-summary-line
kind: accepted-finding
status: active
supersedes: null
topics: [commits, audit]
decisions: [commit-summary-line]
symptoms: ["커밋 메시지에서 제목 다음의 한 줄 요약이 빠짐"]
applies_to: all
source: ".agents/audit/0.3.1.md (첫 감사의 커밋 메시지 지적, 추가 감사 A6); .agents/audit/0.3.2.md (1차 감사 비판 9)"
approved: { by: user, at: 2026-11-15, words: "K1 수용" }
---
## 결정
이 저장소의 커밋 메시지 관례(`type(scope): title`, 한 줄 요약, 불릿, footer)에서 **한 줄 요약만 빠진 일반 커밋**은 감사에서 위반이 아니라 "알려진 수용"으로 적는다.
## 이유
같은 지적이 세 번 나왔고 세 번 모두 수용됐다. 0.3.1의 첫 감사(커밋 메시지 본문, 사용자 "수용"), 0.3.1 추가 감사 A6(사용자 "수용."), 0.3.2 1차 감사 비판 9(사용자 "흠. 일단 수용."). 제목과 불릿이 있으면 커밋을 찾고 되돌리는 데 지장이 없었다.
## 적용
수용 범위는 "제목과 불릿은 있고 요약 줄만 없음"이다. 제목 형식(`type(scope): title`)을 어긴 것, spec 항목(`S-n`·`W-n`·`A-n`)을 적지 않은 것, 무관한 작업을 섞은 것은 여전히 위반이다. 완료 표시·SHA 같은 기록만 남기는 커밋은 원래부터 제목만으로 된다(AGENTS.md 관례). PM은 계속 요약 줄을 쓴다: 이 항목은 감사의 분류를 바꿀 뿐 관례를 없애지 않는다.
## 바뀌면
관례에서 요약 줄을 없애거나, 요약 줄이 빠져 실제로 문제가 생기면(커밋의 뜻을 찾을 수 없음) 이 항목을 내린다.
