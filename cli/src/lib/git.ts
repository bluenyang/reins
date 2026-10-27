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

export function repoRoot(cwd: string): string {
  return git(['rev-parse', '--show-toplevel'], cwd);
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
