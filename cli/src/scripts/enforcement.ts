// Re-renders the enforcement tables between the `enforcement` markers of the README and design editions.
// Run by `pnpm docs:enforcement`; the test in cli/test/enforcement.test.ts fails when they drift.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MARKED_DOCS, applyMarkers, enforcementRows } from '../lib/enforcement.js';

// compiled to cli/dist/scripts/: the repository root is three levels up (or the first argument)
const root = resolve(process.argv[2] ?? fileURLToPath(new URL('../../../', import.meta.url)));

export function renderDocs(): number {
  const rows = enforcementRows(resolve(root, 'harness'));
  for (const d of MARKED_DOCS) {
    const path = resolve(root, d.file);
    const { text, pairs } = applyMarkers(readFileSync(path, 'utf8'), d.lang, rows);
    if (pairs !== d.pairs) {
      console.error(`enforcement: ${d.file} has ${pairs} marker pair(s), expected ${d.pairs}`);
      return 1;
    }
    writeFileSync(path, text);
  }
  console.log('enforcement tables rendered');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = renderDocs();
