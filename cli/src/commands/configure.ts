import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isScalar, isSeq, parse, parseDocument, type Document } from 'yaml';
import {
  discoverGates,
  subdirProposals,
  vendorOf,
  vendors,
  type SubdirGate,
  type Vendor,
} from '../lib/detect.js';
import { applicable, diffGates, type FileGate, type GateDiff } from '../lib/gate-refresh.js';
import {
  GROUP_ROLES,
  GROUPS,
  effectiveBindings,
  fallbackProblems,
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
import { syncLocalDelegation } from '../lib/local-delegation.js';

export type Scope = 'local' | 'project';

export interface ConfigureBindingsOptions {
  cwd?: string;
  /** `target=model` or `target=vendor:model`; target is `default` (the PM), `<group>` or `<group>.<role>` */
  set?: string[];
  /** `<group>=m1,m2` — several models (pl and advisor) */
  models?: string[];
  /** switch these groups off (the PM does their work) */
  off?: string[];
  /** `<group>=model`, `<group>.<role>=model`, or `=none` to clear — what to call when that model cannot be called */
  fallback?: string[];
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
  /** `.loctx/delegation.local.md` was written or removed (spec 020 S-1) */
  localDelegation?: 'written' | 'removed';
}

/** A model given alone, or `vendor:model`. */
export function parseBinding(v: string): Binding | null {
  const s = v.trim();
  if (!s) return null;
  const i = s.indexOf(':');
  if (i < 0) return { vendor: vendorOf(s), model: s };
  // `vendor:` or `:model` names no model: the personal file is not schema-checked, so refuse it here
  const vendor = s.slice(0, i).trim();
  const model = s.slice(i + 1).trim();
  return vendor && model ? { vendor, model } : null;
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
        // a new model keeps the role's fallback; the check below refuses it when they are now the same
        const kept = spec.roles?.[role]?.fallback;
        spec.roles = { ...spec.roles, [role]: kept ? { ...b, fallback: kept } : b };
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
  // fallbacks last, so they are checked against the models this same call set
  for (const pair of o.fallback ?? []) {
    const eq = pair.indexOf('=');
    const target = pair.slice(0, eq).trim();
    const value = eq > 0 ? pair.slice(eq + 1).trim() : '';
    const b = value === 'none' ? null : parseBinding(value);
    if (!target || (!b && value !== 'none')) return refuse(`"${pair}" is not target=model|none`);
    const [g, role] = target.split('.');
    const group = groupOf(g ?? '');
    if (!group) return refuse(`unknown group "${g}" — groups: ${GROUPS.join(', ')}`);
    const where = o.local ? 'your personal file' : 'bindings.yaml';
    next.groups = { ...next.groups };
    const spec = { ...next.groups[group] };
    if (role) {
      if (!GROUP_ROLES[group].includes(role))
        return refuse(
          `unknown role "${role}" in ${group} — roles: ${GROUP_ROLES[group].join(', ') || group}`,
        );
      const own = spec.roles?.[role];
      if (!own)
        return b
          ? refuse(
              `${group}.${role} has no model of its own in ${where} — set it with --set ${group}.${role}=<model>, or give the group a fallback`,
            )
          : refuse(`${group}.${role} has no fallback to clear in ${where}`);
      if (!b && !own.fallback)
        return refuse(`${group}.${role} has no fallback to clear in ${where}`);
      const { fallback: _old, ...rest } = own;
      spec.roles = { ...spec.roles, [role]: b ? { ...rest, fallback: b } : rest };
    } else {
      if (b && !spec.vendor && !spec.models?.length)
        return refuse(
          `${group} has no model in ${where} — set it with --set ${group}=<model> first (a fallback goes with the model beside it)`,
        );
      // clearing what is not there must not write an empty group: in the personal file `{}` switches
      // the team's group off for that person
      if (!b && !spec.fallback) return refuse(`${group} has no fallback to clear in ${where}`);
      if (b) spec.fallback = b;
      else delete spec.fallback;
    }
    next.groups[group] = spec;
    changed.push(`${target} fallback`);
  }
  const wrong = fallbackProblems(next);
  if (wrong.length) return refuse(wrong.join('; '));
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
  const local = syncLocalDelegation(root);
  if (o.local) return { changed, doc, roles: resolveRoles(doc), localDelegation: local };
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
    localDelegation: local,
  };
}

export interface ConfigureGatesOptions {
  cwd?: string;
  /** names of proposals to append to gates.yaml */
  add?: string[];
  /** run the discovery of installation again and report how gates.yaml differs from it */
  refresh?: boolean;
  /** with `refresh`: the differences to apply, by the name the report shows, or `all` */
  apply?: string[];
}

export interface ConfigureGatesResult {
  /** 2: cannot run; 1: an unknown name (file untouched) */
  refused?: string;
  code?: 1 | 2;
  /** proposals not yet in gates.yaml */
  available: SubdirGate[];
  added: string[];
  /** `refresh`: every difference found (before applying) */
  diff?: GateDiff[];
  /** `refresh`: the names applied */
  applied?: string[];
}

const GATES = '.agents/harness/gates.yaml';

/** The gates of a `gates.yaml` document, in its order (gates missing from `order` follow). */
export function fileGates(text: string): FileGate[] {
  const g = parse(text) as {
    gates?: Record<string, { cmd?: string; from?: string; optional?: boolean } | null>;
    order?: string[];
  } | null;
  const gates = g?.gates ?? {};
  const names = [...new Set([...(g?.order ?? []), ...Object.keys(gates)])];
  return names
    .filter((n) => gates[n]?.cmd)
    .map((n) => ({
      name: n,
      cmd: gates[n]!.cmd!,
      ...(gates[n]!.from ? { from: gates[n]!.from } : {}),
      ...(gates[n]!.optional ? { optional: true } : {}),
    }));
}

/**
 * Put a gate that was just added to `gates` at the end of `order`. A file without `order` runs its gates
 * in the order they are written, so the list starts from those — never from the new gate alone.
 */
function appendOrder(doc: Document, name: string): void {
  if (isSeq(doc.get('order'))) {
    doc.addIn(['order'], name);
    return;
  }
  const gates = (doc.toJS() as { gates?: Record<string, unknown> } | null)?.gates ?? {};
  doc.set('order', doc.createNode([...Object.keys(gates).filter((n) => n !== name), name]));
}

/** How gates.yaml differs from what the discovery of installation finds now (design §9). */
export function gateDiff(root: string): GateDiff[] | null {
  const path = join(root, GATES);
  if (!existsSync(path)) return null;
  const found = discoverGates(root);
  return diffGates(root, fileGates(readFileSync(path, 'utf8')), [
    ...found.gates,
    ...found.proposals,
  ]);
}

/**
 * `reins config gates` (design §9). `--add <name>…` appends subdirectory proposals. `--refresh` runs the
 * discovery again and reports the differences; `--apply <name…|all>` applies the chosen ones: a new gate is
 * appended, a changed one gets its command and source, a gone one is removed. Comments and other keys stay,
 * a gate written by hand is never touched, and the gate script is rewritten when the file changes.
 */
export function configureGates(o: ConfigureGatesOptions = {}): ConfigureGatesResult {
  const root = repoRoot(o.cwd ?? process.cwd());
  const path = join(root, GATES);
  if (!existsSync(path))
    return { refused: 'no gates.yaml — run reins install', code: 2, available: [], added: [] };
  const doc = parseDocument(readFileSync(path, 'utf8'));
  const have = new Set<string>(
    Object.keys((doc.toJS() as { gates?: Record<string, unknown> } | null)?.gates ?? {}),
  );
  const available = subdirProposals(root).filter((g) => !have.has(g.name));
  if (o.refresh || o.apply) {
    const diff = gateDiff(root) ?? [];
    const can = applicable(diff);
    // every name is checked, `all` beside others too: one unknown name refuses the whole call
    const asked = [...new Set(o.apply ?? [])];
    const unknown = asked.filter((n) => n !== 'all' && !can.some((d) => d.name === n));
    const names = asked.includes('all') ? can.map((d) => d.name) : asked;
    if (unknown.length)
      return {
        refused: `nothing to apply under: ${unknown.join(', ')} — names: ${can.map((d) => d.name).join(', ') || 'none'}`,
        code: 1,
        available,
        added: [],
        diff,
        applied: [],
      };
    for (const n of names) {
      const d = can.find((x) => x.name === n)!;
      if (d.kind === 'gone') {
        doc.deleteIn(['gates', d.name]);
        // every occurrence: a name left in `order` without its gate would dangle
        const order = doc.get('order');
        if (isSeq(order))
          for (let i = order.items.length - 1; i >= 0; i--) {
            const x = order.items[i];
            if ((isScalar(x) ? x.value : x) === d.name) order.delete(i);
          }
      } else if (d.kind === 'changed') {
        doc.setIn(['gates', d.name, 'cmd'], d.cmd);
        doc.setIn(['gates', d.name, 'from'], d.from);
      } else {
        doc.setIn(
          ['gates', d.name],
          doc.createNode({ cmd: d.cmd, from: d.from, ...(d.optional ? { optional: true } : {}) }),
        );
        appendOrder(doc, d.name);
      }
    }
    if (names.length) {
      writeFileSync(path, doc.toString());
      writeGenerated(root, generateVendorFiles(root), false);
    }
    return {
      available: available.filter((g) => !names.includes(g.name)),
      added: [],
      diff,
      applied: names,
    };
  }
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
    appendOrder(doc, g.name);
    added.push(g.name);
  }
  if (added.length) {
    writeFileSync(path, doc.toString());
    // the gate script holds the commands of gates.yaml (design §6): it follows the file
    writeGenerated(root, generateVendorFiles(root), false);
  }
  return { available: available.filter((g) => !added.includes(g.name)), added };
}
