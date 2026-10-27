import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { splitFrontmatter } from './skills.js';

export type Held = 'blocked' | 'checked' | 'advised';
export type Lang = 'en' | 'ko';
/** `all` is the README table; `redlines` and `stops` are the design §2 and §3 tables. */
export type View = 'all' | 'redlines' | 'stops';

export interface EnforcementRule {
  id: string;
  held: Held;
  by: string[];
  gap?: string;
}

export interface EnforcementRow extends EnforcementRule {
  /** The role's `must_not` text, for `<role>#<n>` keys. */
  text?: string;
}

const HELD: Held[] = ['blocked', 'checked', 'advised'];
const WORDS: Record<Lang, Record<Held, string>> = {
  en: { blocked: 'blocked', checked: 'checked', advised: 'advised' },
  ko: { blocked: '차단', checked: '검사', advised: '권고' },
};
const HEAD: Record<Lang, { main: string[]; role: string[]; budget: string }> = {
  en: {
    main: ['id', 'held', 'by', 'gap'],
    role: ['role', 'blocked', 'checked', 'advised', 'blocked items'],
    budget: 'budget scopes',
  },
  ko: {
    main: ['id', '지킴', '수단', '빈틈'],
    role: ['역할', '차단', '검사', '권고', '차단되는 항목'],
    budget: '예산 범위',
  },
};

export function readRules(text: string): EnforcementRule[] {
  const d = parse(text) as { rules?: EnforcementRule[] } | null;
  return d?.rules ?? [];
}

/** `must_not` items of every role file in `<harness>/roles`, by role name. */
export function roleMustNot(harness: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const dir = join(harness, 'roles');
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith('.md'))
    .toSorted()) {
    const m = splitFrontmatter(readFileSync(join(dir, f), 'utf8')).data?.['must_not'];
    out.set(f.replace(/\.md$/, ''), Array.isArray(m) ? m.map(String) : []);
  }
  return out;
}

/** Every id the table must cover: policy files, role `must_not` items, budget scopes. */
export function expectedIds(harness: string): string[] {
  const y = (f: string): Record<string, unknown> =>
    parse(readFileSync(join(harness, 'policy', f), 'utf8')) as Record<string, unknown>;
  const ids: string[] = [];
  for (const r of (y('common-red-lines.yaml')['rules'] as { id: string }[]) ?? []) ids.push(r.id);
  for (const s of (y('stops.yaml')['stops'] as { id: string }[]) ?? []) ids.push(s.id);
  for (const p of (y('transitions.yaml')['points'] as { id: string }[]) ?? []) ids.push(p.id);
  for (const [role, items] of roleMustNot(harness))
    items.forEach((_, i) => ids.push(`${role}#${i + 1}`));
  for (const s of (y('budget.yaml')['scopes'] as { name: string }[]) ?? [])
    ids.push(`budget:${s.name}`);
  return ids;
}

/** The rules of `enforcement.yaml`, each with its `must_not` text where it has one. */
export function enforcementRows(harness: string): EnforcementRow[] {
  const mustNot = roleMustNot(harness);
  return readRules(readFileSync(join(harness, 'policy', 'enforcement.yaml'), 'utf8')).map((r) => {
    const m = /^(.+)#(\d+)$/.exec(r.id);
    const text = m ? mustNot.get(m[1] ?? '')?.[Number(m[2]) - 1] : undefined;
    return text === undefined ? r : { ...r, text };
  });
}

const esc = (s: string): string => s.replaceAll('|', '\\|');
const table = (head: string[], rows: string[][]): string[] => [
  `| ${head.join(' | ')} |`,
  `|${head.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
];
const isRole = (id: string): boolean => id.includes('#');
const isBudget = (id: string): boolean => id.startsWith('budget:');

function mainRows(rows: EnforcementRow[], lang: Lang, pick: (id: string) => boolean): string[] {
  return table(
    HEAD[lang].main,
    rows
      .filter((r) => pick(r.id))
      .map((r) => [
        r.id,
        WORDS[lang][r.held],
        r.by.map((b) => `\`${b}\``).join(', '),
        r.gap ?? '—',
      ]),
  );
}

function roleRows(rows: EnforcementRow[], lang: Lang): string[] {
  const roles = new Map<string, EnforcementRow[]>();
  for (const r of rows.filter((x) => isRole(x.id))) {
    const role = r.id.slice(0, r.id.indexOf('#'));
    roles.set(role, [...(roles.get(role) ?? []), r]);
  }
  const count = (rs: EnforcementRow[], h: Held): string =>
    String(rs.filter((r) => r.held === h).length);
  const body = [...roles].map(([role, rs]) => [
    role,
    ...HELD.map((h) => count(rs, h)),
    rs
      .filter((r) => r.held === 'blocked')
      .map((r) => r.text ?? r.id)
      .join('; ') || '—',
  ]);
  const budget = rows.filter((r) => isBudget(r.id));
  body.push([HEAD[lang].budget, ...HELD.map((h) => count(budget, h)), '—']);
  return table(HEAD[lang].role, body);
}

/** The Markdown tables between the `enforcement` markers; no trailing newline. */
export function renderTable(rows: EnforcementRow[], lang: Lang, view: View = 'all'): string {
  if (view === 'redlines') return mainRows(rows, lang, (id) => /^C\d+$/.test(id)).join('\n');
  if (view === 'stops') return mainRows(rows, lang, (id) => /^[ABDEFGPT]\d+$/.test(id)).join('\n');
  const main = mainRows(rows, lang, (id) => !isRole(id) && !isBudget(id));
  return [...main, '', ...roleRows(rows, lang)].join('\n');
}

const MARK = /(<!-- enforcement:begin(?: (\w+))? -->\n)([\s\S]*?)(\n<!-- enforcement:end -->)/g;

/** Replaces the content of every `enforcement` marker pair with the rendered table; returns the text and how many pairs it found. */
export function applyMarkers(
  text: string,
  lang: Lang,
  rows: EnforcementRow[],
): { text: string; pairs: number } {
  let pairs = 0;
  const out = text.replace(
    MARK,
    (_m, open: string, view: string | undefined, _body: string, close: string) => {
      pairs += 1;
      return `${open}${renderTable(rows, lang, (view as View | undefined) ?? 'all')}${close}`;
    },
  );
  return { text: out, pairs };
}

/** Documents that carry markers, with their language and how many pairs each must hold. */
export const MARKED_DOCS: { file: string; lang: Lang; pairs: number }[] = [
  { file: 'README.md', lang: 'en', pairs: 1 },
  { file: 'docs/README.ko.md', lang: 'ko', pairs: 1 },
  { file: 'docs/design.md', lang: 'en', pairs: 2 },
  { file: 'docs/design.ko.md', lang: 'ko', pairs: 2 },
];
