import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  CONFIRMED_MODELS,
  checkBinding,
  listModels,
  newModelCache,
  spawnModels,
  vendorOf,
  type ModelsRunner,
} from '../src/lib/detect.js';

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
});

describe('the packaged list of known models (021 S-14)', () => {
  const catalogue = parse(readFileSync(join(process.cwd(), 'harness/models.yaml'), 'utf8')) as {
    vendors: Record<string, string[]>;
  };
  const all = Object.values(catalogue.vendors).flat();

  it('holds the ids confirmed on 2026-11-11 beside the earlier ones, each once', () => {
    expect(catalogue.vendors['claude']).toEqual(
      expect.arrayContaining(['claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5-5']),
    );
    expect(catalogue.vendors['openai']).toEqual(
      expect.arrayContaining(['gpt-6-sol', 'gpt-6-luna', 'gpt-6-astra', 'gpt-6.1-sol']),
    );
    expect(new Set(all).size).toBe(all.length);
  });

  it('every model id the design and the READMEs use as an example is on the list', () => {
    const ids = new Set<string>();
    for (const f of ['docs/design.md', 'docs/design.ko.md', 'README.md', 'docs/README.ko.md'])
      for (const m of readFileSync(join(process.cwd(), f), 'utf8').matchAll(
        /\b(?:claude-(?:opus|sonnet|haiku|fable)|gpt|gemini)-\d[\w.-]*|\bcursor-[a-z]+-\d[\w.-]*/g,
      ))
        ids.add(m[0].replace(/[.,;:-]+$/, ''));
    expect(ids.size).toBeGreaterThan(0);
    expect([...ids].filter((m) => !all.includes(m))).toEqual([]);
  });

  it('a confirmed model is a known model', () => {
    expect([...CONFIRMED_MODELS].filter((m) => !all.includes(m))).toEqual([]);
  });
});
