import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { prePush } from '../src/commands/check.js';

let d = '';
const git = (...a: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], {
    cwd: d,
    encoding: 'utf8',
  }).trim();
const commit = (m: string) => {
  git('commit', '-q', '--allow-empty', '-m', m);
  return git('rev-parse', 'HEAD');
};

let base = '';
let feature = '';
let releaseOnly = '';
let mixed = '';
beforeAll(() => {
  d = mkdtempSync(join(tmpdir(), 'reins-prepush-'));
  git('init', '-q', '-b', 'master');
  base = commit('base');
  feature = commit('feat(x): work');
  git('reset', '-q', '--hard', base);
  releaseOnly = commit('release: v0.1.3');
  git('reset', '-q', '--hard', base);
  commit('release: v0.1.3');
  mixed = commit('feat(x): sneaky');
});
afterEach(() => vi.unstubAllEnvs());

const line = (local: string, remoteRef: string, remote = base) =>
  `${remoteRef} ${local} ${remoteRef} ${remote}`;

describe('T4 push to the default branch (A4)', () => {
  it('holds a local push to master', () => {
    vi.stubEnv('GITHUB_ACTIONS', '');
    const f = prePush(d, [line(feature, 'refs/heads/master')]);
    expect(f.map((x) => x.reason)).toEqual(['A4']);
    expect(f[0]?.verdict).toBe('HOLD');
  });
  it('holds a release commit when not running in GitHub Actions', () => {
    vi.stubEnv('GITHUB_ACTIONS', '');
    expect(prePush(d, [line(releaseOnly, 'refs/heads/main')]).map((x) => x.reason)).toEqual(['A4']);
  });
  it('lets a feature branch through', () => {
    vi.stubEnv('GITHUB_ACTIONS', '');
    expect(prePush(d, [line(feature, 'refs/heads/feat/x')])).toEqual([]);
  });
  it('lets the CI release commit through', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    expect(prePush(d, [line(releaseOnly, 'refs/heads/master')])).toEqual([]);
  });
  it('holds a range that mixes a release commit with another commit', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    expect(prePush(d, [line(mixed, 'refs/heads/master')]).map((x) => x.reason)).toEqual(['A4']);
  });
  it('holds creating master even under CI with a release-prefixed tip', () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    const zero = '0'.repeat(40);
    expect(prePush(d, [line(mixed, 'refs/heads/master', zero)]).map((x) => x.reason)).toEqual([
      'A4',
    ]);
  });
});
