// Sync plugin.json `version` and the pinned CLI version in the reins-setup skill to package.json.
// Run by the `version` lifecycle script (npm/pnpm version), after package.json is bumped.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p: string): string => readFileSync(new URL(p, root), 'utf8');
const write = (p: string, s: string): void => writeFileSync(new URL(p, root), s);

const version = (JSON.parse(read('package.json')) as { version: string }).version;

const plugin = JSON.parse(read('.claude-plugin/plugin.json')) as { version: string };
plugin.version = version;
write('.claude-plugin/plugin.json', `${JSON.stringify(plugin, null, 2)}\n`);

const skillPath = 'skills/reins-setup/SKILL.md';
write(skillPath, read(skillPath).replace(/@bluenyang\/reins@[0-9][\w.+-]*/g, `@bluenyang/reins@${version}`));
console.log(`synced to ${version}`);
