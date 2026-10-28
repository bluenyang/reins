import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, parseDocument, stringify } from 'yaml';
import type { Asker } from '../lib/ask.js';
import {
  CONFIRMED_MODELS,
  checkBinding,
  newModelCache,
  subdirProposals,
  type SubdirGate,
  vendorOf,
  vendors,
  type ModelCache,
  type Vendor,
} from '../lib/detect.js';
import {
  readLocal,
  recordDetection,
  resolveBindings,
  roleEnabledRefusal,
  setRoleEnabled,
  writeLocal,
  type ResolvedBinding,
} from '../lib/bindings.js';
import { generateVendorFiles } from '../lib/generate.js';
import { repoRoot } from '../lib/git.js';
import { writeGenerated, type GenWriteResult } from '../lib/vendor-write.js';
import { packageHarness } from '../lib/upstream.js';
import { buildBindings } from './install.js';

interface Binding {
  vendor: string;
  model: string;
  [k: string]: unknown;
}

interface BindingsDoc {
  schema: string;
  mode?: string;
  vendors?: Record<string, unknown>;
  roles: Record<string, Binding>;
  [k: string]: unknown;
}

export interface ConfigureBindingsOptions {
  cwd?: string;
  /** role=model pairs, e.g. ["pm=claude-fable-5-1", "code-review=claude-opus-5-5"] */
  set?: string[];
  /** rebuild every role from its defaults for this set of available vendors */
  vendors?: string[];
  asker?: Asker;
  detectVendors?: () => Vendor[];
  modelCache?: ModelCache;
  /** with `set`: write the per-user override file instead of bindings.yaml (no regeneration) */
  local?: boolean;
  /** only print the resolved table */
  show?: boolean;
  /** switch these roles off / on (with `local`: for this user only); combinable with `set` */
  disable?: string[];
  enable?: string[];
}

export interface ConfigureResult {
  refused?: string;
  /** exit code for a refusal: 1 = a bad role name or a fixed role (nothing written), 2 (default) = cannot run */
  code?: 1 | 2;
  /** roles switched on or off by this call */
  toggled?: { role: string; enabled: boolean }[];
  changed: string[];
  table: { role: string; vendor: string; model: string }[];
  generated?: GenWriteResult;
  /** what each role actually runs on (local → team → fallback → pm) */
  resolved?: ResolvedBinding[];
}

/** `reins configure bindings` (R57–R59): any role, any model, any vendor; then the vendor files follow. */
export async function configureBindings(o: ConfigureBindingsOptions): Promise<ConfigureResult> {
  const root = repoRoot(o.cwd ?? process.cwd());
  const path = join(root, '.agents/harness/bindings.yaml');
  if (!existsSync(path))
    return { refused: 'no bindings.yaml — install the graph tier first', changed: [], table: [] };
  const roles = new Set(
    readdirSync(join(root, '.agents/harness/roles'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.slice(0, -3)),
  );
  let doc = parse(readFileSync(path, 'utf8')) as BindingsDoc;
  const changed: string[] = [];
  const cache = o.modelCache ?? newModelCache();
  const detect = o.detectVendors ?? vendors;
  const teamTable = () =>
    Object.entries(doc.roles)
      .map(([role, b]) => ({ role, vendor: b.vendor, model: b.model }))
      .toSorted((a, b) => a.role.localeCompare(b.role));

  if (o.show) return { changed, table: teamTable(), resolved: resolveBindings(root, detect) };

  // on/off requests are checked as a whole before anything is written
  const wanted = [
    ...(o.disable ?? []).map((role) => ({ role, enabled: false })),
    ...(o.enable ?? []).map((role) => ({ role, enabled: true })),
  ];
  for (const w of wanted) {
    const why = roleEnabledRefusal(root, w.role, w.enabled);
    if (why) return { refused: why, code: 1, changed: [], table: [] };
  }
  if ((o.disable ?? []).some((r) => (o.enable ?? []).includes(r)))
    return {
      refused: 'a role cannot be both --disable and --enable',
      code: 1,
      changed: [],
      table: [],
    };
  const toggled: { role: string; enabled: boolean }[] = [];
  const toggle = (scope: 'global' | 'local') => {
    for (const w of wanted)
      if (setRoleEnabled(root, w.role, w.enabled, scope).changed) {
        toggled.push(w);
        if (!changed.includes(w.role)) changed.push(w.role);
      }
  };

  if (o.local) {
    // per-user overrides: roles only; the team file and generated files stay untouched
    const local = readLocal(root);
    for (const pair of o.set ?? []) {
      const [role, model] = pair.split('=').map((s) => s.trim());
      if (!role || !model)
        return { refused: `"${pair}" is not role=model`, changed: [], table: [] };
      if (!roles.has(role))
        return {
          refused: `unknown role "${role}" — roles: ${[...roles].toSorted().join(', ')}`,
          changed: [],
          table: [],
        };
      if (local.roles[role]?.model !== model) {
        local.roles[role] = { ...local.roles[role], model };
        changed.push(role);
      }
    }
    if (changed.length) writeLocal(root, local);
    toggle('local');
    return { changed, toggled, table: teamTable(), resolved: resolveBindings(root, detect) };
  }

  if (o.vendors?.length) {
    const vs = detect();
    recordDetection(root, vs);
    const avail = new Set<Vendor['name']>([
      'claude',
      ...(o.vendors.filter((v) => ['openai', 'google', 'cursor'].includes(v)) as Vendor['name'][]),
    ]);
    const rebuilt = parse(
      buildBindings(packageHarness(), avail, vs, doc.mode ?? 'manual', cache),
    ) as BindingsDoc;
    for (const r of Object.keys(rebuilt.roles)) {
      const kept = doc.roles[r]?.['enabled'];
      if (typeof kept === 'boolean') rebuilt.roles[r]!['enabled'] = kept;
    }
    for (const r of Object.keys(rebuilt.roles))
      if (JSON.stringify(rebuilt.roles[r]) !== JSON.stringify(doc.roles[r])) changed.push(r);
    doc = rebuilt;
  }

  let pairs = o.set ?? [];
  if (!pairs.length && !o.vendors?.length && o.asker) {
    const ans = await o.asker.ask(
      'change bindings as role=model, comma-separated (empty: keep)',
      '',
    );
    pairs = ans
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  for (const pair of pairs) {
    const [role, model] = pair.split('=').map((s) => s.trim());
    if (!role || !model) return { refused: `"${pair}" is not role=model`, changed: [], table: [] };
    if (!roles.has(role))
      return {
        refused: `unknown role "${role}" — roles: ${[...roles].toSorted().join(', ')}`,
        changed: [],
        table: [],
      };
    const entry: Binding = { vendor: vendorOf(model), model };
    if (typeof doc.roles[role]?.['enabled'] === 'boolean')
      entry['enabled'] = doc.roles[role]['enabled'];
    if (role === 'implementer') entry['parallel'] = doc.roles[role]?.['parallel'] ?? 4;
    const chk = checkBinding(model, entry.vendor as Vendor['name'], cache);
    if (chk) {
      if (chk.unverified) entry['unverified'] = true;
      if (chk.note) entry['note'] = chk.note;
    } else if (!CONFIRMED_MODELS.has(model)) entry['unverified'] = true;
    if (JSON.stringify(doc.roles[role]) !== JSON.stringify(entry)) {
      doc.roles[role] = entry;
      if (!changed.includes(role)) changed.push(role);
    }
  }

  if (changed.length)
    writeFileSync(
      path,
      `# generated by reins — change with \`reins configure bindings\`\n${stringify(doc)}`,
    );
  const wrote = changed.length > 0;
  toggle('global');
  if (toggled.length > 0) doc = parse(readFileSync(path, 'utf8')) as BindingsDoc;
  const generated =
    wrote || toggled.length ? writeGenerated(root, generateVendorFiles(root), false) : undefined;
  return {
    changed,
    toggled,
    table: teamTable(),
    generated,
    resolved: resolveBindings(root, detect),
  };
}

export interface ConfigureGatesOptions {
  cwd?: string;
  /** names of proposals to append to gates.yaml */
  add?: string[];
}

export interface ConfigureGatesResult {
  /** 2: cannot run; 1: an unknown name (file untouched) */
  refused?: string;
  code?: 1 | 2;
  /** proposals not yet in gates.yaml */
  available: SubdirGate[];
  added: string[];
}

/** `reins configure gates [--add <name>…]` (spec S-7): subdirectory proposals, appended after the existing gates. */
export function configureGates(o: ConfigureGatesOptions = {}): ConfigureGatesResult {
  const root = repoRoot(o.cwd ?? process.cwd());
  const path = join(root, '.agents/harness/gates.yaml');
  if (!existsSync(path))
    return { refused: 'no gates.yaml — run reins install', code: 2, available: [], added: [] };
  const doc = parseDocument(readFileSync(path, 'utf8'));
  const have = new Set<string>(
    Object.keys((doc.toJS() as { gates?: Record<string, unknown> } | null)?.gates ?? {}),
  );
  const available = subdirProposals(root).filter((g) => !have.has(g.name));
  const names = o.add ?? [];
  const unknown = names.filter((n) => !available.some((g) => g.name === n));
  if (unknown.length)
    return {
      refused: `no such proposal: ${unknown.join(', ')} — available: ${available.map((g) => g.name).join(', ') || 'none'}`,
      code: 1,
      available,
      added: [],
    };
  const added: string[] = [];
  for (const n of new Set(names)) {
    const g = available.find((x) => x.name === n)!;
    doc.setIn(['gates', g.name], doc.createNode({ cmd: g.cmd, from: g.from }));
    if (doc.has('order')) doc.addIn(['order'], g.name);
    else doc.set('order', doc.createNode([g.name]));
    added.push(g.name);
  }
  if (added.length) writeFileSync(path, doc.toString());
  return { available: available.filter((g) => !added.includes(g.name)), added };
}
