import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInstall } from '../src/commands/install.js';
import { formatUpdate, runUpdate } from '../src/commands/update.js';
import { defaultsAsker, type Asker } from '../src/lib/ask.js';
import { BACK, EXIT, scriptedPrompter } from '../src/lib/prompter.js';

const detect = () =>
  (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
    name,
    cli: name,
    detected: name === 'claude' || name === 'openai',
  }));

function fixture(): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-tui-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  mkdirSync(join(d, 'server'), { recursive: true });
  writeFileSync(join(d, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }));
  writeFileSync(join(d, 'pnpm-lock.yaml'), '');
  writeFileSync(join(d, 'server/go.mod'), 'module x\n');
  writeFileSync(join(d, 'server/Makefile'), 'check: vet\ntest:\n\tgo test ./...\n');
  return d;
}

const lines = (answers: string[]): Asker => {
  const q = [...answers];
  return { ask: async (_q, d) => q.shift() || d, close: () => {} };
};

const harness = (d: string) => ({
  bindings: readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8'),
  install: readFileSync(join(d, '.agents/harness/install.yaml'), 'utf8'),
  gates: readFileSync(join(d, '.agents/harness/gates.yaml'), 'utf8'),
});

function snapshot(root: string, dir = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readdirSync(join(root, dir))) {
    if (e === '.git') continue;
    const rel = dir ? `${dir}/${e}` : e;
    if (statSync(join(root, rel)).isDirectory()) Object.assign(out, snapshot(root, rel));
    else out[rel] = readFileSync(join(root, rel), 'utf8');
  }
  return out;
}

describe('manual install screens (spec S-8)', () => {
  it('screen answers land as the piped answers would (C-8)', async () => {
    const a = fixture();
    const b = fixture();
    const probe = scriptedPrompter([['claude', 'openai'], 'en', true, ['server-test-go']]);
    await runInstall({
      tier: 'graph',
      mode: 'manual',
      asker: defaultsAsker,
      cwd: a,
      detectVendors: detect,
      prompter: probe,
    });
    expect(probe.asked.map((x) => x.kind)).toEqual([
      'multiselect',
      'select',
      'confirm',
      'multiselect',
    ]);
    expect(probe.asked[0]?.values).toEqual(['claude', 'openai', 'google', 'cursor']);
    expect(probe.asked[3]?.values).toContain('server-test-go');
    expect(probe.remaining()).toBe(0);

    await runInstall({
      tier: 'graph',
      mode: 'manual',
      asker: lines(['claude,openai', 'en', 'y', 'server-test-go']),
      cwd: b,
      detectVendors: detect,
    });
    expect(harness(a)).toEqual(harness(b));
    expect(harness(a).install).toContain('language: en');
    expect(harness(a).gates).toContain('server-test-go');
  });

  it('language other asks for text; gates no leaves the root gates out', async () => {
    const d = fixture();
    const p = scriptedPrompter([['claude'], 'other', 'ja', false, []]);
    const r = await runInstall({
      tier: 'graph',
      mode: 'manual',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: detect,
      prompter: p,
    });
    expect(harness(d).install).toContain('language: ja');
    expect(harness(d).gates).not.toContain('tsc');
    expect(r.notes.some((n) => n.startsWith('gates not confirmed'))).toBe(true);
  });

  it('cancel on any screen writes nothing', async () => {
    for (const nav of [EXIT, BACK]) {
      const d = fixture();
      const before = snapshot(d);
      const r = await runInstall({
        tier: 'graph',
        mode: 'manual',
        asker: defaultsAsker,
        cwd: d,
        detectVendors: detect,
        prompter: scriptedPrompter([['claude'], 'en', nav]),
      });
      expect(r.cancelled).toBe(true);
      expect(snapshot(d)).toEqual(before);
    }
  });

  it('auto mode never calls the prompter', async () => {
    const d = fixture();
    const p = scriptedPrompter([]);
    await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: detect,
      prompter: p,
    });
    expect(p.asked).toEqual([]);
  });
});

describe('update confirmation (spec S-9)', () => {
  async function old(): Promise<string> {
    const d = fixture();
    await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: detect,
    });
    const pin = join(d, '.agents/harness/install.yaml');
    writeFileSync(pin, readFileSync(pin, 'utf8').replace(/version: .*/, 'version: 0.0.9'));
    const role = join(d, '.agents/harness/roles/pl.md');
    writeFileSync(role, `${readFileSync(role, 'utf8')}\nold text\n`);
    return d;
  }
  const opts = { detectVendors: detect, now: new Date(2026, 9, 28, 9, 0) };

  it('no changes nothing and shows the plan (C-9)', async () => {
    const d = await old();
    const before = snapshot(d);
    const p = scriptedPrompter([false]);
    let shown = '';
    const r = await runUpdate({
      cwd: d,
      ...opts,
      prompter: p,
      show: (x) => (shown = formatUpdate(x, true)),
    });
    expect(r.declined).toBe(true);
    expect(p.asked.map((x) => x.kind)).toEqual(['confirm']);
    expect(shown).toMatch(/^reins update — cli .* → v.*, harness v0\.0\.9 → v/);
    expect(shown).toContain('(dry run)');
    expect(shown).toContain('  ~ .agents/harness/roles/pl.md');
    expect(snapshot(d)).toEqual(before);
  });

  it('yes gives the non-interactive result', async () => {
    const a = await old();
    const b = await old();
    await runUpdate({ cwd: a, ...opts, prompter: scriptedPrompter([true]) });
    await runUpdate({ cwd: b, ...opts });
    const sa = snapshot(a);
    const sb = snapshot(b);
    const skip = (s: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(s).filter(
          ([k]) => !k.startsWith('.loctx/history/') && !k.endsWith('bindings.local.yaml'),
        ),
      );
    expect(skip(sa)).toEqual(skip(sb));
    expect(sa['.agents/harness/roles/pl.md']).not.toContain('old text');
  });

  it('plan shows a removed file and the bindings move', () => {
    const text = formatUpdate(
      {
        root: '/x',
        from: '0.1.5',
        to: '0.2.0',
        cliFrom: '0.1.5',
        cliTo: '0.2.0',
        changes: [],
        needsSkill: false,
        overrides: [],
        bindingsMoved: ['claude'],
        install: {
          root: '/x',
          generation: 'gen5' as never,
          notes: [],
          applied: { created: ['a'], changed: ['b'], unchanged: [], removed: ['c'] },
        },
      },
      true,
    );
    expect(text).toContain('bindings: would move detected vendors (claude)');
    expect(text).toContain('  - c (no longer installed by this tier)');
  });

  it('already up to date asks nothing; no prompter (--yes, non-TTY) asks nothing', async () => {
    const d = await old();
    await runUpdate({ cwd: d, ...opts });
    const p = scriptedPrompter([]);
    const r = await runUpdate({ cwd: d, ...opts, prompter: p });
    expect(p.asked).toEqual([]);
    expect(r.declined).toBeUndefined();
    const e = await old();
    const q = scriptedPrompter([]);
    await runUpdate({ cwd: e, ...opts });
    expect(q.asked).toEqual([]);
  });
});

describe('reins-setup skill (C-10)', () => {
  it('tells users they can run reins config', () => {
    expect(readFileSync('skills/reins-setup/SKILL.md', 'utf8')).toContain('`reins config`');
  });
});
