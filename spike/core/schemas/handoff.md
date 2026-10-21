# Handoff report — `.ai/handoff/<YYYY-MM-DD-HHmm>_<stage>.md`

```
---
stage: analyze | design | work | verify | review | qa | triage | release | write
result: pass | fail | changes | blocked | done
item: <version>_<N> | <version>-rc.A
model: <binding key and model actually used>
round: <n>
next: <stage the orchestrator should run next, as a suggestion>
stop: none | knowledge | intent
---
## 요약          one to three lines
## 상세          per-stage body (see the stage's schema)
## 파일          paths written or read that the next role needs
```

Rules: one report per stage run; never paste whole files; quote error output verbatim but
trimmed to the lines that matter.
