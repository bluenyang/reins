import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

// Test files run in parallel and several spawn cli/dist/reins.js; a test that rebuilds cli/dist
// makes another load half-written modules (an empty stdout in CI). Only the globalSetup builds.
test('no test file rebuilds cli/dist', () => {
  const tsc = /typescript\/bin\/tsc|'typescript',\s*'bin',\s*'tsc'/;
  const rebuilds = ['cli/test', 'test', 'test/e2e']
    .flatMap((d) => readdirSync(d).map((f) => join(d, f)))
    .filter((f) => f.endsWith('.test.ts') && f !== join('test', 'suite.test.ts'))
    .filter((f) => tsc.test(readFileSync(f, 'utf8')));
  expect(rebuilds).toEqual([]);
});
