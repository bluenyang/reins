/**
 * AGENTS.md managed blocks (design §5): `<!-- reins:begin <name> v=X -->` … `<!-- reins:end <name> -->`.
 * The tool owns what is inside; everything outside belongs to the project.
 */
export interface Block {
  name: string;
  version: string;
  body: string; // full text including both markers
}

const BLOCK_RE = /<!-- reins:begin ([a-z-]+) v=([^ ]+) -->[\s\S]*?<!-- reins:end \1 -->/g;
const OVERRIDE_RE = /<!-- reins:override ([a-z-]+) -->/g;

export function parseBlocks(text: string): Block[] {
  return [...text.matchAll(BLOCK_RE)].map((m) => ({
    name: m[1] ?? '',
    version: m[2] ?? '',
    body: m[0],
  }));
}

export function overrides(text: string): Set<string> {
  return new Set([...text.matchAll(OVERRIDE_RE)].map((m) => m[1] ?? ''));
}

/** The first `## ` heading inside a block, e.g. "Workflow". */
function headingOf(block: Block): string | null {
  return /^## (.+)$/m.exec(block.body)?.[1]?.trim() ?? null;
}

/** Text with every managed block removed — what the project wrote. */
function outside(text: string): string {
  return text.replace(BLOCK_RE, '');
}

export interface BlockResult {
  text: string;
  inserted: string[];
  replaced: string[];
  skipped: { name: string; why: string }[];
}

/**
 * Put the upstream blocks into an AGENTS.md. Existing blocks are replaced in place; an overridden block is
 * left alone; a block whose heading the project already has outside any block is skipped (migrate replaces it).
 * New blocks go after the first H1 (notice) or at the end.
 */
export function applyBlocks(text: string, upstream: Block[]): BlockResult {
  const res: BlockResult = { text, inserted: [], replaced: [], skipped: [] };
  const present = new Map(parseBlocks(text).map((b) => [b.name, b]));
  const over = overrides(text);
  for (const b of upstream) {
    if (over.has(b.name)) {
      res.skipped.push({ name: b.name, why: 'overridden by the project' });
      continue;
    }
    const cur = present.get(b.name);
    if (cur) {
      if (cur.body !== b.body) {
        res.text = res.text.replace(cur.body, b.body);
        res.replaced.push(b.name);
      }
      continue;
    }
    const h = headingOf(b);
    if (h && new RegExp(`^## ${h}\\s*$`, 'm').test(outside(res.text))) {
      res.skipped.push({
        name: b.name,
        why: `the project already has a "## ${h}" section — \`reins migrate\` replaces it`,
      });
      continue;
    }
    if (b.name === 'notice') {
      const h1 = /^# .*$/m.exec(res.text);
      res.text = h1
        ? `${res.text.slice(0, h1.index + h1[0].length)}\n\n${b.body}\n${res.text.slice(h1.index + h1[0].length)}`
        : `${b.body}\n\n${res.text}`;
    } else res.text = `${res.text.replace(/\s*$/, '')}\n\n${b.body}\n`;
    res.inserted.push(b.name);
  }
  return res;
}

export interface SectionSwap {
  text: string;
  swapped: string[]; // block names
  removed: string; // the project's original sections, kept by the caller
}

/**
 * Migrate's half of the managed-block story (design §7): a project section whose heading an upstream block
 * owns (`## Workflow`, `## Skills`, `## Language`) is replaced by that block. The section runs from its
 * heading to the next heading of the same or a higher level. The originals are returned so nothing is lost.
 */
export function swapSections(text: string, upstream: Block[]): SectionSwap {
  let out = text;
  const swapped: string[] = [];
  const removed: string[] = [];
  const present = new Set(parseBlocks(text).map((b) => b.name));
  for (const b of upstream) {
    if (present.has(b.name)) continue;
    const h = headingOf(b);
    if (!h) continue;
    const re = new RegExp(`^## ${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
    const m = re.exec(out);
    if (!m) continue;
    const start = m.index;
    const rest = out.slice(start + m[0].length);
    const next = /^#{1,2} /m.exec(rest);
    const end = next ? start + m[0].length + next.index : out.length;
    removed.push(out.slice(start, end).trimEnd());
    out = `${out.slice(0, start)}${b.body}\n\n${out.slice(end).replace(/^\n+/, '')}`.replace(
      /\n{3,}/g,
      '\n\n',
    );
    swapped.push(b.name);
  }
  return { text: out.replace(/\s*$/, '\n'), swapped, removed: removed.join('\n\n') };
}
