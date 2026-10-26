import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { hasOwnSection, overrides, parseBlocks } from '../lib/blocks.js';
import { currentBranch, isAncestor, pushedSubjects, repoRoot, stagedFiles } from '../lib/git.js';
import { harnessRel, secretPolicy } from '../lib/harness.js';
import { loadSchemasFrom, schemaFor, validateFile } from '../lib/schema.js';
import { DEFAULT_ALLOWED, DEFAULT_SECRET_PATTERNS, isSecretPath } from '../lib/secrets.js';
import { splitFrontmatter, validateSkillFile } from '../lib/skills.js';
import { harnessVersion, packageHarness, packageSkills, tierSkills } from '../lib/upstream.js';
import { listFiles, relPath } from '../lib/fsx.js';
import { driftGenerated } from '../lib/vendor-write.js';
import { indexReader, workTreeReader, type Reader } from '../lib/reader.js';
import { PROJECT_OWNED, tierFiles, type Tier } from './install.js';
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
  const rd = indexReader(root);
  const policy = secretPolicy(root, rd);
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
  // S-1: the checks read the content the commit would contain (the index), not the working tree
  findings.push(...driftFormat(root, staged, rd), ...driftConvention(root, staged, rd));
  const under = (...dirs: string[]) => staged.some((f) => dirs.some((d) => f.startsWith(d)));
  if (under('harness/', '.agents/harness/', 'skills/', '.agents/skills/'))
    findings.push(...driftMatch(root, rd));
  if (staged.includes('AGENTS.md')) findings.push(...driftBlocks(root, rd));
  if (under('.claude/', '.agents/harness/', '.agents/skills/'))
    findings.push(...driftGenerated(root, rd));
  return findings;
}

/** T4 — before leaving the machine. */
export function prePush(root: string, refs: string[]): Finding[] {
  const findings: Finding[] = [];
  const ZERO = /^0+$/;
  for (const line of refs) {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
    if (!localSha || !remoteSha || !remoteRef) continue;
    if (/^refs\/heads\/(master|main)$/.test(remoteRef)) {
      // design §3 T4: work reaches the default branch by PR only; the publish workflow's version commit is the one exception
      // creating or deleting the ref has no range to judge: always held
      const subjects =
        ZERO.test(localSha) || ZERO.test(remoteSha)
          ? []
          : pushedSubjects(remoteSha, localSha, root);
      const releaseOnly =
        process.env.GITHUB_ACTIONS === 'true' &&
        subjects.length > 0 &&
        subjects.every((m) => m.startsWith('release: v'));
      if (!releaseOnly)
        findings.push({
          reason: 'A4',
          verdict: 'HOLD',
          path: remoteRef,
          message: `push to ${remoteRef.slice('refs/heads/'.length)} outside the PR flow`,
          resume:
            'push a type/topic branch and open a PR; the deploy role merges it when checks are green',
        });
    }
    if (ZERO.test(localSha) && remoteRef.startsWith('refs/tags/')) {
      findings.push({
        reason: 'A1',
        verdict: 'HOLD',
        path: remoteRef,
        message: `push deletes tag ${remoteRef.slice('refs/tags/'.length)}`,
        resume: 'deleting a published tag is irreversible — the user must run it explicitly',
      });
      continue;
    }
    if (ZERO.test(remoteSha) || ZERO.test(localSha)) continue; // new ref or branch deletion
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
export function driftFormat(
  root: string,
  only?: string[],
  rd: Reader = workTreeReader(root),
): Finding[] {
  const files = SKILL_ROOTS.flatMap((r) =>
    rd.list(r).filter((p) => /^[^/]+\/SKILL\.md$/.test(p.slice(r.length + 1))),
  );
  const chosen = only ? files.filter((f) => only.includes(f)) : files;
  return chosen.flatMap((f) =>
    validateSkillFile(join(root, f), rd.read(f)).map<Finding>((i) => ({
      reason: 'F2',
      verdict: 'STOP',
      path: relPath(root, i.path),
      message: i.message,
      resume: 'fix the SKILL.md frontmatter; see agentskills.io/specification',
    })),
  );
}

/** Drift, convention layer — frontmatter schemas and role files (design §6). */
export function driftConvention(
  root: string,
  only?: string[],
  rd: Reader = workTreeReader(root),
): Finding[] {
  const hrel = harnessRel(rd);
  if (!hrel) return [];
  const schemas = loadSchemasFrom(rd, hrel);
  const findings: Finding[] = [];
  const candidates = [
    `${hrel}/install.yaml`,
    ...rd.list(`${hrel}/templates`),
    ...rd.list(`${hrel}/knowledge-seeds`),
    ...rd.list('.agents/intent'),
    ...rd.list('.agents/knowledge'),
    ...rd.list('.loctx/ticket'),
    ...rd.list('.loctx/bus'),
  ];
  for (const rel of candidates) {
    if (only && !only.includes(rel)) continue;
    const text = rd.read(rel);
    if (text === undefined) continue;
    const m = schemaFor(rel);
    if (!m) continue;
    const v = schemas.get(m.schema);
    if (!v) continue;
    if (m.schema === 'knowledge' && rel.startsWith('.agents/knowledge/')) {
      // design §8: an entry reaches .agents/knowledge/ only through the user's approval (presets ship with the package)
      const { data } = splitFrontmatter(text);
      const ap = data?.['approved'] as { by?: unknown } | undefined;
      if (data && data['source'] !== 'preset' && !(ap && typeof ap.by === 'string' && ap.by))
        findings.push({
          reason: 'F2',
          verdict: 'STOP',
          path: rel,
          message: 'knowledge entry without approved',
          resume:
            'propose it with reins knowledge propose; the user approves, then reins knowledge accept',
        });
    }
    for (const i of validateFile(v, join(root, rel), m.whole, text))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: rel,
        message: `${m.schema}: ${i.message}`,
        resume: `fix the frontmatter to match ${m.schema}.schema.json`,
      });
  }
  // role files: role == file name, must_not present
  const roles = `${hrel}/roles`;
  for (const rel of rd.list(roles).filter((x) => /^[^/]+\.md$/.test(x.slice(roles.length + 1)))) {
    if (only && !only.includes(rel)) continue;
    const { data, error } = splitFrontmatter(rd.read(rel) ?? '');
    const name = basename(rel, '.md');
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
/** Drift, match layer — the installed `.agents/harness/` against the packaged upstream at the pinned version (design §6). */
export function driftMatch(root: string, rd: Reader = workTreeReader(root)): Finding[] {
  const installed = '.agents/harness';
  const pinText = rd.read(`${installed}/install.yaml`);
  if (pinText === undefined) return [];
  let up: string;
  try {
    up = packageHarness();
  } catch {
    return [];
  }
  const pinned = parse(pinText) as { version?: string; tier?: string };
  const pin = pinned.version;
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
  // only files this tier installs are compared; an upstream file it no longer installs (e.g. CHANGELOG.md
  // from a 0.1.0 install) is a leftover that `reins update` removes, not a hand edit
  const installs = new Set(tierFiles(listFiles(up), (pinned.tier ?? 'graph') as Tier));
  for (const entry of rd.list(installed)) {
    const rel = entry.slice(installed.length + 1);
    if (PROJECT_OWNED.has(rel)) continue;
    const src = join(up, rel);
    if (!existsSync(src)) continue;
    if (!installs.has(rel)) {
      findings.push({
        reason: 'F2',
        verdict: 'WARN',
        path: `.agents/harness/${rel}`,
        message: `upstream v${upVersion} no longer installs this file for the ${pinned.tier ?? 'graph'} tier`,
        resume: 'run `reins update` to remove it',
      });
      continue;
    }
    if (readFileSync(src, 'utf8') !== rd.read(entry))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: `.agents/harness/${rel}`,
        message: `differs from upstream v${upVersion} (harness files are not edited in place)`,
        resume: 'run `reins update` to restore it; change behaviour upstream or with an override',
      });
  }
  // installed skill entry points = the packaged ones
  const skillsUp = packageSkills();
  for (const name of tierSkills(pinned.tier ?? 'graph')) {
    const dir = `.agents/skills/${name}`;
    if (rd.list(dir).length === 0) continue;
    for (const f of listFiles(join(skillsUp, name))) {
      if (rd.read(`${dir}/${f}`) !== readFileSync(join(skillsUp, name, f), 'utf8'))
        findings.push({
          reason: 'F2',
          verdict: 'STOP',
          path: `.agents/skills/${name}/${f}`,
          message: `differs from the packaged skill (v${upVersion})`,
          resume: 'run `reins update`; a project-specific procedure belongs in its own skill',
        });
    }
  }
  return findings;
}

/** Compare a block for drift: CRLF to LF, trailing whitespace per line, blank lines around the content. */
function normBlock(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

/** Drift, managed blocks — AGENTS.md blocks against the packaged ones at the pinned version (design §5). */
export function driftBlocks(root: string, rd: Reader = workTreeReader(root)): Finding[] {
  const text = rd.read('AGENTS.md');
  if (text === undefined) return [];
  const pinText = rd.read('.agents/harness/install.yaml');
  if (pinText === undefined) return [];
  let upBlocks;
  try {
    const up = packageHarness();
    if ((parse(pinText) as { version?: string }).version !== harnessVersion(up)) return []; // driftMatch warns
    upBlocks = new Map(
      parseBlocks(readFileSync(join(up, 'templates/agents-md-blocks.md'), 'utf8')).map((b) => [
        b.name,
        b,
      ]),
    );
  } catch {
    return [];
  }
  const over = overrides(text);
  const findings: Finding[] = [];
  const have = parseBlocks(text);
  for (const [name, up] of upBlocks)
    if (!over.has(name) && !have.some((b) => b.name === name) && !hasOwnSection(text, up))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: 'AGENTS.md',
        message: `managed block "${name}" is missing`,
        resume: `run \`reins update\`, or add <!-- reins:override ${name} -->`,
      });
  for (const b of have) {
    const want = upBlocks.get(b.name);
    if (!want || over.has(b.name)) continue;
    if (normBlock(b.body) !== normBlock(want.body))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: 'AGENTS.md',
        message: `managed block "${b.name}" was edited by hand`,
        resume: `run \`reins update\`, or add <!-- reins:override ${b.name} -->`,
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
      ...driftBlocks(root),
      ...driftGenerated(root),
    );
  if (!currentBranch(root))
    findings.push({ reason: 'F2', verdict: 'STOP', message: 'not a git repository' });
  return report(stage, findings);
}
