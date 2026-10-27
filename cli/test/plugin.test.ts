import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
    const script = fileURLToPath(new URL('cli/dist/scripts/sync-version.js', root));
    execFileSync('node', [script, tmp]);
    expect(JSON.parse(readFileSync(join(tmp, '.claude-plugin/plugin.json'), 'utf8')).version).toBe(
      '9.8.7',
    );
    const skill = readFileSync(join(tmp, 'skills/reins-setup/SKILL.md'), 'utf8');
    expect(skill).toContain('@bluenyang/reins@9.8.7');
    expect(skill).not.toContain(`@bluenyang/reins@${json('package.json').version}`);
  });

  describe('sync-version keeps the rest of plugin.json as written (C-8)', () => {
    const script = fileURLToPath(new URL('cli/dist/scripts/sync-version.js', root));
    function fixture(pluginText: string): string {
      const tmp = mkdtempSync(join(tmpdir(), 'reins-sync-'));
      mkdirSync(join(tmp, '.claude-plugin'));
      mkdirSync(join(tmp, 'skills/reins-setup'), { recursive: true });
      writeFileSync(join(tmp, '.claude-plugin/plugin.json'), pluginText);
      writeFileSync(join(tmp, 'skills/reins-setup/SKILL.md'), 'npx @bluenyang/reins@0.0.1\n');
      writeFileSync(join(tmp, 'package.json'), '{"version":"9.8.7"}');
      return tmp;
    }
    it.each([
      ['tabs', '{\n\t"name": "reins",\n\t"version": "0.0.1",\n\t"tags": ["a",   "b"]\n}'],
      ['two spaces, no final newline', '{\n  "name": "reins",\n  "version" : "0.0.1"\n}'],
      ['compact', '{"name":"reins","version":"0.0.1"}\n'],
    ])('only the version string changes (%s)', (_n, text) => {
      const tmp = fixture(text);
      execFileSync('node', [script, tmp]);
      expect(readFileSync(join(tmp, '.claude-plugin/plugin.json'), 'utf8')).toBe(
        text.replace('0.0.1', '9.8.7'),
      );
    });
    it('exits 1 and leaves the file alone without a version key', () => {
      const text = '{\n\t"name": "reins"\n}\n';
      const tmp = fixture(text);
      let code = 0;
      try {
        execFileSync('node', [script, tmp], { stdio: 'pipe' });
      } catch (e) {
        code = (e as { status: number }).status;
      }
      expect(code).toBe(1);
      expect(readFileSync(join(tmp, '.claude-plugin/plugin.json'), 'utf8')).toBe(text);
    });
  });
});

describe('publish summary and design paths (C-9)', () => {
  it('publish.yml drops `npm stage list` and keeps the two approval lines', () => {
    const y = read('.github/workflows/publish.yml');
    expect(y).not.toContain('npm stage list');
    expect(y).toContain('is staged, not live');
    expect(y).toContain('npm stage approve <stage-id>');
  });
  it.each(['docs/design.md', 'docs/design.ko.md'])(
    '%s names the real script path and 011 features',
    (p) => {
      const d = read(p);
      expect(d).toContain('`cli/src/scripts/sync-version.ts`');
      expect(d.replace('`cli/src/scripts/sync-version.ts`', '')).not.toContain(
        '`scripts/sync-version.ts`',
      );
      for (const s of ['`new intent', '`released`', '--respond', '`reins metrics record --role'])
        expect(d).toContain(s);
    },
  );
});
