import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configureBindings } from '../src/commands/configure.js';
import { runInstall } from '../src/commands/install.js';
import { runStatus } from '../src/commands/status.js';
import { ticketStart } from '../src/commands/stages.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { readLocal, resolveBindings, roleStates, setRoleEnabled } from '../src/lib/bindings.js';
import { generateVendorFiles } from '../src/lib/generate.js';
import { packageHarness } from '../src/lib/upstream.js';
import { driftGenerated } from '../src/lib/vendor-write.js';

const detect = () =>
  (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
    name,
    cli: name,
    detected: name === 'claude',
  }));

async function repo(): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-onoff-'));
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

const BP = '.agents/harness/bindings.yaml';
const LOCAL = '.loctx/bindings.local.yaml';
const agent = (d: string, r: string) => join(d, `.claude/agents/reins-${r}.md`);
const find = (d: string, r: string) => resolveBindings(d, detect).find((x) => x.role === r)!;
const put = (d: string, rel: string, text: string) => {
  mkdirSync(dirname(join(d, rel)), { recursive: true });
  writeFileSync(join(d, rel), text);
};

describe('role on/off (014-2)', () => {
  it('every role file has covered_by; outside the fixed roles it names a role, caller or user (C-6)', () => {
    const dir = join(packageHarness(), 'roles');
    const names = readdirSync(dir).map((f) => f.slice(0, -3));
    for (const f of readdirSync(dir)) {
      const m = /^covered_by: (.+)$/m.exec(readFileSync(join(dir, f), 'utf8'));
      expect(m, f).not.toBeNull();
      const v = m![1]!;
      if (['pm', 'implementer', 'verify-tool'].includes(f.slice(0, -3))) expect(v).toBe('none');
      else expect([...names, 'caller', 'user']).toContain(v);
    }
  });

  it('global OFF writes only roles.docs.enabled and keeps comments; ON removes it (C-4)', async () => {
    const d = await repo();
    const p = join(d, BP);
    writeFileSync(p, `# keep me\n${readFileSync(p, 'utf8')}`);
    const before = readFileSync(p, 'utf8');
    expect(setRoleEnabled(d, 'docs', false, 'global')).toEqual({ changed: true });
    const after = readFileSync(p, 'utf8');
    expect(after).toContain('# keep me');
    expect(after.replace(/ {4}enabled: false\n/, '')).toBe(before);
    expect(after).toMatch(/docs:\n(?: {4}.*\n)* {4}enabled: false/);
    expect(setRoleEnabled(d, 'docs', true, 'global')).toEqual({ changed: true });
    expect(readFileSync(p, 'utf8')).toBe(before);
    expect(setRoleEnabled(d, 'docs', true, 'global')).toEqual({ changed: false });
  });

  it('local OFF touches the local file only; equal to the team value removes the key (C-4)', async () => {
    const d = await repo();
    const team = readFileSync(join(d, BP), 'utf8');
    setRoleEnabled(d, 'docs', false, 'local');
    expect(readFileSync(join(d, BP), 'utf8')).toBe(team);
    expect(readLocal(d).roles['docs']).toEqual({ enabled: false });
    setRoleEnabled(d, 'docs', true, 'local');
    expect(readLocal(d).roles['docs']).toBeUndefined();
  });

  it('refuses fixed and unknown roles; nothing is written (C-4)', async () => {
    const d = await repo();
    for (const r of ['pm', 'implementer', 'verify-tool'])
      expect(setRoleEnabled(d, r, false, 'global').refused).toContain('always on');
    expect(setRoleEnabled(d, 'nosuch', false, 'local').refused).toContain('unknown role');
    expect(setRoleEnabled(d, 'pm', true, 'local')).toEqual({ changed: false });
  });

  it('local wins both ways; an enabled-only local entry passes the schema (C-4)', async () => {
    const d = await repo();
    setRoleEnabled(d, 'docs', false, 'global');
    expect(find(d, 'docs')).toMatchObject({
      enabled: false,
      enabled_source: 'team',
      covered_by: 'pm',
    });
    put(
      d,
      LOCAL,
      'schema: reins/bindings-local@1\nroles:\n  docs: {enabled: true}\n  qa-run: {enabled: false}\n',
    );
    expect(find(d, 'docs')).toMatchObject({ enabled: true, enabled_source: 'local' });
    expect(find(d, 'qa-run')).toMatchObject({ enabled: false, covered_by: 'verify-tool' });
    expect(find(d, 'pm')).toMatchObject({ enabled: true, enabled_source: 'fixed' });
  });

  it('a fixed role with enabled: false stays on and status warns (C-4)', async () => {
    const d = await repo();
    put(d, LOCAL, 'schema: reins/bindings-local@1\nroles:\n  pm: {enabled: false}\n');
    expect(find(d, 'pm').enabled).toBe(true);
    expect(roleStates(d).warnings.join('\n')).toContain('pm is always on');
    expect(runStatus({ cwd: d }).stderr).toContain('pm is always on');
  });

  it('status shows off -> covered_by and on (local); JSON has enabled and covered_by (C-6, C-7)', async () => {
    const d = await repo();
    setRoleEnabled(d, 'docs', false, 'global');
    setRoleEnabled(d, 'planner', false, 'global');
    setRoleEnabled(d, 'planner', true, 'local');
    const text = runStatus({ cwd: d }).stdout;
    expect(text).toMatch(/docs +\S+ +\S+ \(\w+\) off → pm/);
    expect(text).toMatch(/planner +\S+ +\S+ \(\w+\) on \(local\)/);
    const json = JSON.parse(runStatus({ cwd: d, json: true }).stdout) as {
      bindings: { role: string; enabled: boolean; covered_by?: string }[];
    };
    expect(json.bindings.find((b) => b.role === 'docs')).toMatchObject({
      enabled: false,
      covered_by: 'pm',
    });
    expect(json.bindings.find((b) => b.role === 'planner')).toMatchObject({ enabled: true });
  });

  it('a team-off role gets no agent file; local values change no generated byte (C-7)', async () => {
    const d = await repo();
    const all = generateVendorFiles(d).writes.map((w) => w.path);
    expect(all).toContain('.claude/agents/reins-docs.md');
    const r = await configureBindings({ cwd: d, disable: ['docs'], detectVendors: detect });
    expect(r.toggled).toEqual([{ role: 'docs', enabled: false }]);
    expect(generateVendorFiles(d).writes.map((w) => w.path)).not.toContain(
      '.claude/agents/reins-docs.md',
    );
    expect(existsSync(agent(d, 'docs'))).toBe(false);
    expect(r.generated?.removed).toContain('.claude/agents/reins-docs.md');
    expect(driftGenerated(d)).toEqual([]);
    // a local on/off changes nothing generated
    const snap = JSON.stringify(generateVendorFiles(d).writes);
    setRoleEnabled(d, 'docs', true, 'local');
    setRoleEnabled(d, 'planner', false, 'local');
    expect(JSON.stringify(generateVendorFiles(d).writes)).toBe(snap);
    expect(existsSync(agent(d, 'docs'))).toBe(false);
    expect(find(d, 'docs')).toMatchObject({ enabled: true, enabled_source: 'local' });
    expect(driftGenerated(d)).toEqual([]);
  });

  it('configure --disable/--enable, global and --local, with refusals (C-12)', async () => {
    const d = await repo();
    const run = (o: Parameters<typeof configureBindings>[0]) =>
      configureBindings({ cwd: d, detectVendors: detect, ...o });
    await run({ disable: ['docs'] });
    expect(readFileSync(join(d, BP), 'utf8')).toMatch(/enabled: false/);
    expect(existsSync(agent(d, 'docs'))).toBe(false);
    await run({ enable: ['docs'] });
    expect(readFileSync(join(d, BP), 'utf8')).not.toMatch(/enabled/);
    expect(existsSync(agent(d, 'docs'))).toBe(true);

    const team = readFileSync(join(d, BP), 'utf8');
    const r = await run({ local: true, disable: ['docs'] });
    expect(r.toggled).toEqual([{ role: 'docs', enabled: false }]);
    expect(readFileSync(join(d, BP), 'utf8')).toBe(team);
    expect(existsSync(agent(d, 'docs'))).toBe(true);
    expect(readLocal(d).roles['docs']).toEqual({ enabled: false });

    const files = [BP, LOCAL].map((f) => readFileSync(join(d, f), 'utf8'));
    for (const bad of [['pm'], ['nosuch'], ['docs', 'pm']]) {
      const x = await run({ disable: bad });
      expect(x).toMatchObject({ code: 1, changed: [] });
      expect(x.refused).toBeTruthy();
    }
    expect([BP, LOCAL].map((f) => readFileSync(join(d, f), 'utf8'))).toEqual(files);
  });

  it('--set and --disable combine and --set keeps a role off (C-12)', async () => {
    const d = await repo();
    await configureBindings({ cwd: d, detectVendors: detect, disable: ['docs'] });
    const r = await configureBindings({
      cwd: d,
      detectVendors: detect,
      set: ['docs=claude-opus-5-5', 'lookup=claude-opus-5-5'],
      disable: ['planner'],
    });
    expect(r.refused).toBeUndefined();
    const y = readFileSync(join(d, BP), 'utf8');
    expect(y).toMatch(/docs:\n(?: {4}.*\n)*? {4}enabled: false/);
    expect(find(d, 'docs')).toMatchObject({ model: 'claude-opus-5-5', enabled: false });
    expect(find(d, 'planner').enabled).toBe(false);
    expect(driftGenerated(d)).toEqual([]);
  });

  it('T1 warns once for an off role and still continues (C-6)', async () => {
    const d = await repo();
    put(
      d,
      '.agents/intent/001_s/intent.md',
      '---\nid: "001"\nslug: s\nversion: 0.2.0\nstatus: draft\norigin: user\napprovals: []\n---\n',
    );
    put(
      d,
      '.loctx/ticket/001-1_x.md',
      '---\nid: 001-1\nintent: "001"\nplan_step: 1\ntitle: t\nstatus: todo\nrelease: planned\nrole: docs\n---\n## 목적\n—\n',
    );
    const none = ticketStart(d, '001-1').filter((f) => f.message.includes('is off'));
    expect(none).toEqual([]);
    setRoleEnabled(d, 'docs', false, 'local');
    const warn = ticketStart(d, '001-1').filter((f) => f.message.includes('is off'));
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatchObject({ verdict: 'WARN' });
    expect(warn[0]!.message).toBe('role docs is off — covered by pm');
    expect([warn[0]!.reason, warn[0]!.verdict]).toEqual(['F2', 'WARN']); // no stop id of its own (design §3)
  });
});

describe('docs and skill text (014-2)', () => {
  const root = join(__dirname, '../..');
  const read = (f: string) => readFileSync(join(root, f), 'utf8');
  it('the loop skill explains off roles and locally enabled roles (C-6, C-7)', () => {
    const loop = read('skills/reins-loop/SKILL.md');
    expect(loop).toContain('covered_by');
    expect(loop).toContain('resolved `model`');
    expect(loop).toContain('reins status --json');
  });
  it('design and README name --enable and --disable in both editions (C-12)', () => {
    for (const f of ['docs/design.md', 'docs/design.ko.md', 'README.md', 'docs/README.ko.md']) {
      expect(read(f), f).toContain('--disable');
      expect(read(f), f).toContain('--enable');
    }
    for (const f of ['docs/design.md', 'docs/design.ko.md'])
      expect(read(f), f).toContain('covered_by');
  });
});
