import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const read = (p: string): string => readFileSync(new URL(p, root), 'utf8');
const json = (p: string): Record<string, any> => JSON.parse(read(p));

const plugin = json('.claude-plugin/plugin.json');
const market = json('.claude-plugin/marketplace.json');

describe('claude plugin manifests', () => {
  it('has the required fields (C-1)', () => {
    expect(plugin.name).toBe('reins');
    expect(plugin.license).toBe('MIT');
    expect(plugin.author).toEqual({ name: 'BlueNyang' });
    expect(market.name).toBe('bluenyang');
    expect(market.owner).toEqual({ name: 'BlueNyang' });
    expect(market.plugins).toHaveLength(1);
    expect(market.plugins[0].name).toBe('reins');
    expect(market.plugins[0].source).toBe('./');
  });
  it('exposes only reins-setup (C-3)', () => {
    expect(market.plugins[0].skills).toEqual(['./skills/reins-setup']);
    expect(plugin.skills).toBeUndefined();
  });
  it('plugin.json, package.json and the SKILL.md pin share one version (C-4)', () => {
    const v = json('package.json').version as string;
    const pins = [
      ...read('skills/reins-setup/SKILL.md').matchAll(/@bluenyang\/reins@(\S+?)(?=[\s`)])/g),
    ].map((m) => m[1]);
    expect(plugin.version).toBe(v);
    expect(market.plugins[0].version).toBeUndefined();
    expect(pins.length).toBeGreaterThan(0);
    expect(new Set(pins)).toEqual(new Set([v]));
    expect(json('package.json').scripts.version).toContain('cli/dist/scripts/sync-version.js');
  });
  it('userConfig is language and default_mode with their defaults (C-5)', () => {
    expect(Object.keys(plugin.userConfig).sort()).toEqual(['default_mode', 'language']);
    expect(plugin.userConfig.language.default).toBe('ko');
    expect(plugin.userConfig.default_mode.default).toBe('manual');
    expect(plugin.userConfig.default_mode.options).toEqual(['manual', 'auto']);
    const skill = read('skills/reins-setup/SKILL.md');
    expect(skill).toContain('${user_config.language}');
    expect(skill).toContain('${user_config.default_mode}');
    expect(skill).toMatch(/still starts with `\$\{`/);
  });
  it('adds no bin, dependencies, hooks, agents or MCP (C-6)', () => {
    expect(existsSync(new URL('bin', root))).toBe(false);
    for (const k of ['dependencies', 'hooks', 'agents', 'mcpServers']) {
      expect(plugin[k]).toBeUndefined();
    }
  });
  it('sync-version rewrites plugin.json and the SKILL.md pin from package.json', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'reins-sync-'));
    mkdirSync(join(tmp, '.claude-plugin'));
    mkdirSync(join(tmp, 'skills/reins-setup'), { recursive: true });
    cpSync(new URL('.claude-plugin/plugin.json', root), join(tmp, '.claude-plugin/plugin.json'));
    cpSync(new URL('skills/reins-setup/SKILL.md', root), join(tmp, 'skills/reins-setup/SKILL.md'));
    writeFileSync(join(tmp, 'package.json'), '{"version":"9.8.7"}');
    const script = new URL('cli/dist/scripts/sync-version.js', root).pathname;
    execFileSync('node', [script, tmp]);
    expect(JSON.parse(readFileSync(join(tmp, '.claude-plugin/plugin.json'), 'utf8')).version).toBe(
      '9.8.7',
    );
    const skill = readFileSync(join(tmp, 'skills/reins-setup/SKILL.md'), 'utf8');
    expect(skill).toContain('@bluenyang/reins@9.8.7');
    expect(skill).not.toContain(`@bluenyang/reins@${json('package.json').version}`);
  });
});
