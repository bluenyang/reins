import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runConfig } from '../src/commands/config.js';
import { runInstall } from '../src/commands/install.js';
import { formatUpdate, runUpdate } from '../src/commands/update.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { generateVendorFiles } from '../src/lib/generate.js';
import {
  applyLocalForcePush,
  FORCE_WITH_LEASE_RULES,
  LOCAL_SETTINGS,
  recordedForceWithLease,
} from '../src/lib/local-settings.js';
import { scriptedPrompter } from '../src/lib/prompter.js';
import { deniedBy } from './helpers/claude-bash-rule.js';

/** Spec 024 revision 1 (S-26a, V-8): force push with lease, per person, in .claude/settings.local.json. */

const detect = () => [{ name: 'claude' as const, cli: 'claude', detected: true }];
async function installed(opts: Record<string, unknown> = {}): Promise<string> {
  const d = mkdtempSync(join(tmpdir(), 'reins-lease-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  writeFileSync(join(d, 'package.json'), '{}');
  await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d, detectVendors: detect, ...opts });
  return d;
}
const local = (d: string) =>
  JSON.parse(readFileSync(join(d, LOCAL_SETTINGS), 'utf8')) as {
    permissions?: { deny?: string[]; allow?: string[] };
    env?: unknown;
  };
const team = (d: string) =>
  JSON.parse(
    generateVendorFiles(d).writes.find((w) => w.path === '.claude/settings.json')!.content,
  ) as {
    permissions: { deny: string[] };
  };

describe('force push with lease, per person (024 S-26a)', () => {
  it('a non-interactive install denies it in the personal file and does not record an answer', async () => {
    const d = await installed();
    expect(local(d).permissions?.deny).toEqual(FORCE_WITH_LEASE_RULES);
    expect(recordedForceWithLease(d)).toBeUndefined();
    expect(team(d).permissions.deny.some((r) => r.includes('--force-with-lease'))).toBe(false);
    // the personal rules really catch it, in every form
    for (const c of [
      'git push --force-with-lease',
      'git push --force-with-lease origin fix/x',
      'git push --force-with-lease backup',
    ])
      expect(deniedBy(local(d).permissions!.deny!, c), c).toBeDefined();
  });

  it('a terminal install asks; the answer is recorded and the file follows it', async () => {
    const p = scriptedPrompter([false]);
    const d = await installed({ confirmHooks: p });
    expect(p.asked.at(-1)!.message).toContain('force-with-lease');
    expect(recordedForceWithLease(d)).toBe('allow');
    expect(existsSync(join(d, LOCAL_SETTINGS))).toBe(false); // allow and nothing of ours: no file made
    // asked once: a second install reads the answer
    const q = scriptedPrompter([]);
    await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: detect,
      confirmHooks: q,
    });
    expect(q.asked).toEqual([]);
  });

  it("keeps the person's own entries, removes only the rules reins wrote, and leaves a file that is not settings alone", () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-lease-own-'));
    mkdirSync(join(d, '.claude'));
    writeFileSync(
      join(d, LOCAL_SETTINGS),
      JSON.stringify({
        env: { A: '1' },
        permissions: { allow: ['Bash(gh *)'], deny: ['Mine(*)', FORCE_WITH_LEASE_RULES[1]] },
      }),
    );
    applyLocalForcePush(d, 'deny');
    expect(local(d).permissions).toEqual({
      allow: ['Bash(gh *)'],
      deny: ['Mine(*)', FORCE_WITH_LEASE_RULES[1], FORCE_WITH_LEASE_RULES[0]],
    });
    expect(local(d).env).toEqual({ A: '1' });
    applyLocalForcePush(d, 'allow');
    // the person's rule was there first, so it stays theirs (review 6)
    expect(local(d).permissions).toEqual({
      allow: ['Bash(gh *)'],
      deny: ['Mine(*)', FORCE_WITH_LEASE_RULES[1]],
    });
    expect(recordedForceWithLease(d)).toBe('allow');
    // a rule the person wrote is theirs: deny then allow does not take it out (review 6)
    const e = mkdtempSync(join(tmpdir(), 'reins-lease-mine-'));
    mkdirSync(join(e, '.claude'));
    writeFileSync(
      join(e, LOCAL_SETTINGS),
      JSON.stringify({ permissions: { deny: [FORCE_WITH_LEASE_RULES[1]] } }),
    );
    applyLocalForcePush(e, 'deny');
    expect(local(e).permissions?.deny).toEqual([
      FORCE_WITH_LEASE_RULES[1],
      FORCE_WITH_LEASE_RULES[0],
    ]);
    applyLocalForcePush(e, 'allow');
    expect(local(e).permissions?.deny).toEqual([FORCE_WITH_LEASE_RULES[1]]);
    writeFileSync(join(d, LOCAL_SETTINGS), '{ broken');
    const r = applyLocalForcePush(d, 'deny');
    expect(r.file).toBe('refused');
    expect(readFileSync(join(d, LOCAL_SETTINGS), 'utf8')).toBe('{ broken');
  });

  it('update shows the personal line and the migration from the 0.3.3 team rule (review 6)', async () => {
    const d = await installed();
    const m = join(d, '.agents/harness/generated.yaml');
    writeFileSync(
      m,
      readFileSync(m, 'utf8').replace(
        /owned:\n {2}\.claude\/settings\.json:\n/,
        'owned:\n  .claude/settings.json:\n    - Bash(git push --force-with-lease *)\n',
      ),
    );
    const pin = join(d, '.agents/harness/install.yaml');
    writeFileSync(pin, readFileSync(pin, 'utf8').replace(/version: .*/, 'version: 0.3.3'));
    const r = await runUpdate({ cwd: d, detectVendors: detect, yes: true });
    const report = formatUpdate(r, false);
    expect(report).toContain('force push with lease: denied to the agents on this machine');
    expect(report).toContain('the team .claude/settings.json no longer denies it');
    // a personal file that is not settings is named in the report
    writeFileSync(join(d, LOCAL_SETTINGS), '{ broken');
    rmSync(join(d, '.loctx/settings.local.owned.yaml'));
    const bad = formatUpdate(await runUpdate({ cwd: d, detectVendors: detect, yes: true }), false);
    expect(bad).toContain('.claude/settings.local.json is not a settings object');
  });

  it('the config screen changes it for this machine', async () => {
    const d = await installed();
    const p = scriptedPrompter(['lease', false, 'exit']);
    expect(await runConfig({ cwd: d, interactive: true, prompter: p, detectVendors: detect })).toBe(
      0,
    );
    expect(recordedForceWithLease(d)).toBe('allow');
    expect(local(d).permissions?.deny ?? []).toEqual([]);
    const q = scriptedPrompter(['lease', true, 'exit']);
    await runConfig({ cwd: d, interactive: true, prompter: q, detectVendors: detect });
    expect(recordedForceWithLease(d)).toBe('deny');
    expect(local(d).permissions?.deny).toEqual(FORCE_WITH_LEASE_RULES);
    expect(p.notes.join('\n')).toContain('not denied on this machine');
  });
});
