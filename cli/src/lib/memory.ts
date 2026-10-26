import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles, type Write } from './fsx.js';
import { isSecretPath } from './secrets.js';

const slug = (rel: string) =>
  rel
    .replace(/\.[^./]+$/, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '') || 'note';

/**
 * `.claude/memory/*` is someone's own memory, not a decision (design §7): it is never moved or
 * deleted. Each file becomes a knowledge draft the user may accept with `reins knowledge accept`.
 * Pure: reads, never writes. A draft that already exists is left alone.
 */
export function planMemoryProposals(
  root: string,
  today: string,
): { writes: Write[]; notes: string[] } {
  const out: { writes: Write[]; notes: string[] } = { writes: [], notes: [] };
  const dir = join(root, '.claude/memory');
  if (!existsSync(dir)) return out;
  const made = new Set<string>();
  for (const f of listFiles(dir)) {
    const source = `.claude/memory/${f}`;
    if (isSecretPath(source)) continue;
    let name = `memory-${slug(f)}`;
    while (made.has(name)) name += '-2';
    made.add(name);
    const path = `.loctx/knowledge-proposals/${name}.md`;
    if (existsSync(join(root, path))) continue;
    let text: string;
    try {
      text = readFileSync(join(dir, f), 'utf8');
    } catch {
      continue;
    }
    out.writes.push({
      path,
      why: 'memory draft',
      content: [
        '---',
        `id: ${today}_${name}`,
        'kind: decision',
        'status: active',
        'supersedes: null',
        'topics: []',
        'decisions: []',
        'symptoms: []',
        'applies_to: all',
        `source: ${JSON.stringify(source)}`,
        '---',
        '## 결정',
        text.replace(/\s*$/, ''),
        '',
      ].join('\n'),
    });
    out.notes.push(
      `memory draft ${path} from ${source} (original kept) — promote with \`reins knowledge accept ${name}\``,
    );
  }
  return out;
}
