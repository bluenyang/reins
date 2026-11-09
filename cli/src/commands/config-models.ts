import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { packageHarness } from '../lib/upstream.js';
import {
  CONFIRMED_MODELS,
  listModels,
  vendorOf,
  type ModelCache,
  type Vendor,
} from '../lib/detect.js';
import {
  GROUP_ROLES,
  GROUPS,
  effectiveBindings,
  readLocalBindings,
  readTeam,
  type Binding,
  type BindingsV2,
  type Group,
  type GroupSpec,
} from '../lib/bindings.js';
import { BACK, EXIT, type Option, type Prompter } from '../lib/prompter.js';
import { configureBindings, type ConfigureBindingsOptions, type Scope } from './configure.js';

export interface ModelsScreenOptions {
  root: string;
  prompter: Prompter;
  detectVendors: () => Vendor[];
  modelCache: ModelCache;
}

const LISTER_CLI = { google: 'agy', cursor: 'cursor-agent' } as const;

/** When switching a group on pays for itself (design §9; Anthropic 2026-10-22). */
export const WHEN_TO_SWITCH_ON =
  'switch a group on when the PM context degrades, independent work can run in parallel, or review/audit should run on another model';

const show = (b: Binding | undefined) => (b ? `${b.vendor} ${b.model}` : 'off (PM)');

/** One line per group: `pl  claude claude-sonnet-5-5, openai gpt-6.1-terra  +1 role`. */
export function groupLine(group: Group, spec: GroupSpec | undefined, mode?: string): string {
  if (!spec) return `${group.padEnd(12)} off — the PM does it`;
  const tag =
    mode === 'multi'
      ? ''
      : group === 'auditor'
        ? '  (recommended audit model)'
        : '  (used in multi only)';
  const models = spec.models?.length
    ? spec.models.map(show).join(', ')
    : spec.vendor && spec.model
      ? show({ vendor: spec.vendor, model: spec.model })
      : '—';
  const n = Object.keys(spec.roles ?? {}).length;
  return `${group.padEnd(12)} ${models}${n ? `  +${n} role${n > 1 ? 's' : ''}` : ''}${tag}`;
}

/** The packaged list of known models per vendor (`harness/models.yaml`, spec ST-2). */
export function catalogue(): Record<string, string[]> {
  const p = join(packageHarness(), 'models.yaml');
  if (!existsSync(p)) return {};
  const doc = parse(readFileSync(p, 'utf8')) as { vendors?: Record<string, string[]> } | null;
  return doc?.vendors ?? {};
}

/** Models of `vendor` known here: the packaged list, confirmed ones and those in the current files. */
export function knownModels(vendor: string, current: BindingsV2[]): string[] {
  const out: string[] = [...(catalogue()[vendor] ?? []), ...CONFIRMED_MODELS];
  for (const d of current) {
    if (d.default) out.push(d.default.model);
    for (const g of Object.values(d.groups ?? {})) {
      if (!g) continue;
      if (g.model) out.push(g.model);
      for (const m of g.models ?? []) out.push(m.model);
      for (const r of Object.values(g.roles ?? {})) out.push(r.model);
    }
  }
  const listed = new Set(catalogue()[vendor] ?? []);
  return [...new Set(out)].filter((m) => listed.has(m) || vendorOf(m) === vendor);
}

/**
 * The models-and-roles screen (design §9): scope, the PM's model, each group (off, one model, several for
 * pl and advisor, per-role models). Every choice is written at once through `configureBindings`.
 * Returns `exit` when the user left reins config, `back` for `< Configuration`.
 */
export async function modelsScreen(o: ModelsScreenOptions): Promise<'back' | 'exit'> {
  const { root, prompter } = o;
  let scope: Scope = 'local';
  const write = async (opts: Omit<ConfigureBindingsOptions, 'cwd' | 'local'>, label: string) => {
    const r = await configureBindings({ cwd: root, local: scope === 'local', ...opts });
    if (r.refused) prompter.note(`not changed: ${r.refused}`);
    else if (r.changed.length === 0) prompter.note(`${label}: already so — nothing changed`);
    else if (scope === 'local')
      prompter.note(`${label}: written to .loctx/bindings.local.yaml (this user only)`);
    else
      prompter.note(
        `${label}: written to .agents/harness/bindings.yaml, generated files and AGENTS.md refreshed — commit them`,
      );
  };

  for (;;) {
    const doc = effectiveBindings(root);
    if (!doc) {
      prompter.note('no version-2 bindings.yaml here — run `reins install` or `reins update`');
      return 'back';
    }
    const single = doc.mode !== 'multi';
    prompter.note(
      single
        ? 'single: the PM does every role; the assignments below are used only after switching to multi (the auditor model is the recommended audit model either way)'
        : WHEN_TO_SWITCH_ON,
    );
    const options: Option<string>[] = [
      { value: 'back', label: '< Configuration' },
      { value: 'exit', label: 'exit' },
      {
        value: 'scope',
        label: `scope: ${scope === 'local' ? 'local | project' : 'project | local'}`,
      },
      { value: 'default', label: `${'PM'.padEnd(12)} ${show(doc.default)}` },
      ...GROUPS.map((g) => ({ value: g, label: groupLine(g, doc.groups?.[g], doc.mode) })),
    ];
    const v = await prompter.select<string>({
      message: `Models and roles (mode: ${doc.mode ?? 'single'})`,
      options,
    });
    if (v === EXIT || v === 'exit') return 'exit';
    if (v === BACK || v === 'back') return 'back';
    if (v === 'scope') {
      const s: Scope | typeof BACK | typeof EXIT = await prompter.select<Scope>({
        message: 'Write changes to',
        initial: scope,
        options: [
          { value: 'local', label: 'local', hint: '.loctx/bindings.local.yaml, this user only' },
          {
            value: 'project',
            label: 'project',
            hint: 'the team: .agents/harness/bindings.yaml, committed, regenerates files',
          },
        ],
      });
      if (s === EXIT) return 'exit';
      if (s !== BACK) scope = s;
      continue;
    }
    if (v === 'default') {
      const b = await pickModel(o, 'PM', doc.default);
      if (b === EXIT) return 'exit';
      if (b) await write({ set: [`default=${b.vendor}:${b.model}`] }, `PM → ${show(b)}`);
      continue;
    }
    const r = await groupScreen(o, v as Group, doc.groups?.[v as Group], write);
    if (r === 'exit') return 'exit';
  }
}

async function groupScreen(
  o: ModelsScreenOptions,
  group: Group,
  spec: GroupSpec | undefined,
  write: (opts: Omit<ConfigureBindingsOptions, 'cwd' | 'local'>, label: string) => Promise<void>,
): Promise<'back' | 'exit'> {
  const { prompter } = o;
  const many = group === 'pl' || group === 'advisor';
  const roles = GROUP_ROLES[group];
  const pick = await prompter.select<string>({
    message: `${group}: ${groupLine(group, spec).slice(12).trim()}`,
    options: [
      { value: 'back', label: '< back' },
      { value: 'one', label: many ? 'one model' : 'set the model' },
      ...(many ? [{ value: 'many', label: 'several models', hint: 'first = control (pl)' }] : []),
      ...(roles.length ? [{ value: 'role', label: 'a model for one role' }] : []),
      { value: 'off', label: 'switch off', hint: 'the PM does it' },
    ],
  });
  if (pick === EXIT) return 'exit';
  if (pick === BACK || pick === 'back') return 'back';
  if (pick === 'off') {
    await write({ off: [group] }, `${group} off`);
    return 'back';
  }
  if (pick === 'one') {
    const b = await pickModel(
      o,
      group,
      spec?.vendor && spec.model ? { vendor: spec.vendor, model: spec.model } : spec?.models?.[0],
    );
    if (b === EXIT) return 'exit';
    if (b) await write({ set: [`${group}=${b.vendor}:${b.model}`] }, `${group} → ${show(b)}`);
    return 'back';
  }
  if (pick === 'many') {
    const list: Binding[] = [];
    for (;;) {
      const b = await pickModel(o, `${group} #${list.length + 1}`, undefined);
      if (b === EXIT) return 'exit';
      if (!b) break;
      list.push(b);
      const more = await prompter.confirm({ message: 'Add another model?', initial: false });
      if (more === EXIT) return 'exit';
      if (more !== true) break;
    }
    if (list.length)
      await write(
        { models: [`${group}=${list.map((b) => `${b.vendor}:${b.model}`).join(',')}`] },
        `${group} → ${list.map(show).join(', ')}`,
      );
    return 'back';
  }
  const role = await prompter.select<string>({
    message: `${group}: which role`,
    options: [
      { value: 'back', label: '< back' },
      ...roles.map((r) => ({ value: r, label: r, hint: show(spec?.roles?.[r]) })),
    ],
  });
  if (role === EXIT) return 'exit';
  if (role === BACK || role === 'back') return 'back';
  const b = await pickModel(o, `${group}.${role}`, spec?.roles?.[role]);
  if (b === EXIT) return 'exit';
  if (b)
    await write(
      { set: [`${group}.${role}=${b.vendor}:${b.model}`] },
      `${group}.${role} → ${show(b)}`,
    );
  return 'back';
}

/** Tool (used tools only), then model. Returns the binding, `undefined` for back, or EXIT. */
async function pickModel(
  o: ModelsScreenOptions,
  label: string,
  current: Binding | undefined,
): Promise<Binding | typeof EXIT | undefined> {
  const { prompter, root } = o;
  const team = readTeam(root).doc;
  const local = readLocalBindings(root);
  const docs = [team, local].filter((d): d is BindingsV2 => !!d);
  const used = Object.entries(effectiveBindings(root)?.tools ?? { claude: { use: true } })
    .filter(([, t]) => t?.use !== false)
    .map(([n]) => n);
  if (!used.includes('claude')) used.unshift('claude');
  for (;;) {
    const vendor = await prompter.select<string>({
      message: `${label}: tool`,
      initial: current?.vendor,
      options: [{ value: 'back', label: '< back' }, ...used.map((v) => ({ value: v, label: v }))],
    });
    if (vendor === EXIT) return EXIT;
    if (vendor === BACK || vendor === 'back') return undefined;
    let ids = knownModels(vendor, docs);
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
        message: `${label}: ${vendor} model`,
        initial: current?.model,
        options: [
          { value: 'back', label: '< back' },
          ...ids.map((m) => ({
            value: m,
            label: m,
            ...(m === current?.model ? { hint: 'current' } : {}),
          })),
          { value: 'other', label: 'other (type a model ID)' },
        ],
      });
      if (pick === EXIT) return EXIT;
      if (pick === BACK || pick === 'back') break;
      if (pick !== 'other') return { vendor, model: pick };
      const t = await prompter.text({ message: 'Model ID' });
      if (t === EXIT) return EXIT;
      if (t === BACK || !t.trim()) continue;
      return { vendor, model: t.trim() };
    }
  }
}
