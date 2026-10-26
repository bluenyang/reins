import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { repoRoot } from '../lib/git.js';
import { harnessDir } from '../lib/harness.js';
import { localIso } from '../lib/metrics.js';
import { bareKey, collectRetro } from '../lib/retro.js';
import { loadSchemas, validateFile } from '../lib/schema.js';

export const PROPOSALS = '.loctx/knowledge-proposals';
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface KnowledgeResult {
  path?: string;
  refused?: string;
}

const today = () => localIso().slice(0, 10);

/** Replace the frontmatter line starting with `key:`; `null` removes it. */
function setLine(text: string, key: string, value: string | null): string {
  if (value === null) return text.replace(new RegExp(`^${key}:.*\\n`, 'm'), '');
  return text.replace(new RegExp(`^${key}:.*$`, 'm'), () => `${key}: ${value}`);
}

/**
 * `reins knowledge propose <key|slug> [--from <history>…]`: a draft from the knowledge template,
 * `approved` left out. Writes only under `.loctx/knowledge-proposals/`.
 */
export function proposeKnowledge(
  key: string,
  o: { from?: string[]; cwd?: string } = {},
): KnowledgeResult {
  const root = repoRoot(o.cwd ?? process.cwd());
  const slug = bareKey(key);
  if (!SLUG.test(slug)) return { refused: `"${key}" is not a usable slug` };
  const hd = harnessDir(root);
  const tpl = hd && join(hd, 'templates', 'knowledge.md');
  if (!tpl || !existsSync(tpl)) return { refused: 'no knowledge template — run reins install' };
  const dest = join(root, PROPOSALS, `${slug}.md`);
  if (existsSync(dest)) return { refused: `${PROPOSALS}/${slug}.md already exists` };
  const hist = resolve(root, '.loctx', 'history');
  const from: string[] = [];
  for (const f of o.from ?? []) {
    const abs = resolve(root, f.includes('/') ? f : join('.loctx', 'history', f));
    const rel = relative(hist, abs);
    if (rel.startsWith('..') || rel.includes('/') || !existsSync(abs))
      return { refused: `--from ${f}: not a page under .loctx/history/` };
    const text = readFileSync(abs, 'utf8');
    const lines = [...text.matchAll(/^(?:decisions|reasons):\s*(.+)$/gm)].flatMap((m) =>
      m[1]!.split(',').map((x) => x.trim()),
    );
    const has = key.startsWith('stop:') ? text.includes(slug) : lines.includes(slug);
    if (!has) return { refused: `--from ${f}: does not contain "${slug}"` };
    from.push(`.loctx/history/${rel}`);
  }
  if (from.length === 0)
    from.push(
      ...collectRetro(root)
        .keys.filter((k) => bareKey(k.key) === slug)
        .flatMap((k) => k.pages),
    );
  if (from.length === 0) return { refused: `no record of "${slug}"; pass --from <history>…` };
  const asSymptom = /^(stop|reason):/.test(key);
  let t = readFileSync(tpl, 'utf8');
  t = setLine(t, 'id', `${today()}_${slug}`);
  t = setLine(t, 'decisions', asSymptom ? '[]' : `[${slug}]`);
  t = setLine(t, 'symptoms', asSymptom ? `[${slug}]` : '[]');
  t = setLine(t, 'source', JSON.stringify([...new Set(from)].join(', ')));
  t = setLine(t, 'approved', null);
  mkdirSync(join(root, PROPOSALS), { recursive: true });
  writeFileSync(dest, t);
  return { path: `${PROPOSALS}/${slug}.md` };
}

/**
 * `reins knowledge accept <slug>`: the only way an `approved` field gets written. The skill calls
 * it after the user's answer; the CLI cannot tell who ran it (design §8).
 */
export function acceptKnowledge(name: string, o: { cwd?: string } = {}): KnowledgeResult {
  const root = repoRoot(o.cwd ?? process.cwd());
  const base = basename(name, '.md');
  const slug = base.replace(/^\d{4}-\d{2}-\d{2}_/, '');
  const draft = join(root, PROPOSALS, `${base}.md`);
  if (!existsSync(draft)) return { refused: `no draft ${PROPOSALS}/${base}.md` };
  const at = today();
  let t = readFileSync(draft, 'utf8');
  t = setLine(t, 'id', `${at}_${slug}`);
  t = setLine(t, 'approved', null);
  t = t.replace(/^(source:.*)$/m, (m) => `${m}\napproved: { by: user, at: ${at} }`);
  const hd = harnessDir(root);
  const v = hd ? loadSchemas(hd).get('knowledge') : undefined;
  if (!v) return { refused: 'no knowledge schema — run reins install' };
  const issues = validateFile(v, draft, false, t);
  if (issues.length)
    return { refused: `draft is invalid: ${issues.map((i) => i.message).join('; ')}` };
  const rel = `.agents/knowledge/${at}_${slug}.md`;
  if (existsSync(join(root, rel))) return { refused: `${rel} already exists` };
  mkdirSync(join(root, '.agents', 'knowledge'), { recursive: true });
  writeFileSync(join(root, rel), t);
  rmSync(draft);
  return { path: rel };
}
