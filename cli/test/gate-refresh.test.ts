import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { runConfig } from '../src/commands/config.js';
import { formatGates, refreshGates } from '../src/commands/config-gates.js';
import { configureGates, fileGates, gateDiff } from '../src/commands/configure.js';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { diffGates, formatGateDiff, type GateDiff } from '../src/lib/gate-refresh.js';
import { BACK, scriptedPrompter } from '../src/lib/prompter.js';

/** Spec 021 V-10: `config gates --refresh` — what differs from the discovery, and applying what was picked. */

const GATES = '.agents/harness/gates.yaml';
const SCRIPT = '.agents/harness/run-gates.sh';
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
const kinds = (diff: GateDiff[]) => diff.map((x) => `${x.kind} ${x.name}`);

describe('how gates.yaml differs from the discovery (021 S-22)', () => {
  const ROOT = mkdtempSync(join(tmpdir(), 'reins-refresh-src-'));
  writeFileSync(join(ROOT, 'package.json'), '{}');

  it('(a) the same source and command is the same gate, whatever it is called', () => {
    // two go gates share one source; a subdirectory name that came out differently this time
    const file = [
      { name: 'srv-test', cmd: 'go -C srv test ./...', from: 'srv/go.mod' },
      { name: 'srv-vet', cmd: 'go -C srv vet ./...', from: 'srv/go.mod' },
      {
        name: 'web-check-old-name',
        cmd: 'pnpm --dir web check',
        from: 'web/package.json#scripts.check',
      },
    ];
    const found = [
      { name: 'srv-test', cmd: 'go -C srv test ./...', from: 'srv/go.mod' },
      { name: 'srv-vet', cmd: 'go -C srv vet ./...', from: 'srv/go.mod' },
      { name: 'web-check', cmd: 'pnpm --dir web check', from: 'web/package.json#scripts.check' },
    ];
    expect(diffGates(ROOT, file, found)).toEqual([]);
  });

  it('(a) the root check pointing at another script is one change, not a new and a gone gate', () => {
    const diff = diffGates(
      ROOT,
      [{ name: 'check', cmd: 'pnpm verify', from: 'package.json#scripts.verify' }],
      [{ name: 'check', cmd: 'pnpm check', from: 'package.json#scripts.check' }],
    );
    expect(diff).toEqual([
      {
        kind: 'changed',
        name: 'check',
        cmd: 'pnpm check',
        from: 'package.json#scripts.check',
        was: { cmd: 'pnpm verify', from: 'package.json#scripts.verify' },
      },
    ]);
    expect(formatGateDiff(diff[0]!)).toBe(
      'changed check  pnpm verify → pnpm check   (package.json#scripts.verify → package.json#scripts.check)',
    );
  });

  it('(a) a gate the discovery stops proposing is gone, with the reason; a gate by hand is only shown', () => {
    const diff = diffGates(
      ROOT,
      [
        { name: 'check', cmd: 'pnpm check', from: 'package.json#scripts.check' },
        // check now runs the tests, so discovery no longer proposes `test`; its source is still there
        { name: 'test', cmd: 'pnpm test', from: 'package.json#scripts.test' },
        { name: 'api-test', cmd: 'make -C api test', from: 'api/Makefile:test' },
        { name: 'mine', cmd: './scripts/smoke.sh' },
      ],
      [
        { name: 'check', cmd: 'pnpm check', from: 'package.json#scripts.check' },
        // discovery proposes a gate under the name the hand-written one has
        { name: 'mine', cmd: 'pnpm --dir mine check', from: 'mine/package.json#scripts.check' },
      ],
    );
    expect(kinds(diff)).toEqual(['gone test', 'gone api-test', 'new mine-2', 'yours mine']);
    const why = (n: string) => (diff.find((x) => x.name === n) as { why: string }).why;
    expect(why('test')).toMatch(/^no longer proposed/);
    expect(why('api-test')).toBe('its source is gone (api/Makefile)');
    expect(formatGateDiff(diff.at(-1)!)).toContain('written by hand — left alone');
  });
});

describe('reins config gates --refresh (021 S-22..S-24)', () => {
  /** After install: the check script changes, build goes away, a test script and a subproject appear, one gate is by hand. */
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

  it('(b) --refresh alone reports and writes nothing', async () => {
    const d = await drifted();
    const before = [read(d, GATES), read(d, SCRIPT)];
    const r = configureGates({ cwd: d, refresh: true });
    expect(r.refused).toBeUndefined();
    expect(kinds(r.diff!)).toEqual([
      'changed check',
      'gone build',
      'new test',
      'new web-check',
      'yours mine',
    ]);
    expect(r.applied).toEqual([]);
    expect([read(d, GATES), read(d, SCRIPT)]).toEqual(before);
  });

  it('(c, e, f) --apply writes only what was picked; comments, other keys and the order stay; the script follows', async () => {
    const d = await drifted();
    const hook = read(d, '.husky/pre-commit');
    const r = configureGates({ cwd: d, refresh: true, apply: ['check', 'web-check'] });
    expect(r.applied).toEqual(['check', 'web-check']);
    const g = gates(d);
    expect(g.gates['check']).toEqual({
      cmd: 'npm run verify',
      from: 'package.json#scripts.verify',
    });
    expect(g.gates['web-check']).toEqual({
      cmd: 'npm --prefix web run check',
      from: 'web/package.json#scripts.check',
    });
    expect(g.gates['build']).toBeDefined(); // gone, but not picked
    expect(g.gates['test']).toBeUndefined(); // new, but not picked
    expect(g.gates['mine']).toEqual({ cmd: './smoke.sh' });
    expect(g.order).toEqual(['mine', 'check', 'build', 'web-check']);
    const text = read(d, GATES);
    expect(text).toContain('# discovered by reins install');
    expect(text).toContain('# keep this comment');
    expect(text).toContain('gates_note: kept');
    // the script runs exactly the required gates of the file, in its order; the hook line is as it was
    expect(read(d, SCRIPT).match(/^run '.*'$/gm)).toEqual([
      "run './smoke.sh'",
      "run 'npm run verify'",
      "run 'npm run build'",
      "run 'npm --prefix web run check'",
    ]);
    expect(read(d, '.husky/pre-commit')).toBe(hook);
    // what is left is still reported
    expect(kinds(gateDiff(d)!)).toEqual(['gone build', 'new test', 'yours mine']);
  });

  it('(d, g) --apply all leaves nothing to apply; a second refresh says up to date and writes nothing', async () => {
    const d = await drifted();
    expect(configureGates({ cwd: d, apply: ['all'] }).applied).toEqual([
      'check',
      'build',
      'test',
      'web-check',
    ]);
    const g = gates(d);
    expect(Object.keys(g.gates).toSorted()).toEqual(['check', 'mine', 'test', 'web-check']);
    expect(g.order).toEqual(['mine', 'check', 'test', 'web-check']);
    const after = [read(d, GATES), read(d, SCRIPT)];
    const again = configureGates({ cwd: d, refresh: true, apply: ['all'] });
    expect(again.applied).toEqual([]);
    expect(kinds(again.diff!)).toEqual(['yours mine']);
    expect([read(d, GATES), read(d, SCRIPT)]).toEqual(after);
  });

  it('(h) a name that is not a difference — or a gate by hand — refuses the whole call', async () => {
    const d = await drifted();
    const before = read(d, GATES);
    for (const apply of [['check', 'nope'], ['mine']]) {
      const r = configureGates({ cwd: d, refresh: true, apply });
      expect(r.code).toBe(1);
      expect(r.refused).toMatch(/^nothing to apply under: /);
      expect(read(d, GATES)).toBe(before);
    }
  });

  it('removing the last required gate removes the script', async () => {
    const d = await project();
    rmSync(join(d, 'package.json'));
    writeFileSync(join(d, 'README.md'), 'no scripts any more\n');
    const r = configureGates({ cwd: d, apply: ['all'] });
    expect(r.applied).toEqual(['check', 'build']);
    expect(fileGates(read(d, GATES))).toEqual([]);
    expect(() => read(d, SCRIPT)).toThrow();
  });
});

describe('the gates item of the config screen (021 S-25)', () => {
  it('(i) shows the gates, the hook tool and the script; refresh applies what is picked', async () => {
    const d = await project();
    pkg(d, { check: 'node -e 0', build: 'node -e 1', test: 'node -e 2' });
    rmSync(join(d, 'package.json'));
    pkg(d, { verify: 'node -e 0', build: 'node -e 1' });
    expect(formatGates(d)).toContain(
      'check              npm run check   (package.json#scripts.check)',
    );
    expect(formatGates(d)).toContain('hook tool: husky');
    expect(formatGates(d)).toContain(`gate script: ${SCRIPT}`);
    const p = scriptedPrompter(['gates', 'refresh', ['check'], 'back', 'exit']);
    expect(await runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect })).toBe(
      0,
    );
    expect(p.remaining()).toBe(0);
    expect(gates(d).gates['check']?.cmd).toBe('npm run verify');
    expect(p.notes.join('\n')).toContain('gates: applied check');
    const picker = p.asked.find((q) => q.kind === 'multiselect')!;
    expect(picker.labels?.join('\n')).toContain('changed check  npm run check → npm run verify');
  });

  it('(i) picking nothing, or leaving, changes nothing', async () => {
    const d = await project();
    pkg(d, { verify: 'node -e 0' });
    const before = [read(d, GATES), read(d, SCRIPT)];
    for (const answer of [[], BACK]) {
      const p = scriptedPrompter([answer as never]);
      expect(await refreshGates(d, p)).toBe('done');
      expect(p.notes.join('\n')).toContain('gates: nothing changed');
    }
    expect([read(d, GATES), read(d, SCRIPT)]).toEqual(before);
    // and when nothing differs it says so without asking
    const same = await project();
    const q = scriptedPrompter([]);
    await refreshGates(same, q);
    expect(q.asked).toEqual([]);
    expect(q.notes.join('\n')).toContain('gates: up to date');
  });
});
