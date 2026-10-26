import { repoRoot } from '../lib/git.js';
import { collectRetro, formatRetro, type Retro } from '../lib/retro.js';

/** `reins retro [--release <v>] [--json]` (design §8): counts only; the summary sentences are the pm's. */
export function runRetro(o: { release?: string; cwd?: string } = {}): Retro {
  return collectRetro(repoRoot(o.cwd ?? process.cwd()), { release: o.release });
}

export { formatRetro };
