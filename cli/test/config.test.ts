import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runConfig } from '../src/commands/config.js';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { askerPrompter, BACK, EXIT, isInteractive, scriptedPrompter } from '../src/lib/prompter.js';

const detect = () =>
  (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
    name,
    cli: name,
    detected: name === 'claude',
  }));

async function repo(): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-config-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  writeFileSync(join(d, 'package.json'), '{}');
  await runInstall({
    tier: 'graph',
    mode: 'auto',
    asker: defaultsAsker,
    cwd: d,
    detectVendors: detect,
  });
  return d;
}

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

const SRC = join(__dirname, '../src');

describe('Prompter (C-1)', () => {
  it('scriptedPrompter hands out answers in order and records the questions', async () => {
    const p = scriptedPrompter(['a', ['x', 'y'], 'typed', true, BACK]);
    const opts = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
    expect(await p.select({ message: 'one', options: opts })).toBe('a');
    expect(await p.multiselect({ message: 'two', options: opts })).toEqual(['x', 'y']);
    expect(await p.text({ message: 'three' })).toBe('typed');
    expect(await p.confirm({ message: 'four' })).toBe(true);
    expect(await p.select({ message: 'five', options: opts })).toBe(BACK);
    expect(await p.select({ message: 'six', options: opts })).toBe(EXIT);
    expect(p.asked.map((q) => q.kind)).toEqual([
      'select',
      'multiselect',
      'text',
      'confirm',
      'select',
      'select',
    ]);
    expect(p.asked[0]?.values).toEqual(['a', 'b']);
  });

  it('EXIT on the main screen ends with exit 0 and writes nothing', async () => {
    const d = await repo();
    const before = snapshot(d);
    const p = scriptedPrompter([EXIT]);
    expect(await runConfig({ cwd: d, interactive: true, prompter: p })).toBe(0);
    expect(snapshot(d)).toEqual(before);
  });

  it('askerPrompter bridges the line-based Asker', async () => {
    const lines = ['b', 'x,z', 'hello', 'y'];
    const p = askerPrompter({ ask: async () => lines.shift() ?? '', close: () => {} });
    const opts = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'z', label: 'Z' },
    ];
    expect(await p.select({ message: 's', options: opts })).toBe('b');
    expect(await p.multiselect({ message: 'm', options: opts })).toEqual(['z']);
    expect(await p.text({ message: 't' })).toBe('hello');
    expect(await p.confirm({ message: 'c' })).toBe(true);
    const d = askerPrompter(defaultsAsker);
    expect(await d.select({ message: 's', options: opts, initial: 'z' })).toBe('z');
    expect(await d.confirm({ message: 'c', initial: false })).toBe(false);
  });

  it('isInteractive needs both stdin and stdout to be terminals', () => {
    expect(isInteractive({ isTTY: true }, { isTTY: true })).toBe(true);
    expect(isInteractive({ isTTY: true }, {})).toBe(false);
    expect(isInteractive({}, { isTTY: true })).toBe(false);
  });

  it('@clack/prompts is only ever imported dynamically, and only in prompter.ts', () => {
    const prompter = readFileSync(join(SRC, 'lib/prompter.ts'), 'utf8');
    expect(prompter).toMatch(/await import\('@clack\/prompts'\)/);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const f = join(dir, e);
        if (statSync(f).isDirectory()) walk(f);
        else if (f.endsWith('.ts')) files.push(f);
      }
    };
    walk(SRC);
    for (const f of files)
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /^\s*(import|export)[^;]*from\s+'@clack\/prompts'/m,
      );
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      '@clack/prompts',
      'ajv',
      'commander',
      'yaml',
    ]);
  });
});

describe('reins config (C-2)', () => {
  it('non-TTY prints one resolved line per role and the configure hint, and changes no file', async () => {
    const d = await repo();
    const before = snapshot(d);
    let out = '';
    const code = await runConfig({
      cwd: d,
      interactive: false,
      detectVendors: detect,
      write: (s) => (out += s),
    });
    expect(code).toBe(0);
    expect(out).toMatch(/^ {2}pm\s+claude\s+\S+ \(/m);
    expect(out.trim().split('\n').length).toBeGreaterThan(10);
    expect(out).toContain('reins configure bindings --set');
    expect(snapshot(d)).toEqual(before);
  });

  it('--json prints a bindings array, even on a terminal', async () => {
    const d = await repo();
    let out = '';
    const p = scriptedPrompter([]);
    const code = await runConfig({
      cwd: d,
      json: true,
      interactive: true,
      prompter: p,
      detectVendors: detect,
      write: (s) => (out += s),
    });
    expect(code).toBe(0);
    const j = JSON.parse(out) as { bindings: { role: string; model: string }[] };
    expect(j.bindings.find((b) => b.role === 'pm')?.model).toBeTruthy();
    expect(p.asked).toEqual([]);
  });

  it('on a terminal the main screen lists models and roles first, then exit', async () => {
    const d = await repo();
    const p = scriptedPrompter(['models', 'back', 'exit']);
    expect(await runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect })).toBe(
      0,
    );
    expect(p.asked.map((q) => q.message)).toEqual([
      'Configuration',
      'Models and roles',
      'Configuration',
    ]);
    expect(p.asked[0]?.values).toEqual(['models', 'exit']);
  });
});
