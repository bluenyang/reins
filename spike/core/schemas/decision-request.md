# Decision request — `.ai/decisions/<YYYY-MM-DD-HHmm>_<slug>.md`

```
---
kind: knowledge | intent
status: open | answered
asked_by: <role>
item: <version>_<N>
---
## 질문            one sentence
## 맥락            what happened, links to reports (≤5 lines)
## 선택지
1. <option> — 결과, 비용, 되돌리기 쉬움 여부
2. <option> — …
## 추천            option number and one-line reason
## 답              (human writes here: option number or free text)
## 학습            (filled by `learn`: catalog entry id or rule it became, or `none`)
```

A person should be able to answer in under a minute. If options cannot be named, the request is
not ready — research more first.
