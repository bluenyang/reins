import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { driftMatch } from '../src/commands/check.js';
import { retiredFiles, runInstall } from '../src/commands/install.js';
import { changesBetween, newer, runUpdate } from '../src/commands/update.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { packageHarness } from '../src/lib/upstream.js';

const claude = () =>
  (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
    name,
    cli: name,
    detected: name === 'claude',
  }));

describe('reins update', () => {
  it('compares versions and slices the changelog', () => {
    expect(newer('0.2.0', '0.1.9')).toBe(true);
    expect(newer('0.1.0', '0.1.0')).toBe(false);
    const cl = '## 0.3.0\n- c [skill]\n## 0.2.0\n- b\n## 0.1.0\n- a\n';
    expect(changesBetween(cl, '0.1.0', '0.3.0')).toEqual(['c [skill]', 'b']);
  });

  it('brings an old pin and a hand-edited harness file back to upstream, keeping bindings', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), '{}');
    await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: claude,
    });
    const pin = join(d, '.agents/harness/install.yaml');
    writeFileSync(pin, readFileSync(pin, 'utf8').replace(/version: .*/, 'version: 0.0.9'));
    const role = join(d, '.agents/harness/roles/pl.md');
    writeFileSync(role, `${readFileSync(role, 'utf8')}\nold text\n`);
    const b = join(d, '.agents/harness/bindings.yaml');
    writeFileSync(
      b,
      readFileSync(b, 'utf8').replace('model: claude-opus-5-5', 'model: claude-fable-5-1'),
    );
    expect(driftMatch(d)[0]?.verdict).toBe('WARN');

    const r = await runUpdate({ cwd: d, detectVendors: claude, now: new Date(2026, 9, 25, 14, 0) });
    expect(r.from).toBe('0.0.9');
    expect(r.cliTo).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version);
    expect(r.cliFrom).toMatch(/^\d|^none$/);
    expect(r.changes.length).toBeGreaterThan(0);
    expect(readFileSync(role, 'utf8')).not.toContain('old text');
    expect(readFileSync(b, 'utf8')).toContain('model: claude-fable-5-1');
    expect(readFileSync(pin, 'utf8')).toContain(
      `version: ${readFileSync('harness/VERSION', 'utf8').trim()}`,
    );
    expect(driftMatch(d)).toEqual([]);
    expect(r.install?.history).toBe('.loctx/history/2026-10-25-1400_update-graph.md');
  });

  it('keeps release: and keys it does not know across update (C-1)', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), '{}');
    await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: claude,
    });
    const pin = join(d, '.agents/harness/install.yaml');
    const extra =
      'release:\n  workflows:\n    - file: publish.yml\n      inputs:\n        version: "{version}"\n      approval: npm-staged\nfuture_key: { a: 1 }\n';
    writeFileSync(pin, readFileSync(pin, 'utf8') + extra);
    await runUpdate({ cwd: d, detectVendors: claude });
    const after = parse(readFileSync(pin, 'utf8')) as Record<string, unknown>;
    expect(after['release']).toEqual({
      workflows: [
        { file: 'publish.yml', inputs: { version: '{version}' }, approval: 'npm-staged' },
      ],
    });
    expect(after['future_key']).toEqual({ a: 1 });
  });

  it('removes a file the tier no longer installs; drift only warns first (C-12)', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), '{}');
    await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: claude,
    });
    const h = join(d, '.agents/harness');
    const packaged = readFileSync(join(packageHarness(), 'CHANGELOG.md'), 'utf8');
    writeFileSync(join(h, 'CHANGELOG.md'), packaged + '- an older line\n');
    writeFileSync(join(h, 'notes.md'), 'mine\n');
    expect(driftMatch(d).map((f) => `${f.reason} ${f.verdict} ${f.path}`)).toEqual([
      'F2 WARN .agents/harness/CHANGELOG.md',
    ]);
    expect(driftMatch(d)[0]?.resume).toMatch(/reins update/);

    const dry = await runUpdate({ cwd: d, detectVendors: claude, dryRun: true });
    expect(dry.install?.applied?.removed).toEqual(['.agents/harness/CHANGELOG.md']);
    expect(existsSync(join(h, 'CHANGELOG.md'))).toBe(true);

    const r = await runUpdate({ cwd: d, detectVendors: claude });
    expect(r.install?.applied?.removed).toEqual(['.agents/harness/CHANGELOG.md']);
    expect(existsSync(join(h, 'CHANGELOG.md'))).toBe(false);
    expect(existsSync(join(h, 'gates.yaml'))).toBe(true);
    expect(readFileSync(join(h, 'notes.md'), 'utf8')).toBe('mine\n');
    expect(driftMatch(d)).toEqual([]);
  });

  it('retiredFiles lists only upstream-owned files outside the tier', () => {
    const up = ['CHANGELOG.md', 'VERSION', 'roles/pl.md', 'knowledge-seeds/a.md', 'gates.yaml'];
    const have = [...up, 'notes.md', 'knowledge/x.md'];
    expect(retiredFiles(have, up, 'graph')).toEqual(['CHANGELOG.md', 'knowledge-seeds/a.md']);
    expect(retiredFiles(have, up, 'harness')).toContain('roles/pl.md');
  });

  it('refuses where reins is not installed', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    expect((await runUpdate({ cwd: d })).refused).toMatch(/not installed/);
  });
});
