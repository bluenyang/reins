import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { intentIds, historyPages, intentFile } from './work.js';
import { readMetrics, summarize, type Summary } from './metrics.js';
import { splitFrontmatter } from './skills.js';

/** The three axes a repeated key can come from (design §8). */
export type Axis = 'stop' | 'reason' | 'decision';

export interface RetroKey {
  key: string; // `stop:F2`, `reason:<slug>`, `decision:<slug>`
  axis: Axis;
  /** Distinct tickets or history pages the key appeared in. */
  units: string[];
  /** History pages the key was written in; empty for `stop:` keys. */
  pages: string[];
}

export interface Retro {
  release: string | null;
  stops: Record<string, number>;
  failedRounds: { HOLD: number; STOP: number };
  tokens: Summary['tokens'];
  keys: RetroKey[];
  candidates: RetroKey[];
}

/** `stop:F2` → `F2`; a bare slug stays as it is. */
export const bareKey = (k: string) => k.replace(/^(stop|reason|decision):/, '');

/** `reasons:` lines of history pages: `reasons: a, b` (design §4, optional line after `decisions:`). */
export function recordedReasons(root: string): { path: string; reason: string }[] {
  const out: { path: string; reason: string }[] = [];
  for (const h of historyPages(root)) {
    const line = /^reasons:\s*(.+)$/m.exec(h.text)?.[1];
    if (line)
      for (const x of line.split(',')) if (x.trim()) out.push({ path: h.path, reason: x.trim() });
  }
  return out;
}

/** Slugs already promoted: `decisions` and `symptoms` of `status: active` knowledge entries. */
export function promotedSlugs(root: string): Set<string> {
  const dir = join(root, '.agents', 'knowledge');
  const out = new Set<string>();
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const { data } = splitFrontmatter(readFileSync(join(dir, e), 'utf8'));
    if (!data || data['status'] !== 'active') continue;
    for (const f of ['decisions', 'symptoms']) {
      const v = data[f];
      if (Array.isArray(v)) for (const x of v) out.add(String(x));
    }
  }
  return out;
}

/** Pages the tool wrote itself (install, update, migrate): marked `source: tool`, or named so before the marker existed. */
export const toolPage = (h: { path: string; text: string }) =>
  /^source:\s*tool\s*$/m.test(h.text) ||
  (!ticketOfPage(h.path) && /_(install|update|migrate)-(harness|loop|graph)\.md$/.test(h.path));

const ticketOfPage = (path: string) => /_(\d{3}-\d+)(?:-|\.|$)/.exec(path)?.[1];

function releaseIntents(root: string, version: string): Set<string> {
  const out = new Set<string>();
  for (const id of intentIds(root)) {
    const v = intentFile(root, id, 'intent')?.data['version'];
    if (v !== undefined && String(v) === version) out.add(id);
  }
  return out;
}

export function collectRetro(root: string, opts: { release?: string } = {}): Retro {
  const release = opts.release ?? null;
  const scope = release ? releaseIntents(root, release) : null;
  const inScope = (intent: string | undefined) => !scope || (!!intent && scope.has(intent));

  const records = readMetrics(root).records.filter((r) => inScope(r.intent));
  const units = new Map<string, { axis: Axis; units: Set<string>; pages: Set<string> }>();
  const add = (key: string, axis: Axis, unit: string, page?: string) => {
    let e = units.get(key);
    if (!e) units.set(key, (e = { axis, units: new Set(), pages: new Set() }));
    e.units.add(unit);
    if (page) e.pages.add(page);
  };

  const stops: Record<string, number> = {};
  const failedRounds = { HOLD: 0, STOP: 0 };
  for (const r of records) {
    if (r.kind !== 'check') continue;
    if (r.verdict === 'HOLD' || r.verdict === 'STOP') failedRounds[r.verdict]++;
    for (const id of new Set(r.reasons)) {
      stops[id] = (stops[id] ?? 0) + 1;
      if (r.ticket) add(`stop:${id}`, 'stop', r.ticket);
    }
  }

  const pageIn = (path: string) => {
    const t = ticketOfPage(path);
    return !scope || (!!t && scope.has(t.slice(0, 3)));
  };
  for (const h of historyPages(root)) {
    if (!pageIn(h.path) || toolPage(h)) continue;
    const unit = ticketOfPage(h.path) ?? h.path;
    for (const [axis, field] of [
      ['reason', 'reasons'],
      ['decision', 'decisions'],
    ] as const) {
      const line = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(h.text)?.[1];
      if (!line) continue;
      for (const x of line.split(',')) {
        const slug = x.trim();
        if (slug) add(`${axis}:${slug}`, axis, unit, h.path);
      }
    }
  }

  const keys: RetroKey[] = [...units]
    .map(([key, e]) => ({
      key,
      axis: e.axis,
      units: [...e.units].toSorted(),
      pages: [...e.pages].toSorted(),
    }))
    .toSorted((a, b) => b.units.length - a.units.length || a.key.localeCompare(b.key));
  const done = promotedSlugs(root);
  const candidates = keys.filter((k) => k.units.length >= 2 && !done.has(bareKey(k.key)));
  return {
    release,
    stops: Object.fromEntries(Object.entries(stops).toSorted(([a], [b]) => a.localeCompare(b))),
    failedRounds,
    tokens: summarize(records).tokens,
    keys,
    candidates,
  };
}

/** The number `reins status` shows; the same count as `retro` over the whole record. */
export const candidateCount = (root: string) => collectRetro(root).candidates.length;

export function formatRetro(r: Retro): string {
  const n = (x: number) => x.toLocaleString('en-US');
  const out: string[] = [`reins retro${r.release ? ` — release ${r.release}` : ''}`];
  out.push(`failed rounds: HOLD ${r.failedRounds.HOLD} · STOP ${r.failedRounds.STOP}`);
  out.push('stops by id');
  const s = Object.entries(r.stops);
  if (!s.length) out.push('  —');
  for (const [id, c] of s) out.push(`  ${id.padEnd(8)} ${c}`);
  out.push(`tokens: ${n(r.tokens.total)}`);
  const roles = Object.entries(r.tokens.byRole);
  if (!roles.length) out.push('  —');
  for (const [k, v] of roles) out.push(`  ${k.padEnd(14)} ${n(v).padStart(12)}`);
  for (const axis of ['stop', 'reason', 'decision'] as const) {
    const rows = r.keys.filter((k) => k.axis === axis && k.units.length >= 2);
    out.push(`repeated ${axis} keys`);
    if (!rows.length) out.push('  —');
    for (const k of rows) {
      const cand = r.candidates.some((c) => c.key === k.key);
      const shown =
        k.units.slice(0, 4).join(', ') + (k.units.length > 4 ? `, +${k.units.length - 4}` : '');
      out.push(`  ${k.key} ×${k.units.length} (${shown})${cand ? '' : ' — promoted'}`);
    }
  }
  out.push(`knowledge candidates: ${r.candidates.length}`);
  for (const c of r.candidates) out.push(`  ${c.key}`);
  return `${out.join('\n')}\n`;
}
