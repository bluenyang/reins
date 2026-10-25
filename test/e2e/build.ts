import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** vitest globalSetup: build `cli/dist` once so the scenarios run the current sources, not a stale build. */
export default function setup(): void {
  const root = join(fileURLToPath(import.meta.url), '..', '..', '..');
  // node runs the compiler itself: node_modules/.bin/tsc is a shell script, not executable on Windows
  const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tsc, '-p', 'cli/tsconfig.json'], {
    cwd: root,
    stdio: 'inherit',
  });
}
