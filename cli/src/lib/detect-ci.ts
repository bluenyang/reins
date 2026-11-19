import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/** A command a pull-request workflow runs (024 S-8), as one gate command from the repository root. */
export interface CiRun {
  /** `.github/workflows/<file>` */
  file: string;
  /** the command, rewritten to run from the root when the step had a `working-directory` */
  cmd: string;
  /** the step's working directory ('' for the root) */
  dir: string;
  /** the command as the step wrote it */
  raw: string;
}

const INSTALL = /^(?:(?:pnpm|yarn|bun|npm) (?:install|i|ci)\b|corepack enable\b|go mod download\b)/;

const onPullRequest = (on: unknown): boolean =>
  on === 'pull_request' ||
  (Array.isArray(on) && on.includes('pull_request')) ||
  (!!on && typeof on === 'object' && !Array.isArray(on) && 'pull_request' in on);

/** `cmd` run in `dir`, from the root, for the tools that take a directory option; null otherwise. */
export function fromDir(cmd: string, dir: string): string | null {
  if (!dir || dir === '.') return cmd;
  const [tool, ...rest] = cmd.split(' ');
  const r = rest.join(' ');
  switch (tool) {
    case 'pnpm':
      return `pnpm --dir ${dir} ${r}`;
    case 'yarn':
      return `yarn --cwd ${dir} ${r}`;
    case 'npm':
      return `npm --prefix ${dir} ${r}`;
    case 'go':
      return `go -C ${dir} ${r}`;
    case 'make':
      return `make -C ${dir} ${r}`;
    default:
      return null;
  }
}

/**
 * The one-line `run:` commands of the workflows that run on `pull_request` (024 S-8): no `${{`, one
 * command (`compound` false), not an install step and not `skip(cmd)`; a multi-line `run: |` is unclear
 * and left out, and so is a `working-directory` step whose tool takes no directory option.
 */
export function ciRuns(
  root: string,
  compound: (cmd: string) => boolean,
  skip: (cmd: string) => boolean,
): CiRun[] {
  const dir = join(root, '.github/workflows');
  if (!existsSync(dir)) return [];
  const out: CiRun[] = [];
  for (const f of readdirSync(dir).toSorted()) {
    if (!/\.ya?ml$/.test(f)) continue;
    let doc: { on?: unknown; jobs?: Record<string, { steps?: unknown[] } | null> } | null;
    try {
      doc = parse(readFileSync(join(dir, f), 'utf8')) as typeof doc;
    } catch {
      continue;
    }
    if (!doc || !onPullRequest(doc.on)) continue;
    for (const job of Object.values(doc.jobs ?? {}))
      for (const step of job?.steps ?? []) {
        const s = step as { run?: unknown; 'working-directory'?: unknown } | null;
        if (typeof s?.run !== 'string') continue;
        const raw = s.run.trim().replace(/\s+/g, ' ');
        // a block scalar (`run: |`) keeps its newline even with one line in it
        if (s.run.includes('\n') || raw.includes('${{') || compound(raw)) continue;
        if (INSTALL.test(raw) || skip(raw)) continue;
        const wd =
          typeof s['working-directory'] === 'string'
            ? s['working-directory'].replace(/^\.\//, '').replace(/\/$/, '')
            : '';
        const cmd = fromDir(raw, wd);
        if (cmd) out.push({ file: `.github/workflows/${f}`, cmd, dir: wd === '.' ? '' : wd, raw });
      }
  }
  return out;
}
