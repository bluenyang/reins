import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { retiredFiles, runInstall } from '../src/commands/install.js';
import { changesBetween, newer, PREVIOUS_WARNING, runUpdate } from '../src/commands/update.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { scriptedPrompter } from '../src/lib/prompter.js';
import { packageHarness } from '../src/lib/upstream.js';

const claude = () =>
  (['claude', 'openai', 'google', 'cursor'] as const).map((name) => ({
    name,
    cli: name,
    detected: name === 'claude',
  }));

describe('reins update', () => {
  it('compares versions and slices the changelog', () => {
    expect(newer('0.2.0', '0.1.9')).toBe(true);
    expect(newer('0.1.0', '0.1.0')).toBe(false);
    const cl = '## 0.3.0\n- c [skill]\n## 0.2.0\n- b\n## 0.1.0\n- a\n';
    expect(changesBetween(cl, '0.1.0', '0.3.0')).toEqual(['c [skill]', 'b']);
  });

  it('brings an old pin and a hand-edited harness file back to upstream, keeping bindings', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), '{}');
    await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: claude,
    });
    const pin = join(d, '.agents/harness/install.yaml');
    writeFileSync(pin, readFileSync(pin, 'utf8').replace(/version: .*/, 'version: 0.0.9'));
    const role = join(d, '.agents/harness/roles/pl.md');
    writeFileSync(role, `${readFileSync(role, 'utf8')}\nold text\n`);
    const b = join(d, '.agents/harness/bindings.yaml');
    writeFileSync(
      b,
      readFileSync(b, 'utf8').replace('model: claude-opus-5-5', 'model: claude-fable-5-1'),
    );

    const r = await runUpdate({ cwd: d, detectVendors: claude, now: new Date(2026, 9, 25, 14, 0) });
    expect(r.from).toBe('0.0.9');
    expect(r.cliTo).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version);
    expect(r.cliFrom).toMatch(/^\d|^none$/);
    expect(r.changes.length).toBeGreaterThan(0);
    expect(readFileSync(role, 'utf8')).not.toContain('old text');
    expect(readFileSync(b, 'utf8')).toContain('model: claude-fable-5-1');
    expect(readFileSync(pin, 'utf8')).toContain(
      `version: ${readFileSync('harness/VERSION', 'utf8').trim()}`,
    );
    expect(existsSync(join(d, '.loctx/history'))).toBe(false);
  });

  it('keeps release: and keys it does not know across update (C-1)', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), '{}');
    await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: claude,
    });
    const pin = join(d, '.agents/harness/install.yaml');
    const extra =
      'release:\n  workflows:\n    - file: publish.yml\n      inputs:\n        version: "{version}"\n      approval: npm-staged\nfuture_key: { a: 1 }\n';
    writeFileSync(pin, readFileSync(pin, 'utf8') + extra);
    await runUpdate({ cwd: d, detectVendors: claude });
    const after = parse(readFileSync(pin, 'utf8')) as Record<string, unknown>;
    expect(after['release']).toEqual({
      workflows: [
        { file: 'publish.yml', inputs: { version: '{version}' }, approval: 'npm-staged' },
      ],
    });
    expect(after['future_key']).toEqual({ a: 1 });
  });

  it('removes upstream files this version no longer ships, keeps the project files', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), '{}');
    await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: claude,
    });
    const h = join(d, '.agents/harness');
    const packaged = readFileSync(join(packageHarness(), 'CHANGELOG.md'), 'utf8');
    writeFileSync(join(h, 'CHANGELOG.md'), packaged + '- an older line\n');
    writeFileSync(join(h, 'notes.md'), 'mine\n');

    const dry = await runUpdate({ cwd: d, detectVendors: claude, dryRun: true });
    expect(dry.install?.applied?.removed).toEqual(['.agents/harness/CHANGELOG.md']);
    expect(existsSync(join(h, 'CHANGELOG.md'))).toBe(true);

    const r = await runUpdate({ cwd: d, detectVendors: claude });
    expect(r.install?.applied?.removed).toEqual(['.agents/harness/CHANGELOG.md']);
    expect(existsSync(join(h, 'CHANGELOG.md'))).toBe(false);
    expect(existsSync(join(h, 'gates.yaml'))).toBe(true);
    expect(readFileSync(join(h, 'notes.md'), 'utf8')).toBe('mine\n');
  });

  it('retiredFiles lists upstream-owned files this version no longer ships', () => {
    const up = ['CHANGELOG.md', 'VERSION', 'roles/pm.md', 'knowledge-seeds/a.md'];
    const have = [
      'VERSION',
      'roles/pm.md',
      'roles/pl-old.md',
      'policy/stops.yaml',
      'CHANGELOG.md',
      'notes.md',
      'gates.yaml',
    ];
    expect(retiredFiles(have, up)).toEqual([
      'roles/pl-old.md',
      'policy/stops.yaml',
      'CHANGELOG.md',
    ]);
  });

  it('refuses where reins is not installed', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    expect((await runUpdate({ cwd: d })).refused).toMatch(/not installed/);
  });

  it('keeps a 0.3 hook block with the project gates (review: update deleted it)', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), JSON.stringify({ scripts: { check: 'node -e 0' } }));
    mkdirSync(join(d, '.husky'));
    await runInstall({
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: claude,
      hooks: true,
    });
    const before = readFileSync(join(d, '.husky/pre-commit'), 'utf8');
    expect(before).toContain('sh .agents/harness/run-gates.sh pre-commit');
    const r = await runUpdate({ cwd: d, detectVendors: claude, yes: true });
    expect(r.removed).toEqual([]);
    expect(readFileSync(join(d, '.husky/pre-commit'), 'utf8')).toBe(before);
  });

  describe('hook blocks and the gate script (021 S-9, S-11)', () => {
    const LINE = 'sh .agents/harness/run-gates.sh pre-commit';
    async function installed(hook?: string): Promise<string> {
      const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
      execFileSync('git', ['init', '-q'], { cwd: d });
      writeFileSync(join(d, 'package.json'), JSON.stringify({ scripts: { check: 'node -e 0' } }));
      mkdirSync(join(d, '.husky'));
      await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d, detectVendors: claude });
      if (hook !== undefined) writeFileSync(join(d, '.husky/pre-commit'), hook);
      return d;
    }
    const hook = (d: string) => readFileSync(join(d, '.husky/pre-commit'), 'utf8');

    it('the block 0.3.0 wrote (the gate commands themselves) becomes the one line; what it held is shown', async () => {
      const d = await installed(
        'echo mine\n# reins:begin hooks\nnpm run check\necho added-by-user\n# reins:end hooks\necho after\n',
      );
      const r = await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      expect(hook(d)).toBe(
        `echo mine\n# reins:begin hooks\n${LINE}\n# reins:end hooks\necho after\n`,
      );
      const note = r.install?.notes.find((n) => n.startsWith('.husky/pre-commit:'));
      expect(note).toContain('it held: npm run check && echo added-by-user');
      // the second run changes nothing
      const again = await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      expect(again.install?.notes.some((n) => n.startsWith('.husky/pre-commit:'))).toBe(false);
    });

    it('a husky file without a block is not touched; the line is proposed', async () => {
      const d = await installed('echo mine\n');
      const r = await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      expect(hook(d)).toBe('echo mine\n');
      expect(r.install?.notes.some((n) => n.startsWith('hook proposal (husky)'))).toBe(true);
    });

    it('update writes the script from the gates.yaml that is there, without touching gates.yaml', async () => {
      const d = await installed();
      const gates = join(d, '.agents/harness/gates.yaml');
      const script = join(d, '.agents/harness/run-gates.sh');
      rmSync(script);
      rmSync(join(d, '.agents/harness/generated.yaml'));
      const text = readFileSync(gates, 'utf8').replace('npm run check', "npm run check -- --it's");
      writeFileSync(gates, text);
      await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      expect(readFileSync(gates, 'utf8')).toBe(text);
      expect(readFileSync(script, 'utf8')).toContain("run 'npm run check -- --it'\\''s'");
    });

    it('a script edited by hand is not overwritten without --force', async () => {
      const d = await installed();
      const script = join(d, '.agents/harness/run-gates.sh');
      writeFileSync(script, `${readFileSync(script, 'utf8')}echo mine\n`);
      const r = await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      expect(r.handEdited).toEqual(['.agents/harness/run-gates.sh']);
      expect(readFileSync(script, 'utf8')).toContain('echo mine');
      await runUpdate({ cwd: d, detectVendors: claude, yes: true, force: true });
      expect(readFileSync(script, 'utf8')).not.toContain('echo mine');
    });
  });

  it("update merges .claude/settings.json and keeps the user's entries without --force (021 S-5)", async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), '{}');
    await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d, detectVendors: claude });
    const p = join(d, '.claude/settings.json');
    const s = JSON.parse(readFileSync(p, 'utf8')) as {
      permissions: { deny: string[]; allow?: string[] };
    };
    // one permission of the user's, and a reins rule that an older version wrote and this one does not
    s.permissions.allow = ['Bash(gh *)'];
    writeFileSync(p, `${JSON.stringify(s, null, 2)}\n`);
    for (const force of [false, true]) {
      const r = await runUpdate({ cwd: d, detectVendors: claude, yes: true, force });
      expect(r.handEdited).toEqual([]);
      const now = JSON.parse(readFileSync(p, 'utf8')) as typeof s;
      expect(now.permissions.allow).toEqual(['Bash(gh *)']);
      expect(now.permissions.deny).toEqual(s.permissions.deny);
    }
  });

  it('on a terminal, a hand-edited generated file is shown and overwritten only on yes', async () => {
    const d = mkdtempSync(join(tmpdir(), 'reins-up-'));
    execFileSync('git', ['init', '-q'], { cwd: d });
    writeFileSync(join(d, 'package.json'), '{}');
    await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d, detectVendors: claude });
    const p = join(d, '.claude/skills/intent/SKILL.md');
    const mine = `${readFileSync(p, 'utf8').trimEnd()} \n`;
    writeFileSync(p, mine);
    const keep = await runUpdate({
      cwd: d,
      detectVendors: claude,
      prompter: scriptedPrompter([true, false]),
    });
    expect(keep.handEdited).toEqual(['.claude/skills/intent/SKILL.md']);
    expect(readFileSync(p, 'utf8')).toBe(mine);
    await runUpdate({ cwd: d, detectVendors: claude, prompter: scriptedPrompter([true, true]) });
    expect(readFileSync(p, 'utf8')).not.toBe(mine);
  });

  describe('moving a 0.2.0 install to 0.3 (019 S-15, design §7)', () => {
    async function old(): Promise<string> {
      const d = mkdtempSync(join(tmpdir(), 'reins-up02-'));
      execFileSync('git', ['init', '-q'], { cwd: d });
      writeFileSync(join(d, 'package.json'), '{}');
      await runInstall({ mode: 'auto', asker: defaultsAsker, cwd: d, detectVendors: claude });
      const put = (p: string, c: string) => {
        mkdirSync(join(d, p, '..'), { recursive: true });
        writeFileSync(join(d, p), c);
      };
      // what 0.2.0 left behind
      put(
        '.agents/harness/bindings.yaml',
        'schema: reins/bindings@1\nmode: auto\nvendors:\n  claude: { cli: claude, available: true }\nroles:\n  pm: { vendor: claude, model: claude-fable-5-1 }\n  code-review: { vendor: openai, model: gpt-6.1-sol }\nescalation: [pl, pm, advisor, user]\n',
      );
      put('.agents/harness/policy/stops.yaml', 'stops: []\n');
      put('.agents/skills/reins-loop/SKILL.md', '---\nname: reins-loop\n---\n');
      put('.agents/SKILLS.md', '# Skills\n');
      put('.claude/agents/reins-pm.md', 'old\n');
      put(
        '.husky/pre-commit',
        'echo mine\n# reins:begin hooks\nnpx @bluenyang/reins check --stage pre-commit\n# reins:end hooks\n',
      );
      put(
        '.claude/settings.json',
        JSON.stringify({
          hooks: {
            PreToolUse: [
              {
                hooks: [
                  { command: 'npx -y @bluenyang/reins@0.2.0 hook pre-tool-use' },
                  { command: 'echo same-matcher' },
                ],
              },
              { hooks: [{ command: 'echo mine' }] },
            ],
          },
        }),
      );
      put('.loctx/bus/x.request.yaml', 'a: 1\n');
      put('.loctx/journal.jsonl', '{}\n');
      put('.loctx/history/keep.md', 'keep\n');
      put('.loctx/bindings.local.yaml', 'schema: reins/bindings-local@1\nvendors: {}\n');
      put(
        'AGENTS.md',
        '# AGENTS.md\n\nMy rules.\n\n<!-- reins:begin workflow v=0.1.0 -->\n## Workflow\n- reins status\n<!-- reins:end workflow -->\n',
      );
      return d;
    }

    it("converts bindings, takes the 0.x pieces out, keeps the user's, and reconciles AGENTS.md", async () => {
      const d = await old();
      const before = readFileSync(join(d, 'AGENTS.md'), 'utf8');
      const r = await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      expect(r.refused).toBeUndefined();
      const b = parse(readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8')) as Record<
        string,
        unknown
      >;
      expect(b['schema']).toBe('reins/bindings@2');
      expect(b['mode']).toBe('single');
      expect(b['default']).toEqual({ vendor: 'claude', model: 'claude-fable-5-1' });
      expect(r.converted?.some((n) => n.includes('code-review → pl.code-reviewer'))).toBe(true);
      for (const p of [
        '.agents/harness/policy/stops.yaml',
        '.agents/skills/reins-loop',
        '.agents/SKILLS.md',
        '.claude/agents/reins-pm.md',
        '.loctx/bus',
        '.loctx/journal.jsonl',
      ])
        expect(existsSync(join(d, p)), p).toBe(false);
      expect(readFileSync(join(d, '.loctx/history/keep.md'), 'utf8')).toBe('keep\n');
      expect(r.cleaned).toBe(true);
      const hook = readFileSync(join(d, '.husky/pre-commit'), 'utf8');
      expect(hook).toContain('echo mine');
      expect(hook).not.toContain('@bluenyang/reins');
      const settings = readFileSync(join(d, '.claude/settings.json'), 'utf8');
      expect(settings).not.toContain('@bluenyang/reins');
      expect(settings).toContain('echo same-matcher');
      expect(settings).toContain('echo mine');
      const agents = readFileSync(join(d, 'AGENTS.md'), 'utf8');
      expect(agents).toContain('<!-- reins:reconcile pending -->');
      expect(agents).not.toContain('<!-- reins:onboarding pending -->'); // one note: onboard handles both
      expect(agents).toContain('My rules.');
      expect(agents).not.toContain('reins status');
      // the copy starts with the warning, and under it is the old text as it was (021 S-15)
      const previous = readFileSync(join(d, '.agents/AGENTS.previous.md'), 'utf8');
      expect(previous.startsWith(`${PREVIOUS_WARNING}\n\n`)).toBe(true);
      expect(PREVIOUS_WARNING).toContain('reins 0.2.0 or earlier');
      expect(PREVIOUS_WARNING).toContain('do not exist in 0.3; do not run them');
      expect(previous.slice(PREVIOUS_WARNING.length + 2)).toBe(before);
      expect(previous).toContain('reins status');
      // a second update leaves the copy alone
      await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      expect(readFileSync(join(d, '.agents/AGENTS.previous.md'), 'utf8')).toBe(previous);
    });

    it('the dry-run plan of generated files matches what the real run does (review #3)', async () => {
      const d = await old();
      rmSync(join(d, '.claude/skills/onboard'), { recursive: true }); // so the plan has a write to match
      const dry = await runUpdate({ cwd: d, detectVendors: claude, dryRun: true });
      const real = await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      const g = (r: typeof dry) => ({
        written: [...(r.install?.generated?.written ?? [])].toSorted(),
        refused: (r.install?.generated?.refused ?? []).map((x) => x.path).toSorted(),
      });
      expect(g(dry)).toEqual(g(real));
      expect(g(real).written).toContain('.claude/skills/onboard/SKILL.md');
      expect(g(real).written.some((p) => p.includes('reins-loop'))).toBe(false);
    });

    it('without --yes the .loctx working files are only listed', async () => {
      const d = await old();
      const r = await runUpdate({ cwd: d, detectVendors: claude });
      expect(r.cleanup).toEqual([
        '.loctx/bus',
        '.loctx/journal.jsonl',
        '.loctx/bindings.local.yaml',
      ]);
      expect(existsSync(join(d, '.loctx/bus'))).toBe(true);
    });

    it('a dry run writes nothing', async () => {
      const d = await old();
      const before = readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8');
      const r = await runUpdate({ cwd: d, detectVendors: claude, dryRun: true });
      expect(r.converted?.length).toBeGreaterThan(0);
      expect(readFileSync(join(d, '.agents/harness/bindings.yaml'), 'utf8')).toBe(before);
      expect(existsSync(join(d, '.agents/skills/reins-loop'))).toBe(true);
    });

    it('running it again changes nothing more', async () => {
      const d = await old();
      await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      const r = await runUpdate({ cwd: d, detectVendors: claude, yes: true });
      expect(r.converted).toBeUndefined();
      expect(r.removed).toEqual([]);
      expect(r.cleanup).toEqual([]);
    });
  });
});
