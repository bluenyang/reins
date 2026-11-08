import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { discoverGates } from '../src/lib/detect.js';

function repo(): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-install-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  writeFileSync(
    join(d, 'package.json'),
    JSON.stringify({
      scripts: {
        check: 'oxlint . && tsc --noEmit',
        lint: 'oxlint --fix .',
        test: 'vitest run',
        build: 'tsc',
      },
    }),
  );
  writeFileSync(join(d, 'pnpm-lock.yaml'), '');
  return d;
}
const onlyClaude = () => [
  { name: 'claude' as const, cli: 'claude', detected: true },
  { name: 'openai' as const, cli: 'codex', detected: false },
  { name: 'google' as const, cli: 'agy', detected: false },
  { name: 'cursor' as const, cli: 'cursor-agent', detected: false },
];

describe('gate discovery (design §5)', () => {
  it('prefers the aggregate check, drops mutating scripts, keeps test and build', () => {
    const g = discoverGates(repo());
    expect(g.gates.map((x) => `${x.name}=${x.cmd}`)).toEqual([
      'check=pnpm check',
      'test=pnpm test',
      'build=pnpm build',
    ]);
    expect(g.excluded.map((x) => x.name)).toEqual(['lint']);
  });
});

describe('memory drafts (012 S-11)', () => {
  const o = (d: string) => ({
    mode: 'auto' as const,
    asker: defaultsAsker,
    cwd: d,
    detectVendors: onlyClaude,
    now: new Date(2026, 9, 27, 9, 0),
  });
  it('keeps .claude/memory, drafts it as a proposal, passes drift, and accept promotes it', async () => {
    const d = repo();
    mkdirSync(join(d, '.claude/memory'), { recursive: true });
    writeFileSync(join(d, '.claude/memory/a.md'), 'remember the milk\n');
    const r = await runInstall(o(d));
    expect(readFileSync(join(d, '.claude/memory/a.md'), 'utf8')).toBe('remember the milk\n');
    const draft = readFileSync(join(d, '.loctx/knowledge-proposals/memory-a.md'), 'utf8');
    expect(draft).toContain('source: ".claude/memory/a.md"');
    expect(draft).toContain('remember the milk');
    expect(draft).not.toMatch(/^approved:/m);
    expect(r.notes.join('\n')).toMatch(/memory-a/);
    // a second run leaves an edited draft alone
    writeFileSync(join(d, '.loctx/knowledge-proposals/memory-a.md'), draft + 'edited\n');
    await runInstall(o(d));
    expect(readFileSync(join(d, '.loctx/knowledge-proposals/memory-a.md'), 'utf8')).toMatch(
      /edited/,
    );
    writeFileSync(join(d, '.loctx/knowledge-proposals/memory-a.md'), draft);
    expect(existsSync(join(d, '.claude/memory/a.md'))).toBe(true);
  });
});

describe('memory draft names (012 S-11)', () => {
  it('names a draft by its source: a later a.md does not collide with a.txt', async () => {
    const d = repo();
    const o = {
      mode: 'auto' as const,
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      now: new Date(2026, 9, 27, 9, 0),
    };
    mkdirSync(join(d, '.claude/memory'), { recursive: true });
    writeFileSync(join(d, '.claude/memory/a.txt'), 'one\n');
    await runInstall(o);
    const p = (n: string) => join(d, `.loctx/knowledge-proposals/${n}.md`);
    expect(readFileSync(p('memory-a'), 'utf8')).toContain('a.txt');
    writeFileSync(join(d, '.claude/memory/a.md'), 'two\n');
    await runInstall(o);
    expect(readFileSync(p('memory-a-2'), 'utf8')).toContain('source: ".claude/memory/a.md"');
    expect(readFileSync(p('memory-a'), 'utf8')).toContain('a.txt');
    const before = readdirSync(join(d, '.loctx/knowledge-proposals')).toSorted();
    await runInstall(o);
    expect(readdirSync(join(d, '.loctx/knowledge-proposals')).toSorted()).toEqual(before);
  });
});

describe('memory drafts after accept (012 S-11)', () => {
  it('does not draft again once the draft was accepted', async () => {
    const d = repo();
    const o = {
      mode: 'auto' as const,
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      now: new Date(2026, 9, 27, 9, 0),
    };
    mkdirSync(join(d, '.claude/memory'), { recursive: true });
    writeFileSync(join(d, '.claude/memory/a.md'), 'one\n');
    await runInstall(o);
    // accepted: the draft leaves .loctx/knowledge-proposals for .agents/knowledge (design §8)
    mkdirSync(join(d, '.agents/knowledge'), { recursive: true });
    renameSync(
      join(d, '.loctx/knowledge-proposals/memory-a.md'),
      join(d, '.agents/knowledge/2026-10-27_memory-a.md'),
    );
    await runInstall(o);
    expect(readdirSync(join(d, '.loctx/knowledge-proposals'))).toEqual([]);
  });

  it('an entry that cannot be read does not stop the install and keeps its name', async () => {
    const d = repo();
    mkdirSync(join(d, '.claude/memory'), { recursive: true });
    writeFileSync(join(d, '.claude/memory/a.md'), 'one\n');
    mkdirSync(join(d, '.loctx/knowledge-proposals/memory-a.md'), { recursive: true });
    mkdirSync(join(d, '.agents/knowledge/odd.md'), { recursive: true });
    await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      now: new Date(2026, 9, 27, 9, 0),
    });
    const p = join(d, '.loctx/knowledge-proposals/memory-a-2.md');
    expect(readFileSync(p, 'utf8')).toContain('source: ".claude/memory/a.md"');
  });
});

describe('reins install (019, design §9)', () => {
  it('installs into a fresh repository in single mode, and a second run changes nothing', async () => {
    const d = repo();
    const r = await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      now: new Date(2026, 9, 25, 12, 0),
    });
    expect(r.refused).toBeUndefined();
    for (const p of [
      '.agents/harness/policy/common-red-lines.yaml',
      '.agents/harness/roles/pm.md',
      '.agents/harness/templates/audit.md',
      '.agents/harness/bindings.yaml',
      '.agents/harness/gates.yaml',
      '.agents/audit/.gitkeep',
      '.loctx/.gitignore',
      'CLAUDE.md',
    ])
      expect(existsSync(join(d, p)), p).toBe(true);
    expect(existsSync(join(d, '.agents/SKILLS.md'))).toBe(false);
    expect(existsSync(join(d, '.loctx/history'))).toBe(false); // install never writes history
    const agents = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    for (const b of [
      'notice',
      'layout',
      'settings',
      'flow',
      'delegation',
      'records',
      'stops',
      'language',
    ])
      expect(agents).toContain(`reins:begin ${b}`);
    expect(agents).toContain('<!-- reins:onboarding pending -->');
    expect(agents).toContain('Mode: **single**');
    expect(agents).not.toMatch(/reins (check|gate|status|unit|approve|audit request)\b/);
    const bindings = readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8');
    expect(bindings).toContain('schema: reins/bindings@2');
    expect(bindings).toContain('mode: single');
    expect(bindings).toMatch(/audit:\n\s+required: true/);
    expect(readFileSync(join(d, '.agents/harness/install.yaml'), 'utf8')).not.toMatch(/^tier:/m);
    expect(readFileSync(join(d, '.gitignore'), 'utf8')).toMatch(/^\.loctx\/$/m);
    const again = await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    expect(again.applied?.created).toEqual([]);
    expect(again.applied?.changed).toEqual([]);
  });

  it('refuses over a 3rd/4th-generation harness and points to migrate', async () => {
    const d = repo();
    mkdirSync(join(d, '.claude/commands'), { recursive: true });
    const r = await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    expect(r.refused).toMatch(/migrate/);
  });

  it('an onboarding marker set to done stays done', async () => {
    const d = repo();
    const opts = { mode: 'auto' as const, asker: defaultsAsker, cwd: d, detectVendors: onlyClaude };
    await runInstall(opts);
    const p = join(d, 'AGENTS.md');
    writeFileSync(
      p,
      readFileSync(p, 'utf8').replace('reins:onboarding pending', 'reins:onboarding done'),
    );
    await runInstall(opts);
    const text = readFileSync(p, 'utf8');
    expect(text).toContain('reins:onboarding done');
    expect(text).not.toContain('reins:onboarding pending');
  });
});

describe('hooks: the project gates in the project hook tool (019 S-3)', () => {
  it('proposes the gate commands, adds them to husky with --hooks, and never a reins line', async () => {
    const d = repo();
    mkdirSync(join(d, '.husky'), { recursive: true });
    writeFileSync(join(d, '.husky/pre-commit'), 'echo mine\n');
    const opts = { mode: 'auto' as const, asker: defaultsAsker, cwd: d, detectVendors: onlyClaude };
    const r = await runInstall(opts);
    expect(
      r.notes.some((n) => n.startsWith('hook proposal (husky)') && n.includes('pnpm check')),
    ).toBe(true);
    await runInstall({ ...opts, hooks: true });
    const hook = readFileSync(join(d, '.husky/pre-commit'), 'utf8');
    expect(hook).toContain('echo mine');
    expect(hook).toContain('pnpm check');
    expect(hook.replace(/# reins:(begin|end) hooks/g, '')).not.toContain('reins');
  });

  it('without a hook tool, onboarding asks for one', async () => {
    const d = repo();
    await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d, detectVendors: onlyClaude });
    expect(readFileSync(join(d, 'AGENTS.md'), 'utf8')).toContain('which hook tool runs the gates');
  });
});

describe('re-running install keeps what the project owns', () => {
  it('does not reset customised bindings or gates', async () => {
    const d = repo();
    const opts = {
      mode: 'auto' as const,
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    };
    await runInstall(opts);
    const b = join(d, '.agents/harness/bindings.yaml');
    const g = join(d, '.agents/harness/gates.yaml');
    writeFileSync(
      b,
      readFileSync(b, 'utf8').replace('model: claude-opus-5-5', 'model: claude-fable-5-1'),
    );
    writeFileSync(g, readFileSync(g, 'utf8').replace('cmd: pnpm check', 'cmd: pnpm check:all'));
    const again = await runInstall(opts);
    expect(readFileSync(b, 'utf8')).toContain('model: claude-fable-5-1');
    expect(readFileSync(g, 'utf8')).toContain('cmd: pnpm check:all');
    expect(
      again.applied?.changed.filter((p) => p.includes('bindings') || p.includes('gates')),
    ).toEqual([]);
  });
});

describe('skill entry points (design §6)', () => {
  it('installs the packaged skills (not the plugin-only one) and copies them for Claude Code', async () => {
    const d = repo();
    const opts = {
      mode: 'auto' as const,
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    };
    await runInstall(opts);
    const shipped = readdirSync('skills').filter((s) => s !== 'reins-setup');
    expect(shipped.length).toBeGreaterThan(0);
    for (const s of shipped) {
      const src = readFileSync(join(d, `.agents/skills/${s}/SKILL.md`), 'utf8');
      expect(readFileSync(join(d, `.claude/skills/${s}/SKILL.md`), 'utf8')).toBe(src);
    }
    expect(existsSync(join(d, '.agents/skills/reins-setup'))).toBe(false);
    // a project's own skill is copied too
    mkdirSync(join(d, '.agents/skills/deploy-docs'), { recursive: true });
    writeFileSync(
      join(d, '.agents/skills/deploy-docs/SKILL.md'),
      '---\nname: deploy-docs\ndescription: Publish the docs site. Use on release.\n---\n# x\n',
    );
    await runInstall(opts);
    expect(existsSync(join(d, '.claude/skills/deploy-docs/SKILL.md'))).toBe(true);
  });
});

describe('install.yaml pins the CLI (0.1.3 rc.3)', () => {
  it('records the package version as cli next to the harness version', async () => {
    const d = repo();
    await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    const pin = readFileSync(join(d, '.agents/harness/install.yaml'), 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(pin).toContain(`cli: ${pkg.version}`);
    expect(pin).toMatch(/^version: \d+\.\d+\.\d+$/m);
  });
});
