import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
  // a draft is identified by its `source:`, so names stay stable across runs
  const pdir = join(root, '.loctx/knowledge-proposals');
  const taken = new Set<string>();
  const drafted = new Set<string>();
  const srcOf = (file: string) => {
    const m = /^source:\s*(.+)$/m.exec(readFileSync(file, 'utf8'));
    return m ? m[1]!.trim().replace(/^"(.*)"$/, '$1') : null;
  };
  // an accepted entry keeps the source: its draft had, so accepting does not cause a re-draft
  const kdir = join(root, '.agents/knowledge');
  if (existsSync(kdir))
    for (const n of readdirSync(kdir)) {
      if (!n.endsWith('.md')) continue;
      const src = srcOf(join(kdir, n));
      if (src) drafted.add(src);
    }
  if (existsSync(pdir))
    for (const n of readdirSync(pdir)) {
      if (!/^memory-.*\.md$/.test(n)) continue;
      taken.add(n.slice(0, -3));
      const src = srcOf(join(pdir, n));
      if (src) drafted.add(src);
    }
  for (const f of listFiles(dir)) {
    const source = `.claude/memory/${f}`;
    if (isSecretPath(source)) continue;
    if (drafted.has(source)) continue;
    const base = `memory-${slug(f)}`;
    let name = base;
    for (let i = 2; taken.has(name); i++) name = `${base}-${i}`;
    taken.add(name);
    const path = `.loctx/knowledge-proposals/${name}.md`;
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
