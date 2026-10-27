import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  it('C-7: check, pre-commit and drift run in a repository without commits', () => {
    const d = repo();
    const inst = spawnSync(process.execPath, [CLI, 'install', 'graph', '--mode', 'auto'], {
      cwd: d,
      encoding: 'utf8',
    });
    expect(inst.status, inst.stderr).toBe(0);
    for (const args of [['check'], ['check', '--stage', 'pre-commit'], ['check', '--drift']]) {
      const r = spawnSync(process.execPath, [CLI, ...args], { cwd: d, encoding: 'utf8' });
      expect(r.stderr, args.join(' ')).not.toMatch(/\bat .*\(|Error|fatal/);
      expect([0, 10, 20], `${args.join(' ')}: ${r.stderr}`).toContain(r.status);
    }
  });

  it('C-8: a closed stdout ends quietly with the verdict code', async () => {
    const d = repo();
    const inst = spawnSync(process.execPath, [CLI, 'install', 'graph', '--mode', 'auto'], {
      cwd: d,
      encoding: 'utf8',
    });
    expect(inst.status, inst.stderr).toBe(0);
    // enough findings that the report is still being written after the reader has gone
    mkdirSync(join(d, '.loctx', 'ticket'), { recursive: true });
    for (let i = 0; i < 400; i++)
      writeFileSync(join(d, '.loctx', 'ticket', `bad-${i}.md`), '---\nnot: [valid\n---\n');
    const open = spawnSync(process.execPath, [CLI, 'check', '--drift'], {
      cwd: d,
      encoding: 'utf8',
    });
    expect(open.status).toBe(20); // the fixture really gives a non-zero verdict
    const spawned = spawn(process.execPath, [CLI, 'check', '--drift'], {
      cwd: d,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    spawned.stdout.destroy();
    let stderr = '';
    spawned.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    const code = await new Promise<number | null>((res) => spawned.on('close', res));
    expect(stderr).toBe('');
    expect(code).toBe(open.status);
  });
});
