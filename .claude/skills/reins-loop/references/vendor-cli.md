# Vendor CLI recipes

How to call each role through its vendor CLI: read-only mode, output location, token source.
Report tokens with `reins metrics record --role <r> --tokens <n> --ticket <id>`; no count, no record.

## code-review — codex

```
codex exec -m <model> -s read-only --ephemeral -C <repo> -o <response.yaml> - < prompt.md
```

- Read-only sandbox (`-s read-only`), no session kept (`--ephemeral`); the answer is written to `-o`.
- `prompt.md` = the role's `must_not` + the bus request body + the output of
  `git diff <range> -- <paths from changes[]>` inlined + "do not run commands, do not re-run checks".
- Re-review: inline only the fix commit's diff.
- Tokens: the line after `tokens used` in the output.

## qa-design — agy

```
agy -p "<prompt>" --model <model> --mode plan
```

- Plan mode is read-only. Inline the spec and plan text in the prompt; the reviewer reads no files.
- Tokens: the usage field when present.

## lookup — cursor-agent

```
cursor-agent -p --plan --model <model> "<prompt>"
```

- `--plan` is read-only. With `--output-format json`, tokens come from the usage field when present.

## Claude roles

Call the `reins-<role>` subagent. Tokens: the Agent result's token count.
