import { gatesScreen } from './config-gates.js';
import { effectiveBindings, resolveRoles, type BindingsV2, type Group } from '../lib/bindings.js';
import { newModelCache, vendors, type ModelCache, type Vendor } from '../lib/detect.js';
import { repoRoot } from '../lib/git.js';
import { groupLine, modelsScreen } from './config-models.js';
import { configureBindings } from './configure.js';
import { LOCAL_DELEGATION_NOTE } from '../lib/local-delegation.js';
import { clackPrompter, isInteractive, type Prompter } from '../lib/prompter.js';

export interface ConfigOptions {
  cwd?: string;
  json?: boolean;
  /** Defaults to stdin and stdout both being a TTY. */
  interactive?: boolean;
  /** Defaults to the real prompter, loaded only when a screen is drawn. */
  prompter?: Prompter;
  detectVendors?: () => Vendor[];
  /** Lists vendor models (google, cursor); inject `run` to avoid spawning a CLI. */
  modelCache?: ModelCache;
  write?: (s: string) => void;
}

export const CONFIG_HINT =
  'change with: reins config bindings --set <group|group.role>=<model> [--fallback <group|group.role>=<model|none>] [--local]  (see: reins config bindings --help)';

/** The effective settings as text: mode, audit, each role that is on. */
export function formatBindings(doc: BindingsV2): string {
  const lines = [
    `  mode: ${doc.mode ?? 'single'}`,
    `  audit: ${doc.audit?.required === false ? 'off (switched off by the user)' : 'required every version'}`,
    '  PM: the model in the conversation',
  ];
  const on = resolveRoles(doc).filter((r) => r.on);
  if (on.length === 0) lines.push('  every role: the PM');
  if (doc.mode !== 'multi') {
    const kept = Object.entries(doc.groups ?? {}).filter(
      ([, s]) => s && JSON.stringify(s) !== '{}',
    );
    for (const [g, s] of kept)
      lines.push(
        `  ${g.padEnd(26)} ${groupLine(g as Group, s, doc.mode)
          .slice(12)
          .trim()}`,
      );
  }
  for (const r of on)
    lines.push(
      `  ${`${r.group}/${r.role}`.padEnd(26)} ${r.models.map((b) => `${b.vendor} ${b.model}`).join(', ')} (${r.source})${r.fallback ? ` — fallback: ${r.fallback.vendor} ${r.fallback.model}` : ''}`,
    );
  const tools = Object.entries(doc.tools ?? {})
    .map(([n, t]) => `${n}${t?.use === false ? ' (unused)' : ''}`)
    .join(', ');
  if (tools) lines.push(`  tools: ${tools}`);
  return lines.join('\n');
}

/** `reins config` (design §9): the settings screen on a terminal, the effective table otherwise. Returns the exit code. */
export async function runConfig(o: ConfigOptions = {}): Promise<number> {
  const write = o.write ?? ((s: string) => void process.stdout.write(s));
  const root = repoRoot(o.cwd ?? process.cwd());
  const interactive = o.interactive ?? isInteractive();
  if (!interactive || o.json) {
    const doc = effectiveBindings(root);
    if (!doc) {
      write('no version-2 bindings.yaml — run `reins install` or `reins update`\n');
      return 2;
    }
    if (o.json) write(`${JSON.stringify({ bindings: doc, roles: resolveRoles(doc) }, null, 2)}\n`);
    else write(`${formatBindings(doc)}\n${CONFIG_HINT}\n`);
    return 0;
  }
  const prompter = o.prompter ?? (await clackPrompter());
  const modelCache = o.modelCache ?? newModelCache();
  const detect = o.detectVendors ?? vendors;
  for (;;) {
    const doc = effectiveBindings(root);
    const v = await prompter.select<'models' | 'tools' | 'mode' | 'audit' | 'gates' | 'exit'>({
      message: 'Configuration',
      options: [
        { value: 'models', label: 'models and roles configuration' },
        { value: 'tools', label: 'agent tools', hint: 'detect again, use or not' },
        { value: 'mode', label: `mode: ${doc?.mode ?? 'single'}` },
        {
          value: 'audit',
          label: `audit: ${doc?.audit?.required === false ? 'off' : 'required'}`,
        },
        { value: 'gates', label: 'gates', hint: 'the project checks: see them, find them again' },
        { value: 'exit', label: 'exit' },
      ],
    });
    if (typeof v !== 'string' || v === 'exit') return 0; // EXIT (Ctrl-C) or BACK: nothing more is written
    if (v === 'models') {
      const r = await modelsScreen({ root, prompter, detectVendors: detect, modelCache });
      if (r === 'exit') return 0;
      continue;
    }
    if (v === 'gates') {
      if ((await gatesScreen(root, prompter)) === 'exit') return 0;
      continue;
    }
    if (v === 'tools') {
      const found = detect();
      const picked = await prompter.multiselect<string>({
        message: 'Agent tools to use (detected tools are marked)',
        options: found.map((t) => ({
          value: t.name,
          label: t.name,
          hint: t.detected ? `detected (${t.cli})` : `not found (${t.cli})`,
        })),
        initial: found.filter((t) => doc?.tools?.[t.name]?.use ?? t.detected).map((t) => t.name),
      });
      if (typeof picked === 'symbol') return 0;
      const r = await configureBindings({
        cwd: root,
        detect: true,
        detectVendors: () => found,
        tools: found.map((t) => `${t.name}=${picked.includes(t.name) ? 'on' : 'off'}`),
      });
      prompter.note(
        r.refused ? `not changed: ${r.refused}` : 'agent tools written — commit bindings.yaml',
      );
      if (r.localDelegation) prompter.note(LOCAL_DELEGATION_NOTE(r.localDelegation));
      continue;
    }
    if (v === 'mode') {
      const m = await prompter.select<'single' | 'multi'>({
        message: 'Mode',
        initial: doc?.mode ?? 'single',
        options: [
          { value: 'single', label: 'single', hint: 'the PM does every role (default)' },
          { value: 'multi', label: 'multi', hint: 'role groups with a model do their work' },
        ],
      });
      if (typeof m === 'symbol') return 0;
      const r = await configureBindings({ cwd: root, mode: m });
      prompter.note(
        r.refused
          ? `not changed: ${r.refused}`
          : r.modeChanged
            ? `mode ${m}: AGENTS.md has a mode-changed note — the PM checks the project sections in the next conversation`
            : `mode ${m}: already so`,
      );
      if (r.localDelegation) prompter.note(LOCAL_DELEGATION_NOTE(r.localDelegation));
      continue;
    }
    const off = doc?.audit?.required !== false;
    if (off) {
      const sure = await prompter.confirm({
        message: 'Switch the per-version audit off? Nothing will check that the flow was followed.',
        initial: false,
      });
      if (sure !== true) continue;
    }
    const r = await configureBindings({ cwd: root, audit: off ? 'off' : 'on' });
    prompter.note(r.refused ? `not changed: ${r.refused}` : `audit ${off ? 'off' : 'required'}`);
    if (r.localDelegation) prompter.note(LOCAL_DELEGATION_NOTE(r.localDelegation));
  }
}
