import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * vitest globalSetup: every temp dir of the run (tests and the CLIs they spawn) goes under one
 * directory that is removed at the end, so a run leaves nothing in the system temp area.
 */
export default function setup(): () => void {
  const root = mkdtempSync(join(tmpdir(), 'reins-test-'));
  // workers and spawned processes inherit these; os.tmpdir() reads TMPDIR (TEMP/TMP on Windows)
  for (const k of ['TMPDIR', 'TEMP', 'TMP']) process.env[k] = root;
  return () => rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
