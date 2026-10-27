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
    tier: 'graph',
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

describe('Claude Code generator (design §6)', () => {
  it('generates a subagent per Claude-bound role, with the red lines and the bound model', async () => {
    const g = generateVendorFiles(await installed(['claude', 'openai', 'google']));
    const paths = g.writes.map((w) => w.path);
    expect(paths).toContain('.claude/agents/reins-pm.md');
    // bound to openai: a Claude file on the fallback model, so a user without openai can run it
    const cr = g.writes.find((w) => w.path === '.claude/agents/reins-code-review.md')!;
    expect(cr.content).toMatch(/model: claude-sonnet-5-5/);
    expect(cr.content).toContain('fallback for openai');
    expect(g.skipped).toEqual([]);
    const pm = g.writes.find((w) => w.path.endsWith('reins-pm.md'))!.content;
    const { data, body } = splitFrontmatter(pm);
    expect(data).toMatchObject({ name: 'reins-pm', model: 'claude-opus-5-5' });
    expect(String(data?.['description'])).toMatch(/^reins pm role\./);
    expect(body).toMatch(/## You must never\n- edit source code/);
    expect(body).toMatch(/do not edit/);
  });

  it('with Claude only, every role is generated and lookup cannot write or run commands', async () => {
    const g = generateVendorFiles(await installed(['claude']));
    expect(g.writes.filter((w) => w.path.startsWith('.claude/agents/'))).toHaveLength(12);
    const lookup = splitFrontmatter(
      g.writes.find((w) => w.path.endsWith('reins-lookup.md'))!.content,
    ).data;
    expect(lookup?.['disallowedTools']).toBe('Edit, Write, NotebookEdit, Bash');
    const review = splitFrontmatter(
      g.writes.find((w) => w.path.endsWith('reins-code-review.md'))!.content,
    ).data;
    expect(review?.['model']).toBe('claude-sonnet-5-5'); // its fallback
    expect(review?.['disallowedTools']).toBe('Edit, Write, NotebookEdit');
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
