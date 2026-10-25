import { execFileSync } from 'node:child_process';
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
