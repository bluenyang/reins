import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { vendorOf, vendors, type Vendor } from './detect.js';
import { packageHarness } from './upstream.js';
import { splitFrontmatter } from './skills.js';

/** The git-ignored per-user layer (design §5): detection results and role overrides. */
export const LOCAL_BINDINGS = '.loctx/bindings.local.yaml';

export interface LocalBindings {
  schema: 'reins/bindings-local@1';
  vendors: Record<string, { detected: boolean; at?: string }>;
  roles: Record<string, { model: string }>;
}

export type BindingSource = 'local' | 'team' | 'fallback' | 'pm' | 'default';

/** Used only when pm itself has no usable binding. */
export const DEFAULT_MODEL = 'claude-opus-5-5';

export interface ResolvedBinding {
  role: string;
  vendor: string;
  model: string;
  source: BindingSource;
  reason: string;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

let validateLocal: ((d: unknown) => boolean) | undefined;
function localValid(doc: unknown): string | null {
  validateLocal ??= (() => {
    const schema = JSON.parse(
      readFileSync(join(packageHarness(), 'schemas/bindings-local.schema.json'), 'utf8'),
    ) as object;
    return new Ajv2020({ allErrors: true, strict: false }).compile(schema) as (
      d: unknown,
    ) => boolean;
  })();
  if (validateLocal(doc)) return null;
  const errs = (
    validateLocal as unknown as { errors?: { instancePath: string; message?: string }[] }
  ).errors;
  return (errs ?? [])
    .map((e) => `${e.instancePath || '(root)'} ${e.message ?? 'invalid'}`)
    .join('; ');
}

/** Tolerant: a missing file reads as empty; an invalid one is ignored with a warning, never a crash. */
export function readLocal(root: string): LocalBindings {
  const out: LocalBindings = { schema: 'reins/bindings-local@1', vendors: {}, roles: {} };
  const path = join(root, LOCAL_BINDINGS);
  if (!existsSync(path)) return out;
  let doc: unknown;
  try {
    doc = parse(readFileSync(path, 'utf8'));
  } catch (e) {
    process.stderr.write(
      `warning: ${LOCAL_BINDINGS} cannot be read (${(e as Error).message}) — ignored\n`,
    );
    return out;
  }
  const bad = isObj(doc) ? localValid(doc) : 'not a mapping';
  if (bad !== null || !isObj(doc)) {
    process.stderr.write(`warning: ${LOCAL_BINDINGS} is invalid (${bad}) — ignored\n`);
    return out;
  }
  if (isObj(doc['vendors']))
    for (const [k, v] of Object.entries(doc['vendors']))
      if (isObj(v) && typeof v['detected'] === 'boolean')
        out.vendors[k] = {
          detected: v['detected'],
          ...(typeof v['at'] === 'string' ? { at: v['at'] } : {}),
        };
  if (isObj(doc['roles']))
    for (const [k, v] of Object.entries(doc['roles']))
      if (isObj(v) && typeof v['model'] === 'string' && v['model'])
        out.roles[k] = { model: v['model'] };
  return out;
}

export function writeLocal(root: string, doc: LocalBindings): void {
  const path = join(root, LOCAL_BINDINGS);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `# per-user, git-ignored — change with \`reins configure bindings --local\`\n${stringify(doc)}`,
  );
}

/** Records a detection run in the local file; `roles` and other vendors' entries are kept. */
export function recordDetection(root: string, vs: Vendor[], now: Date = new Date()): void {
  const doc = readLocal(root);
  for (const v of vs) doc.vendors[v.name] = { detected: v.detected, at: now.toISOString() };
  writeLocal(root, doc);
}

interface RoleMeta {
  def?: string;
  fb?: string;
}

function roleMeta(root: string): Map<string, RoleMeta> {
  const dir = join(root, '.agents/harness/roles');
  const meta = new Map<string, RoleMeta>();
  if (!existsSync(dir)) return meta;
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith('.md'))
    .toSorted()) {
    const { data } = splitFrontmatter(readFileSync(join(dir, f), 'utf8'));
    meta.set(f.slice(0, -3), {
      def: typeof data?.['default_binding'] === 'string' ? data['default_binding'] : undefined,
      fb: typeof data?.['fallback_binding'] === 'string' ? data['fallback_binding'] : undefined,
    });
  }
  return meta;
}

function teamRoles(root: string): Record<string, { vendor: string; model: string }> {
  const path = join(root, '.agents/harness/bindings.yaml');
  if (!existsSync(path)) return {};
  try {
    const doc = parse(readFileSync(path, 'utf8')) as { roles?: Record<string, unknown> } | null;
    const out: Record<string, { vendor: string; model: string }> = {};
    for (const [r, b] of Object.entries(doc?.roles ?? {}))
      if (isObj(b) && typeof b['model'] === 'string')
        out[r] = {
          vendor: typeof b['vendor'] === 'string' ? b['vendor'] : vendorOf(b['model']),
          model: b['model'],
        };
    return out;
  } catch {
    return {};
  }
}

/**
 * The model each role actually runs on (design §5). Per role: local override → team binding when its
 * vendor is detected → the role file's `fallback_binding` when its vendor is detected → the pm model.
 * A vendor missing from the local file is detected live (`detect`) and not written back. claude is the floor.
 */
export function resolveBindings(root: string, detect: () => Vendor[] = vendors): ResolvedBinding[] {
  const local = readLocal(root);
  const team = teamRoles(root);
  const meta = roleMeta(root);
  let live: Map<string, boolean> | undefined;
  const detected = (v: string): boolean => {
    if (v === 'claude') return true;
    const known = local.vendors[v];
    if (known) return known.detected;
    live ??= new Map(detect().map((x) => [x.name, x.detected]));
    return live.get(v) ?? false;
  };
  const roles = [...new Set([...Object.keys(team), ...meta.keys()])].toSorted();
  const one = (
    role: string,
    last: { vendor: string; model: string; source: BindingSource; label: string },
  ): ResolvedBinding => {
    const l = local.roles[role]?.model;
    if (l)
      return { role, vendor: vendorOf(l), model: l, source: 'local', reason: 'local override' };
    const t = team[role];
    if (t && detected(t.vendor)) return { role, ...t, source: 'team', reason: 'team binding' };
    const fb = meta.get(role)?.fb;
    const why = t ? `${t.vendor} not detected` : 'no team binding';
    if (fb && detected(vendorOf(fb)))
      return {
        role,
        vendor: vendorOf(fb),
        model: fb,
        source: 'fallback',
        reason: `${why} — fallback_binding`,
      };
    return {
      role,
      vendor: last.vendor,
      model: last.model,
      source: last.source,
      reason: `${why} — ${last.label}`,
    };
  };
  // pm first, through the same order; its last resort is the claude default model
  const pmRes = one('pm', {
    vendor: vendorOf(DEFAULT_MODEL),
    model: DEFAULT_MODEL,
    source: 'default',
    label: 'default model',
  });
  const pm = {
    vendor: pmRes.vendor,
    model: pmRes.model,
    source: 'pm' as const,
    label: "pm's model",
  };
  const out: ResolvedBinding[] = [];
  for (const role of roles) out.push(role === 'pm' ? pmRes : one(role, pm));
  return out;
}
