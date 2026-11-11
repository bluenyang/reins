import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATE_LOGS, GATE_SCRIPT, renderGateScript, requiredGates } from '../src/lib/gate-script.js';

/**
 * Spec 021 V-4: the gate script, run for real in temporary repositories — as a git hook and by hand.
 * The gates are `node -e …` so the same commands run on every platform.
 */

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

/** `git commit` that reports instead of throwing, so a refused commit can be asserted. */
const commit = (cwd: string, ...args: string[]) =>
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', ...args], {
    cwd,
    encoding: 'utf8',
  });

const PASS = `node -e "console.log('gate one ok')"`;
const FAIL = `node -e "console.log('gate one broke'); process.exit(3)"`;
const SECOND = `node -e "console.log('gate two ran')"`;

/** A repository with one commit, the script for these gates, and it wired as pre-commit and pre-push hooks. */
function repo(cmds: string[]): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-gates-'));
  git(d, 'init', '-q');
  writeFileSync(join(d, '.gitignore'), '.loctx/\n');
  writeFileSync(join(d, 'a.txt'), 'a\n');
  writeFileSync(join(d, 'b.txt'), 'b\n');
  mkdirSync(join(d, '.agents/harness'), { recursive: true });
  writeFileSync(join(d, GATE_SCRIPT), renderGateScript(cmds));
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'first');
  mkdirSync(join(d, '.githooks'));
  for (const stage of ['pre-commit', 'pre-push']) {
    writeFileSync(join(d, '.githooks', stage), `#!/bin/sh\nsh ${GATE_SCRIPT} ${stage}\n`);
    chmodSync(join(d, '.githooks', stage), 0o755);
  }
  git(d, 'config', 'core.hooksPath', '.githooks');
  return d;
}

const tree = (d: string, rev = 'HEAD') => git(d, 'rev-parse', `${rev}^{tree}`);
const logs = (d: string) =>
  existsSync(join(d, GATE_LOGS)) ? readdirSync(join(d, GATE_LOGS)).toSorted() : [];
const log = (d: string, t: string) => readFileSync(join(d, GATE_LOGS, `${t}.log`), 'utf8');
const headers = (text: string) => text.split('\n').filter((l) => l.startsWith('== '));
const run = (d: string, stage: string) =>
  spawnSync('sh', [GATE_SCRIPT, stage], { cwd: d, encoding: 'utf8' });

describe('the gate script keeps the output of the project gates (021 S-9, S-10)', () => {
  it('(a) a passing commit leaves a log named after its tree, with the output and exit 0', () => {
    const d = repo([PASS]);
    writeFileSync(join(d, 'a.txt'), 'a2\n');
    git(d, 'add', '-A');
    const c = commit(d, '-m', 'second');
    expect(c.status, c.stderr).toBe(0);
    // the hook's output still reaches the terminal
    expect(c.stdout + c.stderr).toContain('gate one ok');
    expect(logs(d)).toEqual([`${tree(d)}.log`]);
    const text = log(d, tree(d));
    expect(headers(text)).toHaveLength(1);
    expect(headers(text)[0]).toMatch(
      /^== \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ stage: pre-commit worktree: clean$/,
    );
    expect(text).toContain(`$ ${PASS}\n`);
    expect(text).toContain('gate one ok');
    expect(text.trimEnd().split('\n').at(-1)).toBe('exit: 0');
  });

  it('(b, d) a failing gate stops the commit with its exit code, and the next gate does not run', () => {
    const d = repo([FAIL, SECOND]);
    const before = git(d, 'rev-parse', 'HEAD');
    writeFileSync(join(d, 'a.txt'), 'a2\n');
    git(d, 'add', '-A');
    const staged = git(d, 'write-tree');
    const c = commit(d, '-m', 'broken');
    expect(c.status).not.toBe(0);
    expect(git(d, 'rev-parse', 'HEAD')).toBe(before);
    const text = log(d, staged);
    expect(text).toContain('gate one broke');
    expect(text).not.toContain('gate two ran');
    expect(text.trimEnd().split('\n').at(-1)).toBe('exit: 3');
    // run by hand, the script returns the gate's own code
    expect(run(d, 'pre-commit').status).toBe(3);
  });

  it('(c, f2) commit -a and a commit of named paths are logged under the tree of that commit', () => {
    const d = repo([PASS]);
    // -a: nothing staged beforehand; git prepares the index for this commit only
    writeFileSync(join(d, 'a.txt'), 'a2\n');
    expect(commit(d, '-a', '-m', 'all').status).toBe(0);
    expect(logs(d)).toContain(`${tree(d)}.log`);
    expect(headers(log(d, tree(d)))[0]).toContain('worktree: clean');
    // named path: a.txt is changed too but stays out of the commit, so the work tree is not that tree
    writeFileSync(join(d, 'a.txt'), 'a3\n');
    writeFileSync(join(d, 'b.txt'), 'b2\n');
    expect(commit(d, 'b.txt', '-m', 'only b').status).toBe(0);
    expect(git(d, 'show', '--stat', '--format=', 'HEAD')).not.toContain('a.txt');
    expect(headers(log(d, tree(d)))[0]).toContain('worktree: dirty');
    // partly staged: the same
    writeFileSync(join(d, 'b.txt'), 'b3\n');
    git(d, 'add', 'b.txt');
    expect(commit(d, '-m', 'staged b').status).toBe(0);
    expect(headers(log(d, tree(d)))[0]).toContain('worktree: dirty');
  });

  it('(e) any other stage checks HEAD, and (f3) a second run of the same tree is appended', () => {
    const d = repo([PASS]);
    expect(run(d, 'pre-push').status).toBe(0);
    expect(run(d, 'audit').status).toBe(0);
    expect(logs(d)).toEqual([`${tree(d)}.log`]);
    const hs = headers(log(d, tree(d)));
    expect(hs.map((h) => /stage: (\S+)/.exec(h)![1])).toEqual(['pre-push', 'audit']);
    expect(log(d, tree(d)).match(/^exit: 0$/gm)).toHaveLength(2);
    // a work tree that is not HEAD says so
    writeFileSync(join(d, 'a.txt'), 'changed\n');
    run(d, 'audit');
    expect(headers(log(d, tree(d))).at(-1)).toContain('worktree: dirty');
  });

  it('(f4) makes the log folder itself, and works from a subdirectory', () => {
    const d = repo([PASS]);
    expect(existsSync(join(d, '.loctx'))).toBe(false);
    mkdirSync(join(d, 'sub'));
    const r = spawnSync('sh', [join('..', GATE_SCRIPT), 'manual'], {
      cwd: join(d, 'sub'),
      encoding: 'utf8',
    });
    expect(r.status, r.stderr).toBe(0);
    expect(logs(d)).toEqual([`${tree(d)}.log`]);
  });

  it('(f6) commits made again by a rebase have no log until each is checked out and run as "audit"', () => {
    const d = repo([PASS]);
    const base = git(d, 'rev-parse', '--abbrev-ref', 'HEAD');
    git(d, 'checkout', '-q', '-b', 'work');
    for (const n of ['one', 'two']) {
      writeFileSync(join(d, `${n}.txt`), `${n}\n`);
      git(d, 'add', '-A');
      expect(commit(d, '-m', n).status).toBe(0);
    }
    // the base moves, and the branch is rebuilt on it: new trees, and no hook ran for them
    git(d, 'checkout', '-q', base);
    writeFileSync(join(d, 'base.txt'), 'moved\n');
    git(d, 'add', '-A');
    git(d, 'commit', '-q', '--no-verify', '-m', 'base moves');
    git(d, 'checkout', '-q', 'work');
    git(d, 'rebase', '-q', base);
    const commits = git(d, 'rev-list', '--reverse', `${base}..work`).split('\n');
    expect(commits).toHaveLength(2);
    for (const c of commits) expect(logs(d)).not.toContain(`${tree(d, c)}.log`);
    // what the PM does before the audit (design §3-3)
    for (const c of commits) {
      git(d, 'checkout', '-q', '--detach', c);
      expect(run(d, 'audit').status).toBe(0);
      const text = log(d, tree(d, c));
      expect(headers(text)[0]).toMatch(/stage: audit worktree: clean$/);
      expect(text.trimEnd().split('\n').at(-1)).toBe('exit: 0');
    }
  });

  it('outside a repository it says so and exits 2', () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-nogit-'));
    writeFileSync(join(d, 'run-gates.sh'), renderGateScript([PASS]));
    const r = spawnSync('sh', ['run-gates.sh', 'manual'], {
      cwd: d,
      encoding: 'utf8',
      env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('not inside a git work tree');
  });
});

describe('the script is written from gates.yaml (021 S-9)', () => {
  const yaml = (extra = '') =>
    `schema: reins/gates@1\ngates:\n  check: { cmd: pnpm check }\n  slow: { cmd: pnpm e2e, optional: true }\n  build: { cmd: "pnpm build" }\n${extra}order: [build, check, slow]\n`;

  it('(f5) takes the required gates in the order of the file and leaves optional ones out', () => {
    expect(requiredGates(yaml())).toEqual(['pnpm build', 'pnpm check']);
    expect(requiredGates(undefined)).toEqual([]);
    const script = renderGateScript(requiredGates(yaml()));
    expect(script.indexOf("run 'pnpm build'")).toBeLessThan(script.indexOf("run 'pnpm check'"));
    expect(script).not.toContain('pnpm e2e');
  });

  it('(f) calls nothing but git, the shell and the gates', () => {
    const script = renderGateScript(['pnpm check']);
    expect(script).not.toMatch(/npx|@bluenyang|curl|wget|reins\.js/);
    expect(script.split('\n').filter((l) => /\breins\b/.test(l) && !l.startsWith('#'))).toEqual([]);
    expect(script).not.toMatch(/\bunset\b|\bexport\b/);
  });

  it('a command with quotes is written so the shell reads it back as it was', () => {
    const d = repo([`node -e "console.log('its' + 'fine')"`, `node -e 'console.log("single")'`]);
    const r = run(d, 'manual');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('itsfine');
    expect(r.stdout).toContain('single');
  });
});
