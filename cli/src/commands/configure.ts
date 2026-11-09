import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, parseDocument } from 'yaml';
import { subdirProposals, vendorOf, vendors, type SubdirGate, type Vendor } from '../lib/detect.js';
import {
  GROUP_ROLES,
  GROUPS,
  effectiveBindings,
  readLocalBindings,
  readTeam,
  resolveRoles,
  validateBindings,
  writeBindings,
  type Binding,
  type BindingsV2,
  type Group,
  type ResolvedRole,
} from '../lib/bindings.js';
import { modeChangedNote, placeNote, renderBlocks } from '../lib/agents-md.js';
import { applyBlocks } from '../lib/blocks.js';
import { generateVendorFiles } from '../lib/generate.js';
import { repoRoot } from '../lib/git.js';
import { writeGenerated, type GenWriteResult } from '../lib/vendor-write.js';
import { packageHarness } from '../lib/upstream.js';

export type Scope = 'local' | 'project';

export interface ConfigureBindingsOptions {
  cwd?: string;
  /** `target=model` or `target=vendor:model`; target is `default` (the PM), `<group>` or `<group>.<role>` */
  set?: string[];
  /** `<group>=m1,m2` — several models (pl and advisor) */
  models?: string[];
  /** switch these groups off (the PM does their work) */
  off?: string[];
  mode?: 'single' | 'multi';
  /** `on` | `off` — whether the per-version audit is required */
  audit?: 'on' | 'off';
  /** `<tool>=on|off` — which agent tools are used */
  tools?: string[];
  /** re-detect the agent tools and record what is on PATH */
  detect?: boolean;
  /** write the personal override `.loctx/bindings.local.yaml` (no regeneration) */
  local?: boolean;
  /** only report the effective table */
  show?: boolean;
  detectVendors?: () => Vendor[];
}

export interface ConfigureResult {
  refused?: string;
  /** 1 = a bad name (nothing written), 2 = cannot run */
  code?: 1 | 2;
  changed: string[];
  /** the effective settings after the call (team + personal override) */
  doc?: BindingsV2;
  roles: ResolvedRole[];
  generated?: GenWriteResult;
  /** the mode changed: AGENTS.md got a mode-changed note (spec ST-5) */
  modeChanged?: boolean;
}

/** A model given alone, or `vendor:model`. */
export function parseBinding(v: string): Binding | null {
  const s = v.trim();
  if (!s) return null;
  const i = s.indexOf(':');
  if (i > 0) return { vendor: s.slice(0, i), model: s.slice(i + 1) };
  return { vendor: vendorOf(s), model: s };
}

/** Rewrite AGENTS.md's managed blocks for these settings (design §5); a mode change adds the light mode-changed note (ST-5). */
export function refreshAgents(root: string, doc: BindingsV2, modeFrom?: string): boolean {
  const ap = join(root, 'AGENTS.md');
  if (!existsSync(ap)) return false;
  const before = readFileSync(ap, 'utf8');
  const pin = join(root, '.agents/harness/install.yaml');
  const language = existsSync(pin)
    ? String((parse(readFileSync(pin, 'utf8')) as { language?: string } | null)?.language ?? 'ko')
    : 'ko';
  let text = applyBlocks(before, renderBlocks(packageHarness(), doc, language)).text;
  if (modeFrom !== undefined) {
    // a pending note from an earlier switch is replaced by one that names the latest change
    text = text.replace(
      /<!-- reins:mode-changed (?:pending|done) -->\n(?:> \*\*Mode changed from [^\n]*\n)?\n?/,
      '',
    );
    text = placeNote(text, modeChangedNote(modeFrom, doc.mode ?? 'single'), 'mode-changed');
  }
  if (text !== before) writeFileSync(ap, text);
  return text !== before;
}

/** `reins config bindings` (design §9): the flag form of the models-and-roles screen. */
export async function configureBindings(o: ConfigureBindingsOptions): Promise<ConfigureResult> {
  const root = repoRoot(o.cwd ?? process.cwd());
  const team = readTeam(root);
  if (!team.doc)
    return {
      refused: team.v1
        ? 'bindings.yaml is version 1 — run `reins update` to convert it'
        : 'no bindings.yaml — run `reins install` first',
      code: 2,
      changed: [],
      roles: [],
    };
  const effective = () => effectiveBindings(root)!;
  if (o.show) {
    const doc = effective();
    return { changed: [], doc, roles: resolveRoles(doc) };
  }
  const base: Partial<BindingsV2> = o.local
    ? (readLocalBindings(root) ?? {})
    : structuredClone(team.doc);
  const next: Partial<BindingsV2> = structuredClone(base);
  const changed: string[] = [];
  const refuse = (why: string): ConfigureResult => ({
    refused: why,
    code: 1,
    changed: [],
    roles: [],
  });
  const groupOf = (name: string): Group | null =>
    (GROUPS as string[]).includes(name) ? (name as Group) : null;

  for (const pair of o.set ?? []) {
    const eq = pair.indexOf('=');
    const target = pair.slice(0, eq).trim();
    const b = eq > 0 ? parseBinding(pair.slice(eq + 1)) : null;
    if (!target || !b) return refuse(`"${pair}" is not target=model`);
    if (target === 'default') {
      next.default = b;
    } else {
      const [g, role] = target.split('.');
      const group = groupOf(g ?? '');
      if (!group) return refuse(`unknown group "${g}" — groups: default, ${GROUPS.join(', ')}`);
      const roles = GROUP_ROLES[group];
      next.groups = { ...next.groups };
      const spec = { ...next.groups[group] };
      if (role) {
        if (!roles.includes(role))
          return refuse(`unknown role "${role}" in ${group} — roles: ${roles.join(', ') || group}`);
        spec.roles = { ...spec.roles, [role]: b };
      } else {
        delete spec.models;
        spec.vendor = b.vendor;
        spec.model = b.model;
      }
      next.groups[group] = spec;
    }
    changed.push(target);
  }
  for (const pair of o.models ?? []) {
    const eq = pair.indexOf('=');
    const group = groupOf(pair.slice(0, eq).trim());
    if (!group || (group !== 'pl' && group !== 'advisor'))
      return refuse(`"${pair}": several models are for pl and advisor only`);
    const list = pair
      .slice(eq + 1)
      .split(',')
      .map(parseBinding)
      .filter((x): x is Binding => x !== null);
    if (!list.length) return refuse(`"${pair}" names no model`);
    next.groups = { ...next.groups };
    const { vendor: _v, model: _m, ...rest } = next.groups[group] ?? {};
    next.groups[group] = { ...rest, models: list };
    changed.push(group);
  }
  for (const name of o.off ?? []) {
    const group = groupOf(name);
    if (!group) return refuse(`unknown group "${name}" — groups: ${GROUPS.join(', ')}`);
    next.groups = { ...next.groups };
    if (o.local) {
      // an empty group in the personal file hides the team's (mergeLocal replaces a group as a whole)
      if (JSON.stringify(next.groups[group]) !== '{}') {
        next.groups[group] = {};
        changed.push(group);
      }
    } else if (next.groups[group]) {
      delete next.groups[group];
      changed.push(group);
    }
  }
  if (o.mode && next.mode !== o.mode) {
    next.mode = o.mode;
    changed.push('mode');
  }
  if (o.audit) {
    const required = o.audit === 'on';
    if ((next.audit?.required ?? true) !== required) {
      next.audit = { ...next.audit, required };
      changed.push('audit');
    }
  }
  if (o.detect || o.tools?.length) {
    const vs = (o.detectVendors ?? vendors)();
    next.tools = { ...next.tools };
    if (o.detect)
      for (const v of vs)
        next.tools[v.name] = {
          ...next.tools[v.name],
          cli: v.cli,
          use: next.tools[v.name]?.use ?? v.detected,
        };
    for (const pair of o.tools ?? []) {
      const [name, state] = pair.split('=').map((s) => s.trim());
      if (!name || (state !== 'on' && state !== 'off'))
        return refuse(`"${pair}" is not tool=on|off`);
      const cli = vs.find((v) => v.name === name)?.cli ?? next.tools[name]?.cli ?? name;
      next.tools[name] = { ...next.tools[name], cli, use: state === 'on' };
    }
    changed.push('tools');
  }

  const problems = o.local ? [] : validateBindings({ ...next, schema: 'reins/bindings@2' });
  if (problems.length) return refuse(`the result would not be valid: ${problems.join('; ')}`);
  const wrote = JSON.stringify(next) !== JSON.stringify(base);
  if (!wrote) {
    const doc = effective();
    return { changed: [], doc, roles: resolveRoles(doc) };
  }
  writeBindings(root, next, o.local ? 'local' : 'project');
  const doc = effective();
  if (o.local) return { changed, doc, roles: resolveRoles(doc) };
  const teamNow = readTeam(root).doc!;
  const from = team.doc.mode ?? 'single';
  const modeChanged = from !== (teamNow.mode ?? 'single');
  const generated = writeGenerated(root, generateVendorFiles(root), false);
  refreshAgents(root, teamNow, modeChanged ? from : undefined);
  return {
    changed,
    doc,
    roles: resolveRoles(doc),
    generated,
    modeChanged: modeChanged || undefined,
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
