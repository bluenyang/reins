import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Where a drift check reads file contents from: the working tree, or the git index (what a commit would contain). */
export interface Reader {
  /** Contents of a repository-relative path, or undefined when it is absent. */
  read(rel: string): string | undefined;
  /** Repository-relative paths of the files under a repository-relative directory (recursive). */
  list(relDir: string): string[];
}

export function workTreeReader(root: string): Reader {
  const walk = (rel: string, out: string[]): string[] => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return out;
    for (const e of readdirSync(abs)) {
      const r = `${rel}/${e}`;
      if (statSync(join(root, r)).isDirectory()) walk(r, out);
      else out.push(r);
    }
    return out;
  };
  return {
    read: (rel) => {
      const abs = join(root, rel);
      return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : undefined;
    },
    list: (relDir) => walk(relDir.replace(/\/$/, ''), []),
  };
}

/** Reads with `git show :<path>`; a path that is not in the index is absent. Only the paths asked for are read. */
export function indexReader(root: string): Reader {
  const run = (args: string[]): string | undefined => {
    try {
      return execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return undefined;
    }
  };
  return {
    read: (rel) => run(['show', `:${rel}`]),
    list: (relDir) =>
      (run(['ls-files', '-z', '--', `${relDir.replace(/\/$/, '')}/`]) ?? '')
        .split('\0')
        .filter(Boolean),
  };
}
