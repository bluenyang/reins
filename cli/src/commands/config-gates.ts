import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applicable, formatGateDiff } from '../lib/gate-refresh.js';
import { GATE_SCRIPT } from '../lib/gate-script.js';
import { BACK, EXIT, type Prompter } from '../lib/prompter.js';
import { configureGates, fileGates, gateDiff } from './configure.js';
import { hookTool } from './install.js';

const GATES = '.agents/harness/gates.yaml';

/** The gates as the project has them now: name, command, source, in order; and what runs them. */
export function formatGates(root: string): string {
  const path = join(root, GATES);
  if (!existsSync(path)) return '  no gates.yaml — run `reins install`';
  const gates = fileGates(readFileSync(path, 'utf8'));
  const lines = gates.length
    ? gates.map(
        (g, i) =>
          `  ${String(i + 1).padStart(2)}. ${g.name.padEnd(18)} ${g.cmd}   (${g.from ?? 'written by hand'})${g.optional ? '  optional — not in the hooks' : ''}`,
      )
    : ['  no gates'];
  const tool = hookTool(root);
  lines.push(
    `  hook tool: ${tool ?? 'none found'}`,
    `  gate script: ${existsSync(join(root, GATE_SCRIPT)) ? GATE_SCRIPT : 'none (no required gate)'}`,
  );
  return lines.join('\n');
}

/**
 * Run the discovery again and let the user pick which differences to apply (design §9). Nothing is
 * written unless something is picked. Returns `exit` when the user left with Ctrl-C.
 */
export async function refreshGates(root: string, prompter: Prompter): Promise<'done' | 'exit'> {
  const diff = gateDiff(root);
  if (!diff) {
    prompter.note('no gates.yaml — run `reins install`');
    return 'done';
  }
  const can = applicable(diff);
  const yours = diff.filter((d) => d.kind === 'yours');
  if (yours.length) prompter.note(yours.map(formatGateDiff).join('\n'));
  if (can.length === 0) {
    prompter.note('gates: up to date — the discovery finds what gates.yaml holds');
    return 'done';
  }
  const picked = await prompter.multiselect<string>({
    message: 'Differences to apply to gates.yaml (nothing is changed unless picked)',
    options: can.map((d) => ({ value: d.name, label: formatGateDiff(d) })),
    initial: [],
  });
  if (picked === EXIT) return 'exit';
  if (picked === BACK || picked.length === 0) {
    prompter.note('gates: nothing changed');
    return 'done';
  }
  const r = configureGates({ cwd: root, refresh: true, apply: picked });
  prompter.note(
    r.refused
      ? `not changed: ${r.refused}`
      : `gates: applied ${r.applied?.join(', ')} — gates.yaml and ${GATE_SCRIPT} written; commit them (the hook line stays as it is)`,
  );
  return 'done';
}

/** The gates item of the config screen: see the gates, find them again, add subdirectory proposals. */
export async function gatesScreen(root: string, prompter: Prompter): Promise<'back' | 'exit'> {
  for (;;) {
    prompter.note(formatGates(root));
    const v = await prompter.select<string>({
      message: 'Gates',
      options: [
        { value: 'back', label: '< Configuration' },
        { value: 'refresh', label: 'refresh', hint: 'find the gates again and pick what to apply' },
        { value: 'add', label: 'add subdirectory proposals' },
      ],
    });
    if (v === EXIT) return 'exit';
    if (v === BACK || v === 'back') return 'back';
    if (v === 'refresh') {
      if ((await refreshGates(root, prompter)) === 'exit') return 'exit';
      continue;
    }
    const { available } = configureGates({ cwd: root });
    if (available.length === 0) {
      prompter.note('no subdirectory proposals left');
      continue;
    }
    const picked = await prompter.multiselect<string>({
      message: 'Subdirectory gates to add',
      options: available.map((g) => ({ value: g.name, label: g.name, hint: g.cmd })),
      initial: [],
    });
    if (picked === EXIT) return 'exit';
    if (picked === BACK || picked.length === 0) continue;
    const r = configureGates({ cwd: root, add: picked });
    prompter.note(r.refused ? `not changed: ${r.refused}` : `gates: added ${r.added.join(', ')}`);
  }
}
