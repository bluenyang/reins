# QA scenarios — `.ai/qa/<version>_scenarios.md`

Written by the architect, executed by qa without reading code.

```
## S-<N> <title>
- covers: <work item ids>
- setup: <commands from project.toml, fixtures, env — no source paths>
- steps: 1. … 2. …
- expect: <observable result: HTTP status + body field, UI text, file, exit code>
- kind: auto | manual
```
