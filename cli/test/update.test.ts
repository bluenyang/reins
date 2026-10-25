import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { driftMatch } from '../src/commands/check.js';
import { runInstall } from '../src/commands/install.js';
import { changesBetween, newer, runUpdate } from '../src/commands/update.js';
import { defaultsAsker } from '../src/lib/ask.js';

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
    expect(r.changes.length).toBeGreaterThan(0);
    expect(readFileSync(role, 'utf8')).not.toContain('old text');
    expect(readFileSync(b, 'utf8')).toContain('model: claude-fable-5-1');
    expect(readFileSync(pin, 'utf8')).toMatch(/version: 0\.1\.1/);
    expect(driftMatch(d)).toEqual([]);
    expect(r.install?.history).toBe('.loctx/history/2026-10-25-1400_update-graph.md');
  });

  it('refuses where reins is not installed', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    expect((await runUpdate({ cwd: d })).refused).toMatch(/not installed/);
  });
});
