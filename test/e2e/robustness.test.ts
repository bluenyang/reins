import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  it('a closed stdout ends any command quietly, not only check (install, update)', async () => {
    const d = repo();
    for (const args of [
      ['install', 'graph', '--mode', 'auto', '--dry-run'],
      ['install', 'graph', '--mode', 'auto'],
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
