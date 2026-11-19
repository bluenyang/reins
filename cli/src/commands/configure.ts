import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
import {
  actionsOf,
  formatGateRow,
  gateStatus,
  type FileGate,
  type GateAction,
  type StatusRow,
} from '../lib/gate-refresh.js';
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
  /** `target=model` or `target=vendor:model`; target is `<group>` or `<group>.<role>` */
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

/**
 * The generated files of one `config` call as report lines: `+` a path that did not exist before the call,
 * `~` one that was rewritten, `-` one removed, and what was left alone and why.
 */
export function formatGenerated(g: GenWriteResult): string[] {
  return [
    ...g.written.map((p) => `  ${g.created.includes(p) ? '+' : '~'} ${p}`),
    ...g.removed.map((p) => `  - ${p}`),
    ...g.refused.map((x) => `• left alone ${x.path}: ${x.why}`),
  ];
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
    if (target === 'default')
      return refuse(
        'the PM is the model in the conversation — there is nothing to set; assign models to the groups that need another one',
      );
    const [g, role] = target.split('.');
    const group = groupOf(g ?? '');
    if (!group) return refuse(`unknown group "${g}" — groups: ${GROUPS.join(', ')}`);
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
      // an empty group in the personal file switches the team's off for this person (mergeLocal, 023 S-20)
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
  // a file from an earlier reins may still name a PM model; it goes when the file is written (design §5)
  if (wrote && next.default) {
    delete next.default;
    changed.push('default removed (the PM is the model in the conversation)');
  }
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
  /**
   * with `refresh`: rows to act on, by the name the report shows (024 S-13) — a candidate is added, a gate
   * with another command found gets it, any other gate is removed; `remove:<name>` removes a gate whatever
   * its state; `all` adds every candidate not applied, and never removes or replaces.
   */
  apply?: string[];
}

export interface ConfigureGatesResult {
  /** 2: cannot run; 1: an unknown name (file untouched) */
  refused?: string;
  code?: 1 | 2;
  /** proposals not yet in gates.yaml */
  available: SubdirGate[];
  added: string[];
  /** `refresh`: every row, before applying (024 S-11) */
  rows?: StatusRow[];
  /** `refresh`: what was applied, as `<action> <name>` */
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

/** The refresh rows of gates.yaml against the discovery (024 S-11), or null without gates.yaml. */
export function gateRows(root: string): StatusRow[] | null {
  const path = join(root, GATES);
  if (!existsSync(path)) return null;
  return gateStatus(root, fileGates(readFileSync(path, 'utf8')), discoverGates(root).candidates);
}

/** Where a refresh leaves its rows for the agent who applies the user's picks (024 S-12). */
export const REFRESH_LIST = '.loctx/gates-refresh.md';

/** Write the rows to `.loctx/gates-refresh.md`, replacing the last list (024 S-12). */
export function writeRefreshList(root: string, rows: StatusRow[]): void {
  const text = readFileSync(join(root, GATES), 'utf8');
  const body = [
    '# gates refresh',
    '',
    `- made: ${new Date().toISOString()}`,
    `- gates.yaml: sha256 ${createHash('sha256').update(text).digest('hex').slice(0, 16)}`,
    '- The user picks from this list; an agent applies the picks to `.agents/harness/gates.yaml` in a commit of its own. The agent does not run reins.',
    '',
    ...rows.map((r) => `- ${formatGateRow(r)}`),
    '',
  ].join('\n');
  mkdirSync(join(root, '.loctx'), { recursive: true });
  writeFileSync(join(root, REFRESH_LIST), body);
}

/** The action a name passed to `--apply` asks for, or null when no row has it (024 S-13). */
function actionFor(
  rows: StatusRow[],
  asked: string,
): { action: GateAction; row: StatusRow } | null {
  const [verb, name] = asked.includes(':')
    ? (asked.split(/:(.*)/s) as [string, string])
    : ['', asked];
  const row = rows.find((r) => r.name === name);
  if (!row) return null;
  const can = actionsOf(row);
  if (verb === '') return { action: can[0]!, row };
  return (can as string[]).includes(verb) ? { action: verb as GateAction, row } : null;
}

/**
 * `reins config gates` (design §9). `--add <name>…` appends offered candidates. `--refresh` runs the discovery
 * again, writes every gate and candidate with its state to `.loctx/gates-refresh.md` (024 S-11, S-12) and, with
 * `--apply <name…|all|remove:name>`, adds, removes or replaces only what is named (S-13). Comments and other keys
 * stay; the gate script reads gates.yaml when it runs, so only gates.yaml changes (S-17).
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
    const rows = gateRows(root) ?? [];
    writeRefreshList(root, rows);
    // every name is checked, `all` beside others too: one unknown name refuses the whole call
    const asked = [...new Set(o.apply ?? [])];
    const unknown = asked.filter((n) => n !== 'all' && !actionFor(rows, n));
    if (unknown.length)
      return {
        refused: `nothing to apply under: ${unknown.join(', ')} — names: ${rows.map((r) => r.name).join(', ') || 'none'}`,
        code: 1,
        available,
        added: [],
        rows,
        applied: [],
      };
    const picks: { action: GateAction; row: StatusRow }[] = asked.includes('all')
      ? rows
          .filter((r) => r.state === 'not applied')
          .map((row) => ({ action: 'add' as const, row }))
      : [];
    for (const n of asked.filter((x) => x !== 'all')) {
      const p = actionFor(rows, n)!;
      if (!picks.some((x) => x.row === p.row)) picks.push(p);
    }
    const applied: string[] = [];
    for (const { action, row } of picks) {
      if (action === 'remove') {
        doc.deleteIn(['gates', row.name]);
        // every occurrence: a name left in `order` without its gate would dangle
        const order = doc.get('order');
        if (isSeq(order))
          for (let i = order.items.length - 1; i >= 0; i--) {
            const x = order.items[i];
            if ((isScalar(x) ? x.value : x) === row.name) order.delete(i);
          }
      } else if (action === 'replace') {
        doc.setIn(['gates', row.name, 'cmd'], row.found!.cmd);
        doc.setIn(['gates', row.name, 'from'], row.found!.from);
      } else {
        doc.setIn(
          ['gates', row.name],
          doc.createNode({
            cmd: row.cmd,
            from: row.from,
            ...(row.optional ? { optional: true } : {}),
          }),
        );
        appendOrder(doc, row.name);
      }
      applied.push(`${action} ${row.name}`);
    }
    // the gate script reads gates.yaml when it runs, so only the file changes (024 S-17)
    if (applied.length) writeFileSync(path, doc.toString({ lineWidth: 0 }));
    return { available, added: [], rows, applied };
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
  if (added.length) writeFileSync(path, doc.toString({ lineWidth: 0 }));
  return { available: available.filter((g) => !added.includes(g.name)), added };
}
