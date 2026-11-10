import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Robustness of the built CLI (intent 004, C-7 and C-8): a repository without commits, and stdout closed early.
 * `test/e2e/build.ts` (vitest globalSetup) builds first.
 */

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const CLI = join(ROOT, 'cli', 'dist', 'reins.js');
const dirs: string[] = [];

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    stdio: ['ignore', 'ignore', 'ignore'],
  });

function repo(): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-robust-'));
  dirs.push(d);
  git(d, 'init', '-q');
  return d;
}

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('robustness of the built cli', () => {
  it('outside a git repository, or without git on PATH, a command says so in one line and exits 2 (019 ST-8)', () => {
    const plain = mkdtempSync(join(tmpdir(), 'reins-nogit-'));
    dirs.push(plain);
    const run = (cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) =>
      spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: 'utf8' });
    // a folder that is no repository (the GIT_CEILING_DIRECTORIES keeps git from finding one above it)
    const env = { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() };
    for (const args of [
      ['install', '--mode', 'auto'],
      ['update'],
      ['config', 'bindings', '--show'],
    ]) {
      const r = run(plain, env, ...args);
      expect(r.status, args.join(' ')).toBe(2);
      expect(r.stderr.trim()).toBe(
        `reins ${args[0]}: not a git repository (or git is not installed) — run git init here first`,
      );
      expect(r.stderr).not.toMatch(/node:internal|at .*\.js:\d+/);
    }
    // git not on PATH at all, inside a real repository — only where node's folder holds no git
    const nodeDir = dirname(process.execPath);
    if (!['git', 'git.exe'].some((g) => existsSync(join(nodeDir, g)))) {
      const d = repo();
      const noGit = run(
        d,
        { ...process.env, PATH: nodeDir, Path: nodeDir },
        'install',
        '--mode',
        'auto',
      );
      expect(noGit.status).toBe(2);
      expect(noGit.stderr).toContain('not a git repository (or git is not installed)');
    }
  });

  it('a closed stdout ends any command quietly, not only check (install, update)', async () => {
    const d = repo();
    for (const args of [
      ['install', '--mode', 'auto', '--dry-run'],
      ['install', '--mode', 'auto'],
      ['update', '--dry-run'],
    ]) {
      const spawned = spawn(process.execPath, [CLI, ...args], {
        cwd: d,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      spawned.stdout.destroy();
      let stderr = '';
      spawned.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
      const code = await new Promise<number | null>((res) => spawned.on('close', res));
      expect(stderr, args.join(' ')).not.toMatch(/EPIPE|Unhandled/);
      expect(code, args.join(' ')).toBe(0);
    }
  });
});
