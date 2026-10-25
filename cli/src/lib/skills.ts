import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse } from 'yaml';

/** Agent Skills spec constraints (agentskills.io/specification) — the drift check's "format" layer. */
export interface SkillIssue {
  path: string;
  message: string;
}

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = ['anthropic', 'claude'];

export function splitFrontmatter(text: string): {
  data: Record<string, unknown> | null;
  body: string;
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: null, body: text };
  const data = parse(m[1] ?? '') as Record<string, unknown> | null;
  return { data: data ?? {}, body: m[2] ?? '' };
}

export function validateSkillFile(path: string): SkillIssue[] {
  const issues: SkillIssue[] = [];
  const dir = basename(join(path, '..'));
  const text = readFileSync(path, 'utf8');
  const { data, body } = splitFrontmatter(text);
  if (!data) return [{ path, message: 'missing YAML frontmatter' }];
  const name = data['name'];
  const desc = data['description'];
  if (typeof name !== 'string' || name.length === 0 || name.length > 64 || !NAME_RE.test(name))
    issues.push({ path, message: 'name: 1–64 chars, lowercase letters/digits/single hyphens' });
  else {
    if (name !== dir)
      issues.push({ path, message: `name "${name}" must equal its directory "${dir}"` });
    for (const w of RESERVED)
      if (name.split('-').includes(w))
        issues.push({ path, message: `name must not contain reserved word "${w}"` });
  }
  if (typeof desc !== 'string' || desc.trim().length === 0 || desc.length > 1024)
    issues.push({ path, message: 'description: 1–1024 chars, non-empty' });
  else if (/<[a-z][^>]*>/i.test(desc))
    issues.push({ path, message: 'description must not contain XML tags' });
  if (body.split('\n').length > 500)
    issues.push({ path, message: 'SKILL.md body over 500 lines — move detail to references/' });
  return issues;
}

/** Every `<dir>/SKILL.md` under the given roots that exist. */
export function findSkillFiles(roots: string[]): string[] {
  const out: string[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      const p = join(root, entry, 'SKILL.md');
      if (existsSync(p) && statSync(p).isFile()) out.push(p);
    }
  }
  return out;
}
