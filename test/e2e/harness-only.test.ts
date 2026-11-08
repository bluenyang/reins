import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Intent 019 V-1 and V-2: what reins installs never runs reins, and works without reins or a network.
 * Runs the built CLI (`test/e2e/build.ts` builds it first).
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
  const d = mkdtempSync(join(tmpdir(), 'reins-only-'));
  dirs.push(d);
  git(d, 'init', '-q');
  writeFileSync(join(d, 'package.json'), JSON.stringify({ scripts: { check: 'node -e 0' } }));
  mkdirSync(join(d, '.husky'));
  return d;
}

const reins = (cwd: string, ...args: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, REINS_NO_VENDOR_SPAWN: '1' },
  });
  expect(r.status, `${args.join(' ')}: ${r.stderr}`).toBe(0);
  return r.stdout;
};

function files(root: string, dir = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(root, dir))) {
    if (e === '.git') continue;
    const rel = dir ? `${dir}/${e}` : e;
    if (statSync(join(root, rel)).isDirectory()) out.push(...files(root, rel));
    else out.push(rel);
  }
  return out;
}

/** A line that runs reins: npx of the package, the built bin, or a work-time subcommand. */
const RUNS_REINS =
  /npx[^\n]*@bluenyang\/reins|node [^\s]*reins\.js|(^|[\s`(])reins (check|gate|new|status|metrics|retro|knowledge|unit|approve|audit|hook|dispatch|recall)\b/m;

/** Generated text may tell a person which command to run in a terminal; the harness changelog is history. */
const PEOPLE_ONLY = new Set(['.agents/harness/CHANGELOG.md']);

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('what reins installs never runs reins (019 V-1)', () => {
  for (const mode of ['single', 'multi'] as const)
    it(`${mode}: no generated file runs reins; hooks run the project's gates`, () => {
      const d = repo();
      reins(d, 'install', '--mode', 'auto', '--hooks');
      if (mode === 'multi')
        reins(
          d,
          'config',
          'bindings',
          '--mode',
          'multi',
          '--set',
          'implementer=claude-sonnet-5-5',
          'executor=claude-haiku-5-5',
          '--models',
          'pl=claude-sonnet-5-5,openai:gpt-6.1-terra',
          'advisor=claude-fable-5-1,openai:gpt-6.1-sol',
        );
      const offenders = files(d)
        .filter((f) => !PEOPLE_ONLY.has(f))
        .filter((f) => RUNS_REINS.test(readFileSync(join(d, f), 'utf8')));
      expect(offenders).toEqual([]);
      const hook = readFileSync(join(d, '.husky/pre-commit'), 'utf8');
      expect(hook).toContain('npm run check');
    });
});

describe('the installed harness works without reins and without a network (019 V-2)', () => {
  // a POSIX shell with a narrowed PATH; Windows runners are covered by V-1
  it.skipIf(process.platform === 'win32')(
    'a commit through the installed hook runs with reins off PATH and no npm registry',
    () => {
      const d = repo();
      reins(d, 'install', '--mode', 'auto', '--hooks');
      // a PATH with git and node only, and a registry that cannot be reached
      const bin = mkdtempSync(join(tmpdir(), 'reins-bin-'));
      dirs.push(bin);
      const env = {
        PATH: [
          join(process.execPath, '..'),
          ...(process.env['PATH'] ?? '')
            .split(delimiter)
            .filter((p) => /git/i.test(p) || p === '/usr/bin' || p === '/bin'),
        ].join(delimiter),
        HOME: bin,
        npm_config_registry: 'http://127.0.0.1:9',
        npm_config_offline: 'true',
      };
      const hook = readFileSync(join(d, '.husky/pre-commit'), 'utf8').replace(/^#.*$/gm, '').trim();
      const r = spawnSync('sh', ['-c', hook], { cwd: d, env, encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
      git(d, 'add', '-A');
      git(d, 'commit', '-q', '-m', 'installed');
      expect(spawnSync('git', ['log', '--oneline'], { cwd: d, encoding: 'utf8' }).stdout).toContain(
        'installed',
      );
    },
  );
});
