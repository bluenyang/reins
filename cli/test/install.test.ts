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
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { scriptedPrompter } from '../src/lib/prompter.js';
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

describe('.claude/memory (design §8)', () => {
  it('is left alone and drafted nowhere; a note points to the retro', async () => {
    const d = repo();
    mkdirSync(join(d, '.claude/memory'), { recursive: true });
    writeFileSync(join(d, '.claude/memory/a.md'), 'keep this\n');
    const r = await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    expect(readFileSync(join(d, '.claude/memory/a.md'), 'utf8')).toBe('keep this\n');
    expect(existsSync(join(d, '.loctx/knowledge-proposals'))).toBe(false);
    expect(r.notes.some((n) => n.startsWith('.claude/memory found'))).toBe(true);
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
      r.notes.some(
        (n) =>
          n.startsWith('hook proposal (husky)') &&
          n.includes('`sh .agents/harness/run-gates.sh pre-commit`') &&
          n.includes('`sh .agents/harness/run-gates.sh pre-push`'),
      ),
    ).toBe(true);
    expect(readFileSync(join(d, '.husky/pre-commit'), 'utf8')).toBe('echo mine\n');
    await runInstall({ ...opts, hooks: true });
    // one line per stage, whatever the gates are (021 S-11)
    expect(readFileSync(join(d, '.husky/pre-commit'), 'utf8')).toBe(
      'echo mine\n# reins:begin hooks\nsh .agents/harness/run-gates.sh pre-commit\n# reins:end hooks\n',
    );
    expect(readFileSync(join(d, '.husky/pre-push'), 'utf8')).toBe(
      '# reins:begin hooks\nsh .agents/harness/run-gates.sh pre-push\n# reins:end hooks\n',
    );
    // the script holds the gate commands and never runs reins
    const script = readFileSync(join(d, '.agents/harness/run-gates.sh'), 'utf8');
    expect(script).toContain("run 'pnpm check'");
    const runs = script.split('\n').filter((l) => !l.startsWith('#'));
    expect(runs.join('\n')).not.toMatch(/npx|@bluenyang|\breins\b/);
  });

  it.each([
    ['lefthook', 'lefthook.yml', 'run: sh .agents/harness/run-gates.sh pre-commit'],
    [
      'pre-commit',
      '.pre-commit-config.yaml',
      'entry: sh .agents/harness/run-gates.sh pre-commit, language: system, pass_filenames: false',
    ],
  ])('%s: proposes the line in its form and leaves its config alone', async (tool, file, line) => {
    const d = repo();
    writeFileSync(join(d, file), '# mine\n');
    const r = await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      hooks: true,
    });
    const note = r.notes.find((n) => n.startsWith(`hook proposal (${tool})`));
    expect(note).toContain(line);
    expect(note).toContain('sh .agents/harness/run-gates.sh pre-push');
    expect(readFileSync(join(d, file), 'utf8')).toBe('# mine\n');
    expect(existsSync(join(d, '.agents/harness/run-gates.sh'))).toBe(true);
  });

  it('with no required gate there is no script and no hook line', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-nogate-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    mkdirSync(join(d, '.husky'), { recursive: true });
    const r = await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      hooks: true,
    });
    expect(existsSync(join(d, '.agents/harness/run-gates.sh'))).toBe(false);
    expect(existsSync(join(d, '.husky/pre-commit'))).toBe(false);
    expect(r.notes.some((n) => n.includes('run-gates.sh'))).toBe(false);
  });

  it('on a terminal it asks before adding the hooks', async () => {
    const d = repo();
    mkdirSync(join(d, '.husky'), { recursive: true });
    const p = scriptedPrompter([true]);
    await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      confirmHooks: p,
    });
    expect(p.asked.map((q) => q.kind)).toEqual(['confirm']);
    expect(p.asked[0]!.message).toContain('sh .agents/harness/run-gates.sh <stage>');
    expect(readFileSync(join(d, '.husky/pre-commit'), 'utf8')).toContain(
      'sh .agents/harness/run-gates.sh pre-commit',
    );
  });

  it('without a hook tool, onboarding asks for one', async () => {
    const d = repo();
    const r = await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    expect(readFileSync(join(d, 'AGENTS.md'), 'utf8')).toContain('which hook tool runs the gates');
    // the script is there all the same, so the tool chosen later needs one line (021 S-11)
    expect(existsSync(join(d, '.agents/harness/run-gates.sh'))).toBe(true);
    expect(
      r.notes.some(
        (n) => n.startsWith('no hook tool found') && n.includes('run-gates.sh pre-commit'),
      ),
    ).toBe(true);
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
      `${readFileSync(b, 'utf8')}groups:\n  auditor: { vendor: claude, model: claude-fable-5-1 }\n`,
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
