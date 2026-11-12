import { existsSync, readFileSync, readdirSync, rmdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import type { Asker } from '../lib/ask.js';
import { askerPrompter, BACK, EXIT, type Prompter } from '../lib/prompter.js';
import { draftRelease, releaseDraftNotes } from '../lib/release.js';
import { applyBlocks } from '../lib/blocks.js';
import {
  discoverGates,
  generation,
  stacks,
  vendors,
  type Generation,
  type Vendor,
} from '../lib/detect.js';
import { apply, listFiles, type Applied, type Write } from '../lib/fsx.js';
import { repoRoot } from '../lib/git.js';
import { harnessVersion, packageHarness, packageSkills, packageVersion } from '../lib/upstream.js';
import { generateVendorFiles } from '../lib/generate.js';
import { hookLine, requiredGates } from '../lib/gate-script.js';
import { defaultBindings, readTeam, type BindingsV2 } from '../lib/bindings.js';
import { overlayReader, workTreeReader } from '../lib/reader.js';
import {
  LOCAL_DELEGATION,
  ONBOARDING_PENDING,
  RECONCILE_PENDING,
  onboardingNote,
  placeNote,
  renderBlocks,
  tidyNote,
} from '../lib/agents-md.js';
import { syncLocalDelegation } from '../lib/local-delegation.js';
import { writeGenerated, type GenWriteResult } from '../lib/vendor-write.js';

export interface InstallOptions {
  mode: 'manual' | 'auto';
  dryRun?: boolean;
  /** add the hook lines to an existing husky setup instead of proposing them */
  hooks?: boolean;
  /** on a terminal (any mode): ask before adding the hook lines (design §6); without it they are only proposed */
  confirmHooks?: Prompter;
  cwd?: string;
  asker: Asker;
  /**
   * Screens for the manual questions (design §9). Given only when stdin and stdout are terminals,
   * mode is manual and the output is not JSON; otherwise the questions go through `asker`.
   */
  prompter?: Prompter;
  /** tests: replace tool detection */
  detectVendors?: () => Vendor[];
  now?: Date;
  /** migrate installs over an old harness it is about to move away */
  overExisting?: boolean;
  /** update: delete upstream-owned files this version no longer ships */
  retire?: boolean;
  /** update: overwrite generated files edited by hand */
  force?: boolean;
  /** update, dry run: contents it would have written first (the converted bindings), for the plan */
  pending?: { path: string; content: string }[];
  /** update, dry run: paths it would have deleted first (0.x skills, agent files), for the plan */
  pendingDeletes?: string[];
  /** `update` from a 0.3 harness older than 0.3.2: leave the AGENTS.md guide note once (design §5) */
  tidy?: boolean;
}

export interface InstallResult {
  root: string;
  generation: Generation;
  refused?: string;
  /** The user left a screen: nothing was written. */
  cancelled?: boolean;
  applied?: Applied;
  generated?: GenWriteResult;
  notes: string[];
}

/** Upstream harness files installed into `.agents/harness/` (design §1): everything but seeds and the changelog. */
export function harnessFiles(all: string[]): string[] {
  return all.filter((f) => !f.startsWith('knowledge-seeds/') && f !== 'CHANGELOG.md');
}

/** Folders under `.agents/harness/` that upstream owns; a file there that upstream no longer ships is retired. */
const UPSTREAM_DIRS = ['policy/', 'roles/', 'schemas/', 'templates/'];

/** Harness files the project owns; update never touches them. */
export const PROJECT_OWNED = new Set([
  'bindings.yaml',
  'gates.yaml',
  'install.yaml',
  'generated.yaml',
]);

/** Installed upstream-owned files this version no longer ships (an older reins wrote them). */
export function retiredFiles(installed: string[], upstream: string[]): string[] {
  const keep = new Set(harnessFiles(upstream));
  return installed.filter(
    (f) =>
      !keep.has(f) &&
      !PROJECT_OWNED.has(f) &&
      (f === 'CHANGELOG.md' || UPSTREAM_DIRS.some((d) => f.startsWith(d))),
  );
}

/** Skills that ship with the plugin only and are not installed into a project. */
const PLUGIN_ONLY = new Set(['reins-setup', 'setup']);

/** The hook tool the project already uses (design §6), if any. */
export function hookTool(root: string): 'husky' | 'lefthook' | 'pre-commit' | null {
  if (existsSync(join(root, '.husky'))) return 'husky';
  if (
    ['lefthook.yml', 'lefthook.yaml', '.lefthook.yml', '.lefthook.yaml'].some((f) =>
      existsSync(join(root, f)),
    )
  )
    return 'lefthook';
  if (existsSync(join(root, '.pre-commit-config.yaml'))) return 'pre-commit';
  return null;
}

export function buildGates(
  root: string,
  gates: { name: string; cmd: string; from: string; optional?: boolean }[],
): string {
  const doc = {
    schema: 'reins/gates@1',
    gates: Object.fromEntries(
      gates.map((g) => [
        g.name,
        { cmd: g.cmd, from: g.from, ...(g.optional ? { optional: true } : {}) },
      ]),
    ),
    order: gates.map((g) => g.name),
    mutating_forbidden: true,
    evidence: 'raw',
  };
  void root;
  return `# discovered by reins install — the loop reads only this file (design §5)\n${stringify(doc)}`;
}

/** The stub install leaves; migrate may replace it with the project's real raw roadmap. */
export const ROADMAP_STUB =
  '# ROADMAP (local)\n\n— 산발적 아이디어를 여기에. 확정되면 docs/ROADMAP.md\n';

const LOCTX_README = `# .loctx — 이 머신·이 개발자만 (gitignore)

| 경로 | 무엇 | 지우는 때 |
|---|---|---|
| ROADMAP.local.md | 날 것의 아이디어. 사용자와 정리되면 docs/ROADMAP.md | 사용자 |
| history/<version>.md | 버전마다 한 장: 결정, 판정, 건너뛴 단계, 감사·회고 요약 | 지우지 않음 |
| reports/<version>/ | 게이트·테스트 원본 로그, 하위 보고 | 회고 뒤 (history·감사에 요약한 다음) |
| reports/gates/<tree>.log | 훅이 돌린 검사의 출력 (.agents/harness/run-gates.sh; 커밋의 트리 해시가 파일 이름) | 회고 뒤 (그 버전의 stable 전에 쓰인 것) |
| context/ | 개인 컨텍스트 — 대화·메모 | 사용자 |
| bindings.local.yaml | 나만 쓰는 모델 할당 (있으면 팀 설정보다 우선) | 사용자 |
`;

type Tool = Vendor['name'];
const TOOL_NAMES: Tool[] = ['claude', 'openai', 'google', 'gemini', 'copilot', 'cursor'];

/** The gate commands, in order, as hook lines (design §6). */
/** The git hooks reins proposes the gates for. */
const HOOK_STAGES = ['pre-commit', 'pre-push'] as const;

/** A `reins:begin hooks` block in a hook file, with its body. */
const HOOK_BLOCK = /# reins:begin hooks\n([\s\S]*?)# reins:end hooks/g;

/** A command that runs reins: what 0.x put into hooks and settings. */
export const RUNS_REINS =
  /@bluenyang\/reins|reins\.js\b|(^|[\s;&|])reins\s+(check|hook|gate|status)\b/;

/** `reins install` (design §9): place the harness, ask, propose hooks, mark onboarding. Never writes history. */
export async function runInstall(o: InstallOptions): Promise<InstallResult> {
  const root = repoRoot(o.cwd ?? process.cwd());
  const gen = generation(root);
  const notes: string[] = [];
  if ((gen === 'gen3' || gen === 'gen4') && !o.overExisting)
    return {
      root,
      generation: gen,
      notes,
      refused: `an existing ${gen} harness is here — run \`reins migrate\` instead`,
    };

  const up = packageHarness();
  const version = harnessVersion(up);
  const writes: Write[] = [];
  const add = (path: string, content: string, why: string) => writes.push({ path, content, why });
  const addIfMissing = (path: string, content: string, why: string) => {
    if (!existsSync(join(root, path))) add(path, content, why);
  };

  // 1. upstream harness files
  for (const f of harnessFiles(listFiles(up)))
    add(`.agents/harness/${f}`, readFileSync(join(up, f), 'utf8'), 'upstream harness');

  // 2. questions (manual) / detection (auto) — only for what does not exist yet
  const pendingBindings = o.pending?.find((p) => p.path === '.agents/harness/bindings.yaml');
  const team = pendingBindings
    ? { doc: parse(pendingBindings.content) as BindingsV2 }
    : readTeam(root);
  const hasBindings = team.doc !== null;
  const hasGates = existsSync(join(root, '.agents/harness/gates.yaml'));
  const pinPath = join(root, '.agents/harness/install.yaml');
  const pinned = existsSync(pinPath)
    ? (parse(readFileSync(pinPath, 'utf8')) as
        | ({ language?: string } & Record<string, unknown>)
        | null)
    : null;
  const vs = (o.detectVendors ?? vendors)();
  const detected = vs.filter((v) => v.detected).map((v) => v.name);
  const use = new Set<Tool>(['claude']); // claude is the floor (R22)
  const screens = o.mode === 'manual' ? o.prompter : undefined;
  const line = askerPrompter(o.asker); // the piped, line-based form
  const cancelled = (): InstallResult => ({ root, generation: gen, notes, cancelled: true });
  const isNav = (v: unknown): v is typeof BACK | typeof EXIT => v === BACK || v === EXIT;
  if (!hasBindings && !team.v1) {
    if (screens) {
      const picked = await screens.multiselect<Tool>({
        message: 'Agent tools you use (claude is always on)',
        options: TOOL_NAMES.map((n) => ({
          value: n,
          label: n,
          hint: n === 'claude' ? 'always' : detected.includes(n) ? 'detected' : undefined,
        })),
        initial: ['claude', ...detected.filter((d) => d !== 'claude')],
      });
      if (isNav(picked)) return cancelled();
      for (const v of picked) use.add(v);
    } else {
      const ans = await line.text({
        message: `agent tools you use (${TOOL_NAMES.join(',')}) — detected: ${detected.join(',') || 'none'}`,
        initial: ['claude', ...detected.filter((d) => d !== 'claude')].join(','),
      });
      for (const v of String(ans)
        .split(',')
        .map((s) => s.trim()))
        if ((TOOL_NAMES as string[]).includes(v)) use.add(v as Tool);
    }
  }
  let language = pinned?.language;
  if (language === undefined) {
    if (screens) {
      const pick = await screens.select<string>({
        message: 'Language of documents you read',
        options: [
          { value: 'ko', label: 'ko' },
          { value: 'en', label: 'en' },
          { value: 'other', label: 'other', hint: 'type a language code' },
        ],
        initial: 'ko',
      });
      if (isNav(pick)) return cancelled();
      if (pick === 'other') {
        const typed = await screens.text({ message: 'Language code (ko, en, …)', initial: 'ko' });
        if (isNav(typed)) return cancelled();
        language = typed.trim() || 'ko';
      } else language = pick;
    } else
      language = String(
        await line.text({
          message: 'language of documents the user reads (ko, en, …)',
          initial: 'ko',
        }),
      );
  }
  if (!hasGates) {
    const proposal = discoverGates(root);
    const gateList = proposal.gates.map((g) => `${g.name}=${g.cmd}`).join(', ') || 'none found';
    const gateQ = `gates found: ${gateList} — use them?`;
    const gateAns = await (screens ?? line).confirm({ message: gateQ, initial: true });
    if (isNav(gateAns)) return cancelled();
    if (!gateAns) notes.push('gates not confirmed — edit .agents/harness/gates.yaml');
    let chosen: typeof proposal.proposals = [];
    if (proposal.proposals.length) {
      const listing = proposal.proposals.map((g) => `${g.name}=${g.cmd}`).join('; ');
      if (o.mode === 'manual') {
        let names: Set<string>;
        if (screens) {
          const picked = await screens.multiselect<string>({
            message: 'Subdirectory gates to add',
            options: proposal.proposals.map((g) => ({ value: g.name, label: g.name, hint: g.cmd })),
            initial: [],
          });
          if (isNav(picked)) return cancelled();
          names = new Set(picked);
        } else {
          const pick = String(
            await line.text({
              message: `subdirectory gates (names, comma-separated; empty: none) — ${listing}`,
              initial: '',
            }),
          );
          names = new Set(
            pick
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
          );
        }
        chosen = proposal.proposals.filter((g) => names.has(g.name));
        if (o.dryRun)
          notes.push(`subdirectory gates offered (names are asked in a real run): ${listing}`);
        for (const n of names)
          if (!chosen.some((g) => g.name === n)) notes.push(`no such subdirectory gate: ${n}`);
      } else
        notes.push(
          `subdirectory gates not added (auto mode): ${listing} — add with \`reins config gates --add <name>\``,
        );
    }
    for (const x of proposal.excluded) notes.push(`excluded from gates: ${x.name} (${x.why})`);
    add(
      '.agents/harness/gates.yaml',
      buildGates(root, [...(gateAns ? proposal.gates : []), ...chosen]),
      'declared gates',
    );
  }

  // 3. settings: a new bindings file in single mode (an old one is converted by update)
  let doc = team.doc;
  if (!doc && !team.v1) {
    doc = defaultBindings(vs.map((v) => ({ name: v.name, cli: v.cli, use: use.has(v.name) })));
    add(
      '.agents/harness/bindings.yaml',
      `# reins model assignment (design §5) — the user changes it with \`reins config\`; nothing reads it while you work\n${stringify(doc)}`,
      'model assignment (single mode)',
    );
  }
  const { tier: _tier, ...keep } = pinned ?? {};
  add(
    '.agents/harness/install.yaml',
    `# version pin and install settings (R25) — read by reins update\n${stringify({ ...keep, schema: 'reins/install@1', version, cli: packageVersion(), mode: o.mode, language })}`,
    'version pin',
  );

  // 4. layout skeleton (design §1); never overwrite project files
  addIfMissing('.agents/intent/.gitkeep', '', 'intent folders live here');
  addIfMissing('.agents/audit/.gitkeep', '', 'version audit records');
  addIfMissing('.agents/knowledge/.gitkeep', '', 'explicit knowledge');
  for (const s of stacks(root)) {
    const seeds = join(up, 'knowledge-seeds', s);
    if (existsSync(seeds))
      for (const f of listFiles(seeds))
        addIfMissing(
          `.agents/knowledge/${f}`,
          readFileSync(join(seeds, f), 'utf8'),
          `seed for ${s}`,
        );
  }
  add('.loctx/.gitignore', '*\n', 'double ignore');
  add('.loctx/README.md', LOCTX_README, 'local workspace layout and lifetimes');
  addIfMissing('.loctx/ROADMAP.local.md', ROADMAP_STUB, 'raw roadmap');

  // stage skills: upstream-owned copies under the Agent Skills path
  const skillsUp = packageSkills();
  if (existsSync(skillsUp))
    for (const name of readdirSync(skillsUp).toSorted()) {
      if (PLUGIN_ONLY.has(name) || !existsSync(join(skillsUp, name, 'SKILL.md'))) continue;
      for (const f of listFiles(join(skillsUp, name)))
        add(
          `.agents/skills/${name}/${f}`,
          readFileSync(join(skillsUp, name, f), 'utf8'),
          'upstream skill',
        );
    }

  const gi = existsSync(join(root, '.gitignore'))
    ? readFileSync(join(root, '.gitignore'), 'utf8')
    : '';
  if (!/^\/?\.loctx\/?$/m.test(gi))
    add(
      '.gitignore',
      `${gi.replace(/\s*$/, '')}\n\n# reins local workspace\n.loctx/\n`,
      'keep .loctx out of git',
    );

  // 4b. .claude/memory is never moved or drafted (design §8): the PM proposes knowledge in the retro
  if (existsSync(join(root, '.claude/memory')))
    notes.push(
      '.claude/memory found — left as it is; the PM can propose knowledge entries from it in a retro',
    );

  // 4c. a release: draft from dispatchable workflows — proposal only, never written
  notes.push(...releaseDraftNotes(draftRelease(root)));

  // 5. hooks: one line per stage that calls the project's gate script (design §6)
  const tool = hookTool(root);
  const gatesPath = join(root, '.agents/harness/gates.yaml');
  const gated =
    requiredGates(
      writes.find((w) => w.path === '.agents/harness/gates.yaml')?.content ??
        (existsSync(gatesPath) ? readFileSync(gatesPath, 'utf8') : undefined),
    ).length > 0;
  if (gated && tool === 'husky') {
    const files = HOOK_STAGES.map((stage) => {
      const p = join(root, '.husky', stage);
      return { stage, cur: existsSync(p) ? readFileSync(p, 'utf8') : '' };
    });
    const missing = files.filter((f) => !f.cur.includes('# reins:begin hooks'));
    let addHooks = !!o.hooks;
    if (missing.length && !addHooks && o.confirmHooks && !o.dryRun) {
      const yes = await o.confirmHooks.confirm({
        message: `Add the project gates to husky pre-commit and pre-push? (${hookLine('<stage>')})`,
        initial: true,
      });
      if (yes === EXIT) return cancelled();
      addHooks = yes === true;
    }
    for (const { stage, cur } of files) {
      const line = hookLine(stage);
      if (cur.includes('# reins:begin hooks')) {
        // a block an earlier reins wrote: its body becomes the one line. A block that runs reins is 0.x
        // and `update` removes it as a whole; one that already is the line stays.
        const held: string[] = [];
        const next = cur.replace(HOOK_BLOCK, (block, body: string) => {
          if (RUNS_REINS.test(body) || body.trim() === line) return block;
          held.push(...body.split('\n').filter((l) => l.trim()));
          return `# reins:begin hooks\n${line}\n# reins:end hooks`;
        });
        if (next === cur) continue;
        add(`.husky/${stage}`, next, 'hook: the gate script');
        notes.push(
          `.husky/${stage}: the reins hooks block now calls the gate script — it held: ${held.join(' && ')} (move a line of your own outside the block)`,
        );
      } else if (addHooks)
        add(
          `.husky/${stage}`,
          `${cur.replace(/\s*$/, '')}\n# reins:begin hooks\n${line}\n# reins:end hooks\n`.replace(
            /^\n/,
            '',
          ),
          'hook: the gate script',
        );
    }
    if (missing.length && !addHooks)
      notes.push(
        `hook proposal (husky): add \`${hookLine('pre-commit')}\` to .husky/pre-commit and \`${hookLine('pre-push')}\` to .husky/pre-push; re-run with --hooks to add them`,
      );
  } else if (gated && tool === 'lefthook')
    notes.push(
      `hook proposal (lefthook): under \`pre-commit: commands:\` add \`gates: { run: ${hookLine('pre-commit')} }\`, and the same under \`pre-push:\` with \`${hookLine('pre-push')}\` (reins proposes lefthook lines only; add them to its config yourself)`,
    );
  else if (gated && tool === 'pre-commit')
    notes.push(
      `hook proposal (pre-commit): under \`repos:\` add \`- repo: local\` with a hook \`{ id: gates, name: project gates, entry: ${hookLine('pre-commit')}, language: system, pass_filenames: false }\`, and one with \`stages: [pre-push]\` and \`${hookLine('pre-push')}\` (reins proposes pre-commit lines only; add them to its config yourself)`,
    );
  else if (gated)
    notes.push(
      `no hook tool found — the PM asks which one to use during onboarding; whichever it is runs \`${hookLine('pre-commit')}\` and \`${hookLine('pre-push')}\``,
    );

  // 6. AGENTS.md: managed blocks, the onboarding note; CLAUDE.md pointer
  const agentsPath = join(root, 'AGENTS.md');
  const before = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : '# AGENTS.md\n';
  const blocks = renderBlocks(up, doc ?? defaultBindings([]), String(language ?? 'ko'));
  const br = applyBlocks(before, blocks);
  let agents = br.text;
  // a reconcile note already sends the PM to `onboard`; one note is enough
  if (!/<!-- reins:onboarding done -->/.test(agents) && !agents.includes('<!-- reins:reconcile'))
    agents = placeNote(agents, onboardingNote(tool === null), 'onboarding');
  // an install from before the AGENTS.md guide gets its note once; a pending onboarding or reconcile
  // follows the guide anyway (design §5)
  if (
    o.tidy &&
    !agents.includes('<!-- reins:tidy') &&
    !agents.includes(ONBOARDING_PENDING) &&
    !agents.includes(RECONCILE_PENDING)
  ) {
    agents = placeNote(agents, tidyNote(), 'tidy');
    notes.push(
      'AGENTS.md has a note about the AGENTS.md guide — the PM sorts the project sections with the user in the next conversation',
    );
  }
  if (agents !== before)
    add(
      'AGENTS.md',
      agents,
      `managed blocks: ${[...br.inserted, ...br.replaced].join(', ') || 'onboarding'}`,
    );
  for (const s of br.skipped) notes.push(`AGENTS.md block "${s.name}" not placed: ${s.why}`);
  const claude = join(root, 'CLAUDE.md');
  if (!existsSync(claude)) add('CLAUDE.md', '@AGENTS.md\n', 'Claude Code reads AGENTS.md');
  else if (!readFileSync(claude, 'utf8').includes('@AGENTS.md'))
    notes.push('CLAUDE.md does not import @AGENTS.md — add it');

  // 7. legacy workspace — migrate owns it
  if (existsSync(join(root, '.ai')) && !o.overExisting)
    notes.push('legacy workspace .ai/ found — left untouched; run `reins migrate` to move it');
  notes.push(
    'next: open your agent in this repository — the onboarding note in AGENTS.md starts the first conversation',
  );

  // 8. apply
  const applied = apply(root, writes, !!o.dryRun);
  const retired: string[] = [];
  if (o.retire) {
    const harnessDir = join(root, '.agents/harness');
    const here = existsSync(harnessDir) ? listFiles(harnessDir) : [];
    for (const f of retiredFiles(here, listFiles(up))) {
      retired.push(`.agents/harness/${f}`);
      applied.removed.push(`.agents/harness/${f}`);
      if (o.dryRun) continue;
      rmSync(join(harnessDir, f), { force: true });
      for (let d = dirname(join(harnessDir, f)); d !== harnessDir; d = dirname(d)) {
        try {
          rmdirSync(d);
        } catch {
          break;
        }
      }
    }
  }

  // 9. generated files from the installed harness (design §6) — never over a file reins did not write
  // a dry run computes the same plan without writing, so update can show hand-edited files first
  const rd = o.dryRun
    ? overlayReader(
        workTreeReader(root),
        [...(o.pending ?? []), ...writes],
        [...retired, ...(o.pendingDeletes ?? [])],
      )
    : workTreeReader(root);
  const generated = writeGenerated(root, generateVendorFiles(root, rd), !!o.dryRun, !!o.force);
  if (generated) {
    // a generated file that was there before this run is a changed one, not a new one (022 S-28)
    const fresh = new Set(generated.created);
    for (const p of generated.written) {
      const into = fresh.has(p) ? applied.created : applied.changed;
      if (!applied.created.includes(p) && !applied.changed.includes(p)) into.push(p);
    }
    applied.removed.push(...generated.removed);
    for (const r of generated.refused) notes.push(`left alone ${r.path}: ${r.why}`);
  }
  // a person's own delegation table follows the delegation block just written (spec 020 S-2)
  const hadLocal = existsSync(join(root, LOCAL_DELEGATION));
  const local = syncLocalDelegation(root, !!o.dryRun);
  if (local === 'removed') applied.removed.push(LOCAL_DELEGATION);
  else if (local) (hadLocal ? applied.changed : applied.created).push(LOCAL_DELEGATION);
  return { root, generation: gen, applied, generated, notes };
}
