# reins harness changelog

Read by `reins update`: it lists the entries newer than a project's pinned version. An entry tagged
`[skill]` needs the project's own sections touched — `reins update` then points to `/reins-update`,
where the PM proposes those changes for the user to approve.

## 0.1.1
- qa-design default binding is now gemini-4-argon-high and qa-run gemini-3.8-flash-medium (fallbacks unchanged).
- Generated settings deny `Bash(git commit -n *)` alongside `--no-verify`.
- Premise stops C1 and C2 are now P1 and P2, so a stop reason id has one meaning; red lines C1–C10 are unchanged. `metrics` still reads old C1/C2 records as P1/P2.

## 0.1.0
- First harness: twelve roles, red lines C1–C10, stop conditions A1–G2, schemas, templates, Node knowledge seeds.
- Workflow block: committing each finished unit as you go is part of the work.
- verify-tool runs gates through `reins gate` and cites its report files as evidence; `reins check` gains ticket-start (T1), verdict (T3) and rc-close (T5).
