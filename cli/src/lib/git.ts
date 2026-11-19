import { execFileSync } from 'node:child_process';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export function stagedFiles(cwd: string): string[] {
  const out = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], cwd);
  return out ? out.split(/\r?\n/) : [];
}

/** The checked-out branch; on a repository without commits `rev-parse` fails, so ask for the symbolic ref instead. */
export function currentBranch(cwd: string): string {
  try {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  } catch {
    try {
      return git(['symbolic-ref', '--short', 'HEAD'], cwd);
    } catch {
      return '';
    }
  }
}

export function isAncestor(ancestor: string, descendant: string, cwd: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Why a command cannot find its repository (spec 019 ST-8): every command stops with this one line instead of
 * a stack trace. Only a folder outside a repository is told to run git init; any other git failure keeps git's
 * own words (dubious ownership, permissions, a broken config).
 */
export class NotARepository extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotARepository';
  }
}

export function repoRoot(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // git's own messages in English, so "not a git repository" can be recognised
      env: { ...process.env, LC_ALL: 'C', LANGUAGE: 'C' },
    }).trim();
  } catch (e) {
    const err = e as { code?: string; stderr?: string };
    if (err.code === 'ENOENT') throw new NotARepository('git is not installed or not on PATH');
    const said = String(err.stderr ?? '').trim();
    if (/not a git repository/i.test(said))
      throw new NotARepository('not a git repository — run git init here first');
    throw new NotARepository(
      `git cannot read this repository: ${said.split(/\r?\n/)[0] || 'unknown error'}`,
    );
  }
}

/** Subjects of the commits an update of an existing ref adds: `remote..local`. */
export function pushedSubjects(remoteSha: string, localSha: string, cwd: string): string[] {
  try {
    const out = git(['log', '--format=%s', `${remoteSha}..${localSha}`], cwd);
    return out ? out.split(/\r?\n/) : [];
  } catch {
    return [];
  }
}
