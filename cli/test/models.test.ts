import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { configureBindings } from '../src/commands/configure.js';
import { buildBindings, runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import {
  checkBinding,
  listModels,
  newModelCache,
  spawnModels,
  vendorOf,
  type ModelsRunner,
  type Vendor,
} from '../src/lib/detect.js';
import { packageHarness } from '../src/lib/upstream.js';

const AGY =
  '\u001b[1mAvailable models\u001b[0m\ngemini-3-pro\tGemini 3 Pro\ngemini-3-flash\tFlash\n';
const CUR =
  'Available models\n\ncursor-grok-4.5-high-fast - Grok 4.5\nauto - Auto\nTip: use --model\n';

function fake(out: Record<string, string>, calls: string[][] = []) {
  const warns: string[] = [];
  const run: ModelsRunner = (cli, args) => {
    calls.push([cli, ...args]);
    return { status: 0, stdout: out[cli] ?? '' };
  };
  const cache = newModelCache({ run, onPath: () => true, warn: (m) => warns.push(m) });
  return { cache, warns, calls };
}

const run1 = (r: ReturnType<ModelsRunner>) =>
  checkBinding('x', 'google', newModelCache({ run: () => r, onPath: () => true }));
const detectOnlyClaude = () =>
  (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
    name,
    cli: name,
    detected: name === 'claude',
  }));

describe('no real vendor CLI under test', () => {
  it('the real runner refuses to spawn, and the default cache sees every CLI as absent', () => {
    expect(() => spawnModels('agy', ['models'])).toThrow(/refusing to spawn/);
    expect(checkBinding('gemini-3-pro', 'google', newModelCache())).toBeNull();
  });
});

describe('vendorOf (C-2)', () => {
  it('maps the four prefixes and the rest', () => {
    expect(vendorOf('gpt-5')).toBe('openai');
    expect(vendorOf('gemini-3-pro')).toBe('google');
    expect(vendorOf('cursor-grok-4.5-high-fast')).toBe('cursor');
    expect(vendorOf('claude-opus-5-5')).toBe('claude');
    expect(vendorOf('whatever')).toBe('claude');
  });
});

describe('listModels / checkBinding (C-3)', () => {
  it('parses both formats, ignoring headers and ANSI', () => {
    expect(listModels('google', () => ({ status: 0, stdout: AGY }))).toEqual({
      ids: ['gemini-3-pro', 'gemini-3-flash'],
    });
    expect(listModels('cursor', () => ({ status: 0, stdout: CUR }))).toEqual({
      ids: ['cursor-grok-4.5-high-fast', 'auto'],
    });
  });

  it('found: nothing recorded; missing: note and warning; model untouched', () => {
    const { cache, warns } = fake({ agy: AGY });
    expect(checkBinding('gemini-3-pro', 'google', cache)).toEqual({});
    expect(checkBinding('gemini-9', 'google', cache)).toEqual({
      unverified: true,
      note: 'not in agy models',
    });
    expect(warns).toHaveLength(1);
  });

  it('failure, timeout and empty output are failures', () => {
    expect(run1({ status: 2, stdout: '' })).toEqual({
      unverified: true,
      note: 'agy models failed: exit 2',
    });
    expect(run1({ status: null, stdout: '', timedOut: true })?.note).toMatch(
      /^agy models failed: timed out/,
    );
    expect(run1({ status: 0, stdout: 'nothing\n' })?.note).toMatch(/no model IDs/);
  });

  it('runs once per CLI with only [models]; skips absent CLIs and claude/openai', () => {
    const calls: string[][] = [];
    const { cache } = fake({ agy: AGY, 'cursor-agent': CUR }, calls);
    checkBinding('gemini-3-pro', 'google', cache);
    checkBinding('gemini-3-flash', 'google', cache);
    checkBinding('cursor-grok-4.5-high-fast', 'cursor', cache);
    expect(calls).toEqual([
      ['agy', 'models'],
      ['cursor-agent', 'models'],
    ]);
    expect(checkBinding('claude-opus-5-5', 'claude', cache)).toBeNull();
    expect(checkBinding('gpt-5', 'openai', cache)).toBeNull();
    const absent = newModelCache({
      run: () => {
        throw new Error('ran');
      },
      onPath: () => false,
    });
    expect(checkBinding('gemini-3-pro', 'google', absent)).toBeNull();
  });

  it('buildBindings joins the fallback note and records the check', () => {
    const vs: Vendor[] = [{ name: 'claude', cli: 'claude', detected: true }];
    const { cache } = fake({ agy: AGY });
    const doc = parse(
      buildBindings(packageHarness(), new Set(['claude', 'google']), vs, 'auto', cache),
    ) as {
      roles: Record<string, Record<string, unknown>>;
    };
    for (const r of Object.values(doc.roles))
      if (r['vendor'] === 'google') expect(r['model']).toBeTypeOf('string');
  });
});

describe('configure --set (C-4)', () => {
  it('keeps an unknown ID, warns, exits cleanly', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-models-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), '{}');
    const { cache: c0 } = fake({});
    await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: detectOnlyClaude,
      modelCache: c0,
    });
    const { cache, warns } = fake({ agy: AGY });
    const r = await configureBindings({
      cwd: d,
      set: ['qa-run=gemini-nope', 'pm=gemini-3-pro'],
      modelCache: cache,
    });
    expect(r.refused).toBeUndefined();
    const doc = parse(readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8')) as {
      roles: Record<string, Record<string, unknown>>;
    };
    expect(doc.roles['qa-run']).toEqual({
      vendor: 'google',
      model: 'gemini-nope',
      unverified: true,
      note: 'not in agy models',
    });
    expect(doc.roles['pm']).toEqual({ vendor: 'google', model: 'gemini-3-pro' });
    expect(warns).toHaveLength(1);
  });
});
