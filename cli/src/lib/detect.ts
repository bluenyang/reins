import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Generation of an existing harness (design §7). First match wins, from the most specific. */
export type Generation = 'reins' | 'gen4' | 'gen3' | 'gen2' | 'gen1' | 'none';

export function generation(root: string): Generation {
  const agents = join(root, 'AGENTS.md');
  const hasAgents = existsSync(agents);
  if (
    hasAgents &&
    readFileSync(agents, 'utf8').includes('<!-- reins:begin') &&
    existsSync(join(root, '.agents/harness'))
  )
    return 'reins';
  const skills = join(root, '.claude/skills');
  const skillDirs = existsSync(skills) ? readdirSync(skills) : [];
  if (skillDirs.length >= 10 && skillDirs.some((s) => s === 'work-cicd-to' || s === 'go-flow'))
    return 'gen4';
  if (existsSync(join(root, '.claude/commands'))) return 'gen3';
  if (hasAgents) return 'gen2';
  if (existsSync(join(root, '.ai'))) return 'gen1';
  return 'none';
}

export interface Vendor {
  name: 'claude' | 'openai' | 'google' | 'cursor';
  cli: string;
  detected: boolean;
}

function onPath(bin: string): boolean {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function vendors(): Vendor[] {
  return [
    { name: 'claude', cli: 'claude', detected: onPath('claude') },
    { name: 'openai', cli: 'codex', detected: onPath('codex') },
    { name: 'google', cli: 'agy', detected: onPath('agy') || onPath('gemini') },
    { name: 'cursor', cli: 'cursor-agent', detected: onPath('cursor-agent') },
  ];
}

export function stacks(root: string): string[] {
  const out: string[] = [];
  if (existsSync(join(root, 'package.json'))) out.push('node');
  if (existsSync(join(root, 'go.mod'))) out.push('go');
  if (existsSync(join(root, 'build.gradle.kts')) || existsSync(join(root, 'build.gradle')))
    out.push('gradle');
  if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'requirements.txt')))
    out.push('python');
  return out;
}

export function runner(root: string): string | null {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(root, 'package-lock.json')) || existsSync(join(root, 'package.json')))
    return 'npm';
  if (existsSync(join(root, 'Makefile'))) return 'make';
  return null;
}

export interface Gate {
  name: 'check' | 'test' | 'build' | 'e2e';
  cmd: string;
  from: string;
  optional?: boolean;
}

export interface GateProposal {
  gates: Gate[];
  excluded: { name: string; cmd: string; why: string }[];
}

const MUTATING = /--fix\b|--write\b|\bfmt\b(?!:check)|(^|\s)format(\s|$)/;

/**
 * The PM's discovery step 2–3 (design §5): read the project's scripts, drop mutating ones,
 * prefer the aggregate `check` the hooks and CI already call.
 */
export function discoverGates(root: string): GateProposal {
  const res: GateProposal = { gates: [], excluded: [] };
  const run = runner(root);
  const pkgPath = join(root, 'package.json');
  if (run && run !== 'make' && existsSync(pkgPath)) {
    const scripts =
      (JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> }).scripts ??
      {};
    const cmd = (s: string) => (run === 'npm' ? `npm run ${s}` : `${run} ${s}`);
    for (const [name, body] of Object.entries(scripts))
      if (MUTATING.test(body) && !/check/.test(name))
        res.excluded.push({ name, cmd: body, why: 'mutates files (--fix/--write) — not a gate' });
    const pick = (names: string[]) =>
      names.find((n) => n in scripts && !MUTATING.test(scripts[n] ?? ''));
    const check = pick(['check', 'verify', 'ci', 'lint:check']) ?? null;
    if (check)
      res.gates.push({ name: 'check', cmd: cmd(check), from: `package.json#scripts.${check}` });
    const test =
      check && /\btest\b/.test(scripts[check] ?? '') ? null : pick(['test', 'test:unit']);
    if (test)
      res.gates.push({ name: 'test', cmd: cmd(test), from: `package.json#scripts.${test}` });
    const build = pick(['build']);
    if (build)
      res.gates.push({ name: 'build', cmd: cmd(build), from: 'package.json#scripts.build' });
    const e2e = pick(['test:e2e', 'e2e']);
    if (e2e)
      res.gates.push({
        name: 'e2e',
        cmd: cmd(e2e),
        from: `package.json#scripts.${e2e}`,
        optional: true,
      });
  } else if (run === 'make') {
    const mk = readFileSync(join(root, 'Makefile'), 'utf8');
    for (const t of ['check', 'test', 'build'] as const)
      if (new RegExp(`^${t}:`, 'm').test(mk))
        res.gates.push({ name: t, cmd: `make ${t}`, from: `Makefile:${t}` });
  }
  return res;
}

/** Vendor of a model ID by prefix, in order: gpt, gemini, cursor-, else claude (spec S-2). */
export function vendorOf(model: string): Vendor['name'] {
  if (model.startsWith('gpt')) return 'openai';
  if (model.startsWith('gemini')) return 'google';
  if (model.startsWith('cursor-')) return 'cursor';
  return 'claude';
}

/** Model IDs seen working in this environment. */
export const CONFIRMED_MODELS = new Set(['claude-opus-5-5', 'claude-fable-5-1']);

export interface RunResult {
  status: number | null;
  stdout: string;
  timedOut?: boolean;
  error?: string;
}
export type ModelsRunner = (cli: string, args: string[]) => RunResult;

/** Runs `<cli> models` without a shell, stdin closed, 10 s limit. Nothing else is ever run. */
export const spawnModels: ModelsRunner = (cli, args) => {
  if (process.env['REINS_NO_VENDOR_SPAWN']) throw new Error(`refusing to spawn ${cli} under test`);
  const r = spawnSync(cli, args, {
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 10_000,
    encoding: 'utf8',
  });
  const code = (r.error as NodeJS.ErrnoException | undefined)?.code;
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    timedOut: code === 'ETIMEDOUT',
    error: r.error?.message,
  };
};

const LISTERS = { google: 'agy', cursor: 'cursor-agent' } as const;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

function parseModels(cli: string, out: string): string[] {
  const ids: string[] = [];
  for (const line of out.replace(ANSI, '').split(/\r?\n/)) {
    if (cli === 'agy') {
      if (line.includes('\t')) ids.push(line.split('\t')[0]!.trim());
    } else {
      const m = /^(\S+) - .+$/.exec(line);
      if (m) ids.push(m[1]!);
    }
  }
  return ids.filter(Boolean);
}

export type ListResult = { ids: string[] } | { failed: string };

/** `<cli> models` → model IDs, or the reason it could not be read. */
export function listModels(
  vendor: 'google' | 'cursor',
  run: ModelsRunner = spawnModels,
): ListResult {
  const cli = LISTERS[vendor];
  const r = run(cli, ['models']);
  if (r.timedOut) return { failed: 'timed out after 10 s' };
  if (r.error) return { failed: r.error };
  if (r.status !== 0) return { failed: `exit ${r.status}` };
  const ids = parseModels(cli, r.stdout);
  return ids.length ? { ids } : { failed: 'no model IDs in output' };
}

export interface ModelCache {
  run: ModelsRunner;
  onPath: (bin: string) => boolean;
  warn: (msg: string) => void;
  lists: Map<string, ListResult>;
}

export function newModelCache(o: Partial<Omit<ModelCache, 'lists'>> = {}): ModelCache {
  return {
    run: o.run ?? spawnModels,
    onPath: o.onPath ?? (process.env['REINS_NO_VENDOR_SPAWN'] ? () => false : onPath),
    warn: o.warn ?? ((m) => void process.stderr.write(`warning: ${m}\n`)),
    lists: new Map(),
  };
}

/**
 * Checks a binding against the vendor CLI's model list (spec S-3). Returns the fields to record,
 * or null when the vendor has no list command or its CLI is absent. Never blocks, never changes the model.
 */
export function checkBinding(
  model: string,
  vendor: Vendor['name'],
  cache: ModelCache,
): { unverified?: true; note?: string } | null {
  if (vendor !== 'google' && vendor !== 'cursor') return null;
  const cli = LISTERS[vendor];
  if (!cache.onPath(cli)) return null;
  let res = cache.lists.get(cli);
  if (!res) {
    res = listModels(vendor, cache.run);
    cache.lists.set(cli, res);
  }
  if ('failed' in res) return { unverified: true, note: `${cli} models failed: ${res.failed}` };
  if (res.ids.includes(model)) return {};
  cache.warn(`${model} is not in \`${cli} models\` — recorded as unverified`);
  return { unverified: true, note: `not in ${cli} models` };
}
