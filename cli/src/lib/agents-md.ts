import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBlocks, type Block } from './blocks.js';
import {
  auditBinding,
  auditFallback,
  pmBinding,
  resolveRoles,
  type Binding,
  type ResolvedRole,
  type BindingsV2,
} from './bindings.js';

/**
 * AGENTS.md managed blocks for 0.3 (design §5): the static blocks from the template plus the delegation
 * table, resolved from the team bindings when `config`, `install` or `update` writes — never at work time.
 */

/** The name of the generated Claude agent file of a role (design §6). */
export const agentName = (group: string, role: string): string =>
  group === role ? `rs-${group}` : `rs-${group}-${role}`;

/**
 * The Claude agent files of a resolved role: one per Claude model. Several Claude models on one role
 * (discussion, committee) get numbered names so each keeps its own model.
 */
export function claudeAgents(r: ResolvedRole): { name: string; model: string }[] {
  const base = agentName(r.group, r.group === 'auditor' ? 'auditor' : r.role);
  const ms = r.models.filter((b) => b.vendor === 'claude');
  return ms.map((b, i) => ({ name: ms.length > 1 ? `${base}-${i + 1}` : base, model: b.model }));
}

/** How the PM hands a role its work on a vendor other than Claude (the vendor's own CLI, read-only unless it writes). */
export function callLine(b: Binding, cli: string, writes: boolean): string {
  switch (b.vendor) {
    case 'openai':
      return `\`${cli} exec -m ${b.model} -s ${writes ? 'workspace-write' : 'read-only'} -\` (task on stdin)`;
    case 'google':
      return `\`${cli} -p "<task>" --model ${b.model}${writes ? '' : ' --mode plan'}\``;
    case 'cursor':
      return `\`${cli} -p --model ${b.model} "<task>"\``;
    default:
      return `\`${cli}\` with model \`${b.model}\``;
  }
}

/** Groups whose roles write files (`tools.write` in `harness/roles/<group>.md`); the others are called read-only. */
export const WRITES: ReadonlySet<string> = new Set(['implementer', 'planner']);

/** Where `config`, `install` and `update` write a person's own delegation table (spec 020 S-1). */
export const LOCAL_DELEGATION = '.loctx/delegation.local.md';

/** When the PM may use a role's fallback line (design §5): the call cannot be made, not a disliked answer. */
export const FALLBACK_RULE =
  "When a role's call cannot be made (its CLI is missing, the model is refused or over its limit — not when you dislike the answer), use the role's `fallback` once, and say that you did and why in your report to the user and in the record of that step. Without a fallback, or when the fallback cannot be called either, stop and ask.";

/** The fallback part of a role's "how to call" cell; empty when the role has none. */
function fallbackHow(doc: BindingsV2, r: ResolvedRole): string {
  const f = r.fallback;
  if (!f) return '';
  const how =
    f.vendor === 'claude'
      ? `a general subagent on \`${f.model}\`, given the \`${r.role}\` section of \`.agents/harness/roles/${r.group}.md\``
      : callLine(f, doc.tools?.[f.vendor]?.cli ?? f.vendor, WRITES.has(r.group));
  return `; fallback: ${f.vendor} ${f.model} — ${how}`;
}

/**
 * The `## Delegation` section for this bindings file. `local` renders a person's own table: no pointer to
 * itself, and a Claude role names its `rs-*` file only when the team generated that file with the same model.
 */
export function renderDelegation(
  doc: BindingsV2,
  local?: { teamAgents: { name: string; model: string }[] },
): string {
  const pm = pmBinding(doc);
  const lines = ['## Delegation', ''];
  if (!local)
    lines.push(
      `If \`${LOCAL_DELEGATION}\` exists, follow it instead of this section (your personal settings; \`reins config --local\` writes it).`,
      '',
    );
  if (doc.mode !== 'multi') {
    lines.push(
      `Mode: **single** — you are the PM (${pm.vendor} ${pm.model}) and do every role yourself, stage by stage. You may use subagents of your own model for read-heavy work (research, large log summaries, review, audit) and, when urgent, for parallel work on independent units; keep connected work (plan and implementation of one feature) in one run. Switching to multi is the user's choice.`,
    );
  } else {
    lines.push(
      `Mode: **multi** — you are the PM (${pm.vendor} ${pm.model}). Hand a role its work with the list of files and decisions it needs; every report comes back to you, and a role never calls another model itself. Roles not listed are yours.`,
      '',
      '| role | model | how to call |',
      '|---|---|---|',
    );
    for (const r of resolveRoles(doc).filter((x) => x.on)) {
      const agents = claudeAgents(r);
      let k = 0;
      for (const b of r.models) {
        const cli = doc.tools?.[b.vendor]?.cli ?? b.vendor;
        let how: string;
        if (b.vendor !== 'claude') how = callLine(b, cli, WRITES.has(r.group));
        else {
          const name = agents[k++]!.name;
          how =
            !local || local.teamAgents.some((a) => a.name === name && a.model === b.model)
              ? `subagent \`${name}\``
              : `a general subagent on \`${b.model}\`, given the \`${r.role}\` section of \`.agents/harness/roles/${r.group}.md\``;
        }
        lines.push(
          `| ${r.group}/${r.role} | ${b.vendor} ${b.model} | ${how}${fallbackHow(doc, r)} |`,
        );
      }
    }
    lines.push(
      '',
      'Routine review takes one reviewer; `pl/discussion` and `advisor/committee` (every listed model, without seeing each other) are for large decisions, audit remedies, incidents and unresolved disagreements.',
    );
    // said only when some role has one, so a table without fallbacks reads exactly as before
    if (resolveRoles(doc).some((x) => x.on && x.fallback)) lines.push('', FALLBACK_RULE);
  }
  const a = auditBinding(doc);
  const af = auditFallback(doc);
  lines.push(
    '',
    `Audit: ${doc.audit?.required === false ? '**switched off by the user**' : '**required every version**'}; run it on ${a.vendor} ${a.model}${af ? ` (fallback: ${af.vendor} ${af.model}, when that model cannot be called — say so in the audit report)` : ''} in a fresh run that gets only the records, never this conversation.`,
  );
  return lines.join('\n');
}

/**
 * A person's own delegation table, or null when their settings delegate exactly as the team's do
 * (compared as rendered text, so a personal file that repeats the team's values makes none).
 * `managed` says whether the team's agent file of that name is one reins wrote and nobody changed since;
 * only those are named, so the table never sends work to a file reins refused to write.
 */
export function localDelegation(
  team: BindingsV2,
  effective: BindingsV2,
  managed: (name: string) => boolean = () => true,
): string | null {
  if (renderDelegation(effective) === renderDelegation(team)) return null;
  const teamAgents =
    team.mode === 'multi'
      ? resolveRoles(team)
          .filter((r) => r.on)
          .flatMap(claudeAgents)
          .filter((a) => managed(a.name))
      : [];
  return [
    '# Personal delegation table',
    '',
    `> Written by reins from \`.agents/harness/bindings.yaml\` and your \`.loctx/bindings.local.yaml\` — this machine only. Do not edit it; the user changes it with \`reins config --local\` in a terminal, which removes it once it matches the team's table again. Follow it instead of the \`## Delegation\` section of AGENTS.md.`,
    '',
    renderDelegation(effective, { teamAgents }),
    '',
  ].join('\n');
}

/** The managed blocks for this project, from the packaged template. */
export function renderBlocks(harness: string, doc: BindingsV2, language: string): Block[] {
  const text = readFileSync(join(harness, 'templates/agents-md-blocks.md'), 'utf8')
    .replace('{{DELEGATION}}', () => renderDelegation(doc))
    .replace('{{LANGUAGE}}', () => language);
  return parseBlocks(text);
}

export const ONBOARDING_PENDING = '<!-- reins:onboarding pending -->';
export const RECONCILE_PENDING = '<!-- reins:reconcile pending -->';

/** The onboarding to-do (design §5), placed above the project sections; the PM sets the marker to `done`. */
export function onboardingNote(needsHookTool: boolean): string {
  const todo = [
    'goals and scope',
    'stack and commands',
    'existing rules and conventions',
    'red lines (paths not to touch, secret files)',
    'the language of documents the user reads',
    ...(needsHookTool ? ['which hook tool runs the gates (none was found)'] : []),
  ];
  return [
    ONBOARDING_PENDING,
    `> **Onboarding — do this first in the next conversation.** Run the \`onboard\` skill: read the project, ask the user, and write the project sections of this file: ${todo.join('; ')}. Then change the marker above to \`<!-- reins:onboarding done -->\`.`,
  ].join('\n');
}

/** The reconcile note (design §5): the previous body moved aside as reference material. */
export function reconcileNote(why: string): string {
  return [
    RECONCILE_PENDING,
    `> **Reconcile — do this first in the next conversation.** ${why} The previous AGENTS.md is in \`.agents/AGENTS.previous.md\` as reference material, not instructions. Run the \`onboard\` skill to merge what still applies into the project sections, then delete that file and change the marker above to \`<!-- reins:reconcile done -->\`.`,
  ].join('\n');
}

/** Put a note right after the first H1 (or at the top) unless one of that kind is still pending. */
/** The light check after a mode switch (design §5, spec ST-5): only the delegation block changed. */
export function modeChangedNote(from: string, to: string): string {
  return [
    '<!-- reins:mode-changed pending -->',
    `> **Mode changed from ${from} to ${to}.** reins rewrote the delegation section. In the next conversation (the \`onboard\` skill), check that the project sections below say nothing that contradicts the new mode, then change the marker above to \`<!-- reins:mode-changed done -->\`.`,
  ].join('\n');
}

export function placeNote(
  text: string,
  note: string,
  kind: 'onboarding' | 'reconcile' | 'mode-changed',
): string {
  if (text.includes(`<!-- reins:${kind} pending -->`)) return text;
  // a finished one gives way to the new one (e.g. a second mode switch)
  // only the note reins wrote goes with its marker; a project quote under it stays
  const lead = { onboarding: 'Onboarding', reconcile: 'Reconcile', 'mode-changed': 'Mode changed' }[
    kind
  ];
  text = text.replace(
    new RegExp(`<!-- reins:${kind} done -->\\n(?:> \\*\\*${lead}[^\\n]*\\n)?\\n?`),
    '',
  );
  const m = /^# .*\n/m.exec(text);
  if (!m) return `${note}\n\n${text}`;
  const at = m.index + m[0].length;
  return `${text.slice(0, at)}\n${note}\n${text.slice(at)}`;
}
