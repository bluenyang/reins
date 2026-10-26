import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { compound } from '../src/commands/gate.js';
import { configureGates } from '../src/commands/configure.js';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker, type Asker } from '../src/lib/ask.js';
import { discoverGates } from '../src/lib/detect.js';

function fixture(): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-gp-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  const w = (p: string, c: string) => {
    mkdirSync(join(d, p, '..'), { recursive: true });
    writeFileSync(join(d, p), c);
  };
  w('package.json', JSON.stringify({ scripts: { build: 'tsc' } }));
  w('pnpm-lock.yaml', '');
  w(
    'apps/desktop/package.json',
    JSON.stringify({
      scripts: { typecheck: 'tsc --noEmit', test: 'vitest run', lint: 'eslint --fix .' },
    }),
  );
  w('server/go.mod', 'module x\n');
  w('server/Makefile', 'check: vet\ntest:\n\tgo test ./...\n');
  w('node_modules/x/package.json', JSON.stringify({ scripts: { test: 'x' } }));
  w('a/b/c/d/package.json', JSON.stringify({ scripts: { test: 'x' } })); // depth 4
  return d;
}

const gatesOf = (d: string) =>
  parse(readFileSync(join(d, '.agents/harness/gates.yaml'), 'utf8')) as {
    gates: Record<string, { cmd: string }>;
    order: string[];
  };

describe('subdirectory gate proposals (spec S-5)', () => {
  it('keeps root gates apart from proposals and skips node_modules and deep dirs', () => {
    const r = discoverGates(fixture());
    expect(r.gates.map((g) => g.name)).toEqual(['build']);
    const cmds = r.proposals.map((p) => p.cmd);
    expect(cmds).toContain('pnpm --dir apps/desktop typecheck');
    expect(cmds).toContain('pnpm --dir apps/desktop test');
    expect(cmds).toContain('go -C server test ./...');
    expect(cmds).toContain('go -C server vet ./...');
    expect(cmds).toContain('make -C server check');
    expect(r.proposals.map((p) => p.name)).toContain('server-test'); // the first in path/source order keeps the plain name
    expect(cmds.some((c) => c.includes('node_modules'))).toBe(false);
    expect(cmds.some((c) => c.includes('a/b/c/d'))).toBe(false);
    expect(cmds.some((c) => c.includes('apps/desktop lint'))).toBe(false); // mutating
    expect(r.proposals.map((p) => p.name)).toContain('apps-desktop-typecheck');
    for (const p of r.proposals) expect(compound(p.cmd)).toBe(false);
  });

  it('takes the runner from the directory lock file', () => {
    const d = fixture();
    writeFileSync(join(d, 'apps/desktop/package-lock.json'), '{}');
    const cmds = discoverGates(d).proposals.map((p) => p.cmd);
    expect(cmds).toContain('npm --prefix apps/desktop run test');
  });
});

function collisionFixture(): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-gp-col-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  const w = (p: string, c: string) => {
    mkdirSync(join(d, p, '..'), { recursive: true });
    writeFileSync(join(d, p), c);
  };
  w('package.json', JSON.stringify({ scripts: { build: 'tsc' } }));
  w('a-b/package.json', JSON.stringify({ scripts: { test: 'vitest run' } }));
  w('a/b/package.json', JSON.stringify({ scripts: { test: 'jest' } }));
  w('svc/package.json', JSON.stringify({ scripts: { test: 'vitest run' } }));
  w('svc/Makefile', 'test:\n\techo\n');
  return d;
}

describe('proposal name collisions', () => {
  it('keeps every candidate under a distinct, deterministic name', () => {
    const p = discoverGates(collisionFixture()).proposals;
    expect(new Set(p.map((x) => x.name)).size).toBe(p.length);
    const byCmd = Object.fromEntries(p.map((x) => [x.cmd, x.name]));
    expect(byCmd['npm --prefix a-b run test']).toBe('a-b-test');
    expect(byCmd['npm --prefix a/b run test']).toBe('a-b-test-npm');
    expect(byCmd['npm --prefix svc run test']).toBe('svc-test');
    expect(byCmd['make -C svc test']).toBe('svc-test-make');
    expect(p.map((x) => x.name)).toEqual(
      discoverGates(collisionFixture()).proposals.map((x) => x.name),
    );
  });

  it('each colliding candidate can be picked through install and configure gates', async () => {
    const names = discoverGates(collisionFixture()).proposals.map((x) => x.name);
    for (const n of ['a-b-test', 'a-b-test-npm', 'svc-test', 'svc-test-make']) {
      const d = collisionFixture();
      const asker: Asker = {
        ask: async (q, f) => (q.startsWith('subdirectory gates') ? n : f),
        close: () => {},
      };
      await runInstall({ tier: 'loop', mode: 'manual', asker, cwd: d });
      expect(gatesOf(d).order).toEqual(['build', n]);
      const e = collisionFixture();
      await runInstall({ tier: 'loop', mode: 'auto', asker: defaultsAsker, cwd: e });
      expect(configureGates({ cwd: e, add: [n] }).added).toEqual([n]);
      expect(gatesOf(e).order).toEqual(['build', n]);
    }
    expect(names).toHaveLength(4);
  });
});

describe('install (spec S-6)', () => {
  it('manual records only the chosen proposal; auto reports them in notes', async () => {
    const d = fixture();
    const asker: Asker = {
      ask: async (q, f) => (q.startsWith('subdirectory gates') ? 'server-test-go' : f),
      close: () => {},
    };
    await runInstall({ tier: 'loop', mode: 'manual', asker, cwd: d });
    const g = gatesOf(d);
    expect(g.order).toEqual(['build', 'server-test-go']);
    expect(g.gates['server-test-go']!.cmd).toBe('go -C server test ./...');

    const a = fixture();
    const r = await runInstall({ tier: 'loop', mode: 'auto', asker: defaultsAsker, cwd: a });
    expect(gatesOf(a).order).toEqual(['build']);
    expect(r.notes.some((n) => n.includes('server-test-go'))).toBe(true);
  });
});

describe('reins configure gates (spec S-7)', () => {
  it('lists missing proposals, appends with comments kept, refuses unknown names', async () => {
    const d = fixture();
    await runInstall({ tier: 'loop', mode: 'auto', asker: defaultsAsker, cwd: d });
    const path = join(d, '.agents/harness/gates.yaml');
    const before = readFileSync(path, 'utf8');
    expect(before).toContain('# discovered by reins install');

    const bad = configureGates({ cwd: d, add: ['nope'] });
    expect(bad.code).toBe(1);
    expect(readFileSync(path, 'utf8')).toBe(before);

    expect(configureGates({ cwd: d }).available.map((g) => g.name)).toContain('server-test-go');
    const r = configureGates({ cwd: d, add: ['server-test-go'] });
    expect(r.added).toEqual(['server-test-go']);
    const g = gatesOf(d);
    expect(g.order).toEqual(['build', 'server-test-go']);
    expect(Object.keys(g.gates)).toEqual(['build', 'server-test-go']);
    expect(readFileSync(path, 'utf8')).toContain('# discovered by reins install');
    expect(configureGates({ cwd: d }).available.map((x) => x.name)).not.toContain('server-test-go');
    expect(configureGates({ cwd: d, add: ['server-test-go'] }).code).toBe(1);
  });
});
