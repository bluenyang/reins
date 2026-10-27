import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const read = (p: string): string => readFileSync(new URL(p, root), 'utf8');
const pkg = JSON.parse(read('package.json')) as {
  engines: { node: string };
  dependencies: Record<string, string>;
};

/** The lowest Node major a `>=x || ^y` engines range accepts. */
function minMajor(range: string): number {
  return Math.min(...[...range.matchAll(/(\d+)(?:\.\d+){0,2}/g)].map((m) => Number(m[1])));
}

describe('supported Node range (C-12)', () => {
  it('engines.node is >=22', () => {
    expect(pkg.engines.node).toBe('>=22');
  });

  it('no installed runtime dependency needs more than Node 22', () => {
    for (const name of Object.keys(pkg.dependencies)) {
      const dep = JSON.parse(read(`node_modules/${name}/package.json`)) as {
        engines?: { node?: string };
      };
      const needs = dep.engines?.node;
      if (needs) expect(minMajor(needs), `${name} engines ${needs}`).toBeLessThanOrEqual(22);
    }
  });

  it('commander is 14.x', () => {
    expect(pkg.dependencies.commander).toMatch(/^\^14\./);
    const installed = JSON.parse(read('node_modules/commander/package.json')) as {
      version: string;
    };
    expect(installed.version).toMatch(/^14\./);
  });

  it('no document still says Node 20', () => {
    for (const f of [
      'README.md',
      'docs/README.ko.md',
      'AGENTS.md',
      'docs/design.md',
      'docs/design.ko.md',
    ]) {
      expect(read(f), f).not.toMatch(/Node ≥ ?20|Node 20/);
    }
  });

  it('CONTRIBUTING (both editions) names the development Node 22.12', () => {
    expect(read('CONTRIBUTING.md')).toContain('22.12');
    expect(read('docs/CONTRIBUTING.ko.md')).toContain('22.12');
  });
});

interface Job {
  name?: string;
  needs?: string | string[];
  if?: string;
  strategy?: { 'fail-fast'?: boolean; matrix?: { os?: string[]; node?: number[] } };
  steps?: { run?: string; if?: string }[];
}

describe('CI matrix (C-11)', () => {
  const ci = parse(read('.github/workflows/ci.yml')) as { jobs: Record<string, Job> };

  it('runs three OS by Node 22 and 24 without fail-fast', () => {
    const m = ci.jobs['check-matrix']!;
    expect(m.strategy?.['fail-fast']).toBe(false);
    expect(m.strategy?.matrix?.os).toEqual(['ubuntu-latest', 'windows-latest', 'macos-latest']);
    expect(m.strategy?.matrix?.node).toEqual([22, 24]);
  });

  it('runs install, check and build on every leg and plugin validate on one', () => {
    const steps = ci.jobs['check-matrix']!.steps ?? [];
    const runs = steps.map((s) => s.run ?? '');
    expect(runs).toContain('pnpm install --frozen-lockfile');
    expect(runs).toContain('pnpm check');
    expect(runs).toContain('pnpm build');
    const validate = steps.filter((s) => (s.run ?? '').includes('plugin validate'));
    expect(validate).toHaveLength(1);
    expect(validate[0]!.if).toContain('ubuntu-latest');
    expect(validate[0]!.if).toContain('24');
  });

  it('keeps a job named exactly "check" that needs the matrix and always runs', () => {
    const c = ci.jobs['check']!;
    expect(c.name).toBe('check');
    expect(c.needs).toBe('check-matrix');
    expect(c.if).toContain('always()');
  });

  it('has a .gitattributes with eol=lf', () => {
    expect(existsSync(new URL('.gitattributes', root))).toBe(true);
    expect(read('.gitattributes')).toMatch(/^\* text=auto eol=lf$/m);
  });
});
