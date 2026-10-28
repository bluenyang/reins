import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isMap, isScalar, parse, parseDocument, stringify } from 'yaml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { vendorOf, vendors, type Vendor } from './detect.js';
import { packageHarness } from './upstream.js';
import { splitFrontmatter } from './skills.js';

/** The git-ignored per-user layer (design §5): detection results and role overrides. */
export const LOCAL_BINDINGS = '.loctx/bindings.local.yaml';

export interface LocalBindings {
  schema: 'reins/bindings-local@1';
  vendors: Record<string, { detected: boolean; at?: string }>;
  /** `model` and/or `enabled` per role (the schema wants at least one). */
  roles: Record<string, { model?: string; enabled?: boolean }>;
}

export type BindingSource = 'local' | 'team' | 'fallback' | 'pm' | 'default';

/** Used only when pm itself has no usable binding. */
export const DEFAULT_MODEL = 'claude-opus-5-5';

/** Always on (design §2): pm, implementer and verify-tool cannot be switched off. */
export const FIXED_ROLES: readonly string[] = ['pm', 'implementer', 'verify-tool'];

export type EnabledSource = 'fixed' | 'local' | 'team' | 'default';

export interface ResolvedBinding {
  role: string;
  vendor: string;
  model: string;
  source: BindingSource;
  reason: string;
  /** Whether the role is on for this user (fixed → on; else local ?? team ?? true). */
  enabled: boolean;
  enabled_source: EnabledSource;
  /** Who does the work while the role is off: a role, `caller` or `user`; absent for the fixed roles. */
  covered_by?: string;
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
  return loadLocal(root) ?? { schema: 'reins/bindings-local@1', vendors: {}, roles: {} };
}

/** The local file, empty when absent; `null` (after a warning) when it exists but cannot be used. */
function loadLocal(root: string): LocalBindings | null {
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
    return null;
  }
  const bad = isObj(doc) ? localValid(doc) : 'not a mapping';
  if (bad !== null || !isObj(doc)) {
    process.stderr.write(`warning: ${LOCAL_BINDINGS} is invalid (${bad}) — ignored\n`);
    return null;
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
      if (isObj(v)) {
        const e: { model?: string; enabled?: boolean } = {};
        if (typeof v['model'] === 'string' && v['model']) e.model = v['model'];
        if (typeof v['enabled'] === 'boolean') e.enabled = v['enabled'];
        if (e.model !== undefined || e.enabled !== undefined) out.roles[k] = e;
      }
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
  covered?: string;
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
      covered:
        typeof data?.['covered_by'] === 'string' && data['covered_by'] !== 'none'
          ? data['covered_by']
          : undefined,
    });
  }
  return meta;
}

/** `roles.<r>.enabled` of the committed file, where a boolean is written. */
export function teamEnabled(root: string): Record<string, boolean> {
  const path = join(root, '.agents/harness/bindings.yaml');
  if (!existsSync(path)) return {};
  try {
    const doc = parse(readFileSync(path, 'utf8')) as { roles?: Record<string, unknown> } | null;
    const out: Record<string, boolean> = {};
    for (const [r, b] of Object.entries(doc?.roles ?? {}))
      if (isObj(b) && typeof b['enabled'] === 'boolean') out[r] = b['enabled'];
    return out;
  } catch {
    return {};
  }
}

export interface RoleState {
  role: string;
  enabled: boolean;
  enabled_source: EnabledSource;
  covered_by?: string;
}

/**
 * On or off per role for this user, without resolving models (no vendor detection): fixed roles are
 * on; otherwise `local enabled ?? team enabled ?? true`. `warnings` names a fixed role that carries
 * `enabled: false` in either layer (ignored).
 */
export function roleStates(root: string): { states: Map<string, RoleState>; warnings: string[] } {
  const local = readLocal(root);
  const team = teamEnabled(root);
  const meta = roleMeta(root);
  const names = new Set([
    ...FIXED_ROLES,
    ...Object.keys(teamRoles(root)),
    ...meta.keys(),
    ...Object.keys(team),
    ...Object.keys(local.roles),
  ]);
  const states = new Map<string, RoleState>();
  const warnings: string[] = [];
  for (const role of [...names].toSorted()) {
    const covered = meta.get(role)?.covered;
    let enabled = true;
    let enabled_source: EnabledSource = 'default';
    if (FIXED_ROLES.includes(role)) {
      enabled_source = 'fixed';
      for (const [layer, v] of [
        ['bindings.yaml', team[role]],
        [LOCAL_BINDINGS, local.roles[role]?.enabled],
      ] as const)
        if (v === false)
          warnings.push(`warning: ${layer}: ${role} is always on — its enabled: false is ignored`);
    } else if (local.roles[role]?.enabled !== undefined) {
      enabled = local.roles[role].enabled;
      enabled_source = 'local';
    } else if (team[role] !== undefined) {
      enabled = team[role];
      enabled_source = 'team';
    }
    states.set(role, {
      role,
      enabled,
      enabled_source,
      ...(covered ? { covered_by: covered } : {}),
    });
  }
  return { states, warnings };
}

/** The state column of status and the config table: `off → pm`, `on (local)`, or empty when plainly on. */
export function stateLabel(b: {
  enabled: boolean;
  enabled_source: EnabledSource;
  covered_by?: string;
}): string {
  if (!b.enabled) return `off${b.covered_by ? ` → ${b.covered_by}` : ''}`;
  return b.enabled_source === 'local' ? 'on (local)' : '';
}

export function teamRoles(root: string): Record<string, { vendor: string; model: string }> {
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
  const { states } = roleStates(root);
  const stateOf = (role: string): RoleState =>
    states.get(role) ?? {
      role,
      enabled: true,
      enabled_source: FIXED_ROLES.includes(role) ? 'fixed' : 'default',
    };
  let live: Map<string, boolean> | undefined;
  const detected = (v: string): boolean => {
    if (v === 'claude') return true;
    const known = local.vendors[v];
    if (known) return known.detected;
    live ??= new Map(detect().map((x) => [x.name, x.detected]));
    return live.get(v) ?? false;
  };
  const roles = [...new Set([...FIXED_ROLES, ...Object.keys(team), ...meta.keys()])].toSorted();
  const withState = (b: Omit<ResolvedBinding, 'enabled' | 'enabled_source' | 'covered_by'>) => {
    const { enabled, enabled_source, covered_by } = stateOf(b.role);
    return { ...b, enabled, enabled_source, ...(covered_by ? { covered_by } : {}) };
  };
  const one = (
    role: string,
    last: { vendor: string; model: string; source: BindingSource; label: string },
  ): ResolvedBinding => {
    const l = local.roles[role]?.model;
    if (l)
      return withState({
        role,
        vendor: vendorOf(l),
        model: l,
        source: 'local',
        reason: 'local override',
      });
    const t = team[role];
    if (t && detected(t.vendor))
      return withState({ role, ...t, source: 'team', reason: 'team binding' });
    const fb = meta.get(role)?.fb;
    const why = t ? `${t.vendor} not detected` : 'no team binding';
    if (fb && detected(vendorOf(fb)))
      return withState({
        role,
        vendor: vendorOf(fb),
        model: fb,
        source: 'fallback',
        reason: `${why} — fallback_binding`,
      });
    return withState({
      role,
      vendor: last.vendor,
      model: last.model,
      source: last.source,
      reason: `${why} — ${last.label}`,
    });
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

const DETECT_KEYS = ['detected', 'at', 'detected_at', 'detectedAt', 'checked_at', 'checkedAt'];

/**
 * 0.1.4 kept `vendors.<v>.detected` (and a timestamp) in the committed bindings.yaml. Moves them to the
 * local file (a vendor the local file already has is kept as is) and removes just those keys from the
 * committed one through the Document API, so comments, order and every other key stay as written.
 * Returns the vendors moved; nothing is written when `dryRun`.
 */
export function migrateDetected(root: string, dryRun = false): string[] {
  const path = join(root, '.agents/harness/bindings.yaml');
  if (!existsSync(path)) return [];
  const doc = parseDocument(readFileSync(path, 'utf8'));
  if (doc.errors.length > 0) return [];
  const vs = doc.get('vendors', true);
  if (!isMap(vs)) return [];
  const found: Record<string, { detected: boolean; at?: string }> = {};
  const touched: string[] = [];
  for (const pair of vs.items) {
    const name = isScalar(pair.key) ? String(pair.key.value) : undefined;
    if (name === undefined || !isMap(pair.value)) continue;
    const m = pair.value;
    const keys = m.items.filter(
      (i) => isScalar(i.key) && DETECT_KEYS.includes(String(i.key.value)),
    );
    if (keys.length === 0) continue;
    const val = (k: string): unknown => {
      const v = m.get(k);
      return v;
    };
    const det = val('detected');
    const at = ['at', 'detected_at', 'detectedAt', 'checked_at', 'checkedAt']
      .map(val)
      .find((x) => typeof x === 'string' || x instanceof Date);
    if (typeof det !== 'boolean') continue; // only a well-formed record is migrated
    found[name] = {
      detected: det,
      ...(at === undefined ? {} : { at: at instanceof Date ? at.toISOString() : String(at) }),
    };
    touched.push(name);
  }
  if (touched.length === 0) return [];
  if (dryRun) return touched;
  const local = loadLocal(root);
  if (local === null) return []; // never overwrite a local file we cannot read
  let add = false;
  for (const [k, v] of Object.entries(found))
    if (!local.vendors[k]) {
      local.vendors[k] = v;
      add = true;
    }
  if (add) writeLocal(root, local);
  for (const name of touched) {
    const m = vs.get(name, true);
    if (!isMap(m)) continue;
    for (const k of DETECT_KEYS) m.delete(k);
    if (m.items.length === 0) vs.delete(name);
  }
  if (vs.items.length === 0) doc.delete('vendors');
  writeFileSync(path, doc.toString());
  return touched;
}

export type EnabledScope = 'global' | 'local';

export interface SetRoleEnabledResult {
  refused?: string;
  changed: boolean;
}

function roleNames(root: string): string[] {
  const dir = join(root, '.agents/harness/roles');
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.slice(0, -3))
        .toSorted()
    : [];
}

/** Why a role cannot be switched on or off, or null (used before anything is written). */
export function roleEnabledRefusal(root: string, role: string, on: boolean): string | null {
  const names = roleNames(root);
  if (!names.includes(role)) return `unknown role "${role}" — roles: ${names.join(', ')}`;
  if (!on && FIXED_ROLES.includes(role))
    return `${role} is always on and cannot be switched off (fixed roles: ${FIXED_ROLES.join(', ')})`;
  return null;
}

/**
 * Switches a role on or off in one layer and touches nothing else. Global edits `bindings.yaml` through
 * the Document API (comments and order stay; switching on removes the key, since on is the default);
 * local drops its key when it equals the team value. Regenerating vendor files is the caller's job.
 */
export function setRoleEnabled(
  root: string,
  role: string,
  on: boolean,
  scope: EnabledScope,
): SetRoleEnabledResult {
  const refused = roleEnabledRefusal(root, role, on);
  if (refused) return { refused, changed: false };
  if (scope === 'local') {
    const local = readLocal(root);
    const teamValue = teamEnabled(root)[role] ?? true;
    const before = local.roles[role]?.enabled;
    const entry = { ...local.roles[role] };
    if (on === teamValue) delete entry.enabled;
    else entry.enabled = on;
    if (entry.enabled === before) return { changed: false };
    if (entry.model === undefined && entry.enabled === undefined) delete local.roles[role];
    else local.roles[role] = entry;
    writeLocal(root, local);
    return { changed: true };
  }
  const path = join(root, '.agents/harness/bindings.yaml');
  if (!existsSync(path))
    return { refused: 'no bindings.yaml — install the graph tier first', changed: false };
  const doc = parseDocument(readFileSync(path, 'utf8'));
  if (doc.errors.length > 0) return { refused: 'bindings.yaml cannot be parsed', changed: false };
  const was = doc.getIn(['roles', role, 'enabled']);
  if (on) {
    if (was === undefined) return { changed: false };
    doc.deleteIn(['roles', role, 'enabled']);
    const entry = doc.getIn(['roles', role], true);
    if (isMap(entry) && entry.items.length === 0) doc.deleteIn(['roles', role]);
  } else {
    if (was === false) return { changed: false };
    doc.setIn(['roles', role, 'enabled'], false);
  }
  writeFileSync(path, doc.toString());
  return { changed: true };
}
