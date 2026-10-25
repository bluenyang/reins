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

export function harnessVersion(dir: string): string {
  return readFileSync(join(dir, 'VERSION'), 'utf8').trim();
}
