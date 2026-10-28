import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runConfig } from '../src/commands/config.js';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { newModelCache, type Vendor } from '../src/lib/detect.js';
import { EXIT, scriptedPrompter } from '../src/lib/prompter.js';

const all = (on: string[]) => (): Vendor[] =>
  (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
    name,
    cli: name,
    detected: on.includes(name),
  }));

async function repo(): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-cfgm-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  writeFileSync(join(d, 'package.json'), '{}');
  await runInstall({
    tier: 'graph',
    mode: 'auto',
    asker: defaultsAsker,
    cwd: d,
    detectVendors: all(['claude']),
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

const team = (d: string) => readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8');
const localFile = (d: string) => join(d, '.loctx/bindings.local.yaml');
const noRun = newModelCache({
  run: () => {
    throw new Error('spawn');
  },
  onPath: () => false,
  warn: () => {},
});

async function go(d: string, answers: unknown[], detect = all(['claude']), cache = noRun) {
  const p = scriptedPrompter(answers);
  const code = await runConfig({
    cwd: d,
    interactive: true,
    prompter: p,
    detectVendors: detect,
    modelCache: cache,
  });
  return { p, code };
}

describe('models and roles screens (C-3, C-5)', () => {
  it('walks main > models > role > vendor > model > back to models > < Configuration > main > exit', async () => {
    const d = await repo();
    const { p, code } = await go(d, [
      'models',
      'planner',
      'claude',
      'claude-fable-5-1',
      'back',
      'exit',
    ]);
    expect(code).toBe(0);
    expect(p.remaining()).toBe(0);
    const models = p.asked.filter((q) => q.message === 'Models and roles');
    expect(models).toHaveLength(2);
    expect(models[0]?.values?.slice(0, 2)).toEqual(['back', 'exit']);
    expect(p.asked.map((q) => q.message)).toEqual([
      'Configuration',
      'Models and roles',
      'planner (local): vendor',
      'planner: claude model',
      'Models and roles',
      'Configuration',
    ]);
  });

  it('global writes bindings.yaml and regenerates; local writes only the local file', async () => {
    const g = await repo();
    const before = snapshot(g);
    await go(g, [
      'models',
      'scope',
      'global',
      'planner',
      'claude',
      'claude-fable-5-1',
      'back',
      'exit',
    ]);
    expect(team(g)).toMatch(/planner:\s+vendor: claude\s+model: claude-fable-5-1/);
    expect(readFileSync(join(g, '.claude/agents/reins-planner.md'), 'utf8')).toContain(
      'claude-fable-5-1',
    );
    expect(snapshot(g)['.loctx/bindings.local.yaml']).toBe(before['.loctx/bindings.local.yaml']);
    expect(snapshot(g)['.agents/harness/bindings.yaml']).not.toBe(
      before['.agents/harness/bindings.yaml'],
    );

    const l = await repo();
    const lb = snapshot(l);
    const { p } = await go(l, ['models', 'planner', 'claude', 'claude-fable-5-1', 'back', 'exit']);
    expect(readFileSync(localFile(l), 'utf8')).toContain('claude-fable-5-1');
    const after = snapshot(l);
    delete after['.loctx/bindings.local.yaml'];
    for (const k of Object.keys(lb))
      if (k !== '.loctx/bindings.local.yaml') expect(after[k]).toBe(lb[k]);
    // the local value is marked on the redrawn list
    const lines = p.asked.filter((q) => q.message === 'Models and roles');
    expect(lines).toHaveLength(2);
    expect(p.notes.some((n) => n.includes('bindings.local.yaml'))).toBe(true);
  });

  it('fixed roles are not offered for OFF; toggling a role off and on', async () => {
    const d = await repo();
    const p = scriptedPrompter(['models', 'toggle', ['implementer'].slice(0, 0), 'back', 'exit']);
    // multiselect answer: switch every non-fixed role off by selecting none
    await runConfig({
      cwd: d,
      interactive: true,
      prompter: p,
      detectVendors: all(['claude']),
      modelCache: noRun,
    });
    const ms = p.asked.find((q) => q.kind === 'multiselect');
    expect(ms?.values).not.toContain('pm');
    expect(ms?.values).not.toContain('implementer');
    expect(ms?.values).not.toContain('verify-tool');
    expect(ms?.values).toContain('planner');
    const local = readFileSync(localFile(d), 'utf8');
    expect(local).toMatch(/planner:\s+enabled: false/);
    expect(local).not.toMatch(/pm:/);
    // and back on: select planner (and every other off role)
    const names = (ms?.values ?? []) as string[];
    await go(d, ['models', 'toggle', names, 'back', 'exit']);
    expect(existsSync(localFile(d)) ? readFileSync(localFile(d), 'utf8') : '').not.toContain(
      'enabled',
    );
  });

  it('only detected vendors are offered; cursor lists the injected run, failure falls back with a reason', async () => {
    const d = await repo();
    const ok = newModelCache({
      run: () => ({ status: 0, stdout: 'cursor-a - A\ncursor-b - B\n' }),
      onPath: () => true,
      warn: () => {},
    });
    const det = all(['claude', 'cursor']);
    const a = await go(d, ['models', 'planner', 'cursor', 'cursor-b', 'back', 'exit'], det, ok);
    const vq = a.p.asked.find((q) => q.message.endsWith('vendor'));
    expect(vq?.values).toEqual(['back', 'claude', 'cursor']);
    const mq = a.p.asked.find((q) => q.message.endsWith('cursor model'));
    expect(mq?.values).toEqual(['back', 'cursor-a', 'cursor-b', 'other']);
    expect(readFileSync(localFile(d), 'utf8')).toContain('cursor-b');

    const bad = newModelCache({
      run: () => ({ status: 1, stdout: '' }),
      onPath: () => true,
      warn: () => {},
    });
    const b = await go(d, ['models', 'planner', 'cursor', EXIT], det, bad);
    expect(b.p.notes.some((n) => n.includes('cursor-agent models failed (exit 1)'))).toBe(true);
    const mb = b.p.asked.find((q) => q.message.endsWith('cursor model'));
    expect(mb?.values?.at(-1)).toBe('other');
  });

  it('claude lists known models from the role files; other saves the typed ID', async () => {
    const d = await repo();
    const { p } = await go(d, [
      'models',
      'planner',
      'claude',
      'other',
      'claude-custom-9',
      'back',
      'exit',
    ]);
    const mq = p.asked.find((q) => q.message.endsWith('claude model'));
    expect(mq?.values).toContain('claude-opus-5-5');
    expect(mq?.values?.at(-1)).toBe('other');
    expect(readFileSync(localFile(d), 'utf8')).toContain('claude-custom-9');
  });

  it('EXIT mid-flow leaves files unchanged', async () => {
    const d = await repo();
    const before = snapshot(d);
    await go(d, ['models', 'scope', 'global', 'planner', 'claude', EXIT]);
    expect(snapshot(d)).toEqual(before);
    await go(d, ['models', 'planner', 'claude', 'other', EXIT]);
    expect(snapshot(d)).toEqual(before);
  });
});
