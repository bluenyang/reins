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
import { configureBindings } from '../src/commands/configure.js';
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

describe('reins config (019 S-6, design §9)', () => {
  it('non-TTY prints the effective settings and the hint, and changes no file', async () => {
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
    expect(out).toContain('mode: single');
    expect(out).toContain('audit: required every version');
    expect(out).toContain('every role: the PM');
    expect(out).toContain('reins config bindings --set');
    expect(snapshot(d)).toEqual(before);
  });

  it('--json prints the bindings and the roles, even on a terminal', async () => {
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
    const j = JSON.parse(out) as { bindings: { mode: string }; roles: unknown[] };
    expect(j.bindings.mode).toBe('single');
    expect(j.roles.length).toBeGreaterThan(10);
    expect(p.asked).toEqual([]);
  });

  it('on a terminal the main screen lists models, tools, mode, audit, then exit', async () => {
    const d = await repo();
    const p = scriptedPrompter(['models', 'back', 'exit']);
    expect(await runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect })).toBe(
      0,
    );
    expect(p.asked.map((q) => q.message)).toEqual([
      'Configuration',
      'Models and roles (mode: single)',
      'Configuration',
    ]);
    expect(p.asked[0]?.values).toEqual(['models', 'tools', 'mode', 'audit', 'exit']);
  });

  it('the screen sets a group model on the project scope and regenerates', async () => {
    const d = await repo();
    const p = scriptedPrompter([
      'mode',
      'multi',
      'models',
      'scope',
      'project',
      'implementer',
      'one',
      'claude',
      'other',
      'claude-sonnet-5-5',
      'back',
      'exit',
    ]);
    expect(await runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect })).toBe(
      0,
    );
    const b = readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8');
    expect(b).toContain('mode: multi');
    expect(b).toMatch(/implementer:\n\s+vendor: claude\n\s+model: claude-sonnet-5-5/);
    expect(existsSync(join(d, '.claude/agents/rs-implementer-code.md'))).toBe(true);
    const agents = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('<!-- reins:mode-changed pending -->');
    expect(agents).not.toContain('reins:reconcile pending');
    expect(existsSync(join(d, '.agents/AGENTS.previous.md'))).toBe(false); // ST-5: no copy on a mode switch
    expect(agents).toContain(
      '| implementer/code | claude claude-sonnet-5-5 | subagent `rs-implementer-code` |',
    );
  });

  it('switching the audit off asks once more', async () => {
    const d = await repo();
    const p = scriptedPrompter(['audit', false, 'audit', true, 'exit']);
    await runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect });
    expect(readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8')).toMatch(
      /audit:\n\s+required: false/,
    );
  });
});

describe('single mode shows kept assignments as unused (ST-1)', () => {
  it('the text output and the screen mark them used in multi only; the auditor as the audit model', async () => {
    const d = await repo();
    await configureBindings({
      cwd: d,
      set: ['implementer=claude-sonnet-5-5', 'auditor=openai:gpt-6-astra'],
    });
    let out = '';
    await runConfig({
      cwd: d,
      interactive: false,
      detectVendors: detect,
      write: (s) => (out += s),
    });
    expect(out).toContain('every role: the PM');
    expect(out).toMatch(/implementer\s+claude claude-sonnet-5-5\s+\(used in multi only\)/);
    expect(out).toMatch(/auditor\s+openai gpt-6-astra\s+\(recommended audit model\)/);
    const p = scriptedPrompter(['models', 'back', 'exit']);
    await runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect });
    expect(p.notes.join('\n')).toContain('single: the PM does every role');
    const labels = p.asked[1]?.labels ?? [];
    expect(
      labels.some((l) => l.startsWith('implementer') && l.endsWith('(used in multi only)')),
    ).toBe(true);
  });
});

describe('known models (ST-2)', () => {
  it('OpenAI and Claude lists are never empty, even with every group off', async () => {
    const { knownModels } = await import('../src/commands/config-models.js');
    expect(knownModels('openai', [])).toEqual(
      expect.arrayContaining(['gpt-6.1-sol', 'gpt-6-astra']),
    );
    expect(knownModels('claude', [])).toEqual(
      expect.arrayContaining(['claude-sonnet-5-5', 'claude-opus-5-5']),
    );
    expect(knownModels('openai', [])).not.toContain('claude-opus-5-5');
  });
});

describe('rc.2 review fixes', () => {
  it('a mode switch keeps a project quote that sits under a finished note', async () => {
    const d = await repo();
    await configureBindings({ cwd: d, mode: 'multi' });
    const p = join(d, 'AGENTS.md');
    // the PM finished the check and wrote its own quote under the marker
    const done = readFileSync(p, 'utf8')
      .replace('reins:mode-changed pending', 'reins:mode-changed done')
      .replace(/> \*\*Mode changed from [^\n]*\n/, '> Our rule: review it yourself.\n');
    writeFileSync(p, done);
    await configureBindings({ cwd: d, mode: 'single' });
    expect(readFileSync(p, 'utf8')).toContain('> Our rule: review it yourself.');
  });

  it('known models keep each binding with its own vendor', async () => {
    const { knownModels } = await import('../src/commands/config-models.js');
    const doc = {
      schema: 'reins/bindings@2' as const,
      groups: { pl: { roles: { 'code-reviewer': { vendor: 'openai', model: 'o3' } } } },
    };
    expect(knownModels('openai', [doc])).toContain('o3');
    expect(knownModels('claude', [doc])).not.toContain('o3');
  });

  it('in multi mode the group screen carries no single-mode tag', async () => {
    const d = await repo();
    await configureBindings({ cwd: d, mode: 'multi', set: ['auditor=openai:gpt-6-astra'] });
    const p = scriptedPrompter(['models', 'auditor', 'back', 'back', 'exit']);
    await runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect });
    const screens =
      p.asked.map((q) => q.message).join('\n') + p.asked.flatMap((q) => q.labels ?? []).join('\n');
    expect(screens).not.toContain('recommended audit model');
    expect(screens).not.toContain('used in multi only');
  });
});

describe('reins config bindings (flags)', () => {
  it('sets groups, roles, several models and the mode; refuses bad names and writes nothing', async () => {
    const d = await repo();
    const r = await configureBindings({
      cwd: d,
      mode: 'multi',
      set: ['executor=claude-haiku-5-5', 'pl.doc-reviewer=claude:claude-sonnet-5-5'],
      models: ['pl=claude-sonnet-5-5,openai:gpt-6.1-terra'],
    });
    expect(r.refused).toBeUndefined();
    expect(r.changed).toEqual(
      expect.arrayContaining(['executor', 'pl.doc-reviewer', 'pl', 'mode']),
    );
    const reviewer = r.roles.find((x) => x.group === 'pl' && x.role === 'code-reviewer');
    expect(reviewer?.models).toEqual([{ vendor: 'openai', model: 'gpt-6.1-terra' }]);
    expect(readFileSync(join(d, 'AGENTS.md'), 'utf8')).toContain(
      'exec -m gpt-6.1-terra -s read-only -`',
    );
    const before = snapshot(d);
    expect((await configureBindings({ cwd: d, set: ['nope=x'] })).code).toBe(1);
    expect((await configureBindings({ cwd: d, set: ['pl.nope=x'] })).code).toBe(1);
    expect((await configureBindings({ cwd: d, models: ['executor=a,b'] })).code).toBe(1);
    expect(snapshot(d)).toEqual(before);
  });

  it('several Claude models on the committee each get their own agent file', async () => {
    const d = await repo();
    await configureBindings({
      cwd: d,
      mode: 'multi',
      models: ['advisor=claude:claude-fable-5-1,claude:claude-opus-5-5'],
    });
    const a1 = readFileSync(join(d, '.claude/agents/rs-advisor-committee-1.md'), 'utf8');
    const a2 = readFileSync(join(d, '.claude/agents/rs-advisor-committee-2.md'), 'utf8');
    expect(a1).toContain('model: claude-fable-5-1');
    expect(a2).toContain('model: claude-opus-5-5');
    const agents = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('subagent `rs-advisor-committee-1`');
    expect(agents).toContain('subagent `rs-advisor-committee-2`');
  });

  it('a mode switch adds one light mode-changed note naming the latest change (ST-5)', async () => {
    const d = await repo();
    await configureBindings({ cwd: d, mode: 'multi' });
    const p = join(d, 'AGENTS.md');
    expect(readFileSync(p, 'utf8')).toContain('Mode changed from single to multi.');
    writeFileSync(
      p,
      readFileSync(p, 'utf8').replace('reins:mode-changed pending', 'reins:mode-changed done'),
    );
    await configureBindings({ cwd: d, mode: 'single' });
    const text = readFileSync(p, 'utf8');
    expect(text.match(/^<!-- reins:mode-changed pending -->$/gm)).toHaveLength(1);
    expect(text).toContain('Mode changed from multi to single.');
    expect(text).not.toContain('Mode changed from single to multi.');
    expect(existsSync(join(d, '.agents/AGENTS.previous.md'))).toBe(false);
  });

  it('--local --off hides a group the team switched on', async () => {
    const d = await repo();
    await configureBindings({ cwd: d, mode: 'multi', set: ['implementer=claude-sonnet-5-5'] });
    const r = await configureBindings({ cwd: d, local: true, off: ['implementer'] });
    expect(r.roles.filter((x) => x.group === 'implementer' && x.on)).toEqual([]);
    expect(readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8')).toContain(
      'implementer:',
    );
  });

  it('--local writes only the personal file; --off switches a group off', async () => {
    const d = await repo();
    await configureBindings({ cwd: d, mode: 'multi', set: ['implementer=claude-sonnet-5-5'] });
    const team = readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8');
    const l = await configureBindings({ cwd: d, local: true, set: ['default=claude-fable-5-1'] });
    expect(l.doc?.default).toEqual({ vendor: 'claude', model: 'claude-fable-5-1' });
    expect(readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8')).toBe(team);
    expect(existsSync(join(d, '.loctx/bindings.local.yaml'))).toBe(true);
    const off = await configureBindings({ cwd: d, off: ['implementer'] });
    expect(off.roles.filter((x) => x.on)).toEqual([]);
    expect(existsSync(join(d, '.claude/agents/rs-implementer-code.md'))).toBe(false);
  });
});
