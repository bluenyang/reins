import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { configureBindings } from '../src/commands/configure.js';
import { runInstall } from '../src/commands/install.js';
import { runStatus } from '../src/commands/status.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { readLocal, resolveBindings } from '../src/lib/bindings.js';
import { generateVendorFiles } from '../src/lib/generate.js';
import { driftGenerated } from '../src/lib/vendor-write.js';

const detect = (on: string[]) => () =>
  (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
    name,
    cli: name,
    detected: on.includes(name),
  }));

async function repo(on: string[]): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-bnd-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  writeFileSync(join(d, 'package.json'), '{}');
  await runInstall({
    tier: 'graph',
    mode: 'auto',
    asker: defaultsAsker,
    cwd: d,
    detectVendors: detect(on),
  });
  return d;
}

const find = (t: ReturnType<typeof resolveBindings>, role: string) =>
  t.find((x) => x.role === role)!;

describe('two-layer bindings (013-3)', () => {
  it('install keeps detection out of bindings.yaml and writes the local file (C-5)', async () => {
    const d = await repo(['claude', 'openai']);
    expect(readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8')).not.toContain(
      'detected',
    );
    const local = readLocal(d);
    expect(local.vendors['openai']?.detected).toBe(true);
    expect(local.vendors['google']?.detected).toBe(false);
    expect(local.roles).toEqual({});
  });

  it('an old detected: key is accepted by T1 and drift (C-5)', async () => {
    const d = await repo(['claude']);
    const p = join(d, '.agents/harness/bindings.yaml');
    writeFileSync(
      p,
      readFileSync(p, 'utf8').replace('cli: claude\n', 'cli: claude\n    detected: true\n'),
    );
    expect(readFileSync(p, 'utf8')).toContain('detected: true');
    expect(driftGenerated(d)).toEqual([]);
    expect(resolveBindings(d, detect(['claude'])).length).toBeGreaterThan(0);
  });

  it('resolves local, fallback and pm with a source (C-6)', async () => {
    const d = await repo(['claude', 'openai', 'cursor']);
    // make code-review (fallback claude-sonnet-5-5) and lookup (no fallback) unavailable
    writeFileSync(
      join(d, '.loctx/bindings.local.yaml'),
      'schema: reins/bindings-local@1\nvendors:\n  openai: {detected: false}\n  cursor: {detected: false}\nroles:\n  docs: {model: claude-opus-5-5}\n',
    );
    // the team binds these two to other vendors
    const bp = join(d, '.agents/harness/bindings.yaml');
    const text = readFileSync(bp, 'utf8')
      .replace(/(code-review:\n\s+vendor: )claude(\n\s+model: )\S+/, '$1openai$2gpt-6.1-sol')
      .replace(
        /(lookup:\n\s+vendor: )claude(\n\s+model: )\S+/,
        '$1cursor$2cursor-grok-4.5-high-fast',
      );
    writeFileSync(bp, text);
    const t = resolveBindings(d, detect([]));
    expect(find(t, 'docs')).toMatchObject({ model: 'claude-opus-5-5', source: 'local' });
    expect(find(t, 'code-review')).toMatchObject({
      model: 'claude-sonnet-5-5',
      source: 'fallback',
    });
    expect(find(t, 'lookup')).toMatchObject({ model: 'claude-opus-5-5', source: 'pm' });
    expect(find(t, 'pm').source).toBe('team');
  });

  it('detects a vendor missing from the local file live, without writing it back', async () => {
    const d = await repo(['claude']);
    const bp = join(d, '.agents/harness/bindings.yaml');
    writeFileSync(
      bp,
      readFileSync(bp, 'utf8').replace(
        /(code-review:\n\s+vendor: )claude(\n\s+model: )\S+/,
        '$1openai$2gpt-6.1-sol',
      ),
    );
    const before = readFileSync(join(d, '.loctx/bindings.local.yaml'), 'utf8');
    writeFileSync(join(d, '.loctx/bindings.local.yaml'), 'schema: reins/bindings-local@1\n');
    expect(find(resolveBindings(d, detect(['claude', 'openai'])), 'code-review').source).toBe(
      'team',
    );
    expect(find(resolveBindings(d, detect(['claude'])), 'code-review').source).toBe('fallback');
    expect(readFileSync(join(d, '.loctx/bindings.local.yaml'), 'utf8')).not.toContain('openai');
    expect(before).toContain('openai');
  });

  it('configure --local --set writes roles only; --show and status list the table (C-6)', async () => {
    const d = await repo(['claude']);
    const bp = join(d, '.agents/harness/bindings.yaml');
    const files = ['.claude/agents/reins-pm.md', '.agents/harness/generated.yaml'];
    const snap = [bp, ...files.map((f) => join(d, f))].map((f) => readFileSync(f, 'utf8'));
    const r = await configureBindings({
      cwd: d,
      local: true,
      set: ['pm=claude-fable-5-1'],
      detectVendors: detect(['claude']),
    });
    expect(r.refused).toBeUndefined();
    expect(r.resolved?.find((x) => x.role === 'pm')).toMatchObject({
      model: 'claude-fable-5-1',
      source: 'local',
    });
    expect([bp, ...files.map((f) => join(d, f))].map((f) => readFileSync(f, 'utf8'))).toEqual(snap);
    expect(readLocal(d).roles).toEqual({ pm: { model: 'claude-fable-5-1' } });
    expect((await configureBindings({ cwd: d, local: true, set: ['nope=x'] })).refused).toMatch(
      /unknown role/,
    );
    const show = await configureBindings({ cwd: d, show: true, detectVendors: detect(['claude']) });
    expect(show.resolved).toHaveLength(12);
    const st = JSON.parse(runStatus({ cwd: d, json: true }).stdout) as {
      bindings: { role: string; source: string }[];
    };
    expect(st.bindings.find((b) => b.role === 'pm')?.source).toBe('local');
    expect(runStatus({ cwd: d }).stdout).toContain('bindings (resolved):');
  });

  it('generated files ignore the local file and cover non-Claude roles (C-7)', async () => {
    const d = await repo(['claude']);
    const bp = join(d, '.agents/harness/bindings.yaml');
    writeFileSync(
      bp,
      readFileSync(bp, 'utf8').replace(
        /(code-review:\n\s+vendor: )claude(\n\s+model: )\S+/,
        '$1openai$2gpt-6.1-sol',
      ),
    );
    const a = generateVendorFiles(d);
    writeFileSync(
      join(d, '.loctx/bindings.local.yaml'),
      'schema: reins/bindings-local@1\nroles:\n  code-review: {model: claude-fable-5-1}\n  pm: {model: claude-haiku-5-5}\n',
    );
    expect(generateVendorFiles(d)).toEqual(a);
    const cr = a.writes.find((w) => w.path === '.claude/agents/reins-code-review.md')!;
    expect(cr.content).toContain('model: claude-sonnet-5-5');
    expect(cr.content).toContain('fallback for openai');
    expect(existsSync(join(d, '.claude/agents'))).toBe(true);
  });

  const bindPm = (d: string, extra = '') => {
    const bp = join(d, '.agents/harness/bindings.yaml');
    writeFileSync(
      bp,
      readFileSync(bp, 'utf8')
        .replace(/(\n  pm:\n\s+vendor: )claude(\n\s+model: )\S+/, '$1openai$2gpt-6.1-sol')
        .replace(
          /(lookup:\n\s+vendor: )claude(\n\s+model: )\S+/,
          '$1cursor$2cursor-grok-4.5-high-fast',
        ),
    );
    if (extra) {
      const rp = join(d, '.agents/harness/roles/pm.md');
      writeFileSync(
        rp,
        readFileSync(rp, 'utf8').replace(/^(default_binding:.*)$/m, `$1\n${extra}`),
      );
    }
  };

  it('pm is resolved first: an unavailable pm uses its fallback, and others fall to that (review fix)', async () => {
    const d = await repo(['claude']);
    bindPm(d, 'fallback_binding: "claude-sonnet-5-5"');
    const t = resolveBindings(d, detect(['claude']));
    expect(find(t, 'pm')).toMatchObject({ model: 'claude-sonnet-5-5', source: 'fallback' });
    expect(find(t, 'lookup')).toMatchObject({ model: 'claude-sonnet-5-5', source: 'pm' });
  });

  it('pm with nothing usable ends on the claude default, and a local pm override wins', async () => {
    const d = await repo(['claude']);
    bindPm(d);
    const t = resolveBindings(d, detect(['claude']));
    expect(find(t, 'pm')).toMatchObject({
      vendor: 'claude',
      model: 'claude-opus-5-5',
      source: 'default',
    });
    expect(find(t, 'lookup')).toMatchObject({ model: 'claude-opus-5-5', source: 'pm' });
    writeFileSync(
      join(d, '.loctx/bindings.local.yaml'),
      'schema: reins/bindings-local@1\nroles:\n  pm: {model: claude-fable-5-1}\n',
    );
    const u = resolveBindings(d, detect(['claude']));
    expect(find(u, 'pm')).toMatchObject({ model: 'claude-fable-5-1', source: 'local' });
    expect(find(u, 'lookup')).toMatchObject({ model: 'claude-fable-5-1', source: 'pm' });
  });

  it('an invalid local file warns and is ignored', async () => {
    const d = await repo(['claude']);
    writeFileSync(
      join(d, '.loctx/bindings.local.yaml'),
      'schema: reins/bindings-local@1\nroles:\n  pm: {model: 7}\n',
    );
    const warn = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      expect(readLocal(d).roles).toEqual({});
      expect(resolveBindings(d, detect(['claude'])).length).toBe(12);
      expect(String(warn.mock.calls[0]?.[0])).toMatch(/bindings\.local\.yaml is invalid/);
    } finally {
      warn.mockRestore();
    }
  });

  it('the loop skill and vendor-cli reference point at reins status --json (C-7)', () => {
    for (const f of ['skills/reins-loop/SKILL.md', 'skills/reins-loop/references/vendor-cli.md'])
      expect(readFileSync(join(__dirname, '../..', f), 'utf8')).toContain('reins status --json');
  });
});
