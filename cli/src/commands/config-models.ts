import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIRMED_MODELS,
  listModels,
  vendorOf,
  type ModelCache,
  type Vendor,
} from '../lib/detect.js';
import {
  FIXED_ROLES,
  readLocal,
  teamEnabled,
  resolveBindings,
  type ResolvedBinding,
} from '../lib/bindings.js';
import { BACK, EXIT, type Option, type Prompter } from '../lib/prompter.js';
import { splitFrontmatter } from '../lib/skills.js';
import { configureBindings } from './configure.js';

export type Scope = 'local' | 'global';

export interface ModelsScreenOptions {
  root: string;
  prompter: Prompter;
  detectVendors: () => Vendor[];
  modelCache: ModelCache;
}

const LISTER_CLI = { google: 'agy', cursor: 'cursor-agent' } as const;

/** One line per role: `[ON] planner  claude claude-opus-5-5 (team)`; `(local)` marks a value of this user's own. */
export function roleLine(b: ResolvedBinding, scope: Scope): string {
  const mark = scope === 'local' && b.enabled_source === 'local' ? ' state (local)' : '';
  const fixed = b.enabled_source === 'fixed' ? ' always on' : '';
  return `[${b.enabled ? 'ON ' : 'OFF'}] ${b.role.padEnd(12)} ${b.vendor.padEnd(7)} ${b.model} (${b.source})${mark}${fixed}`;
}

/** Models of `vendor` already known to this repository: role defaults and fallbacks, confirmed, current. */
export function knownModels(root: string, vendor: Vendor['name'], current: string[]): string[] {
  const out: string[] = [];
  const dir = join(root, '.agents/harness/roles');
  if (existsSync(dir))
    for (const f of readdirSync(dir)
      .filter((x) => x.endsWith('.md'))
      .toSorted()) {
      const { data } = splitFrontmatter(readFileSync(join(dir, f), 'utf8'));
      for (const k of ['default_binding', 'fallback_binding'])
        if (typeof data?.[k] === 'string') out.push(data[k]);
    }
  out.push(...CONFIRMED_MODELS, ...current);
  return [...new Set(out)].filter((m) => vendorOf(m) === vendor);
}

/**
 * The models and roles screen (spec S-3) and the role screen under it (S-5). Every choice is written at
 * once through `configureBindings` (the same writer as `reins configure bindings`); EXIT writes nothing more.
 * Returns `exit` when the user left reins config, `back` for `< Configuration`.
 */
export async function modelsScreen(o: ModelsScreenOptions): Promise<'back' | 'exit'> {
  const { root, prompter } = o;
  let scope: Scope = 'local';
  const write = async (
    opts: { set?: string[]; enable?: string[]; disable?: string[] },
    label: string,
  ): Promise<void> => {
    const r = await configureBindings({
      cwd: root,
      local: scope === 'local',
      detectVendors: o.detectVendors,
      modelCache: o.modelCache,
      ...opts,
    });
    if (r.refused) prompter.note(`not changed: ${r.refused}`);
    else if (r.changed.length === 0) prompter.note(`${label}: already so — nothing changed`);
    else if (scope === 'local')
      prompter.note(`${label}: written to .loctx/bindings.local.yaml (this user only)`);
    else
      prompter.note(
        `${label}: written to .agents/harness/bindings.yaml, vendor files regenerated — commit bindings.yaml`,
      );
  };

  for (;;) {
    const rows = resolveBindings(root, o.detectVendors);
    const options: Option<string>[] = [
      { value: 'back', label: '< Configuration' },
      { value: 'exit', label: 'exit' },
      {
        value: 'scope',
        label: `scope: ${scope === 'local' ? 'local | global' : 'global | local'}`,
      },
      { value: 'toggle', label: 'switch roles on or off' },
      ...rows.map((b) => ({ value: b.role, label: roleLine(b, scope) })),
    ];
    const v = await prompter.select<string>({ message: 'Models and roles', options });
    if (v === EXIT) return 'exit';
    if (v === BACK || v === 'back') return 'back';
    if (v === 'exit') return 'exit';
    if (v === 'scope') {
      const s: Scope | typeof BACK | typeof EXIT = await prompter.select<Scope>({
        message: 'Write changes to',
        initial: scope,
        options: [
          { value: 'local', label: 'local', hint: '.loctx/bindings.local.yaml, this user only' },
          { value: 'global', label: 'global', hint: 'bindings.yaml, committed, regenerates files' },
        ],
      });
      if (s === EXIT) return 'exit';
      if (s !== BACK) scope = s;
      continue;
    }
    if (v === 'toggle') {
      const names = rows.filter((b) => !FIXED_ROLES.includes(b.role));
      prompter.note(`always on: ${FIXED_ROLES.join(', ')}`);
      const on = await prompter.multiselect<string>({
        message: 'Roles that are on',
        initial: names
          .filter((b) => (scope === 'global' ? (teamEnabled(root)[b.role] ?? true) : b.enabled))
          .map((b) => b.role),
        options: names.map((b) => ({ value: b.role, label: b.role })),
      });
      if (on === EXIT) return 'exit';
      if (on === BACK) continue;
      // the list and the diff use the chosen scope's own value: global = the team file, local = effective
      const team = teamEnabled(root);
      const isOn = (b: ResolvedBinding): boolean =>
        scope === 'global' ? (team[b.role] ?? true) : b.enabled;
      const enable = names.filter((b) => !isOn(b) && on.includes(b.role)).map((b) => b.role);
      const disable = names.filter((b) => isOn(b) && !on.includes(b.role)).map((b) => b.role);
      if (enable.length + disable.length > 0)
        await write({ enable, disable }, `roles ${[...enable, ...disable].join(', ')}`);
      continue;
    }
    const row = rows.find((b) => b.role === v);
    if (!row) continue;
    const r = await roleScreen(o, row, scope);
    if (r === EXIT) return 'exit';
    if (r !== undefined) await write({ set: [`${row.role}=${r}`] }, `${row.role} → ${r}`);
  }
}

/** S-5: vendor (detected only), then model. Returns the chosen model ID, `undefined` for back, or EXIT. */
async function roleScreen(
  o: ModelsScreenOptions,
  row: ResolvedBinding,
  scope: Scope,
): Promise<string | typeof EXIT | undefined> {
  const { prompter } = o;
  const detected = o.detectVendors().filter((v) => v.detected || v.name === 'claude');
  for (;;) {
    const vendor = await prompter.select<string>({
      message: `${row.role} (${scope}): vendor`,
      initial: row.vendor,
      options: [
        { value: 'back', label: '< back' },
        ...detected.map((v) => ({ value: v.name as string, label: v.name })),
      ],
    });
    if (vendor === EXIT) return EXIT;
    if (vendor === BACK || vendor === 'back') return undefined;
    const model = await modelPicker(o, row, vendor as Vendor['name']);
    if (model === EXIT) return EXIT;
    if (model === undefined) continue; // back to the vendor list
    return model;
  }
}

async function modelPicker(
  o: ModelsScreenOptions,
  row: ResolvedBinding,
  vendor: Vendor['name'],
): Promise<string | typeof EXIT | undefined> {
  const { prompter, root } = o;
  const team = (
    await configureBindings({ cwd: root, show: true, detectVendors: o.detectVendors })
  ).table.map((t) => t.model);
  const local = Object.values(readLocal(root).roles).flatMap((r) => (r.model ? [r.model] : []));
  let ids = knownModels(root, vendor, [...team, ...local, row.model]);
  if (vendor === 'google' || vendor === 'cursor') {
    let res: ReturnType<typeof listModels>;
    try {
      res = listModels(vendor, o.modelCache.run);
    } catch (e) {
      res = { failed: (e as Error).message };
    }
    if ('failed' in res)
      prompter.note(`${LISTER_CLI[vendor]} models failed (${res.failed}) — showing known models`);
    else ids = res.ids;
  }
  for (;;) {
    const pick = await prompter.select<string>({
      message: `${row.role}: ${vendor} model`,
      initial: row.model,
      options: [
        { value: 'back', label: '< back' },
        ...ids.map((m) => ({
          value: m,
          label: m,
          ...(m === row.model ? { hint: 'current' } : {}),
        })),
        { value: 'other', label: 'other (type a model ID)' },
      ],
    });
    if (pick === EXIT) return EXIT;
    if (pick === BACK || pick === 'back') return undefined;
    if (pick !== 'other') return pick;
    const t = await prompter.text({ message: 'Model ID' });
    if (t === EXIT) return EXIT;
    if (t === BACK || !t.trim()) continue;
    return t.trim();
  }
}
