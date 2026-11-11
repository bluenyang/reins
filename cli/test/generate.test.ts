import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { localDelegation, renderDelegation, WRITES } from '../src/lib/agents-md.js';
import { GROUPS, type BindingsV2 } from '../src/lib/bindings.js';
import { generateVendorFiles, readGroup } from '../src/lib/generate.js';
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

  it('the auditor is read-only on every vendor (021 S-7)', async () => {
    const d = await installed(['claude']);
    // a Claude auditor: its agent file withholds the write tools
    multi(d, '  auditor: { vendor: claude, model: claude-fable-5-1 }\n');
    const file = generateVendorFiles(d).writes.find(
      (w) => w.path === '.claude/agents/rs-auditor.md',
    )!;
    const tools = String(splitFrontmatter(file.content).data?.['disallowedTools']);
    for (const t of ['Edit', 'Write', 'NotebookEdit']) expect(tools).toContain(t);
    // another vendor's auditor: the call line asks for no write access
    const doc = (vendor: string, model: string): BindingsV2 => ({
      schema: 'reins/bindings@2',
      mode: 'multi',
      groups: { auditor: { vendor, model } },
    });
    const openai = renderDelegation(doc('openai', 'gpt-6-astra'));
    expect(openai).toContain(
      '| auditor/auditor | openai gpt-6-astra | `codex exec -m gpt-6-astra -s read-only -` (task on stdin) |',
    );
    expect(openai).not.toContain('workspace-write');
    expect(renderDelegation(doc('google', 'gemini-4-argon-high'))).toContain(
      '--model gemini-4-argon-high --mode plan`',
    );
    // a person's own table is drawn by the same renderer
    expect(
      localDelegation(doc('claude', 'claude-opus-5-5'), doc('openai', 'gpt-6-astra')),
    ).toContain('-s read-only -`');
  });

  it('a group is called with write access exactly when one of its roles writes (021 S-7)', () => {
    const writing = GROUPS.filter((g) => {
      const roles = readGroup(
        readFileSync(join(process.cwd(), 'harness/roles', `${g}.md`), 'utf8'),
      ).roles;
      return Object.values(roles).some((r) => r.tools?.write === true);
    });
    expect(writing.toSorted()).toEqual([...WRITES].toSorted());
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
