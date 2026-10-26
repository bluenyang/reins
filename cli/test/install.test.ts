import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { driftConvention, driftMatch } from '../src/commands/check.js';
import { acceptKnowledge } from '../src/commands/knowledge.js';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { discoverGates } from '../src/lib/detect.js';
import { tierSkills } from '../src/lib/upstream.js';

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
    tier: 'graph' as const,
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
    expect(driftConvention(d)).toEqual([]);
    expect(driftMatch(d)).toEqual([]);
    // a second run leaves an edited draft alone
    writeFileSync(join(d, '.loctx/knowledge-proposals/memory-a.md'), draft + 'edited\n');
    await runInstall(o(d));
    expect(readFileSync(join(d, '.loctx/knowledge-proposals/memory-a.md'), 'utf8')).toMatch(
      /edited/,
    );
    writeFileSync(join(d, '.loctx/knowledge-proposals/memory-a.md'), draft);
    const acc = acceptKnowledge('memory-a', { cwd: d });
    expect(acc.refused).toBeUndefined();
    expect(readFileSync(join(d, acc.path!), 'utf8')).toMatch(/^approved:/m);
    expect(existsSync(join(d, '.claude/memory/a.md'))).toBe(true);
  });
});

describe('memory draft names (012 S-11)', () => {
  it('names a draft by its source: a later a.md does not collide with a.txt', async () => {
    const d = repo();
    const o = {
      tier: 'graph' as const,
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

describe('reins install graph (S5)', () => {
  it('installs into a fresh repository with Claude only, and a second run changes nothing', async () => {
    const d = repo();
    const r = await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      now: new Date(2026, 9, 25, 12, 0),
    });
    expect(r.refused).toBeUndefined();
    for (const p of [
      '.agents/harness/policy/stops.yaml',
      '.agents/harness/bindings.yaml',
      '.agents/harness/gates.yaml',
      '.loctx/.gitignore',
      'CLAUDE.md',
    ])
      expect(existsSync(join(d, p)), p).toBe(true);
    const agents = readFileSync(join(d, 'AGENTS.md'), 'utf8');
    for (const b of ['notice', 'workflow', 'skills', 'language'])
      expect(agents).toContain(`reins:begin ${b}`);
    // every role runs on Claude when no other vendor is available (R14, R22)
    const bindings = readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8');
    expect(bindings).not.toMatch(/vendor: (openai|google)/);
    expect(bindings).toMatch(/qa-run:\n\s+vendor: claude\n\s+model: claude-haiku-5-5/);
    expect(readFileSync(join(d, '.gitignore'), 'utf8')).toMatch(/^\.loctx\/$/m);
    expect(r.history).toBe('.loctx/history/2026-10-25-1200_install-graph.md');
    // installed files pass the verifier's own layers
    expect(driftConvention(d)).toEqual([]);
    expect(driftMatch(d)).toEqual([]);
    const again = await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    expect(again.applied?.created).toEqual([]);
    expect(again.applied?.changed).toEqual([]);
    expect(again.history).toBeUndefined();
  });

  it('refuses over a 3rd/4th-generation harness and points to migrate', async () => {
    const d = repo();
    mkdirSync(join(d, '.claude/commands'), { recursive: true });
    const r = await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    expect(r.refused).toMatch(/migrate/);
  });

  it('the harness tier installs only policy, gates and blocks', async () => {
    const d = repo();
    await runInstall({
      tier: 'harness',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    expect(existsSync(join(d, '.agents/harness/policy/stops.yaml'))).toBe(true);
    expect(existsSync(join(d, '.agents/harness/roles'))).toBe(false);
    expect(existsSync(join(d, '.loctx'))).toBe(false);
  });

  it('a hand edit to an installed harness file is drift (F2)', async () => {
    const d = repo();
    await runInstall({
      tier: 'graph',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    const p = join(d, '.agents/harness/roles/pl.md');
    writeFileSync(p, readFileSync(p, 'utf8').replace('push, open PRs, merge, release', 'nothing'));
    expect(driftMatch(d).map((f) => `${f.reason} ${f.verdict} ${f.path}`)).toEqual([
      'F2 STOP .agents/harness/roles/pl.md',
    ]);
  });
});

describe('re-running install keeps what the project owns', () => {
  it('does not reset customised bindings or gates', async () => {
    const d = repo();
    const opts = {
      tier: 'graph' as const,
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
  it('installs the packaged skills, indexes them and copies them for Claude Code', async () => {
    const d = repo();
    const opts = {
      tier: 'graph' as const,
      mode: 'auto' as const,
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    };
    await runInstall(opts);
    for (const s of tierSkills('graph')) {
      const src = readFileSync(join(d, `.agents/skills/${s}/SKILL.md`), 'utf8');
      expect(readFileSync(join(d, `.claude/skills/${s}/SKILL.md`), 'utf8')).toBe(src);
    }
    const index = readFileSync(join(d, '.agents/SKILLS.md'), 'utf8');
    expect(index.match(/^\| `reins-/gm)).toHaveLength(10);
    expect(driftMatch(d)).toEqual([]);
    // a project's own skill is indexed and copied too
    mkdirSync(join(d, '.agents/skills/deploy-docs'), { recursive: true });
    writeFileSync(
      join(d, '.agents/skills/deploy-docs/SKILL.md'),
      '---\nname: deploy-docs\ndescription: Publish the docs site. Use on release.\n---\n# x\n',
    );
    await runInstall(opts);
    expect(readFileSync(join(d, '.agents/SKILLS.md'), 'utf8')).toContain(
      '| `deploy-docs` | Publish the docs site. |',
    );
    expect(existsSync(join(d, '.claude/skills/deploy-docs/SKILL.md'))).toBe(true);
    // editing an installed reins skill is drift
    const p = join(d, '.agents/skills/reins-loop/SKILL.md');
    writeFileSync(p, `${readFileSync(p, 'utf8')}\nskip T3.\n`);
    expect(driftMatch(d).map((f) => f.path)).toEqual(['.agents/skills/reins-loop/SKILL.md']);
  });

  it('the harness tier gets only reins-setup', async () => {
    const d = repo();
    await runInstall({
      tier: 'harness',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    expect(existsSync(join(d, '.agents/skills/reins-setup/SKILL.md'))).toBe(true);
    expect(existsSync(join(d, '.agents/skills/reins-loop'))).toBe(false);
  });
});

describe('install.yaml pins the CLI (0.1.3 rc.3)', () => {
  it('records the package version as cli next to the harness version', async () => {
    const d = repo();
    await runInstall({
      tier: 'graph',
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

  it('every stage skill reads cli, not version, from install.yaml', () => {
    for (const s of tierSkills('graph').filter((n) => n !== 'reins-setup')) {
      const text = readFileSync(join('skills', s, 'SKILL.md'), 'utf8');
      expect(text, s).toContain('is `cli` in `.agents/harness/install.yaml`');
      expect(text, s).not.toContain('is `version` in `.agents/harness/install.yaml`');
    }
  });
});
