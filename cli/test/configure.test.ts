import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configureBindings } from '../src/commands/configure.js';
import { runInstall } from '../src/commands/install.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { driftGenerated } from '../src/lib/vendor-write.js';

const detect = (on: string[]) => () =>
  (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
    name,
    cli: name,
    detected: on.includes(name),
  }));

async function repo(on: string[]): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-cfg-'));
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

describe('reins configure bindings (R57–R59)', () => {
  it('binds any role to any model, and the vendor files follow', async () => {
    const d = await repo(['claude', 'openai']);
    // on GPT: the Claude file is the fallback one
    expect(readFileSync(join(d, '.claude/agents/reins-code-review.md'), 'utf8')).toContain(
      'fallback for openai',
    );
    const r = await configureBindings({
      cwd: d,
      set: ['pm=claude-fable-5-1', 'code-review=claude-opus-5-5'],
    });
    expect(r.changed).toEqual(['pm', 'code-review']);
    expect(readFileSync(join(d, '.claude/agents/reins-pm.md'), 'utf8')).toMatch(
      /model: claude-fable-5-1/,
    );
    expect(readFileSync(join(d, '.claude/agents/reins-code-review.md'), 'utf8')).not.toContain(
      'fallback for',
    );
    expect(driftGenerated(d)).toEqual([]);
  });

  it('--vendors rebuilds from defaults: GPT only for review when openai is added', async () => {
    const d = await repo(['claude']);
    const r = await configureBindings({
      cwd: d,
      vendors: ['openai'],
      detectVendors: detect(['claude', 'openai']),
    });
    expect(r.table.find((t) => t.role === 'code-review')).toMatchObject({
      vendor: 'openai',
      model: 'gpt-6.1-sol',
    });
    expect(readFileSync(join(d, '.claude/agents/reins-code-review.md'), 'utf8')).toContain(
      'fallback for openai',
    ); // now on GPT
  });

  it('refuses an unknown role or a malformed pair, and changes nothing', async () => {
    const d = await repo(['claude']);
    const before = readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8');
    expect((await configureBindings({ cwd: d, set: ['boss=claude-opus-5-5'] })).refused).toMatch(
      /unknown role/,
    );
    expect((await configureBindings({ cwd: d, set: ['pm'] })).refused).toMatch(/role=model/);
    expect(readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8')).toBe(before);
  });
});
