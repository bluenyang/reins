# Vendor CLI recipes

How to call each role through its vendor CLI: read-only mode, output location, token source.
Take `<model>` and the vendor from `reins status --json` (`bindings`), not from `bindings.yaml`: the resolved entry already applies your local override and the fallback.
Report tokens with `reins metrics record --role <r> --tokens <n> --ticket <id>`; no count, no record.

## code-review — codex

```
codex exec -m <model> -s read-only --ephemeral -C <repo> -o <response.yaml> - < prompt.md
```

- Read-only sandbox (`-s read-only`), no session kept (`--ephemeral`); the answer is written to `-o`.
- `prompt.md` = the role's `must_not` + its procedure (the body of code-review.md) + the bus request + the COMPLETE
  `git diff <range> -- . ":!.agents/harness" ":!.agents/skills" ":!.agents/SKILLS.md" ":!.claude"` inlined (all other files, not filtered to `changes[]` paths) followed by `git diff --stat <range> -- .agents/harness .agents/skills .agents/SKILLS.md .claude`; installed copies
  are always allowed to change) + "do not run commands, do not re-run checks".
- Output lands in the `-o` file.
- Re-review: inline only the fix commit's diff.
- Tokens: the line after `tokens used` in the output.

## qa-design — agy

```
agy -p "<prompt>" --model <model> --mode plan
```

- Plan mode is read-only. Inline the spec and plan text in the prompt; the reviewer reads no files.
- Output: redirect stdout to a file (`> response.yaml`).
- Tokens: the usage field when present.

## lookup — cursor-agent

```
cursor-agent -p --plan --model <model> "<prompt>"
```

- Output: redirect stdout to a file. `--plan` is read-only. With `--output-format json`, tokens come from the usage field when present.

## Claude roles

Call the `reins-<role>` subagent. It returns text; the pl writes it to the response file. Tokens: the Agent result's token count.
