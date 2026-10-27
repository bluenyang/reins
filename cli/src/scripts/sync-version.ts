// Sync plugin.json `version` and the pinned CLI version in the reins-setup skill to package.json.
// Run by the `version` lifecycle script (npm/pnpm version), after package.json is bumped.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Replaces only the first `"version": "<x>"` value; every other byte stays. Null when there is no such key. */
export function replaceVersion(text: string, version: string): string | null {
  const re = /("version"\s*:\s*")[^"]*(")/;
  return re.test(text)
    ? text.replace(re, (_m, a: string, b: string) => `${a}${version}${b}`)
    : null;
}

// compiled to cli/dist/scripts/: the repository root is three levels up (or the first argument)
const root = pathToFileURL(
  `${resolve(process.argv[2] ?? fileURLToPath(new URL('../../../', import.meta.url)))}/`,
);
const read = (p: string): string => readFileSync(new URL(p, root), 'utf8');
const write = (p: string, s: string): void => writeFileSync(new URL(p, root), s);

export function sync(): number {
  const version = (JSON.parse(read('package.json')) as { version: string }).version;
  const pluginPath = '.claude-plugin/plugin.json';
  const next = replaceVersion(read(pluginPath), version);
  if (next === null) {
    console.error(`sync-version: no "version" key in ${pluginPath}`);
    return 1;
  }
  write(pluginPath, next);
  const skillPath = 'skills/reins-setup/SKILL.md';
  write(
    skillPath,
    read(skillPath).replace(/@bluenyang\/reins@[0-9][\w.+-]*/g, `@bluenyang/reins@${version}`),
  );
  console.log(`synced to ${version}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = sync();
