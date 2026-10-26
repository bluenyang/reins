import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The harness shipped with this package: `<pkg>/harness`, two levels above `cli/dist/lib`. */
export function packageHarness(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const up of ['../../../harness', '../../harness', '../harness']) {
    const p = join(here, up);
    if (existsSync(join(p, 'VERSION'))) return p;
  }
  throw new Error('reins: cannot find the packaged harness/ directory');
}

/** The version of the installed package (package.json next to `harness/`); stage skills pin the CLI to it. */
export function packageVersion(): string {
  const p = join(packageHarness(), '..', 'package.json');
  return (JSON.parse(readFileSync(p, 'utf8')) as { version: string }).version;
}

export function harnessVersion(dir: string): string {
  return readFileSync(join(dir, 'VERSION'), 'utf8').trim();
}

/** The skill entry points shipped with this package: `<pkg>/skills`, next to `harness/`. */
export function packageSkills(): string {
  return join(packageHarness(), '..', 'skills');
}

/** Which packaged skills a tier installs: the harness tier has no loop to run. */
export function tierSkills(tier: string): string[] {
  return tier === 'harness'
    ? ['reins-setup']
    : [
        'reins-setup',
        'reins-roadmap',
        'reins-intent',
        'reins-spec',
        'reins-implement',
        'reins-review',
        'reins-test',
        'reins-release',
        'reins-retro',
        'reins-loop',
      ];
}
