import { tmpdir } from 'node:os';
import { basename } from 'node:path';
import { expect, test } from 'vitest';

test('temp dirs of a run go under the run directory that globalSetup removes', () => {
  expect(basename(tmpdir())).toMatch(/^reins-test-/);
});
