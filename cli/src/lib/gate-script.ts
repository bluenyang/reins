import { parse } from 'yaml';

/**
 * The project's gate script (design §6): one POSIX shell file that reads `gates.yaml` when it runs, runs
 * its required commands in order and keeps their output, so a hook tool needs one line and the audit can
 * tell whether a commit passed. reins writes it; nothing in it calls reins or the network (024 S-15).
 */
export const GATE_SCRIPT = '.agents/harness/run-gates.sh';

/** Where the script keeps its logs: one file per tree hash of what was checked. */
export const GATE_LOGS = '.loctx/reports/gates';

/** The one line a hook tool runs for a stage (`pre-commit`, `pre-push`). */
export const hookLine = (stage: string): string => `sh ${GATE_SCRIPT} ${stage}`;

/** The required (not optional) gate commands of a `gates.yaml` text, in its order. */
export function requiredGates(text: string | undefined): string[] {
  if (text === undefined) return [];
  const g = parse(text) as {
    gates?: Record<string, { cmd?: string; optional?: boolean } | null>;
    order?: string[];
  } | null;
  const gates = g?.gates ?? {};
  return (g?.order ?? Object.keys(gates))
    .map((n) => gates[n])
    .filter((x): x is { cmd: string } => !!x?.cmd && !x.optional)
    .map((x) => x.cmd);
}

/**
 * Reads the shape of `gates.yaml` that reins writes (024 S-16) with POSIX awk and prints the required
 * commands, one per line, in order: `order` when it is there (names not in `gates` are skipped, gates
 * not in `order` do not run), else the order of `gates`; `optional: true` is skipped. On any other shape
 * inside `gates:` or `order:` it prints `line <n>: <reason>` and exits 3.
 */
const AWK = String.raw`
function fail(why) { print "line " NR ": " why; bad = 1; exit 3 }
function rest(r) {
  sub(/^ +/, "", r)
  if (r != "" && substr(r, 1, 1) != "#") fail("text after a quoted value")
}
function value(v,   out, c, i, n) {
  sub(/^ +/, "", v)
  if (v == "") return ""
  c = substr(v, 1, 1)
  if (c == "|" || c == ">") fail("a multi-line value")
  if (c == "&" || c == "*") fail("an anchor or alias")
  if (c == "{" || c == "[") fail("flow style")
  if (c == "'") {
    out = ""; n = length(v)
    for (i = 2; i <= n; i++) {
      c = substr(v, i, 1)
      if (c == "'") {
        if (substr(v, i + 1, 1) == "'") { out = out "'"; i++; continue }
        rest(substr(v, i + 1)); return out
      }
      out = out c
    }
    fail("an unclosed quote")
  }
  if (c == "\"") {
    out = ""; n = length(v)
    for (i = 2; i <= n; i++) {
      c = substr(v, i, 1)
      if (c == "\\") {
        c = substr(v, i + 1, 1)
        if (c != "\"" && c != "\\") fail("an escape other than a quote or a backslash")
        out = out c; i++; continue
      }
      if (c == "\"") { rest(substr(v, i + 1)); return out }
      out = out c
    }
    fail("an unclosed quote")
  }
  if (match(v, / #/)) v = substr(v, 1, RSTART - 1)
  sub(/ +$/, "", v)
  return v
}
function word(v) { sub(/^ +/, "", v); sub(/ +#.*$/, "", v); sub(/ +$/, "", v); return v }
{ sub(/\r$/, "") }
/^[ \t]*$/ || /^[ \t]*#/ { next }
/^\t/ || /^ +\t/ { if (sec == "gates" || sec == "order") fail("a tab in the indentation"); next }
/^[^ ]/ {
  sec = $0; sub(/:.*/, "", sec)
  if (sec == "gates") hasGates = 1
  if (sec == "order") hasOrder = 1
  if (sec == "gates" || sec == "order") {
    t = $0; sub(/^[^:]*:/, "", t); t = word(t)
    # the empty collections written for no gate (gates: {}, order: []) are read; other flow style is not
    if ((t == "{}" && sec == "gates") || (t == "[]" && sec == "order")) { sec = ""; next }
    if (t != "") fail("flow style")
  }
  next
}
sec == "gates" && /^  [^ ]/ {
  if (!match($0, /^  [^ :]+:/)) fail("a gate that is not a name")
  name = substr($0, 3, RLENGTH - 3)
  if (word(substr($0, RLENGTH + 1)) != "") fail("flow style")
  if (name in seen) fail("the gate " name " twice")
  seen[name] = 1; names[++count] = name
  next
}
sec == "gates" && /^    [^ ]/ {
  if (name == "") fail("a key outside a gate")
  key = $0; sub(/^ +/, "", key); sub(/:.*/, "", key)
  t = $0; sub(/^ *[^:]*:/, "", t)
  if (key == "cmd") { cmd[name] = value(t); if (cmd[name] == "") fail("an empty cmd") }
  else if (key == "optional") { if (word(t) == "true") opt[name] = 1 }
  else value(t)
  next
}
sec == "gates" { fail("a multi-line value") }
sec == "order" && /^  - / { o = $0; sub(/^  - +/, "", o); order[++ocount] = word(o); next }
sec == "order" { fail("an order entry that is not a list item") }
END {
  if (bad) exit 3
  # an empty or unrelated file is no gates.yaml: it must not pass without checks
  if (!hasGates) { print "line " NR ": no gates section"; exit 3 }
  for (k = 1; k <= count; k++) if (!(names[k] in cmd)) { print "the gate " names[k] " has no cmd"; exit 3 }
  # order present, even empty, decides: order: [] runs nothing
  if (hasOrder) { for (k = 1; k <= ocount; k++) if ((order[k] in seen) && !(order[k] in opt)) print cmd[order[k]] }
  else for (k = 1; k <= count; k++) if (!(names[k] in opt)) print cmd[names[k]]
}
`;

const quote = (s: string): string => `'${s.replaceAll("'", `'\\''`)}'`;

/** The script. It holds no command: it reads gates.yaml every time it runs (024 S-15–S-17). */
export function renderGateScript(): string {
  return `#!/bin/sh
# generated by reins — do not edit; \`reins update\` rewrites it. The gates are in .agents/harness/gates.yaml.
#
# Reads .agents/harness/gates.yaml, runs its required checks in order and keeps their output in
# ${GATE_LOGS}/<tree>.log, where <tree> is the tree hash of what is checked: \`git rev-parse <commit>^{tree}\`
# names a commit's log. gates.yaml is read in the shape reins writes; another shape stops the run (exit 2).
# Usage: sh ${GATE_SCRIPT} <stage>   (pre-commit, pre-push, audit, or any name of your own)
stage="\${1:-manual}"
root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "run-gates: not inside a git work tree" >&2
  exit 2
}
cd "$root" || exit 2
# pre-commit checks what is about to be committed (the index git prepared for this commit); every other
# stage checks HEAD. The checks run in the work tree, so a work tree that differs from that tree — a
# changed file left out of it, or a file git does not track and does not ignore — is "dirty", and the run
# is no evidence for it.
worktree=dirty
if [ "$stage" = pre-commit ]; then
  tree=$(git write-tree 2>/dev/null)
  if git diff --quiet 2>/dev/null; then worktree=clean; fi
else
  tree=$(git rev-parse --verify --quiet 'HEAD^{tree}')
  if git diff --quiet HEAD 2>/dev/null; then worktree=clean; fi
fi
if [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then worktree=dirty; fi
[ -n "$tree" ] || {
  echo "run-gates: cannot tell which tree is being checked" >&2
  exit 2
}
dir=${GATE_LOGS}
mkdir -p "$dir" || exit 2
log="$dir/$tree.log"
status="$dir/.status.$$"
printf '== %s stage: %s worktree: %s\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$stage" "$worktree" >>"$log"
stop() {
  echo "run-gates: $1" >&2
  printf 'run-gates: %s\\nexit: 2\\n' "$1" >>"$log"
  exit 2
}
gates=.agents/harness/gates.yaml
[ -f "$gates" ] || stop "no $gates: nothing is checked without it"
cmds=$(awk ${quote(AWK)} "$gates") || stop "$gates $cmds"
code=0
run() {
  [ "$code" -eq 0 ] || return 0
  printf '$ %s\\n' "$1" | tee -a "$log"
  {
    sh -c "$1" 2>&1
    echo $? >"$status"
  } | tee -a "$log"
  code=$(cat "$status" 2>/dev/null || echo 1)
  rm -f "$status"
  # output that did not end its last line must not run into the next record
  if [ -n "$(tail -c 1 "$log")" ]; then echo >>"$log"; fi
}
if [ -z "$cmds" ]; then echo "no required gate" >>"$log"; fi
# the commands come on fd 3, so a gate still reads the hook's own stdin
while IFS= read -r c <&3; do
  if [ -n "$c" ]; then run "$c"; fi
done 3<<GATES
$cmds
GATES
printf 'exit: %s\\n' "$code" >>"$log"
exit "$code"
`;
}
