# Failure catalog — `.ai/knowledge/failures.md`

One entry per distinct cause. Search by symptom before every retry.

```
## F-<NNN> <short name>
- symptom: `<verbatim distinctive error line>`
- where: <gate | stage | tool> · <path pattern>
- cause: <one line>
- fix: <steps or the rule to apply>
- check: <command that proves it is fixed>
- verified: <n>           # times this fix resolved the symptom
- source: preset | history/<file> | decisions/<file>
- promoted: no | rule:<file> | hook:<file> | lint:<rule>
```

`verified` increases only when the check command passed after applying the fix. At `verified ≥ 2`
and `promoted: no`, `learn` proposes promotion with a decision request.
