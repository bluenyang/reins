import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { currentBranch, isAncestor, repoRoot, stagedFiles } from '../lib/git.js';
import { harnessDir, secretPolicy } from '../lib/harness.js';
import { loadSchemas, schemaFor, validateFile } from '../lib/schema.js';
import { DEFAULT_ALLOWED, DEFAULT_SECRET_PATTERNS, isSecretPath } from '../lib/secrets.js';
import { findSkillFiles, splitFrontmatter, validateSkillFile } from '../lib/skills.js';
import { harnessVersion, packageHarness } from '../lib/upstream.js';
import { driftGenerated } from '../lib/vendor-write.js';
import { rcClose, ticketStart, verdictCheck } from './stages.js';
import { parse } from 'yaml';
import { report, type Finding, type StopReport } from '../lib/verdict.js';

export const STAGES = ['ticket-start', 'pre-commit', 'verdict', 'pre-push', 'rc-close'] as const;
export type Stage = (typeof STAGES)[number];

export interface CheckOptions {
  stage?: Stage;
  drift?: boolean;
  cwd?: string;
  /** pre-push: the ref lines git passes on stdin (`<local ref> <local sha> <remote ref> <remote sha>`). */
  pushRefs?: string[];
  /** ticket-start, verdict: the ticket id (`001-1`). */
  ticket?: string;
  /** rc-close: the release version the rc closes. */
  release?: string;
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
  if (staged.some((f) => f.startsWith('harness/') || f.startsWith('.agents/harness/')))
    findings.push(...driftMatch(root));
  if (staged.some((f) => f.startsWith('.claude/') || f.startsWith('.agents/harness/')))
    findings.push(...driftGenerated(root));
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

/** Files in an installed harness that belong to the project, not upstream. */
const PROJECT_OWNED = new Set(['bindings.yaml', 'gates.yaml', 'install.yaml', 'generated.yaml']);

/** Drift, match layer — the installed `.agents/harness/` against the packaged upstream at the pinned version (design §6). */
export function driftMatch(root: string): Finding[] {
  const installed = join(root, '.agents', 'harness');
  const pinPath = join(installed, 'install.yaml');
  if (!existsSync(pinPath)) return [];
  let up: string;
  try {
    up = packageHarness();
  } catch {
    return [];
  }
  const pin = (parse(readFileSync(pinPath, 'utf8')) as { version?: string }).version;
  const upVersion = harnessVersion(up);
  if (pin !== upVersion)
    return [
      {
        reason: 'F2',
        verdict: 'WARN',
        path: '.agents/harness/install.yaml',
        message: `installed harness is v${pin}, upstream is v${upVersion}`,
        resume: 'run `reins update`',
      },
    ];
  const findings: Finding[] = [];
  for (const abs of walk(installed)) {
    const rel = relative(installed, abs);
    if (PROJECT_OWNED.has(rel)) continue;
    const src = join(up, rel);
    if (!existsSync(src)) continue;
    if (readFileSync(src, 'utf8') !== readFileSync(abs, 'utf8'))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: `.agents/harness/${rel}`,
        message: `differs from upstream v${upVersion} (harness files are not edited in place)`,
        resume: 'run `reins update` to restore it; change behaviour upstream or with an override',
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
  else if (opts.stage === 'ticket-start' || opts.stage === 'verdict') {
    if (!opts.ticket)
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        message: `stage  needs --ticket <id>`,
      });
    else
      findings.push(
        ...(opts.stage === 'ticket-start'
          ? ticketStart(root, opts.ticket)
          : verdictCheck(root, opts.ticket)),
      );
  } else if (opts.stage === 'rc-close') findings.push(...rcClose(root, opts.release));
  if (opts.drift || !opts.stage)
    findings.push(
      ...driftFormat(root),
      ...driftConvention(root),
      ...driftMatch(root),
      ...driftGenerated(root),
    );
  if (!currentBranch(root))
    findings.push({ reason: 'F2', verdict: 'STOP', message: 'not a git repository' });
  return report(stage, findings);
}
