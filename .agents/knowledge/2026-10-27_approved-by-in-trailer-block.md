---
id: 2026-10-27_approved-by-in-trailer-block
kind: decision
status: active
supersedes: null
topics: []
decisions: [approved-by-in-trailer-block]
symptoms: []
applies_to: all
source: ".loctx/history/2026-10-27-0130_approved-by-trailer.md"
approved: { by: user, at: 2026-10-27 }
---
## 결정
`Approved-by:`는 커밋 메시지 마지막 문단(트레일러 블록)에 `Co-Authored-By:`와 빈 줄 없이 함께 둔다.
## 이유
빈 줄로 떨어진 `Approved-by:`는 git이 트레일러로 읽지 않는다. T1이 승인을 못 찾아 B3 HOLD가 났다(intent 012, 2026-10-27).
## 적용
승인 커밋은 `git commit -m "<제목>" -m "<본문>" -m "Approved-by: <user>
Co-Authored-By: …"`처럼 마지막 -m 하나에 두 줄을 넣는다. 커밋 뒤 `git log -1 --format=%(trailers:key=Approved-by)`로 확인한다.
## 바뀌면
T1이 트레일러가 아닌 본문 줄도 읽게 바뀌면 다시 본다.
