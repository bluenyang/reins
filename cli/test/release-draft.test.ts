import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runInstall } from '../src/commands/install.js';
import { runMigrate } from '../src/commands/migrate.js';
import { defaultsAsker } from '../src/lib/ask.js';
import { draftRelease } from '../src/lib/release.js';
import { rmSync } from 'node:fs';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const onlyClaude = () => [
  { name: 'claude' as const, cli: 'claude', detected: true },
  { name: 'openai' as const, cli: 'codex', detected: false },
  { name: 'google' as const, cli: 'agy', detected: false },
  { name: 'cursor' as const, cli: 'cursor-agent', detected: false },
];

function repo(files: Record<string, string> = {}): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-reldraft-'));
  dirs.push(d);
  execFileSync('git', ['init', '-q'], { cwd: d });
  const all = {
    'package.json': JSON.stringify({ scripts: { test: 'vitest run' } }),
    '.github/workflows/release.yml': [
      'name: release',
      'on:',
      '  workflow_dispatch:',
      '    inputs:',
      '      version:',
      '        required: true',
      '      dry_run:',
      '        type: boolean',
      '      note:',
      '        type: string',
      '',
    ].join('\n'),
    '.github/workflows/ci.yml': 'on:\n  push:\n    branches: [main]\n',
    ...files,
  };
  for (const [p, c] of Object.entries(all)) {
    mkdirSync(dirname(join(d, p)), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}

describe('release: draft from dispatchable workflows (012-8)', () => {
  it('drafts one entry per workflow_dispatch workflow, in all three trigger forms', () => {
    const d = repo({
      '.github/workflows/deploy-a.yaml': 'on: workflow_dispatch\n',
      '.github/workflows/publish-b.yml': 'on: [push, workflow_dispatch]\n',
      '.github/workflows/ship-c.yml': 'on:\n  workflow_dispatch:\n    inputs:\n      tag: {}\n',
      '.github/workflows/bad.yml': 'on: [unclosed\n',
    });
    expect(draftRelease(d)).toEqual([
      { file: 'deploy-a.yaml', inputs: {}, approval: 'none' },
      { file: 'publish-b.yml', inputs: {}, approval: 'none' },
      {
        file: 'release.yml',
        inputs: { version: '{version}', dry_run: 'false', note: '<fill in>' },
        approval: 'none',
      },
      { file: 'ship-c.yml', inputs: { tag: 'v{version}' }, approval: 'none' },
    ]);
  });

  it('prefers release-like names over other dispatchable workflows, else lists them all', () => {
    const d = repo({
      '.github/workflows/ci.yml': 'on: [push, workflow_dispatch]\n',
      '.github/workflows/secret-scan.yml': 'on: workflow_dispatch\n',
    });
    expect(draftRelease(d).map((x) => x.file)).toEqual(['release.yml']);
    const only = repo({
      '.github/workflows/release.yml': 'on: push\n',
      '.github/workflows/ci.yml': 'on: workflow_dispatch\n',
    });
    expect(draftRelease(only).map((x) => x.file)).toEqual(['ci.yml']);
  });

  it('proposes nothing when install.yaml already has release:', () => {
    const d = repo({
      '.agents/harness/install.yaml': 'release:\n  workflows: []\n',
    });
    expect(draftRelease(d)).toEqual([]);
  });

  it('install and its dry run report the draft and never write it', async () => {
    const d = repo();
    const r = await runInstall({
      tier: 'loop',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      dryRun: true,
    });
    const hit = r.notes.filter((n) => n.startsWith('release settings draft'));
    expect(hit).toHaveLength(1);
    expect(hit[0]).toContain(
      '{file: release.yml, inputs: {version: "{version}", dry_run: "false", note: "<fill in>"}, approval: none}',
    );
    const real = await runInstall({
      tier: 'loop',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
    });
    expect(real.notes.some((n) => n.startsWith('release settings draft'))).toBe(true);
    expect(readFileSync(join(d, '.agents/harness/install.yaml'), 'utf8')).not.toContain('release:');
  });

  it('migrate and its dry run report the draft', async () => {
    const d = repo({ '.ai/README.md': '# old' });
    const r = await runMigrate({
      tier: 'loop',
      mode: 'auto',
      asker: defaultsAsker,
      cwd: d,
      detectVendors: onlyClaude,
      dryRun: true,
    });
    expect(r.report.some((n) => n.startsWith('release settings draft'))).toBe(true);
  });
});
