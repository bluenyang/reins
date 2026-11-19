import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { detectCandidates, discoverGates, REASON, type Candidate } from '../src/lib/detect.js';

/** Spec 024 V-3 and V-4: gate discovery by pattern, body, workspace and CI. */

const FIX = join(process.cwd(), 'cli/test/fixtures/gates');
const row = (c: Candidate) => [c.name, c.status, c.reasons] as const;
const table = (root: string) => detectCandidates(root).map(row);
const ci = REASON.ci('.github/workflows/ci.yml');

/** A temporary repository from a map of files. */
function repo(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-detect-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(join(d, p, '..'), { recursive: true });
    writeFileSync(join(d, p), text);
  }
  return d;
}
const pkg = (scripts: Record<string, string>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ ...extra, scripts });
const byName = (root: string) => new Map(detectCandidates(root).map((c) => [c.name, c]));
const status = (root: string, name: string) => byName(root).get(name)?.status;

describe('the four reference projects (024 V-4, appendix A and B)', () => {
  it('each fixture holds only the files and keys of appendix A', () => {
    const files = (d: string): string[] =>
      readdirSync(d).flatMap((e) =>
        statSync(join(d, e)).isDirectory() ? files(join(d, e)) : [relative(FIX, join(d, e))],
      );
    expect(files(FIX).toSorted()).toEqual(
      [
        'allot/.github/workflows/release.yml',
        'allot/gates.yaml',
        'allot/package.json',
        'allot/pnpm-lock.yaml',
        'croffle/.github/workflows/ci.yml',
        'croffle/.github/workflows/release.yml',
        'croffle/apps/desktop/package.json',
        'croffle/apps/server/Makefile',
        'croffle/apps/server/go.mod',
        'croffle/apps/server/web/package.json',
        'croffle/apps/server/web/pnpm-lock.yaml',
        'croffle/apps/server/web/pnpm-workspace.yaml',
        'croffle/gates-a.yaml',
        'croffle/gates-b.yaml',
        'croffle/package.json',
        'croffle/packages/cli/package.json',
        'croffle/packages/types/package.json',
        'croffle/pnpm-lock.yaml',
        'croffle/pnpm-workspace.yaml',
        'pipit-bot/.github/workflows/abstraction.yml',
        'pipit-bot/dashboard/package.json',
        'pipit-bot/package.json',
        'pipit-bot/yarn.lock',
        'pipit-music/.github/workflows/ci.yml',
        'pipit-music/package.json',
        'pipit-music/yarn.lock',
      ].toSorted(),
    );
    for (const f of files(FIX).filter((x) => x.endsWith('package.json')))
      for (const k of Object.keys(JSON.parse(readFileSync(join(FIX, f), 'utf8')) as object))
        expect(['name', 'scripts', 'workspaces'], `${f}: ${k}`).toContain(k);
    for (const f of files(FIX).filter((x) => x.includes('.github/workflows/'))) {
      const doc = parse(readFileSync(join(FIX, f), 'utf8')) as {
        jobs: Record<string, { steps: Record<string, unknown>[] }>;
      };
      expect(Object.keys(doc).toSorted()).toEqual(['jobs', 'on']);
      for (const j of Object.values(doc.jobs))
        for (const s of j.steps)
          for (const k of Object.keys(s)) expect(['name', 'run', 'working-directory']).toContain(k);
    }
  });

  it('croffle', () => {
    const runs = (by: string, piece: string) => REASON.runs(by, piece);
    const outside = REASON.outside('apps/server/web/pnpm-lock.yaml');
    expect(table(join(FIX, 'croffle'))).toEqual([
      ['format', 'excluded', [REASON.mutates]],
      ['format-check', 'pick', []],
      ['lint', 'pick', []],
      ['lint:fix', 'excluded', [REASON.mutates]],
      ['prepare', 'excluded', [REASON.install]],
      ['typecheck', 'pick', []],
      ['typecheck-desktop', 'offer', []],
      ['dev', 'excluded', [REASON.neverEnds]],
      ['start', 'excluded', [REASON.neverEnds]],
      ['build', 'pick', [ci]],
      ['build-unpack', 'offer', []],
      ['build:win', 'excluded', [REASON.platform]],
      ['build:mac', 'excluded', [REASON.platform]],
      ['build:linux', 'excluded', [REASON.platform]],
      ['apps-desktop-build', 'covered', [runs('build', 'pnpm --filter @croffledev/desktop build')]],
      [
        'apps-desktop-build-unpack',
        'covered',
        [runs('build:unpack', 'pnpm --filter @croffledev/desktop build:unpack')],
      ],
      ['apps-desktop-test', 'offer', []],
      [
        'apps-desktop-typecheck',
        'covered',
        [
          runs('typecheck', 'pnpm -r --parallel run typecheck'),
          runs('typecheck:desktop', 'pnpm --filter @croffledev/desktop typecheck'),
        ],
      ],
      ['apps-server-build', 'offer', []],
      ['apps-server-check', 'offer', []],
      ['apps-server-test', 'covered', [REASON.dependsOn('check')]],
      ['apps-server-vet', 'covered', [REASON.dependsOn('check')]],
      ['apps-server-test-go', 'covered', [REASON.holds('Makefile test'), ci]],
      ['apps-server-vet-go', 'covered', [REASON.holds('Makefile vet'), ci]],
      ['apps-server-web-build', 'offer', [outside, ci]],
      ['apps-server-web-typecheck', 'covered', [REASON.holds('build'), outside]],
      [
        'packages-cli-build',
        'covered',
        [runs('release', 'pnpm --filter @croffledev/croffle-cli build')],
      ],
      [
        'packages-cli-typecheck',
        'covered',
        [runs('typecheck', 'pnpm -r --parallel run typecheck')],
      ],
      [
        'packages-types-typecheck',
        'covered',
        [runs('typecheck', 'pnpm -r --parallel run typecheck')],
      ],
      ['ci-pnpm-croffledev-croffle-cli-build', 'offer', [ci]],
      ['ci-go-build', 'offer', [ci]],
    ]);
  });

  it('allot', () => {
    expect(table(join(FIX, 'allot'))).toEqual([
      ['dev', 'excluded', [REASON.neverEnds]],
      ['dev:api', 'excluded', [REASON.neverEnds]],
      ['build', 'pick', []],
      ['preview', 'excluded', [REASON.neverEnds]],
      ['typecheck', 'pick', []],
      ['prepare', 'excluded', [REASON.install]],
      ['e2e', 'pick', []],
      ['check-migrations', 'offer', []],
      ['check-logs', 'offer', []],
      ['test', 'pick', []],
      ['build-server', 'offer', []],
    ]);
    // release.yml has no pull_request: no CI candidate
    expect(detectCandidates(join(FIX, 'allot')).some((c) => c.source === 'ci')).toBe(false);
  });

  it('pipit-bot', () => {
    expect(table(join(FIX, 'pipit-bot'))).toEqual([
      ['build', 'pick', []],
      ['format', 'excluded', [REASON.mutates]],
      ['format-check', 'pick', []],
      ['lint', 'excluded', [REASON.mutates]],
      ['lint-check', 'pick', []],
      ['check-abstraction', 'offer', []],
      ['prepare', 'excluded', [REASON.install]],
      ['postinstall', 'excluded', [REASON.install]],
      ['typecheck', 'pick', []],
      ['watch', 'excluded', [REASON.neverEnds]],
      ['start', 'excluded', [REASON.neverEnds]],
      ['start:dev', 'excluded', [REASON.neverEnds]],
      ['dev', 'excluded', [REASON.neverEnds]],
      ['watch:start', 'excluded', [REASON.neverEnds]],
      ['dashboard:dev', 'excluded', [REASON.neverEnds]],
      ['dashboard-build', 'offer', []],
      [
        'dashboard-build-2',
        'covered',
        [REASON.runs('dashboard:build', 'yarn workspace dashboard build')],
      ],
    ]);
  });

  it('pipit-music', () => {
    expect(table(join(FIX, 'pipit-music'))).toEqual([
      ['build', 'pick', []],
      ['start', 'excluded', [REASON.neverEnds]],
      ['start:dev', 'excluded', [REASON.neverEnds]],
      ['dev', 'excluded', [REASON.neverEnds]],
      ['typecheck', 'pick', [ci]],
      ['format', 'excluded', [REASON.mutates]],
      ['format-check', 'pick', [ci]],
      ['lint', 'excluded', [REASON.mutates]],
      ['lint-check', 'pick', [ci]],
    ]);
  });

  it('install writes the picked gates in their order; a non-interactive install writes nothing else (S-10)', async () => {
    const expected: Record<string, string[]> = {
      croffle: ['lint', 'format-check', 'typecheck', 'build'],
      allot: ['typecheck', 'test', 'build', 'e2e'],
      'pipit-bot': ['lint-check', 'format-check', 'typecheck', 'build'],
      'pipit-music': ['lint-check', 'format-check', 'typecheck', 'build'],
    };
    for (const [name, order] of Object.entries(expected)) {
      expect(
        discoverGates(join(FIX, name)).gates.map((g) => g.name),
        name,
      ).toEqual(order);
      const d = mkdtempSync(join(tmpdir(), `reins-fix-${name}-`));
      execFileSync('cp', ['-R', `${join(FIX, name)}/.`, d]);
      execFileSync('git', ['init', '-q'], { cwd: d });
      await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d });
      const g = parse(readFileSync(join(d, '.agents/harness/gates.yaml'), 'utf8')) as {
        order: string[];
        gates: Record<string, { optional?: boolean }>;
      };
      expect(g.order, name).toEqual(order);
    }
  });
});

describe('the rules, row by row (024 V-3)', () => {
  it('S-4: names by pattern, never hooks, words inside words or lifecycle scripts', () => {
    const d = repo({
      'package.json': pkg({
        'lint:check': 'eslint .',
        'format:check': 'prettier --check .',
        'check:migrations': 'sh m.sh',
        'test:unit': 'vitest',
        'build:web': 'vite build',
        'type-check': 'tsc --noEmit',
        ci: 'node ci.js',
        contest: 'x',
        latest: 'x',
        prebuild: 'x',
        rebuild: 'x',
        pretest: 'x',
        postbuild: 'x',
        build: 'tsc',
        test: 'vitest run',
      }),
      'package-lock.json': '{}',
    });
    const m = byName(d);
    for (const n of [
      'lint-check',
      'format-check',
      'check-migrations',
      'test',
      'build-web',
      'type-check',
      'check',
    ])
      expect(m.has(n), n).toBe(true);
    for (const n of ['contest', 'latest', 'prebuild', 'rebuild', 'pretest', 'postbuild'])
      expect(
        [...m.values()].some((c) => c.script === n),
        n,
      ).toBe(false);
    // `ci` is the bundle when there is no check or verify
    expect(m.get('check')!.script).toBe('ci');
  });

  it.each([
    ['test:watch', 'vitest', REASON.neverEnds],
    ['dev', 'vite', REASON.neverEnds],
    ['start:dev', 'node .', REASON.neverEnds],
    ['test:e2e', 'playwright test --watch', REASON.neverEnds],
    ['prepare', 'husky', REASON.install],
    ['postinstall', 'node x.js', REASON.install],
    ['build:win', 'electron-builder --win', REASON.platform],
    ['build:appimage', 'electron-builder --linux appimage', REASON.platform],
    ['lint', 'oxlint --fix .', REASON.mutates],
  ])('S-4: %s (%s) is excluded: %s', (name, body, why) => {
    const d = repo({ 'package.json': pkg({ [name]: body }), 'package-lock.json': '{}' });
    const c = detectCandidates(d).find((x) => x.script === name)!;
    expect(c.status).toBe('excluded');
    expect(c.reasons).toEqual([why]);
  });

  it('S-5: lint:check is no bundle; the bundle covers by name or same body, and test by the 023 rule', () => {
    const d = repo({
      'package.json': pkg({
        check: 'pnpm lint:check && pnpm test:unit',
        'lint:check': 'eslint .',
        'test:unit': 'vitest',
        test: 'vitest run',
      }),
      'pnpm-lock.yaml': '',
    });
    const m = byName(d);
    expect(m.get('check')!.status).toBe('pick');
    expect(m.get('lint-check')!.status).toBe('covered');
    expect(m.get('lint-check')!.reasons).toEqual([REASON.calls('check')]);
    // `test:unit` is called, so it is covered; `test` is not (the word test alone no longer counts)
    expect([...m.values()].find((c) => c.script === 'test:unit')!.status).toBe('covered');
    expect(m.get('test')!.status).toBe('pick');
  });

  it('S-6: a Makefile dependency, a $(MAKE) call, go in a recipe, and a body that holds another', () => {
    const d = repo({
      'package.json': '{}',
      'svc/Makefile':
        'check: vet\n\t$(MAKE) lint\nlint:\n\tgolangci-lint run\nvet:\n\tgo vet ./...\nbuild:\n\tgo build\n',
      'svc/go.mod': 'module x\n',
      'web/package.json': pkg({
        build: 'vue-tsc --noEmit && vite build',
        typecheck: 'vue-tsc --noEmit',
      }),
      'web/pnpm-lock.yaml': '',
    });
    const m = byName(d);
    expect(m.get('svc-vet')!.reasons).toEqual([REASON.dependsOn('check')]);
    expect(m.get('svc-lint')!.reasons).toEqual([REASON.dependsOn('check')]);
    expect(m.get('svc-vet-go')!.reasons).toEqual([REASON.holds('Makefile vet')]);
    expect(m.get('svc-test')?.status ?? m.get('svc-test-go')?.status).toBe('offer'); // no recipe runs go test
    expect(m.get('svc-build')!.status).toBe('offer');
    expect(m.get('web-typecheck')!.reasons).toContain(REASON.holds('build'));
  });

  describe('S-7: workspaces', () => {
    const ws = (
      root: Record<string, string>,
      extra: Record<string, unknown> = {},
      lock = 'pnpm-lock.yaml',
    ) =>
      repo({
        'package.json': pkg(root, extra),
        [lock]: '',
        'packages/a/package.json': pkg({ test: 'vitest' }, { name: '@x/a' }),
        'packages/b/package.json': pkg({ test: 'vitest' }, { name: 'b' }),
        'apps/web/package.json': pkg({ test: 'vitest' }, { name: 'web' }),
        'apps/own/package.json': pkg({ test: 'vitest' }, { name: 'own' }),
        'apps/own/yarn.lock': '',
        'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n  - 'apps/**'\n  - '!apps/web'\n",
      });
    const cov = (d: string) =>
      Object.fromEntries(
        ['packages-a-test', 'packages-b-test', 'apps-web-test', 'apps-own-test'].map((n) => [
          n,
          status(d, n),
        ]),
      );
    it.each([
      ['pnpm -r test', ['covered', 'covered']],
      ['pnpm --recursive run test', ['covered', 'covered']],
      ['pnpm --filter @x/a test', ['covered', 'offer']],
      ['pnpm --filter ./packages/b test', ['offer', 'covered']],
      ['pnpm -F b test', ['offer', 'covered']],
      ['pnpm -r --parallel --if-present test', ['covered', 'covered']],
      ['pnpm -r --no-bail test', ['offer', 'offer']], // a flag outside the table: unclear
      ['pnpm --filter "@x/*" test', ['offer', 'offer']], // a glob: unclear
      ['turbo run test', ['covered', 'covered']],
      ['nx run-many -t test', ['covered', 'covered']],
      ['lerna run test', ['covered', 'covered']],
    ])('%s', (body, [a, b]) => {
      const d = ws({ 'test:all': body });
      const c = cov(d);
      expect([c['packages-a-test'], c['packages-b-test']]).toEqual([a, b]);
      // `!apps/web` is taken out and apps/own has a lock of its own: neither is covered
      expect(c['apps-web-test']).toBe('offer');
      expect(c['apps-own-test']).toBe('offer');
    });
    it.each([
      ['npm run test --workspaces', ['covered', 'covered']],
      ['npm run test -ws', ['covered', 'covered']],
      ['npm run test -w b', ['offer', 'covered']],
      ['npm run test --workspace=@x/a', ['covered', 'offer']],
      ['yarn workspaces run test', ['covered', 'covered']],
      ['yarn workspace b test', ['offer', 'covered']],
      ['yarn workspaces foreach -A run test', ['covered', 'covered']],
      ['yarn workspaces foreach --include b run test', ['offer', 'offer']],
      ['bun --filter b test', ['offer', 'covered']],
      ['bun --filter @x/* test', ['covered', 'offer']],
    ])('%s (package.json workspaces)', (body, [a, b]) => {
      const d = repo({
        'package.json': pkg({ 'test:all': body }, { workspaces: ['packages/*'] }),
        'package-lock.json': '{}',
        'packages/a/package.json': pkg({ test: 'vitest' }, { name: '@x/a' }),
        'packages/b/package.json': pkg({ test: 'vitest' }, { name: 'b' }),
      });
      expect([status(d, 'packages-a-test'), status(d, 'packages-b-test')]).toEqual([a, b]);
    });
    it('the `{ packages }` form of workspaces', () => {
      const d = repo({
        'package.json': pkg(
          { 'test:all': 'yarn workspaces run test' },
          { workspaces: { packages: ['packages/*'] } },
        ),
        'yarn.lock': '',
        'packages/a/package.json': pkg({ test: 'vitest' }, { name: 'a' }),
      });
      expect(status(d, 'packages-a-test')).toBe('covered');
    });
  });

  describe('S-8: pull-request workflows', () => {
    const wf = (on: string, steps: string) =>
      repo({
        'package.json': pkg({ lint: 'eslint .', build: 'tsc' }),
        'pnpm-lock.yaml': '',
        'web/package.json': pkg({ build: 'vite build' }),
        '.github/workflows/ci.yml': `on: ${on}\njobs:\n  a:\n    steps:\n${steps}`,
      });
    const step = (run: string, wd?: string) =>
      `      - name: s\n${wd ? `        working-directory: ${wd}\n` : ''}        run: ${run}\n`;
    const ciNames = (d: string) =>
      detectCandidates(d)
        .filter((c) => c.source === 'ci')
        .map((c) => [c.name, c.cmd]);
    it('reads only workflows that run on pull_request', () => {
      expect(ciNames(wf('push', step('pnpm test:all')))).toEqual([]);
      expect(ciNames(wf('[push, pull_request]', step('node verify.js')))).toEqual([
        ['ci-node-verify-js', 'node verify.js'],
      ]);
      expect(
        ciNames(wf('\n  pull_request:\n    types: [opened]', step('node verify.js'))),
      ).toHaveLength(1);
    });
    it('leaves out ${{ }}, run: |, compound, install steps and excluded commands', () => {
      const d = wf(
        'pull_request',
        [
          step('pnpm ${{ matrix.x }} lint'),
          '      - name: m\n        run: |\n          node a.js\n',
          step('node a.js && node b.js'),
          step('pnpm install --frozen-lockfile'),
          step('npm ci'),
          step('corepack enable'),
          step('go mod download'),
          step('pnpm exec eslint --fix .'),
          step('vite --watch'),
        ].join(''),
      );
      expect(ciNames(d)).toEqual([]);
    });
    it('rewrites working-directory, folds a command a candidate has, and drops tools without a directory option', () => {
      const d = wf(
        'pull_request',
        [
          step('pnpm lint'),
          step('pnpm build', 'web'),
          step('go build ./...', 'svc'),
          step('cargo test', 'rs'),
          step('tsc'),
        ].join(''),
      );
      const m = byName(d);
      expect(m.get('lint')!.reasons).toEqual([ci]);
      expect(m.get('web-build')!.reasons).toEqual([ci]);
      expect(m.get('build')!.reasons).toEqual([ci]); // `tsc` is the body of the root build
      expect(ciNames(d)).toEqual([['ci-go-build', 'go -C svc build ./...']]);
      expect(m.get('ci-go-build')!.status).toBe('offer');
    });
  });

  it('S-10: a non-interactive install writes only the picked candidates', async () => {
    const d = repo({
      'package.json': pkg({
        build: 'tsc',
        'check:migrations': 'sh m.sh',
        'format:check': 'prettier --check .',
      }),
      'pnpm-lock.yaml': '',
      'web/package.json': pkg({ build: 'vite build' }),
    });
    await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d });
    const g = parse(readFileSync(join(d, '.agents/harness/gates.yaml'), 'utf8')) as {
      order: string[];
    };
    expect(g.order).toEqual(['format-check', 'build']);
  });
});
