import { resolveBindings, stateLabel, type ResolvedBinding } from '../lib/bindings.js';
import { newModelCache, vendors, type ModelCache, type Vendor } from '../lib/detect.js';
import { repoRoot } from '../lib/git.js';
import { modelsScreen } from './config-models.js';
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
  'change with: reins configure bindings --set <role>=<model> [--local]  (see: reins configure bindings --help)';

export function formatBindings(rows: ResolvedBinding[]): string {
  return rows
    .map(
      (t) =>
        `  ${t.role.padEnd(12)} ${t.vendor.padEnd(7)} ${t.model} (${t.source}: ${t.reason})${stateLabel(t) ? ` ${stateLabel(t)}` : ''}`,
    )
    .join('\n');
}

/** `reins config` (design §9): the settings screen on a terminal, the resolved table otherwise. Returns the exit code. */
export async function runConfig(o: ConfigOptions = {}): Promise<number> {
  const write = o.write ?? ((s: string) => void process.stdout.write(s));
  const root = repoRoot(o.cwd ?? process.cwd());
  const interactive = o.interactive ?? isInteractive();
  if (!interactive || o.json) {
    const bindings = resolveBindings(root, o.detectVendors);
    if (o.json) write(`${JSON.stringify({ bindings }, null, 2)}\n`);
    else write(`${formatBindings(bindings)}\n${CONFIG_HINT}\n`);
    return 0;
  }
  const prompter = o.prompter ?? (await clackPrompter());
  const modelCache = o.modelCache ?? newModelCache();
  const detect = o.detectVendors ?? vendors;
  for (;;) {
    const v = await prompter.select<'models' | 'exit'>({
      message: 'Configuration',
      options: [
        { value: 'models', label: 'models and roles configuration' },
        { value: 'exit', label: 'exit' },
      ],
    });
    if (v !== 'models') return 0; // exit, EXIT (Ctrl-C) or BACK: nothing more is written
    const r = await modelsScreen({ root, prompter, detectVendors: detect, modelCache });
    if (r === 'exit') return 0;
  }
}
