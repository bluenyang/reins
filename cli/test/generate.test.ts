import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { generateVendorFiles } from '../src/lib/generate.js';
import { splitFrontmatter } from '../src/lib/skills.js';

async function installed(vendors: string[]): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-gen-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  writeFileSync(join(d, 'package.json'), '{}');
  await runInstall({
    mode: 'auto',
    asker: defaultsAsker,
    cwd: d,
    detectVendors: () =>
      (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
        name,
        cli: name,
        detected: vendors.includes(name),
      })),
  });
  return d;
}

const multi = (d: string, groups: string): void =>
  writeFileSync(
    join(d, '.agents/harness/bindings.yaml'),
    `schema: reins/bindings@2\nmode: multi\ndefault: { vendor: claude, model: claude-opus-5-5 }\ngroups:\n${groups}`,
  );

describe('Claude Code generator (design §6)', () => {
  it('single mode generates no agent file', async () => {
    const g = generateVendorFiles(await installed(['claude']));
    expect(g.writes.filter((w) => w.path.startsWith('.claude/agents/'))).toEqual([]);
  });

  it('multi: one rs- file per role on a Claude model, with its model, must_not and tools', async () => {
    const d = await installed(['claude']);
    multi(
      d,
      '  pl: { models: [ { vendor: claude, model: claude-sonnet-5-5 }, { vendor: openai, model: gpt-6.1-terra } ] }\n  executor: { vendor: claude, model: claude-haiku-5-5 }\n',
    );
    const g = generateVendorFiles(d);
    const paths = g.writes.map((w) => w.path).filter((p) => p.startsWith('.claude/agents/'));
    expect(paths).toContain('.claude/agents/rs-pl-control.md');
    expect(paths).toContain('.claude/agents/rs-executor-researcher.md');
    // the reviewers run on the second (openai) model: no Claude file, the delegation table calls codex
    expect(paths).not.toContain('.claude/agents/rs-pl-code-reviewer.md');
    const researcher = g.writes.find((w) => w.path === '.claude/agents/rs-executor-researcher.md')!;
    const { data, body } = splitFrontmatter(researcher.content);
    expect(data?.['model']).toBe('claude-haiku-5-5');
    expect(String(data?.['disallowedTools'])).toContain('Write');
    expect(body).toContain('write files');
    expect(body).not.toMatch(/reins (check|gate|status|unit)/);
  });

  it('settings.json denies secrets without hiding templates, and force push / hook bypass', async () => {
    const g = generateVendorFiles(await installed(['claude']));
    const deny = (
      JSON.parse(g.writes.find((w) => w.path === '.claude/settings.json')!.content) as {
        permissions: { deny: string[] };
      }
    ).permissions.deny;
    expect(deny).toContain('Read(**/.env)');
    expect(deny).toContain('Read(**/*.env)');
    expect(deny).toContain('Read(**/.env.*.local)');
    expect(deny).not.toContain('Read(**/.env.*)'); // would hide .env.example
    expect(deny).toContain('Bash(git push --force *)');
    expect(deny).toContain('Bash(git commit --no-verify *)');
  });
});
