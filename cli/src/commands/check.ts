import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { currentBranch, isAncestor, repoRoot, stagedFiles } from '../lib/git.js';
import { harnessDir, secretPolicy } from '../lib/harness.js';
import { loadSchemas, schemaFor, validateFile } from '../lib/schema.js';
import { DEFAULT_ALLOWED, DEFAULT_SECRET_PATTERNS, isSecretPath } from '../lib/secrets.js';
import { findSkillFiles, splitFrontmatter, validateSkillFile } from '../lib/skills.js';
import { report, type Finding, type StopReport } from '../lib/verdict.js';

export interface CheckOptions {
  stage?: 'pre-commit' | 'pre-push' | 'test' | 'rc-close';
  drift?: boolean;
  cwd?: string;
  /** pre-push: the ref lines git passes on stdin (`<local ref> <local sha> <remote ref> <remote sha>`). */
  pushRefs?: string[];
}

const SKILL_ROOTS = ['skills', '.agents/skills', '.claude/skills'];
const LOCAL_DIRS = ['.loctx/', '.ai/'];

function gitignoreHas(root: string, entry: string): boolean {
  const p = join(root, '.gitignore');
  if (!existsSync(p)) return false;
  const lines = readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => l.trim());
  const bare = entry.replace(/\/$/, '');
  return lines.some((l) => l === entry || l === bare || l === `/${entry}` || l === `/${bare}`);
}

/** T2 — before a commit. */
export function preCommit(root: string): Finding[] {
  const findings: Finding[] = [];
  const policy = secretPolicy(root);
  const patterns = policy?.patterns ?? DEFAULT_SECRET_PATTERNS;
  const allowed = policy?.allowed ?? DEFAULT_ALLOWED;
  const staged = stagedFiles(root);
  for (const f of staged) {
    const hit = isSecretPath(f, patterns, allowed);
    if (hit)
      findings.push({
        reason: 'C4',
        verdict: 'STOP',
        path: f,
        message: `staged file matches secret pattern "${hit}"`,
        resume: `git restore --staged -- "${f}" and add it to .gitignore`,
      });
    for (const d of LOCAL_DIRS)
      if (f.startsWith(d))
        findings.push({
          reason: 'F2',
          verdict: 'STOP',
          path: f,
          message: `${d} is local-only and must not be committed`,
          resume: `git restore --staged -- "${f}"; ensure "${d}" is in .gitignore`,
        });
  }
  const hasLocal = LOCAL_DIRS.some((d) => existsSync(join(root, d)));
  if (hasLocal && !LOCAL_DIRS.some((d) => gitignoreHas(root, d)))
    findings.push({
      reason: 'F2',
      verdict: 'STOP',
      message: 'local workspace exists but is not in .gitignore',
      resume: 'add ".loctx/" (or ".ai/") to .gitignore',
    });
  findings.push(...driftFormat(root, staged), ...driftConvention(root, staged));
  return findings;
}

/** T4 — before leaving the machine. */
export function prePush(root: string, refs: string[]): Finding[] {
  const findings: Finding[] = [];
  const ZERO = /^0+$/;
  for (const line of refs) {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
    if (!localSha || !remoteSha || !remoteRef) continue;
    if (ZERO.test(remoteSha) || ZERO.test(localSha)) continue; // new branch or deletion
    if (!isAncestor(remoteSha, localSha, root))
      findings.push({
        reason: 'A1',
        verdict: 'HOLD',
        path: remoteRef,
        message: `push of ${localRef ?? '?'} would rewrite ${remoteRef} (remote commit is not an ancestor)`,
        resume: 'this is a force push — the user must run it explicitly, every time',
      });
  }
  return findings;
}

/** Drift, format layer — Agent Skills spec on SKILL.md files. */
export function driftFormat(root: string, only?: string[]): Finding[] {
  const files = findSkillFiles(SKILL_ROOTS.map((r) => join(root, r)));
  const chosen = only ? files.filter((f) => only.includes(relative(root, f))) : files;
  return chosen.flatMap((f) =>
    validateSkillFile(f).map<Finding>((i) => ({
      reason: 'F2',
      verdict: 'STOP',
      path: relative(root, i.path),
      message: i.message,
      resume: 'fix the SKILL.md frontmatter; see agentskills.io/specification',
    })),
  );
}

/** Files the convention layer looks at: harness sources plus the installed project's agent files. */
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Drift, convention layer — frontmatter schemas and role files (design §6). */
export function driftConvention(root: string, only?: string[]): Finding[] {
  const dir = harnessDir(root);
  if (!dir) return [];
  const schemas = loadSchemas(dir);
  const findings: Finding[] = [];
  const candidates = [
    ...walk(join(dir, 'templates')),
    ...walk(join(dir, 'knowledge-seeds')),
    ...walk(join(root, '.agents', 'intent')),
    ...walk(join(root, '.agents', 'knowledge')),
    ...walk(join(root, '.loctx', 'ticket')),
    ...walk(join(root, '.loctx', 'bus')),
  ];
  for (const abs of candidates) {
    const rel = relative(root, abs);
    if (only && !only.includes(rel)) continue;
    const m = schemaFor(rel);
    if (!m) continue;
    const v = schemas.get(m.schema);
    if (!v) continue;
    for (const i of validateFile(v, abs, m.whole))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: rel,
        message: `${m.schema}: ${i.message}`,
        resume: `fix the frontmatter to match ${m.schema}.schema.json`,
      });
  }
  // role files: role == file name, must_not present
  const roles = join(dir, 'roles');
  if (existsSync(roles))
    for (const f of readdirSync(roles).filter((x) => x.endsWith('.md'))) {
      const rel = relative(root, join(roles, f));
      if (only && !only.includes(rel)) continue;
      const { data, error } = splitFrontmatter(readFileSync(join(roles, f), 'utf8'));
      const name = basename(f, '.md');
      if (error)
        findings.push({
          reason: 'F2',
          verdict: 'STOP',
          path: rel,
          message: `frontmatter is not valid YAML: ${error}`,
        });
      else if (!data || data['role'] !== name)
        findings.push({
          reason: 'F2',
          verdict: 'STOP',
          path: rel,
          message: `role file must declare role: ${name}`,
        });
      else if (!Array.isArray(data['must_not']) || data['must_not'].length === 0)
        findings.push({
          reason: 'F2',
          verdict: 'STOP',
          path: rel,
          message: 'must_not is the enforced source and cannot be empty',
        });
    }
  return findings;
}

export function runCheck(opts: CheckOptions): StopReport {
  const root = repoRoot(opts.cwd ?? process.cwd());
  const findings: Finding[] = [];
  const stage = opts.stage ?? (opts.drift ? 'drift' : 'all');
  if (opts.stage === 'pre-commit') findings.push(...preCommit(root));
  else if (opts.stage === 'pre-push') findings.push(...prePush(root, opts.pushRefs ?? []));
  else if (opts.stage) {
    // test / rc-close: not implemented yet — say so instead of pretending
    findings.push({
      reason: 'F2',
      verdict: 'STOP',
      message: `stage "${opts.stage}" is not implemented yet`,
      resume: 'implemented in work item 4-2 (harness sources) and later',
    });
  }
  if (opts.drift || !opts.stage) findings.push(...driftFormat(root), ...driftConvention(root));
  if (!currentBranch(root))
    findings.push({ reason: 'F2', verdict: 'STOP', message: 'not a git repository' });
  return report(stage, findings);
}
