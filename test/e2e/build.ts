import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** vitest globalSetup: build `cli/dist` once so the scenarios run the current sources, not a stale build. */
export default function setup(): void {
  const root = join(fileURLToPath(import.meta.url), '..', '..', '..');
  execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', 'cli/tsconfig.json'], {
    cwd: root,
    stdio: 'inherit',
  });
}
