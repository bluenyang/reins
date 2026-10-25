import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { relPath } from './fsx.js';
import { splitFrontmatter } from './skills.js';

/** The files people and agents exchange (design §4), read as frontmatter plus body. */
export interface WorkFile {
  path: string; // relative to the root
  data: Record<string, unknown>;
  body: string;
  error?: string;
}

function read(root: string, abs: string): WorkFile {
  const { data, body, error } = splitFrontmatter(readFileSync(abs, 'utf8'));
  return { path: relPath(root, abs), data: data ?? {}, body, error };
}

const ls = (dir: string) => (existsSync(dir) ? readdirSync(dir).toSorted() : []);

/** `.agents/intent/<id>_<slug>/` */
export function intentDir(root: string, id: string): string | null {
  const base = join(root, '.agents', 'intent');
  const d = ls(base).find((e) => e === id || e.startsWith(`${id}_`));
  return d ? join(base, d) : null;
}

export function intentIds(root: string): string[] {
  return ls(join(root, '.agents', 'intent'))
    .map((e) => /^(\d{3})(_|$)/.exec(e)?.[1])
    .filter((x): x is string => !!x);
}

/** intent.md, spec.md or plan.md of an intent, or null when the file is not written yet. */
export function intentFile(
  root: string,
  id: string,
  kind: 'intent' | 'spec' | 'plan',
): WorkFile | null {
  const d = intentDir(root, id);
  const p = d && join(d, `${kind}.md`);
  return p && existsSync(p) ? read(root, p) : null;
}

/** `.loctx/ticket/<id>_<slug>.md` — a ticket that is done is deleted, so null may also mean done. */
export function ticketFile(root: string, id: string): WorkFile | null {
  const dir = join(root, '.loctx', 'ticket');
  const f = ls(dir).find((e) => e === `${id}.md` || e.startsWith(`${id}_`));
  return f ? read(root, join(dir, f)) : null;
}

export function openTickets(root: string): WorkFile[] {
  const dir = join(root, '.loctx', 'ticket');
  return ls(dir)
    .filter((e) => e.endsWith('.md'))
    .map((e) => read(root, join(dir, e)));
}

export interface BusPair {
  id: string;
  request: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
}

function loadYaml(p: string): Record<string, unknown> | null {
  if (!existsSync(p)) return null;
  try {
    return (parse(readFileSync(p, 'utf8')) as Record<string, unknown> | null) ?? null;
  } catch {
    return null;
  }
}

/** Bus exchanges of one ticket, in request-id order (`<ticket>_<nn>`). */
export function busFor(root: string, ticket: string): BusPair[] {
  const dir = join(root, '.loctx', 'bus');
  const ids = new Set(
    ls(dir)
      .map((e) => /^(.+)\.(request|response)\.yaml$/.exec(e)?.[1])
      .filter((x): x is string => !!x && x.startsWith(`${ticket}_`)),
  );
  return [...ids].toSorted().map((id) => ({
    id,
    request: loadYaml(join(dir, `${id}.request.yaml`)),
    response: loadYaml(join(dir, `${id}.response.yaml`)),
  }));
}

/** Every history page's text, newest last. */
export function historyPages(root: string): { path: string; text: string }[] {
  const dir = join(root, '.loctx', 'history');
  return ls(dir)
    .filter((e) => e.endsWith('.md'))
    .map((e) => ({ path: `.loctx/history/${e}`, text: readFileSync(join(dir, e), 'utf8') }));
}

/** Recorded decisions: knowledge `decisions:` entries and history `decisions:` lines, with where they live. */
export function recordedDecisions(root: string): { path: string; decision: string }[] {
  const out: { path: string; decision: string }[] = [];
  const kdir = join(root, '.agents', 'knowledge');
  for (const e of ls(kdir).filter((x) => x.endsWith('.md'))) {
    const d = read(root, join(kdir, e)).data['decisions'];
    if (Array.isArray(d))
      for (const x of d) out.push({ path: `.agents/knowledge/${e}`, decision: String(x) });
  }
  for (const h of historyPages(root)) {
    const line = /^decisions:\s*(.+)$/m.exec(h.text)?.[1];
    if (line) for (const x of line.split(',')) out.push({ path: h.path, decision: x.trim() });
  }
  return out;
}

/** Commits that touched a path and carry an `Approved-by:` trailer (design §4: approval = frontmatter + trailer). */
export function approvedBy(root: string, path: string): string[] {
  try {
    const out = execFileSync(
      'git',
      ['log', '--format=%(trailers:key=Approved-by,valueonly,separator=%x2C)', '--', path],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
