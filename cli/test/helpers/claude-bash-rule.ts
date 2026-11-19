/**
 * A stand-in for how Claude Code matches a `Bash(<pattern>)` permission rule against a command, for the
 * deny tests of 024 S-26: `*` is any run of characters (spaces and `/` included), everything else is
 * literal, and the whole command must match. It imitates the matching; it is no evidence of it (spec
 * 024, concern 2). `cli/src/lib/glob.ts` is a path glob (`*` stops at `/`) and must not be used here.
 */
export function bashRuleMatches(rule: string, command: string): boolean {
  const m = /^Bash\((.*)\)$/.exec(rule);
  if (!m) return false;
  const re = m[1]!
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${re}$`).test(command);
}

export const deniedBy = (rules: string[], command: string): string | undefined =>
  rules.find((r) => bashRuleMatches(r, command));
