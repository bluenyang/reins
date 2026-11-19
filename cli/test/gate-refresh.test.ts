import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { runConfig } from '../src/commands/config.js';
import { formatGates, refreshGates } from '../src/commands/config-gates.js';
import { configureGates, fileGates, gateRows, REFRESH_LIST } from '../src/commands/configure.js';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { detectCandidates, REASON } from '../src/lib/detect.js';
import { renderGateScript, requiredGates } from '../src/lib/gate-script.js';
import { gateStatus, type StatusRow } from '../src/lib/gate-refresh.js';
import { BACK, scriptedPrompter } from '../src/lib/prompter.js';

/** Spec 024 V-5 (and 021 V-10): `config gates --refresh` — every gate and candidate with its state. */

const GATES = '.agents/harness/gates.yaml';
const SCRIPT = '.agents/harness/run-gates.sh';
const FIX = join(process.cwd(), 'cli/test/fixtures/gates');
const detect = () => [{ name: 'claude' as const, cli: 'claude', detected: true }];

/** A project with a root `check` and `build`, installed (so gates.yaml holds both), with husky hooks. */
async function project(): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-refresh-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  pkg(d, { check: 'node -e 0', build: 'node -e 1' });
  mkdirSync(join(d, '.husky'));
  await runInstall({
    mode: 'auto',
    asker: defaultsAsker,
    cwd: d,
    detectVendors: detect,
    hooks: true,
  });
  return d;
}
const pkg = (d: string, scripts: Record<string, string>, dir = '') => {
  mkdirSync(join(d, dir), { recursive: true });
  writeFileSync(join(d, dir, 'package.json'), JSON.stringify({ scripts }));
};
const read = (d: string, p: string) => readFileSync(join(d, p), 'utf8');
const gates = (d: string) =>
  parse(read(d, GATES)) as {
    gates: Record<string, { cmd: string; from?: string; optional?: boolean }>;
    order: string[];
  };
const states = (rows: StatusRow[]) => rows.map((r) => `${r.state}: ${r.name}`);

describe('the state of each gate and candidate (024 S-11)', () => {
  it('shows all six states, and never says a gate is gone', () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-state-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'pnpm-lock.yaml'), '');
    writeFileSync(join(d, 'pnpm-workspace.yaml'), "packages:\n  - 'pk/*'\n");
    pkg(d, { lint: 'eslint .', build: 'tsc', typecheck: 'tsc --noEmit' });
    pkg(d, { test: 'vitest' }, 'pk/a');
    mkdirSync(join(d, 'srv'));
    writeFileSync(join(d, 'srv/Makefile'), 'check:\n\ttrue\n');
    const file = [
      { name: 'lint', cmd: 'pnpm lint', from: 'package.json#scripts.lint' },
      { name: 'smoke', cmd: './smoke.sh' },
      { name: 'gone-script', cmd: 'pnpm old', from: 'package.json#scripts.old' },
      { name: 'gone-target', cmd: 'make -C srv old', from: 'srv/Makefile:old' },
      { name: 'gone-go', cmd: 'go -C x test ./...', from: 'x/go.mod' },
      { name: 'gone-ci', cmd: 'node ci.js', from: '.github/workflows/nope.yml' },
      { name: 'odd', cmd: 'node odd.js', from: 'somewhere/else.toml' },
      { name: 'build', cmd: 'pnpm run build', from: 'package.json#scripts.build' },
      { name: 'srv', cmd: 'make -C srv check', from: 'srv/Makefile#check' },
      { name: 'tests', cmd: 'pnpm -r test' },
    ];
    const rows = gateStatus(d, file, detectCandidates(d));
    expect(states(rows)).toEqual([
      'applied: lint',
      'applied, written by hand: smoke',
      'applied, source not found: gone-script',
      'applied, source not found: gone-target',
      'applied, source not found: gone-go',
      'applied, source not found: gone-ci',
      'applied: odd', // a source reins cannot read reads as there
      'applied, another command: build',
      'applied: srv', // the old `Makefile#check` is `Makefile:check`
      'applied, written by hand: tests',
      'not applied: typecheck',
      'not applied, already runs: pk-a-test',
    ]);
    expect(rows.find((r) => r.name === 'build')!.found).toEqual({
      cmd: 'pnpm build',
      from: 'package.json#scripts.build',
    });
    expect(rows.find((r) => r.name === 'pk-a-test')!.reasons).toEqual([
      REASON.runs('tests', 'pnpm -r test'),
    ]);
  });

  it('pairs the same command whatever its source, then the same source, then the same name', () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-pair-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    pkg(d, { verify: 'node -e 0', build: 'tsc' });
    const rows = gateStatus(
      d,
      [
        { name: 'b', cmd: 'npm run build', from: 'elsewhere' },
        { name: 'check', cmd: 'npm run check', from: 'package.json#scripts.check' },
      ],
      detectCandidates(d),
    );
    // `b` pairs with build by its command; the root check now points at verify: another command
    expect(states(rows)).toEqual(['applied: b', 'applied, another command: check']);
    expect(rows[1]!.found!.cmd).toBe('npm run verify');
  });

  it('croffle with the gates of a 0.3.3 install (fixture B): nothing reads as gone (024 V-4)', () => {
    const root = join(FIX, 'croffle');
    const rows = gateStatus(
      root,
      fileGates(read(FIX, 'croffle/gates-b.yaml')),
      detectCandidates(root),
    );
    expect(states(rows)).toEqual([
      'applied: typecheck',
      'applied: lint',
      'applied: format',
      'applied, written by hand: test',
      'applied: build',
      'applied, written by hand: build-cli',
      'applied, written by hand: server-web',
      'applied: server',
      'not applied: typecheck-desktop',
      'not applied: build-unpack',
      'not applied, already runs: apps-desktop-build',
      'not applied, already runs: apps-desktop-build-unpack',
      'not applied, already runs: apps-desktop-test',
      'not applied, already runs: apps-desktop-typecheck',
      'not applied: apps-server-build',
      'not applied, already runs: apps-server-test',
      'not applied, already runs: apps-server-vet',
      'not applied, already runs: apps-server-test-go',
      'not applied, already runs: apps-server-vet-go',
      'not applied, already runs: apps-server-web-typecheck',
      'not applied, already runs: packages-cli-build',
      'not applied, already runs: packages-cli-typecheck',
      'not applied, already runs: packages-types-typecheck',
      'not applied: ci-go-build',
    ]);
    expect(rows.find((r) => r.name === 'build-cli')!.reasons).toEqual([
      REASON.ci('.github/workflows/ci.yml'),
    ]);
    expect(rows.find((r) => r.name === 'apps-desktop-test')!.reasons).toEqual([
      REASON.runs('test', 'pnpm -r test'),
    ]);
    // fixture A, every gate by hand: the same rows, the gates all "written by hand"
    const a = gateStatus(
      root,
      fileGates(read(FIX, 'croffle/gates-a.yaml')),
      detectCandidates(root),
    );
    expect(a.filter((r) => r.state.startsWith('applied')).map((r) => r.state)).toEqual(
      Array(8).fill('applied, written by hand'),
    );
    expect(a.filter((r) => r.state.startsWith('not')).map((r) => r.name)).toEqual(
      rows.filter((r) => r.state.startsWith('not')).map((r) => r.name),
    );
  });
});

describe('reins config gates --refresh (024 S-12, S-13, V-5)', () => {
  /** After install: the check script moves to verify, build goes away, a test script and a subproject appear, one gate is by hand. */
  async function drifted(): Promise<string> {
    const d = await project();
    const text = read(d, GATES)
      .replace('  build:', '  # keep this comment\n  build:')
      .replace('order:', 'gates_note: kept\norder:');
    writeFileSync(
      join(d, GATES),
      text
        .replace(/(\n {2}build:)/, '\n  mine:\n    cmd: ./smoke.sh$1')
        .replace(/order:\n/, 'order:\n  - mine\n'),
    );
    pkg(d, { verify: 'node -e 0', test: 'node -e 2' });
    pkg(d, { check: 'node -e 3' }, 'web');
    return d;
  }

  it('--refresh alone writes .loctx/gates-refresh.md and nothing else; a second run replaces it', async () => {
    const d = await drifted();
    const before = [read(d, GATES), read(d, SCRIPT)];
    const r = configureGates({ cwd: d, refresh: true });
    expect(r.refused).toBeUndefined();
    expect(states(r.rows!)).toEqual([
      'applied, written by hand: mine', // the order of gates.yaml
      'applied, another command: check',
      'applied, source not found: build',
      'not applied: test',
      'not applied: web-check',
    ]);
    expect(r.applied).toEqual([]);
    expect([read(d, GATES), read(d, SCRIPT)]).toEqual(before);
    const list = read(d, REFRESH_LIST);
    expect(list).toMatch(
      /^# gates refresh\n\n- made: \d{4}-\d\d-\d\dT[\d:.]+Z\n- gates.yaml: sha256 [0-9a-f]{16}\n/,
    );
    expect(list).toContain(
      'an agent applies the picks to `.agents/harness/gates.yaml` in a commit of its own',
    );
    expect(list).toContain('The agent does not run reins.');
    for (const row of r.rows!) expect(list).toContain(row.name);
    writeFileSync(join(d, REFRESH_LIST), 'old\n');
    configureGates({ cwd: d, refresh: true });
    expect(read(d, REFRESH_LIST)).not.toContain('old');
  });

  it('--apply all only adds what is not applied: no removal, no replacement', async () => {
    const d = await drifted();
    const r = configureGates({ cwd: d, refresh: true, apply: ['all'] });
    expect(r.applied).toEqual(['add test', 'add web-check']);
    const g = gates(d);
    expect(g.gates['check']!.cmd).toBe('npm run check'); // not replaced
    expect(g.gates['build']).toBeDefined(); // not removed
    expect(g.order).toEqual(['mine', 'check', 'build', 'test', 'web-check']);
    // what is left is not "applied"-able by all
    expect(configureGates({ cwd: d, refresh: true, apply: ['all'] }).applied).toEqual([]);
  });

  it('by name: replace, remove, remove:<name>; comments, other keys and the order stay; the script stays', async () => {
    const d = await drifted();
    const r = configureGates({ cwd: d, refresh: true, apply: ['check', 'build', 'web-check'] });
    expect(r.applied).toEqual(['replace check', 'remove build', 'add web-check']);
    const g = gates(d);
    expect(g.gates['check']).toEqual({
      cmd: 'npm run verify',
      from: 'package.json#scripts.verify',
    });
    expect(g.gates['build']).toBeUndefined();
    expect(g.gates['mine']).toEqual({ cmd: './smoke.sh' });
    expect(g.order).toEqual(['mine', 'check', 'web-check']);
    const text = read(d, GATES);
    expect(text).toContain('# discovered by reins install');
    expect(text).toContain('gates_note: kept');
    expect(requiredGates(text)).toEqual([
      './smoke.sh',
      'npm run verify',
      'npm --prefix web run check',
    ]);
    expect(read(d, SCRIPT)).toBe(renderGateScript());
    // a gate by hand is removed only when named, and remove: works for any applied row
    expect(configureGates({ cwd: d, refresh: true, apply: ['remove:check'] }).applied).toEqual([
      'remove check',
    ]);
    expect(configureGates({ cwd: d, refresh: true, apply: ['mine'] }).applied).toEqual([
      'remove mine',
    ]);
    expect(gates(d).order).toEqual(['web-check']);
  });

  it('a name taken in gates.yaml gets -2; an unknown name refuses the whole call and writes nothing', async () => {
    const d = await project();
    writeFileSync(
      join(d, GATES),
      read(d, GATES).replace('  build:', '  test:\n    cmd: ./t.sh\n  build:'),
    );
    pkg(d, { check: 'node -e 0', build: 'node -e 1', test: 'node -e 2' });
    expect(states(gateRows(d)!)).toContain('not applied: test-2');
    const before = read(d, GATES);
    for (const apply of [['nope'], ['all', 'nope'], ['replace:test-2']]) {
      const r = configureGates({ cwd: d, refresh: true, apply });
      expect(r.code).toBe(1);
      expect(r.refused).toContain('nothing to apply under');
      expect(read(d, GATES)).toBe(before);
    }
  });

  it('a removed gate leaves `order` wherever it was listed, flow style included', async () => {
    const d = await project();
    writeFileSync(
      join(d, GATES),
      read(d, GATES).replace(/order:\n( {2}- .*\n)+/, 'order: [build, check, build] # mine\n'),
    );
    expect(configureGates({ cwd: d, refresh: true, apply: ['build'] }).applied).toEqual([
      'remove build',
    ]);
    expect(gates(d).order).toEqual(['check']);
    expect(read(d, GATES)).toContain('# mine');
  });

  it('a file without `order` gets one that starts from the gates it has', async () => {
    for (const how of ['refresh', 'add'] as const) {
      const d = await project();
      pkg(d, { check: 'node -e 3' }, 'web');
      writeFileSync(join(d, GATES), read(d, GATES).replace(/order:\n( {2}- .*\n)+/, ''));
      expect(gates(d).order).toBeUndefined();
      if (how === 'refresh') configureGates({ cwd: d, refresh: true, apply: ['web-check'] });
      else configureGates({ cwd: d, add: ['web-check'] });
      expect(gates(d).order).toEqual(['check', 'build', 'web-check']);
    }
  });
});

describe('the gates item of the config screen (024 S-13, V-5)', () => {
  it('shows the gates; refresh shows every state and applies add, remove and replace as picked', async () => {
    const d = await project();
    rmSync(join(d, 'package.json'));
    pkg(d, { verify: 'node -e 0', test: 'node -e 2' });
    expect(formatGates(d)).toContain(
      'check              npm run check   (package.json#scripts.check)',
    );
    expect(formatGates(d)).toContain('hook tool: husky');
    expect(formatGates(d)).toContain(`gate script: ${SCRIPT}`);
    const p = scriptedPrompter([
      'gates',
      'refresh',
      ['replace:check', 'remove:build', 'add:test'],
      'back',
      'exit',
    ]);
    expect(await runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect })).toBe(
      0,
    );
    expect(p.remaining()).toBe(0);
    const g = gates(d);
    expect(g.gates['check']?.cmd).toBe('npm run verify');
    expect(g.gates['build']).toBeUndefined();
    expect(g.gates['test']?.cmd).toBe('npm run test');
    const shown = p.notes.join('\n');
    expect(shown).toContain('applied, another command    check  npm run check → npm run verify');
    expect(shown).toContain(`(the same list: ${REFRESH_LIST})`);
    expect(shown).toContain('gates: replace check, remove build, add test');
    const picker = p.asked.find((q) => q.kind === 'multiselect')!;
    expect(picker.labels).toEqual(['replace check', 'remove check', 'remove build', 'add test']);
    expect(existsSync(join(d, REFRESH_LIST))).toBe(true);
  });

  it('picking nothing, or leaving, changes nothing', async () => {
    const d = await project();
    pkg(d, { verify: 'node -e 0' });
    const before = [read(d, GATES), read(d, SCRIPT)];
    for (const answer of [[], BACK]) {
      const p = scriptedPrompter([answer as never]);
      expect(await refreshGates(d, p)).toBe('done');
      expect(p.notes.join('\n')).toContain('gates: nothing changed');
    }
    expect([read(d, GATES), read(d, SCRIPT)]).toEqual(before);
  });
});
