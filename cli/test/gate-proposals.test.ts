import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { compound } from '../src/lib/detect.js';
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
  w(
    'server/Makefile',
    'check: vet\ntest:\n\tsh ./t.sh\n' /* 024 S-6: a recipe with go test would cover go -C server test */,
  );
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
      await runInstall({ mode: 'manual', asker, cwd: d });
      expect(gatesOf(d).order).toEqual(['build', n]);
      const e = collisionFixture();
      await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: e });
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
    await runInstall({ mode: 'manual', asker, cwd: d });
    const g = gatesOf(d);
    expect(g.order).toEqual(['build', 'server-test-go']);
    expect(g.gates['server-test-go']!.cmd).toBe('go -C server test ./...');

    const a = fixture();
    const r = await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: a });
    expect(gatesOf(a).order).toEqual(['build']);
    expect(r.notes.some((n) => n.includes('server-test-go'))).toBe(true);
  });
});

describe('reins configure gates (spec S-7)', () => {
  it('lists missing proposals, appends with comments kept, refuses unknown names', async () => {
    const d = fixture();
    await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d });
    const path = join(d, '.agents/harness/gates.yaml');
    const before = readFileSync(path, 'utf8');
    expect(before).toContain('# discovered by reins install');

    const bad = configureGates({ cwd: d, add: ['nope'] });
    expect(bad.code).toBe(1);
    expect(readFileSync(path, 'utf8')).toBe(before);

    expect(configureGates({ cwd: d }).available.map((g) => g.name)).toContain('server-test-go');
    const script = join(d, '.agents/harness/run-gates.sh');
    const scriptBefore = readFileSync(script, 'utf8');
    const r = configureGates({ cwd: d, add: ['server-test-go'] });
    expect(r.added).toEqual(['server-test-go']);
    // the gate script reads gates.yaml when it runs (024 S-17): adding a gate does not rewrite it
    expect(readFileSync(script, 'utf8')).toBe(scriptBefore);
    const g = gatesOf(d);
    expect(g.order).toEqual(['build', 'server-test-go']);
    expect(Object.keys(g.gates)).toEqual(['build', 'server-test-go']);
    expect(readFileSync(path, 'utf8')).toContain('# discovered by reins install');
    expect(configureGates({ cwd: d }).available.map((x) => x.name)).not.toContain('server-test-go');
    expect(configureGates({ cwd: d, add: ['server-test-go'] }).code).toBe(1);
  });
});

describe('root typecheck and lint (023 S-1..S-9)', () => {
  type Row = {
    id: string;
    scripts: Record<string, string>;
    names: string[];
    lock?: 'pnpm-lock.yaml' | 'package-lock.json' | 'yarn.lock';
    excluded?: string[];
    from?: Record<string, string>;
  };
  const S1 = { typecheck: 'tsc --noEmit', lint: 'oxlint .', test: 'vitest run', build: 'tsc' };
  const TC = { typecheck: 'tsc --noEmit', lint: 'oxlint .' };
  const rows: Row[] = [
    { id: '1 repro 1', scripts: S1, names: ['lint', 'typecheck', 'test', 'build'] },
    {
      id: '2 repro 2',
      scripts: { check: 'pnpm lint && pnpm test', ...S1 },
      names: ['check', 'typecheck', 'build'],
    },
    {
      id: '3 this repository',
      scripts: {
        build: 'tsc -p cli/tsconfig.json',
        typecheck: 'tsc -p cli/tsconfig.json --noEmit',
        lint: 'oxlint cli/src cli/test test',
        fmt: 'oxfmt --write cli/src cli/test test',
        'fmt:check': 'oxfmt --check cli/src cli/test test',
        test: 'vitest run',
        check: 'pnpm lint && pnpm fmt:check && pnpm typecheck && pnpm test',
        version: 'pnpm -s build && node cli/dist/scripts/sync-version.js',
        prepare: 'husky',
      },
      names: ['check', 'build'],
      excluded: ['fmt', 'prepare'], // 024 S-4: prepare is an install step
    },
    {
      id: '4 direct, same command',
      scripts: { check: 'oxlint . && tsc --noEmit && pnpm test', ...TC, test: 'vitest run' },
      names: ['check'],
    },
    {
      id: '5 direct, other command',
      scripts: {
        check: 'oxlint . && tsc -p . --noEmit && pnpm test',
        lint: 'oxlint src',
        typecheck: 'tsc --noEmit',
      },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '6 redirect',
      scripts: { check: 'tsc --noEmit 2>&1 && pnpm lint', ...TC },
      names: ['check'],
    },
    {
      id: '7 wrapped call',
      scripts: { check: 'pnpm exec tsc --noEmit && pnpm lint', ...TC },
      names: ['check', 'typecheck'],
    },
    {
      id: '8 other names',
      scripts: {
        check: 'pnpm lint:check && pnpm fmt:check && pnpm typecheck:watch && pnpm test',
        lint: 'oxlint .',
        'lint:check': 'oxlint . --deny-warnings',
        typecheck: 'tsc --noEmit',
        'typecheck:watch': 'tsc --noEmit --watch',
      },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '9 run-s',
      scripts: { check: 'run-s lint typecheck test', ...S1 },
      names: ['check', 'build'],
    },
    {
      id: '10 recursive',
      scripts: { check: 'pnpm -r lint && pnpm typecheck', ...TC },
      names: ['check', 'lint'],
    },
    {
      id: '11 filter',
      scripts: { check: 'pnpm --filter ./cli lint && pnpm typecheck', ...TC },
      names: ['check', 'lint'],
    },
    {
      id: '11b echo names the script without running it (A-5)',
      scripts: { check: 'echo lint && pnpm typecheck', ...TC },
      names: ['check', 'lint'],
    },
    {
      id: '11c another directory (A-5)',
      scripts: { check: 'pnpm --dir ./cli lint && npm --prefix web run typecheck', ...TC },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '11d yarn workspace and bun run (A-5)',
      scripts: { check: 'yarn workspace web lint && bun run typecheck', ...TC },
      names: ['check', 'lint'],
    },
    {
      id: '11e npm run-script; an option before the name does not count (A-5, A-6)',
      scripts: { check: 'npm run-script lint && pnpm --silent typecheck', ...TC },
      names: ['check', 'typecheck'],
    },
    {
      id: '11f an option before the name may hold a value (A-6)',
      scripts: {
        check: 'npm run --script-shell lint typecheck && npm-run-all --npm-path lint typecheck',
        ...TC,
      },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '11g attached short option values point elsewhere (A-6)',
      scripts: { check: 'pnpm -Fweb lint && pnpm -C./web typecheck', ...TC },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '11h quoted names and value-free run-all flags count (A-6)',
      scripts: { check: 'pnpm run "lint" && npm-run-all -p \'typecheck\'', ...TC },
      names: ['check'],
    },
    {
      id: '11j any option on a package manager command does not count (A-6)',
      scripts: { check: 'pnpm lint --quiet && npm run typecheck --help=true', ...TC },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '11i help instead of a run (A-6)',
      scripts: { check: 'npm run lint --help && pnpm typecheck -h', ...TC },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '11k text inside quotes is not a command (A-11)',
      scripts: {
        check: 'echo "start && pnpm lint && end" && node -e \'1; tsc --noEmit\'',
        ...TC,
      },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '11m an escaped quote makes the bundle unclear (A-11)',
      scripts: { check: 'echo "start \\" && pnpm lint && \\" end" && pnpm typecheck', ...TC },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '11l an open quote makes the bundle unclear (A-11)',
      scripts: { check: 'pnpm lint && echo "oops && pnpm typecheck', ...TC },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      id: '12 task runner',
      scripts: { check: 'turbo run lint typecheck', ...TC },
      names: ['check', 'lint', 'typecheck'],
    },
    {
      // 024 S-5: intended change — lint:check is no bundle any more, it is a gate of its own name
      id: '13a lint:check is its own gate, same body',
      scripts: { 'lint:check': 'eslint .', lint: 'eslint .', typecheck: 'tsc --noEmit' },
      names: ['lint', 'lint-check', 'typecheck'],
      from: { 'lint-check': 'package.json#scripts.lint:check' },
    },
    {
      // 024 S-5: intended change — lint:check is no bundle any more
      id: '13b lint:check is its own gate, other body',
      scripts: {
        'lint:check': 'eslint .',
        lint: 'eslint . --max-warnings 0',
        typecheck: 'tsc --noEmit',
      },
      names: ['lint', 'lint-check', 'typecheck'],
      from: { 'lint-check': 'package.json#scripts.lint:check' },
    },
    {
      id: '14 ci bundle',
      scripts: { ci: 'pnpm lint', ...TC },
      names: ['check', 'typecheck'],
      from: { check: 'package.json#scripts.ci' },
    },
    {
      id: '15 verify bundle',
      scripts: { verify: 'pnpm typecheck', ...TC },
      names: ['check', 'lint'],
      from: { check: 'package.json#scripts.verify' },
    },
    {
      id: '16a mutating check',
      scripts: {
        check: 'eslint --fix . && pnpm typecheck',
        lint: 'eslint .',
        typecheck: 'tsc --noEmit',
        test: 'vitest run',
      },
      names: ['lint', 'typecheck', 'test'],
    },
    {
      id: '16b mutating check, next bundle',
      scripts: {
        check: 'eslint --fix . && pnpm typecheck',
        verify: 'pnpm lint',
        lint: 'eslint .',
        typecheck: 'tsc --noEmit',
        test: 'vitest run',
      },
      names: ['check', 'typecheck', 'test'],
      from: { check: 'package.json#scripts.verify' },
    },
    {
      id: '17 mutating lint',
      scripts: { lint: 'eslint --fix .', typecheck: 'tsc --noEmit', test: 'vitest run' },
      names: ['typecheck', 'test'],
      excluded: ['lint'],
    },
    {
      id: '18 mutating typecheck',
      scripts: { typecheck: 'tsc --noEmit && oxfmt --write .', lint: 'oxlint .' },
      names: ['lint'],
      excluded: ['typecheck'],
    },
    { id: '19 lint only', scripts: { lint: 'oxlint .' }, names: ['lint'] },
    { id: '20 neither', scripts: { test: 'vitest run', build: 'tsc' }, names: ['test', 'build'] },
    {
      id: '21 all six',
      scripts: {
        check: 'node scripts/verify.js',
        lint: 'oxlint .',
        typecheck: 'tsc --noEmit',
        test: 'vitest run',
        build: 'tsc',
        e2e: 'playwright test',
      },
      names: ['check', 'lint', 'typecheck', 'test', 'build', 'e2e'],
    },
  ];

  function repo(scripts: Record<string, string>, lock: string | null): string {
    const d = mkdtempSync(join(tmpdir(), 'reins-gp-root-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), JSON.stringify({ scripts }));
    if (lock) writeFileSync(join(d, lock), '');
    return d;
  }

  it.each(rows)('row $id', (row) => {
    const r = discoverGates(repo(row.scripts, row.lock ?? 'pnpm-lock.yaml'));
    expect(r.gates.map((g) => g.name)).toEqual(row.names);
    if (row.excluded) expect(r.excluded.map((e) => e.name)).toEqual(row.excluded);
    for (const g of r.gates) {
      expect(compound(g.cmd)).toBe(false);
      if (g.name === 'lint' || g.name === 'typecheck') {
        expect(g.cmd).toBe(`pnpm ${g.name}`);
        expect(g.from).toBe(`package.json#scripts.${g.name}`);
      }
      if (row.from?.[g.name]) expect(g.from).toBe(row.from[g.name]);
    }
    const e2e = r.gates.find((g) => g.name === 'e2e');
    if (e2e) expect(e2e.optional).toBe(true);
  });

  it('row 22 npm runner', () => {
    const r = discoverGates(repo(S1, 'package-lock.json'));
    const cmd = (n: string) => r.gates.find((g) => g.name === n)?.cmd;
    expect(cmd('lint')).toBe('npm run lint');
    expect(cmd('typecheck')).toBe('npm run typecheck');
    const from = (n: string) => r.gates.find((g) => g.name === n)?.from;
    expect(from('lint')).toBe('package.json#scripts.lint');
    expect(from('typecheck')).toBe('package.json#scripts.typecheck');
  });

  it('row 23 yarn runner', () => {
    const r = discoverGates(repo(S1, 'yarn.lock'));
    const cmd = (n: string) => r.gates.find((g) => g.name === n)?.cmd;
    expect(cmd('lint')).toBe('yarn lint');
    expect(cmd('typecheck')).toBe('yarn typecheck');
    const from = (n: string) => r.gates.find((g) => g.name === n)?.from;
    expect(from('lint')).toBe('package.json#scripts.lint');
    expect(from('typecheck')).toBe('package.json#scripts.typecheck');
  });

  it('row 24 a Makefile only: lint and typecheck targets are not candidates (S-10)', () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-gp-make-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(
      join(d, 'Makefile'),
      'check:\n\ttrue\nlint:\n\ttrue\ntypecheck:\n\ttrue\ntest:\n\ttrue\n',
    );
    const r = discoverGates(d);
    expect(r.gates.map((g) => [g.name, g.cmd])).toEqual([
      ['check', 'make check'],
      ['test', 'make test'],
    ]);
  });
});

describe('root typecheck and lint through install and refresh (023 S-8, V-3a)', () => {
  it('install orders them, and a refresh straight after has nothing to show', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-gp-inst-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(
      join(d, 'package.json'),
      JSON.stringify({
        scripts: { typecheck: 'tsc --noEmit', lint: 'oxlint .', test: 'vitest run', build: 'tsc' },
      }),
    );
    writeFileSync(join(d, 'pnpm-lock.yaml'), '');
    await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d });
    expect(gatesOf(d).order).toEqual(['lint', 'typecheck', 'test', 'build']);
    // 024 S-11: a refresh straight after shows every gate applied and nothing else
    expect(configureGates({ cwd: d, refresh: true }).rows!.map((r) => r.state)).toEqual([
      'applied',
      'applied',
      'applied',
      'applied',
    ]);
  });
});
