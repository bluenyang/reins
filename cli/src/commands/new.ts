import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { harnessDir } from '../lib/harness.js';
import { loadSchemas, validateFile } from '../lib/schema.js';
import { intentDir, intentFile, intentIds, openTickets } from '../lib/work.js';

/** `reins new intent|ticket|request` — files made from the harness templates (design §9). No prompts, no overwrite. */

export interface NewResult {
  code: 0 | 1;
  /** the created path (repository-relative), one line */
  stdout: string;
  stderr: string;
}

const fail = (m: string): NewResult => ({ code: 1, stdout: '', stderr: `reins new: ${m}\n` });
const pad = (n: number, w: number) => String(n).padStart(w, '0');
const ls = (d: string) => (existsSync(d) ? readdirSync(d).toSorted() : []);

// ---- numbering (pure) -------------------------------------------------------------------------

/** Next intent id: the highest number in `.agents/intent/` plus one, three digits. */
export function nextIntentId(existing: string[]): string {
  return pad(Math.max(0, ...existing.map(Number)) + 1, 3);
}

/** Next ticket number of an intent: the highest among open tickets, history records and the plan's ids, plus one. */
export function nextTicketNumber(intent: string, ...sources: string[][]): number {
  const re = new RegExp(`^${intent}-(\\d+)$`);
  const ns = sources.flat().map((s) => Number(re.exec(s)?.[1] ?? 0));
  return Math.max(0, ...ns) + 1;
}

/** Next two-digit bus number of a ticket, from the file names already in `.loctx/bus/`. */
export function nextBusNumber(ticket: string, files: string[]): string {
  const ns = files.map((f) => {
    const m = /^(.+)_(\d+)\.(request|response)\.yaml$/.exec(f);
    return m && m[1] === ticket ? Number(m[2]) : 0;
  });
  return pad(Math.max(0, ...ns) + 1, 2);
}

/** Ticket ids that history pages record, from their file names and first heading (`# 009-2 — …`). */
function historyTicketIds(root: string, intent: string): string[] {
  const dir = join(root, '.loctx', 'history');
  const re = new RegExp(`(?<![0-9])(${intent}-\\d+)(?![0-9])`, 'g');
  const out: string[] = [];
  for (const f of ls(dir).filter((e) => e.endsWith('.md'))) {
    const head =
      readFileSync(join(dir, f), 'utf8')
        .split('\n')
        .find((l) => l.startsWith('# ')) ?? '';
    for (const m of `${f}\n${head}`.matchAll(re)) out.push(m[1]!);
  }
  return out;
}

/** How many numbered items the plan's order of work lists, or null when it cannot be read. */
export function planStepCount(body: string): number | null {
  const m = /^##\s+(?:작업 순서|order of work)[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/im.exec(body);
  if (!m) return null;
  const n = (m[1]!.match(/^\d+\.\s/gm) ?? []).length;
  return n || null;
}

// ---- writing ----------------------------------------------------------------------------------

/** Replaces top-level `key: value` lines of the frontmatter; the body stays as the template has it. */
function fill(text: string, values: Record<string, string>): string {
  const m = /^(---\n)([\s\S]*?\n)(---\n[\s\S]*)$/.exec(text);
  const [head, mid, tail] = m ? [m[1]!, m[2]!, m[3]!] : ['', text, ''];
  const lines = mid.split('\n').map((l) => {
    const k = /^([A-Za-z_]+):/.exec(l)?.[1];
    return k && k in values ? `${k}: ${values[k]}` : l;
  });
  return `${head}${lines.join('\n')}${tail}`;
}

const q = (s: string) => JSON.stringify(s);

function emit(
  root: string,
  rel: string,
  content: string,
  schemaName: string,
  whole: boolean,
): NewResult {
  const hd = harnessDir(root);
  const v = hd ? loadSchemas(hd).get(schemaName) : undefined;
  if (!v) return fail(`no ${schemaName} schema in the harness`);
  const issues = validateFile(v, rel, whole, content);
  if (issues.length)
    return fail(`output would not pass ${schemaName}: ${issues.map((i) => i.message).join('; ')}`);
  const abs = join(root, rel);
  if (existsSync(abs)) return fail(`${rel} already exists; not overwritten`);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, { flag: 'wx' });
  return { code: 0, stdout: `${rel}\n`, stderr: '' };
}

function template(root: string, rel: string): string | null {
  const hd = harnessDir(root);
  const p = hd && join(hd, 'templates', rel);
  return p && existsSync(p) ? readFileSync(p, 'utf8') : null;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function newIntent(
  root: string,
  slug: string,
  o: { version?: string; origin?: string } = {},
): NewResult {
  if (!SLUG.test(slug)) return fail(`slug must be kebab-case (got "${slug}")`);
  const t = template(root, 'intent.md');
  if (!t) return fail('no intent template in the harness');
  const id = nextIntentId(intentIds(root));
  const vals: Record<string, string> = { id: q(id), slug, status: 'draft', approvals: '[]' };
  if (o.version) vals['version'] = q(o.version);
  if (o.origin) vals['origin'] = o.origin;
  return emit(root, `.agents/intent/${id}_${slug}/intent.md`, fill(t, vals), 'intent', false);
}

export function newTicket(
  root: string,
  intent: string,
  step: string,
  slug: string,
  o: { title?: string; depends?: string; release?: string; role?: string } = {},
): NewResult {
  if (!/^\d{3}$/.test(intent)) return fail(`intent must be three digits (got "${intent}")`);
  if (!/^[1-9]\d*$/.test(step)) return fail(`step must be a positive integer (got "${step}")`);
  if (!SLUG.test(slug)) return fail(`slug must be kebab-case (got "${slug}")`);
  const idir = intentDir(root, intent);
  if (!idir) return fail(`no intent ${intent} in .agents/intent/`);
  const plan = intentFile(root, intent, 'plan');
  if (plan) {
    const max = planStepCount(plan.body);
    if (max !== null && Number(step) > max)
      return fail(`step ${step} is outside the plan's order of work (1..${max})`);
  }
  const t = template(root, 'ticket.md');
  if (!t) return fail('no ticket template in the harness');
  const planned = Array.isArray(plan?.data['tickets'])
    ? (plan.data['tickets'] as unknown[]).map(String)
    : [];
  const open = openTickets(root).map((f) => String(f.data['id'] ?? ''));
  const n = nextTicketNumber(intent, open, historyTicketIds(root, intent), planned);
  const iSlug = idir
    .split('/')
    .pop()!
    .replace(/^\d{3}_/, '');
  const branch =
    typeof plan?.data['branch'] === 'string' ? plan.data['branch'] : `feat/${intent}-${iSlug}`;
  const depends = (o.depends ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const vals: Record<string, string> = {
    id: `${intent}-${n}`,
    intent: q(intent),
    plan_step: step,
    depends: `[${depends.join(', ')}]`,
    branch,
  };
  if (o.title) vals['title'] = q(o.title);
  if (o.release) vals['release'] = o.release;
  if (o.role) vals['role'] = o.role;
  return emit(root, `.loctx/ticket/${intent}-${n}_${slug}.md`, fill(t, vals), 'ticket', false);
}

const KIND_ROUTE: Record<string, { from: string; to: string }> = {
  implement: { from: 'pl', to: 'implementer' },
  verify: { from: 'pl', to: 'verify-tool' },
  review: { from: 'pl', to: 'reviewer' },
};

export function newRequest(
  root: string,
  ticket: string,
  kind: string,
  o: { from?: string; to?: string } = {},
): NewResult {
  if (!/^\d{3}-\d+$/.test(ticket)) return fail(`ticket must look like 011-1 (got "${ticket}")`);
  const fixed = KIND_ROUTE[kind];
  if (!fixed && kind !== 'question' && kind !== 'stop-report')
    return fail(`kind must be implement, verify, review, question or stop-report (got "${kind}")`);
  const from = o.from ?? fixed?.from;
  if (!from) return fail(`${kind} needs --from`);
  const to = o.to ?? fixed?.to ?? 'pl';
  const t = template(root, 'bus/request.yaml');
  if (!t) return fail('no bus request template in the harness');
  const nn = nextBusNumber(ticket, ls(join(root, '.loctx', 'bus')));
  const id = `${ticket}_${nn}`;
  const vals: Record<string, string> = {
    id,
    from,
    to,
    ticket,
    intent: q(ticket.slice(0, 3)),
    kind,
  };
  return emit(root, `.loctx/bus/${id}.request.yaml`, fill(t, vals), 'bus-request', true);
}
