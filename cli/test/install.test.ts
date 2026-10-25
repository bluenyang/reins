import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { driftConvention, driftMatch } from '../src/commands/check.js';
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
    execFileSync('mkdir', ['-p', join(d, '.claude/commands')]);
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
