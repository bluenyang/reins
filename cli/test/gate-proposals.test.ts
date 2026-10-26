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
    expect(r.proposals.map((p) => p.name)).toContain('server-test'); // the Makefile target keeps the plain name
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

describe('install (spec S-6)', () => {
  it('manual records only the chosen proposal; auto reports them in notes', async () => {
    const d = fixture();
    const asker: Asker = {
      ask: async (q, f) => (q.startsWith('subdirectory gates') ? 'server-go-test' : f),
      close: () => {},
    };
    await runInstall({ tier: 'loop', mode: 'manual', asker, cwd: d });
    const g = gatesOf(d);
    expect(g.order).toEqual(['build', 'server-go-test']);
    expect(g.gates['server-go-test']!.cmd).toBe('go -C server test ./...');

    const a = fixture();
    const r = await runInstall({ tier: 'loop', mode: 'auto', asker: defaultsAsker, cwd: a });
    expect(gatesOf(a).order).toEqual(['build']);
    expect(r.notes.some((n) => n.includes('server-go-test'))).toBe(true);
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

    expect(configureGates({ cwd: d }).available.map((g) => g.name)).toContain('server-go-test');
    const r = configureGates({ cwd: d, add: ['server-go-test'] });
    expect(r.added).toEqual(['server-go-test']);
    const g = gatesOf(d);
    expect(g.order).toEqual(['build', 'server-go-test']);
    expect(Object.keys(g.gates)).toEqual(['build', 'server-go-test']);
    expect(readFileSync(path, 'utf8')).toContain('# discovered by reins install');
    expect(configureGates({ cwd: d }).available.map((x) => x.name)).not.toContain('server-go-test');
    expect(configureGates({ cwd: d, add: ['server-go-test'] }).code).toBe(1);
  });
});
