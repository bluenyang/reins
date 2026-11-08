import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { packageHarness } from './upstream.js';

/**
 * Model assignment, version 2 (design §2-1, §5): which vendor's model does a group's or a role's work.
 * reins resolves it when `config` writes; nothing reads it while a project works.
 */
export interface Binding {
  vendor: string;
  model: string;
}

export type Group = 'pl' | 'planner' | 'implementer' | 'executor' | 'advisor' | 'auditor';

export interface GroupSpec {
  vendor?: string;
  model?: string;
  /** pl and advisor only: several models. */
  models?: Binding[];
  roles?: Record<string, Binding>;
}

export interface BindingsV2 {
  schema: 'reins/bindings@2';
  mode?: 'single' | 'multi';
  audit?: { required?: boolean };
  default?: Binding;
  tools?: Record<string, { cli?: string; use?: boolean }>;
  groups?: Partial<Record<Group, GroupSpec>>;
}

/** The roles of each group (design §2-2). A group whose list is empty is one role of the same name. */
export const GROUP_ROLES: Record<Group, readonly string[]> = {
  pl: [
    'control',
    'plan-reviewer',
    'code-reviewer',
    'qa-plan-reviewer',
    'doc-reviewer',
    'retrospector',
    'discussion',
  ],
  planner: ['spec-writer', 'qa-designer'],
  implementer: ['code', 'qa', 'doc'],
  executor: ['tool-executor', 'researcher', 'qa-runner', 'deployer'],
  advisor: ['committee'],
  auditor: [],
};

export const GROUPS = Object.keys(GROUP_ROLES) as Group[];

/** Roles that use every model of their group rather than one (design §2-2). */
const ALL_MODELS = new Set(['pl/discussion', 'advisor/committee']);
const PL_REVIEWERS = new Set([
  'plan-reviewer',
  'code-reviewer',
  'qa-plan-reviewer',
  'doc-reviewer',
  'retrospector',
]);

/** Used when a file names no default. */
export const DEFAULT_BINDING: Binding = { vendor: 'claude', model: 'claude-opus-5-5' };

export interface ResolvedRole {
  group: Group;
  role: string;
  /** false: the PM does this work. */
  on: boolean;
  /** One model, or several for discussion and the committee; empty when off. */
  models: Binding[];
  source: 'role' | 'group' | 'off';
}

const pair = (b: Binding): Binding => ({ vendor: b.vendor, model: b.model });

/** The group's models in order: `models`, else the single `vendor`/`model`. */
function groupModels(spec: GroupSpec): Binding[] {
  if (spec.models?.length) return spec.models.map(pair);
  if (spec.vendor && spec.model) return [{ vendor: spec.vendor, model: spec.model }];
  return [];
}

/**
 * Every group's roles with the model(s) that do them. Single mode switches every group off, so the PM
 * does all the work; the auditor's model, if any, stays a recommendation (see `auditBinding`).
 */
export function resolveRoles(doc: BindingsV2): ResolvedRole[] {
  const multi = doc.mode === 'multi';
  const out: ResolvedRole[] = [];
  for (const group of GROUPS) {
    const spec = doc.groups?.[group];
    const roles = GROUP_ROLES[group].length ? GROUP_ROLES[group] : [group];
    const models = spec ? groupModels(spec) : [];
    for (const role of roles) {
      const own = spec?.roles?.[role];
      if (!multi || (!own && models.length === 0)) {
        out.push({ group, role, on: false, models: [], source: 'off' });
        continue;
      }
      if (own) {
        out.push({ group, role, on: true, models: [pair(own)], source: 'role' });
        continue;
      }
      let picked: Binding[];
      if (ALL_MODELS.has(`${group}/${role}`)) picked = models;
      else if (group === 'pl' && PL_REVIEWERS.has(role)) picked = [models[1] ?? models[0]!];
      else picked = [models[0]!];
      out.push({ group, role, on: true, models: picked, source: 'group' });
    }
  }
  return out;
}

/** The PM's model. */
export function pmBinding(doc: BindingsV2): Binding {
  return doc.default ? pair(doc.default) : { ...DEFAULT_BINDING };
}

/** The model an audit should run on: the auditor group's, else the PM's (design §3-3). */
export function auditBinding(doc: BindingsV2): Binding {
  const a = doc.groups?.auditor;
  const own = a?.roles?.auditor;
  if (own) return pair(own);
  const ms = a ? groupModels(a) : [];
  return ms[0] ?? pmBinding(doc);
}

/** Whether the per-version audit is mandatory (design §3-3): true unless the file says false. */
export const auditRequired = (doc: BindingsV2): boolean => doc.audit?.required !== false;

/** The local override wins per key: mode, audit, default, each tool and each group as a whole. */
export function mergeLocal(team: BindingsV2, local: Partial<BindingsV2> | undefined): BindingsV2 {
  if (!local) return team;
  const out: BindingsV2 = { ...team, schema: 'reins/bindings@2' };
  if (local.mode) out.mode = local.mode;
  if (local.audit) out.audit = { ...team.audit, ...local.audit };
  if (local.default) out.default = pair(local.default);
  if (local.tools) out.tools = { ...team.tools, ...local.tools };
  if (local.groups) out.groups = { ...team.groups, ...local.groups };
  return out;
}

let validator: ((d: unknown) => boolean) | undefined;
/** Problems of a version-2 file against `harness/schemas/bindings.schema.json`; empty when valid. */
export function validateBindings(doc: unknown): string[] {
  validator ??= new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(
      readFileSync(join(packageHarness(), 'schemas/bindings.schema.json'), 'utf8'),
    ) as object,
  ) as (d: unknown) => boolean;
  if (validator(doc)) return [];
  const errs = (validator as unknown as { errors?: { instancePath: string; message?: string }[] })
    .errors;
  return (errs ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message ?? 'invalid'}`);
}

/** Where each version-1 role goes in version 2 (design §7). `pm` becomes `default`. */
export const V1_ROLE_MAP: Record<string, { group: Group; role?: string }> = {
  planner: { group: 'planner', role: 'spec-writer' },
  pl: { group: 'pl' },
  'code-review': { group: 'pl', role: 'code-reviewer' },
  implementer: { group: 'implementer' },
  'verify-tool': { group: 'executor', role: 'tool-executor' },
  'qa-run': { group: 'executor', role: 'qa-runner' },
  deploy: { group: 'executor', role: 'deployer' },
  lookup: { group: 'executor', role: 'researcher' },
  'qa-design': { group: 'planner', role: 'qa-designer' },
  docs: { group: 'implementer', role: 'doc' },
  advisor: { group: 'advisor' },
};

const DROPPED_V1_KEYS = ['escalation', 'limits'] as const;

/**
 * A version-1 `bindings.yaml` (`roles.<r>: {vendor, model, enabled, fallback, parallel}`, `vendors`)
 * as version 2. The result is single mode; the converted groups take effect once the user switches to
 * multi with `config`. `notes` says what moved and what was dropped, for the user to confirm.
 */
export function convertV1(v1: Record<string, unknown>): { doc: BindingsV2; notes: string[] } {
  const notes: string[] = [];
  const doc: BindingsV2 = { schema: 'reins/bindings@2', mode: 'single', audit: { required: true } };
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  const roles = isObj(v1['roles']) ? v1['roles'] : {};
  const bindingOf = (v: unknown): Binding | null =>
    isObj(v) && typeof v['vendor'] === 'string' && typeof v['model'] === 'string'
      ? { vendor: v['vendor'], model: v['model'] }
      : null;
  const pm = bindingOf(roles['pm']);
  if (pm) doc.default = pm;
  for (const [name, raw] of Object.entries(roles)) {
    if (name === 'pm') continue;
    const target = V1_ROLE_MAP[name];
    if (!target) {
      notes.push(`role ${name}: no place in version 2, dropped`);
      continue;
    }
    if (isObj(raw) && raw['enabled'] === false) {
      notes.push(`role ${name}: was off, left off`);
      continue;
    }
    const b = bindingOf(raw);
    if (!b) continue;
    doc.groups ??= {};
    const spec = (doc.groups[target.group] ??= {});
    if (target.role) {
      spec.roles ??= {};
      spec.roles[target.role] = b;
    } else if (!spec.vendor) {
      spec.vendor = b.vendor;
      spec.model = b.model;
    }
    const where = target.role ? `${target.group}.${target.role}` : target.group;
    notes.push(`role ${name} → ${where} (${b.vendor} ${b.model})`);
    for (const k of ['fallback', 'parallel'] as const)
      if (isObj(raw) && k in raw) notes.push(`role ${name}: ${k} dropped (no run-time keys)`);
  }
  if (isObj(v1['vendors'])) {
    doc.tools = {};
    for (const [v, raw] of Object.entries(v1['vendors'])) {
      if (!isObj(raw)) continue;
      const t: { cli?: string; use?: boolean } = {};
      if (typeof raw['cli'] === 'string') t.cli = raw['cli'];
      if (typeof raw['available'] === 'boolean') t.use = raw['available'];
      doc.tools[v] = t;
    }
  }
  for (const k of DROPPED_V1_KEYS) if (k in v1) notes.push(`${k}: dropped (no run-time keys)`);
  if (doc.groups) notes.push('mode: single; switch to multi with config to use the groups above');
  return { doc, notes };
}
