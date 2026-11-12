import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CONFIG_HINT, formatBindings, runConfig } from '../src/commands/config.js';
import { configureBindings } from '../src/commands/configure.js';
import { runInstall } from '../src/commands/install.js';
import { runUpdate } from '../src/commands/update.js';
import { renderDelegation } from '../src/lib/agents-md.js';
import { LOCAL_DELEGATION_NOTE } from '../src/lib/local-delegation.js';
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

  it('on a terminal the main screen lists models, tools, mode, audit, gates, then exit', async () => {
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
    expect(p.asked[0]?.values).toEqual(['models', 'tools', 'mode', 'audit', 'gates', 'exit']);
    // no PM entry: the PM is the model in the conversation (022 S-27b)
    expect(p.asked[1]?.values).toEqual([
      'back',
      'exit',
      'scope',
      'pl',
      'planner',
      'implementer',
      'executor',
      'advisor',
      'auditor',
    ]);
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
    const l = await configureBindings({ cwd: d, local: true, set: ['advisor=claude-fable-5-1'] });
    expect(l.doc?.groups?.advisor).toMatchObject({ vendor: 'claude', model: 'claude-fable-5-1' });
    expect(readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8')).toBe(team);
    expect(existsSync(join(d, '.loctx/bindings.local.yaml'))).toBe(true);
    const off = await configureBindings({ cwd: d, off: ['implementer'] });
    expect(off.roles.filter((x) => x.on && x.group !== 'advisor')).toEqual([]);
    expect(existsSync(join(d, '.claude/agents/rs-implementer-code.md'))).toBe(false);
  });
});

describe('the PM is the model in the conversation (022 S-27..S-27b, V-9)', () => {
  const TEAM = '.agents/harness/bindings.yaml';
  const LOCAL = '.loctx/bindings.local.yaml';
  const withDefault = (d: string, rel: string) => {
    const p = join(d, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    const cur = existsSync(p) ? readFileSync(p, 'utf8') : 'schema: reins/bindings@2\n';
    writeFileSync(p, `${cur}default: { vendor: claude, model: claude-fable-5-1 }\n`);
  };

  it('a new install names no PM model, in the file or in AGENTS.md', async () => {
    const d = await repo();
    expect(readFileSync(join(d, TEAM), 'utf8')).not.toMatch(/^default:/m);
    const a = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    expect(a).toContain('you are the PM — the model in this conversation');
    expect(a).not.toContain('you are the PM (');
    expect(a).toContain('run it in a fresh run of your own model');
  });

  it('the delegation text names the auditor model when there is one, and never a PM model', () => {
    const fable = { vendor: 'claude', model: 'claude-fable-5-1' };
    for (const mode of ['single', 'multi'] as const) {
      const none = renderDelegation({ schema: 'reins/bindings@2', mode, default: fable });
      expect(none).toContain('the model in this conversation');
      expect(none).not.toContain('you are the PM (');
      expect(none).not.toContain('claude-fable-5-1');
      expect(none).toContain('in a fresh run of your own model (or another one the user chooses)');
      const own = renderDelegation({
        schema: 'reins/bindings@2',
        mode,
        groups: { auditor: { vendor: 'openai', model: 'gpt-6-astra' } },
      });
      expect(own).toContain('run it on openai gpt-6-astra in a fresh run');
      expect(own).not.toContain('your own model (or');
    }
  });

  it('a file that still holds `default` loads; nothing prints its model', async () => {
    const d = await repo();
    withDefault(d, TEAM);
    withDefault(d, LOCAL);
    const shown = await configureBindings({ cwd: d, show: true });
    expect(shown.refused).toBeUndefined();
    expect(shown.doc?.default).toBeUndefined();
    const text = formatBindings(shown.doc!);
    expect(text).toContain('PM: the model in the conversation');
    expect(text).not.toContain('claude-fable-5-1');
    const u = await runUpdate({ cwd: d, detectVendors: detect, yes: true });
    expect(u.refused).toBeUndefined();
    expect(readFileSync(join(d, 'AGENTS.md'), 'utf8')).not.toContain('claude-fable-5-1');
    // update does not rewrite a version-2 file
    expect(readFileSync(join(d, TEAM), 'utf8')).toMatch(/^default:/m);
  });

  it('config drops `default` when it writes the file, and says so', async () => {
    const d = await repo();
    withDefault(d, TEAM);
    withDefault(d, LOCAL);
    const r = await configureBindings({ cwd: d, mode: 'multi' });
    expect(r.changed).toEqual([
      'mode',
      'default removed (the PM is the model in the conversation)',
    ]);
    expect(readFileSync(join(d, TEAM), 'utf8')).not.toMatch(/^default:/m);
    expect(readFileSync(join(d, LOCAL), 'utf8')).toMatch(/^default:/m);
    const l = await configureBindings({ cwd: d, local: true, audit: 'off' });
    expect(l.changed).toContain('default removed (the PM is the model in the conversation)');
    expect(readFileSync(join(d, LOCAL), 'utf8')).not.toMatch(/^default:/m);
    // nothing to write: the key stays and nothing is announced
    const e = await repo();
    withDefault(e, TEAM);
    expect((await configureBindings({ cwd: e, mode: 'single' })).changed).toEqual([]);
    expect(readFileSync(join(e, TEAM), 'utf8')).toMatch(/^default:/m);
  });

  it('--set default=… is refused, at either scope', async () => {
    const d = await repo();
    for (const local of [false, true]) {
      const r = await configureBindings({ cwd: d, local, set: ['default=claude-fable-5-1'] });
      expect(r.code).toBe(1);
      expect(r.refused).toContain('the PM is the model in the conversation');
    }
    expect(
      (await configureBindings({ cwd: d, set: ['nope=claude-fable-5-1'] })).refused,
    ).not.toContain('default');
    expect(CONFIG_HINT).not.toContain('default');
  });
});

describe('the personal delegation table (020 V-1)', () => {
  const LD = '.loctx/delegation.local.md';
  const table = (d: string) => readFileSync(join(d, LD), 'utf8');
  /** everything the team commits: a personal write must leave it as it is */
  const teamFiles = (d: string) =>
    Object.fromEntries(Object.entries(snapshot(d)).filter(([k]) => !k.startsWith('.loctx/')));

  it('(a) no personal settings: no table; (g) the delegation section points to it first', async () => {
    const d = await repo();
    expect(existsSync(join(d, LD))).toBe(false);
    const agents = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    const section = agents.slice(agents.indexOf('## Delegation'));
    expect(section.split('\n')[2]).toContain('If `.loctx/delegation.local.md` exists, follow it');
    expect(agents).not.toContain('it overrides this section for you');
  });

  it('(b) --local switching multi on writes the table and nothing of the team; (h) says so', async () => {
    const d = await repo();
    const before = teamFiles(d);
    const r = await configureBindings({
      cwd: d,
      local: true,
      mode: 'multi',
      set: ['implementer=claude-sonnet-5-5', 'pl.code-reviewer=openai:gpt-6.1-sol'],
    });
    expect(r.localDelegation).toBe('written');
    expect(LOCAL_DELEGATION_NOTE('written')).toContain('re-read it, or start a new one');
    const t = table(d);
    expect(t).toContain('Mode: **multi**');
    expect(t).toContain(
      '| pl/code-reviewer | openai gpt-6.1-sol | `openai exec -m gpt-6.1-sol -s read-only -` (task on stdin) |',
    );
    // (e) the team generated no rs-* file for it: a general subagent given the role file
    expect(t).toContain(
      'a general subagent on `claude-sonnet-5-5`, given the `code` section of `.agents/harness/roles/implementer.md`',
    );
    expect(t).not.toContain('If `.loctx/delegation.local.md` exists');
    expect(teamFiles(d)).toEqual(before);
  });

  it('(c) a personal file that repeats the team makes no table', async () => {
    const d = await repo();
    const r = await configureBindings({ cwd: d, local: true, mode: 'single' });
    expect(r.changed).toEqual(['mode']);
    expect(r.localDelegation).toBeUndefined();
    expect(existsSync(join(d, LD))).toBe(false);
  });

  it('(d) the team catching up removes the table, and says so', async () => {
    const d = await repo();
    await configureBindings({
      cwd: d,
      local: true,
      mode: 'multi',
      set: ['implementer=claude-sonnet-5-5'],
    });
    expect(existsSync(join(d, LD))).toBe(true);
    const r = await configureBindings({
      cwd: d,
      mode: 'multi',
      set: ['implementer=claude-sonnet-5-5'],
    });
    expect(r.localDelegation).toBe('removed');
    expect(existsSync(join(d, LD))).toBe(false);
  });

  it('(e) a role the team generated with the same model keeps its rs-* name', async () => {
    const d = await repo();
    await configureBindings({ cwd: d, mode: 'multi', set: ['implementer=claude-sonnet-5-5'] });
    // a personal group replaces the team's as a whole (mergeLocal); implementer stays the team's
    await configureBindings({ cwd: d, local: true, set: ['executor=claude-haiku-5-5'] });
    const t = table(d);
    expect(t).toContain(
      '| implementer/code | claude claude-sonnet-5-5 | subagent `rs-implementer-code` |',
    );
    expect(t).toContain(
      '| executor/researcher | claude claude-haiku-5-5 | a general subagent on `claude-haiku-5-5`',
    );
    expect(existsSync(join(d, '.claude/agents/rs-executor-researcher.md'))).toBe(false);
  });

  it('(e) a team agent file reins did not write, or one edited since, is not named', async () => {
    const d = await repo();
    await configureBindings({ cwd: d, mode: 'multi', set: ['implementer=claude-sonnet-5-5'] });
    const f = join(d, '.claude/agents/rs-implementer-code.md');
    writeFileSync(f, `${readFileSync(f, 'utf8')}\nhand edit\n`);
    await configureBindings({ cwd: d, local: true, set: ['executor=claude-haiku-5-5'] });
    expect(table(d)).toContain(
      '| implementer/code | claude claude-sonnet-5-5 | a general subagent on `claude-sonnet-5-5`, given the `code` section',
    );
  });

  it('(f) install and update follow the same rule', async () => {
    const d = await repo();
    await configureBindings({
      cwd: d,
      local: true,
      mode: 'multi',
      set: ['executor=claude-haiku-5-5'],
    });
    const t = table(d);
    rmSync(join(d, LD));
    await runUpdate({ cwd: d, detectVendors: detect });
    expect(table(d)).toBe(t);
    rmSync(join(d, '.loctx/bindings.local.yaml'));
    await runUpdate({ cwd: d, detectVendors: detect });
    expect(existsSync(join(d, LD))).toBe(false);
  });
});

describe('fallback models through config (021 S-18, V-7)', () => {
  const TEAM = '.agents/harness/bindings.yaml';
  const LOCAL = '.loctx/bindings.local.yaml';
  const team = (d: string) =>
    parse(readFileSync(join(d, TEAM), 'utf8')) as {
      groups?: Record<
        string,
        { fallback?: unknown; roles?: Record<string, { fallback?: unknown }> }
      >;
    };
  const terra = { vendor: 'openai', model: 'gpt-6.1-terra' };
  const multi = (d: string) =>
    configureBindings({
      cwd: d,
      mode: 'multi',
      set: ['implementer=claude-sonnet-5-5', 'pl.code-reviewer=openai:gpt-6.1-sol'],
    });

  it('(e) --fallback sets one on a group and on a role, and none clears it; the table follows', async () => {
    const d = await repo();
    await multi(d);
    const r = await configureBindings({
      cwd: d,
      fallback: ['implementer=openai:gpt-6.1-terra', 'pl.code-reviewer=gpt-6.1-terra'],
    });
    expect(r.refused).toBeUndefined();
    expect(r.changed).toEqual(['implementer fallback', 'pl.code-reviewer fallback']);
    expect(team(d).groups?.['implementer']?.fallback).toEqual(terra);
    expect(team(d).groups?.['pl']?.roles?.['code-reviewer']?.fallback).toEqual(terra);
    const agents = () => readFileSync(join(d, 'AGENTS.md'), 'utf8');
    expect(agents()).toContain(
      '; fallback: openai gpt-6.1-terra — `openai exec -m gpt-6.1-terra -s workspace-write -`',
    );
    expect(agents()).toContain("use the role's `fallback` once");
    // a new model for the role keeps its fallback
    await configureBindings({ cwd: d, set: ['pl.code-reviewer=openai:gpt-6-astra'] });
    expect(team(d).groups?.['pl']?.roles?.['code-reviewer']).toEqual({
      vendor: 'openai',
      model: 'gpt-6-astra',
      fallback: terra,
    });
    const c = await configureBindings({
      cwd: d,
      fallback: ['implementer=none', 'pl.code-reviewer=none'],
    });
    expect(c.refused).toBeUndefined();
    expect(team(d).groups?.['implementer']?.fallback).toBeUndefined();
    expect(team(d).groups?.['pl']?.roles?.['code-reviewer']?.fallback).toBeUndefined();
    expect(agents()).not.toContain('fallback');
  });

  it.each([
    [
      'a group without a model',
      { fallback: ['executor=gpt-6.1-terra'] },
      /executor has no model in bindings\.yaml/,
    ],
    [
      'a role without a model of its own',
      { fallback: ['implementer.qa=gpt-6.1-terra'] },
      /implementer\.qa has no model of its own/,
    ],
    [
      'the model itself',
      { fallback: ['implementer=claude-sonnet-5-5'] },
      /the fallback is the group's own model/,
    ],
    [
      "a model the same call makes the group's",
      { set: ['implementer=openai:gpt-6.1-terra'], fallback: ['implementer=gpt-6.1-terra'] },
      /the fallback is the group's own model/,
    ],
    [
      'one of several models',
      { models: ['pl=claude-sonnet-5-5,openai:gpt-6.1-terra'], fallback: ['pl=gpt-6.1-terra'] },
      /the fallback is the group's own model/,
    ],
    ['an unknown role', { fallback: ['implementer.nope=gpt-6.1-terra'] }, /unknown role "nope"/],
    ['no value', { fallback: ['implementer='] }, /is not target=model\|none/],
    [
      'a vendor without a model',
      { fallback: ['implementer=openai:'] },
      /is not target=model\|none/,
    ],
    [
      'clearing a group fallback that is not there',
      { fallback: ['implementer=none'] },
      /implementer has no fallback to clear/,
    ],
    [
      'clearing a role fallback that is not there',
      { fallback: ['pl.code-reviewer=none'] },
      /pl\.code-reviewer has no fallback to clear/,
    ],
  ])('(e, i, j) refuses %s and writes nothing', async (_n, opts, why) => {
    const d = await repo();
    await multi(d);
    const before = readFileSync(join(d, TEAM), 'utf8');
    const r = await configureBindings({ cwd: d, ...opts });
    expect(r.refused).toMatch(why);
    expect(r.code).toBe(1);
    expect(readFileSync(join(d, TEAM), 'utf8')).toBe(before);
  });

  it('(f, i) --local: needs the model in the personal file; then only the personal table changes', async () => {
    const d = await repo();
    await multi(d);
    // the team has the model, the personal file does not: a fallback alone would switch the group off
    const no = await configureBindings({
      cwd: d,
      local: true,
      fallback: ['implementer=gpt-6.1-terra'],
    });
    expect(no.refused).toMatch(/implementer has no model in your personal file/);
    expect(existsSync(join(d, LOCAL))).toBe(false);
    // review: clearing a fallback the personal file does not have must not write `implementer: {}` there,
    // which would switch the team's group off for this person; nor may an empty model get in unchecked
    for (const fallback of [['implementer=none'], ['implementer=openai:']]) {
      const r = await configureBindings({
        cwd: d,
        local: true,
        ...(fallback[0] === 'implementer=none' ? {} : { set: ['implementer=claude-sonnet-5-5'] }),
        fallback,
      });
      expect(r.refused).toBeDefined();
      expect(existsSync(join(d, LOCAL))).toBe(false);
    }
    const stillOn = await configureBindings({ cwd: d, show: true });
    expect(stillOn.roles.find((x) => x.group === 'implementer' && x.role === 'code')?.on).toBe(
      true,
    );
    const before = Object.fromEntries(
      Object.entries(snapshot(d)).filter(([k]) => !k.startsWith('.loctx/')),
    );
    const r = await configureBindings({
      cwd: d,
      local: true,
      set: ['implementer=claude-sonnet-5-5'],
      fallback: ['implementer=gpt-6.1-terra'],
    });
    expect(r.refused).toBeUndefined();
    expect(r.localDelegation).toBe('written');
    expect(readFileSync(join(d, '.loctx/delegation.local.md'), 'utf8')).toContain(
      '| implementer/code | claude claude-sonnet-5-5 | subagent `rs-implementer-code`; fallback: openai gpt-6.1-terra — ',
    );
    expect(
      Object.fromEntries(Object.entries(snapshot(d)).filter(([k]) => !k.startsWith('.loctx/'))),
    ).toEqual(before);
    // the role is still on for this person
    expect(r.roles.find((x) => x.group === 'implementer' && x.role === 'code')).toMatchObject({
      on: true,
      fallback: terra,
    });
  });

  it('(h) the screen: choose a fallback after the model, see it, clear it; leaving changes nothing', async () => {
    const d = await repo();
    await multi(d);
    const run = (answers: unknown[]) => {
      const p = scriptedPrompter(answers as never[]);
      return runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect }).then(
        () => p,
      );
    };
    // project scope → implementer → fallback → choose a model → openai → typed id
    const p = await run([
      'models',
      'scope',
      'project',
      'implementer',
      'fallback',
      'pick',
      'openai',
      'other',
      'gpt-6.1-terra',
      'back',
      'exit',
    ]);
    expect(team(d).groups?.['implementer']?.fallback).toEqual(terra);
    const labels = p.asked.flatMap((q) => q.labels ?? []).join('\n');
    expect(labels).toContain('fallback (optional)');
    // the group line shows it the next time the screen is drawn
    const again = await run(['models', 'back', 'exit']);
    expect(again.asked.flatMap((q) => q.labels ?? []).join('\n')).toContain(
      '(fallback: openai gpt-6.1-terra)',
    );
    // leaving the fallback screen writes nothing
    const before = readFileSync(join(d, TEAM), 'utf8');
    await run(['models', 'scope', 'project', 'implementer', 'fallback', 'back', 'back', 'exit']);
    await run([
      'models',
      'scope',
      'project',
      'implementer',
      'fallback',
      'pick',
      'back',
      'back',
      'exit',
    ]);
    expect(readFileSync(join(d, TEAM), 'utf8')).toBe(before);
    // and it can be removed there
    await run(['models', 'scope', 'project', 'implementer', 'fallback', 'none', 'back', 'exit']);
    expect(team(d).groups?.['implementer']?.fallback).toBeUndefined();
    // a group with no model says so instead of asking
    const none = await run(['models', 'scope', 'project', 'executor', 'fallback', 'back', 'exit']);
    expect(none.notes.join('\n')).toContain('executor has no model yet');
  });

  it('the text output names the fallback beside the role', async () => {
    const d = await repo();
    await multi(d);
    await configureBindings({ cwd: d, fallback: ['implementer=gpt-6.1-terra'] });
    const out: string[] = [];
    await runConfig({
      cwd: d,
      interactive: false,
      write: (s) => out.push(s),
      detectVendors: detect,
    });
    expect(out.join('')).toMatch(
      /implementer\/code\s+claude claude-sonnet-5-5 \(group\) — fallback: openai gpt-6\.1-terra/,
    );
  });
});
