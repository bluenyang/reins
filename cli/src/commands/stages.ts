import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { harnessDir, readYaml } from '../lib/harness.js';
import { loadSchemas, validateFile } from '../lib/schema.js';
import type { Finding } from '../lib/verdict.js';
import { compound } from './gate.js';
import {
  approvedBy,
  busFor,
  historyPages,
  intentFile,
  intentIds,
  openTickets,
  recordedDecisions,
  ticketFile,
} from '../lib/work.js';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const mentions = (text: string, id: string) =>
  new RegExp(`(?<![\\w-])${id.replace(/[-]/g, '\\-')}(?![\\w-])`).test(text);

/** Words of a phrase, for matching an ask against recorded decisions. */
function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 || /\p{Script=Hangul}/u.test(w)),
  );
}

/** A recorded decision whose every word appears in the ask — the question was probably answered before. */
function answeredBefore(root: string, ask: string): { path: string; decision: string }[] {
  const a = words(ask);
  return recordedDecisions(root).filter(({ decision }) => {
    const d = [...words(decision)];
    return d.length > 0 && d.every((w) => a.has(w));
  });
}

/** The intent → spec → plan chain a ticket stands on (design §4: approved ∧ accepted ∧ reviewed). */
function approvalChain(root: string, intent: string, ticket: string): Finding[] {
  const out: Finding[] = [];
  const i = intentFile(root, intent, 'intent');
  if (!i)
    return [
      {
        reason: 'B3',
        verdict: 'HOLD',
        message: `ticket ${ticket} belongs to intent ${intent}, which has no intent.md`,
        resume: 'write the intent with the user (reins-intent) or move the ticket to its intent',
      },
    ];
  if (i.data['status'] !== 'approved')
    out.push({
      reason: 'B3',
      verdict: 'HOLD',
      path: i.path,
      message: `intent ${intent} is ${str(i.data['status']) || 'without a status'} — only the user approves an intent`,
      resume:
        'show the intent to the user; on approval set status: approved, add approvals: [{role: user, at}] and commit with an Approved-by: trailer',
    });
  else {
    if (!hasUser(i.data['approvals']))
      out.push({
        reason: 'B3',
        verdict: 'HOLD',
        path: i.path,
        message: 'intent approvals: has no user entry',
        resume: 'record the user approval: approvals: [{role: user, at: <date>}]',
      });
    if (approvedBy(root, i.path).length === 0)
      out.push({
        reason: 'B3',
        verdict: 'HOLD',
        path: i.path,
        message: 'the approval is not recorded in git (no commit with an Approved-by: trailer)',
        resume: 'commit the status change with the trailer "Approved-by: <user>"',
      });
  }
  const s = intentFile(root, intent, 'spec');
  if (s?.data['status'] !== 'accepted')
    out.push({
      reason: 'B3',
      verdict: 'HOLD',
      path: s?.path,
      message: s
        ? `spec of intent ${intent} is ${str(s.data['status'])}, not accepted`
        : `intent ${intent} has no spec.md`,
      resume:
        'planner writes spec.md → pm and qa-design review → the user sees summary_for_user and does not veto (R64)',
    });
  const p = intentFile(root, intent, 'plan');
  if (!p || !['reviewed', 'active'].includes(str(p.data['status'])))
    out.push({
      reason: 'F2',
      verdict: 'STOP',
      path: p?.path,
      message: p
        ? `plan of intent ${intent} is ${str(p.data['status'])}, not reviewed`
        : `intent ${intent} has no plan.md`,
      resume: 'pl writes plan.md, qa-design reviews it lightly, then status: reviewed',
    });
  else if (!list(p.data['tickets']).includes(ticket))
    out.push({
      reason: 'P2',
      verdict: 'STOP',
      path: p.path,
      message: `ticket ${ticket} is not in the plan's tickets:`,
      resume: 'add it to plan.md (order of work + tickets:) in the same commit, or drop the ticket',
    });
  return out;
}

function hasUser(approvals: unknown): boolean {
  return (
    Array.isArray(approvals) &&
    approvals.some((a) => (a as Record<string, unknown> | null)?.['role'] === 'user')
  );
}

/** T1 — before a ticket starts. */
export function ticketStart(root: string, id: string): Finding[] {
  const t = ticketFile(root, id);
  if (!t)
    return [
      {
        reason: 'F2',
        verdict: 'STOP',
        message: `no ticket ${id} in .loctx/ticket/`,
        resume: 'pl creates it from plan.md (one order-of-work item = one ticket)',
      },
    ];
  const findings: Finding[] = [];
  const dir = harnessDir(root);
  const v = dir ? loadSchemas(dir).get('ticket') : undefined;
  if (v)
    for (const i of validateFile(v, join(root, t.path)))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: t.path,
        message: `ticket: ${i.message}`,
        resume: 'fix the frontmatter to match ticket.schema.json',
      });
  findings.push(...approvalChain(root, str(t.data['intent']), id));

  for (const ask of list(t.data['asks'])) {
    const prior = answeredBefore(root, ask);
    findings.push({
      reason: 'B1',
      verdict: 'HOLD',
      path: t.path,
      message: prior.length
        ? `open ask "${ask}" — possibly answered already: ${prior.map((p) => `${p.decision} (${p.path})`).join('; ')}`
        : `open ask "${ask}"`,
      resume: prior.length
        ? "read the recorded decision; if it answers the ask, move it to the ticket's decisions section and clear asks:"
        : "ask the user; record the answer in the ticket's decisions section and clear asks:",
    });
  }

  const history = historyPages(root);
  for (const dep of list(t.data['depends'])) {
    const d = ticketFile(root, dep);
    if (d && d.data['status'] !== 'done')
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: t.path,
        message: `depends on ${dep}, which is ${str(d.data['status'])}`,
        resume: `finish ${dep} first`,
      });
    else if (!d && !history.some((h) => mentions(h.text, dep)))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: t.path,
        message: `depends on ${dep}, which is neither open nor recorded as done in history`,
        resume: `check the id; a finished ticket has a line in .loctx/history/`,
      });
  }

  const role = str(t.data['role']);
  if (dir) {
    const roleFile = join(dir, 'roles', `${role}.md`);
    const bindingsPath = join(dir, 'bindings.yaml');
    const bound = existsSync(bindingsPath)
      ? (readYaml<{ roles?: Record<string, unknown> }>(bindingsPath).roles ?? {})
      : null;
    if (!existsSync(roleFile))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: t.path,
        message: `role "${role}" does not exist (roles: ${readdirSync(join(dir, 'roles'))
          .map((f) => f.replace(/\.md$/, ''))
          .join(', ')})`,
        resume: 'set role: to one of the harness roles',
      });
    else if (bound && !(role in bound))
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: '.agents/harness/bindings.yaml',
        message: `role "${role}" has no binding`,
        resume: `reins configure bindings --set ${role}=<model>`,
      });
  }
  return findings;
}

/** What a raw evidence text says: the command line (`$ cmd`) and the exit code (`exit N`). */
export function readEvidence(
  root: string,
  evidence: string,
): {
  source: string;
  text: string;
  cmd?: string;
  exit?: number;
  outside?: boolean;
  empty?: boolean;
}[] {
  const tokens = evidence.split(/\s+/).filter(Boolean);
  // an absolute path inside the repository reads like a relative one; outside it is refused
  const inside = (t: string) => {
    const rel = relative(root, t);
    return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
  };
  const outside = tokens.filter((t) => isAbsolute(t) && !inside(t));
  const resolve = (t: string) => (isAbsolute(t) ? t : join(root, t));
  const files = tokens.length > 0 && tokens.every((t) => existsSync(resolve(t)));
  const pieces: { source: string; text: string; outside?: boolean }[] =
    outside.length > 0
      ? outside.map((t) => ({ source: t, text: '', outside: true }))
      : files
        ? tokens.map((t) => ({
            source: isAbsolute(t) ? relative(root, t) : t,
            text: readFileSync(resolve(t), 'utf8'),
          }))
        : [{ source: 'inline', text: evidence }];
  return pieces.map((p) => {
    const empty =
      !p.outside &&
      p.text
        .split(/\r?\n/)
        .filter((l) => !l.startsWith('$ ') && !/^exit[: =]?\s*-?\d+\s*$/i.test(l))
        .join('')
        .trim() === '';
    const code = /^exit[: =]?\s*(-?\d+)\s*$/im.exec(p.text)?.[1];
    return {
      ...p,
      empty,
      cmd: /^\$ (.+)$/m.exec(p.text)?.[1]?.trim(),
      exit: code === undefined ? undefined : Number(code),
    };
  });
}

/** T3 — at a gate or test verdict: the latest verification of a ticket must be a real pass. */
export function verdictCheck(root: string, id: string): Finding[] {
  const bus = busFor(root, id);
  const unreadable = bus.flatMap((b) => b.broken);
  if (unreadable.length > 0)
    return unreadable.map<Finding>((u) => ({
      reason: 'F2',
      verdict: 'STOP',
      path: u.path,
      message: `bus file is not valid YAML: ${u.message}`,
      resume: 'quote values containing ": " or " #" in double quotes, then re-run the check',
    }));
  const verifies = bus.filter((b) => b.request?.['kind'] === 'verify');
  if (verifies.length === 0)
    return [
      {
        reason: 'D5',
        verdict: 'STOP',
        message: `ticket ${id} has no verification exchange in .loctx/bus/`,
        resume:
          'pl sends a verify request; verify-tool runs the gates and answers with raw evidence',
      },
    ];
  const findings: Finding[] = [];
  const last = verifies.at(-1)!;
  const dir = harnessDir(root);
  const schemas = dir ? loadSchemas(dir) : undefined;
  const bad: Finding[] = [];
  for (const [kind, name] of [
    ['request', 'bus-request'],
    ['response', 'bus-response'],
  ] as const) {
    const v = schemas?.get(name);
    const rel = `.loctx/bus/${last.id}.${kind}.yaml`;
    if (v && last[kind])
      for (const i of validateFile(v, join(root, rel), true))
        bad.push({
          reason: 'F2',
          verdict: 'STOP',
          path: rel,
          message: `${name}: ${i.message}`,
          resume: 'fix the bus file against its schema, then re-run the check',
        });
  }
  if (bad.length > 0) return bad;
  if (!last.response)
    return [
      {
        reason: 'D5',
        verdict: 'STOP',
        path: `.loctx/bus/${last.id}.request.yaml`,
        message: 'verification requested but not answered',
        resume: 'verify-tool answers it with a response file',
      },
    ];
  // D1: consecutive failed rounds at the tail; a pass resets the counter
  let fails = 0;
  for (const b of verifies.toReversed()) {
    if (b.response?.['verdict'] !== 'fail') break;
    fails++;
  }
  if (fails >= 2)
    findings.push({
      reason: 'D1',
      verdict: 'ESCALATE',
      message: `${fails} failed verification rounds in a row for ${id}`,
      resume: 'the next role in the chain (pl → pm → advisor → user) finds the root cause',
    });
  else if (fails === 1)
    findings.push({
      reason: 'D1',
      verdict: 'WARN',
      path: `.loctx/bus/${last.id}.response.yaml`,
      message: 'the latest verification failed (round 1 of 2)',
      resume: 'fix and verify again; a second failure escalates',
    });
  if (last.response['verdict'] !== 'pass') return findings;

  const at = `.loctx/bus/${last.id}.response.yaml`;
  const ev = str(last.response['evidence']);
  if (!ev.trim())
    findings.push({
      reason: 'D5',
      verdict: 'STOP',
      path: at,
      message: 'pass without evidence',
      resume: 'attach the raw gate output (a .loctx/reports/ path or the text itself)',
    });
  else
    for (const e of readEvidence(root, ev)) {
      const at2 = e.source === 'inline' ? at : `${at} → ${e.source}`;
      if (e.outside) {
        findings.push({
          reason: 'D5',
          verdict: 'STOP',
          path: at2,
          message: 'evidence path outside the repository',
          resume: 'copy the gate output under .loctx/reports/ and cite that path',
        });
        continue;
      }
      if (e.empty)
        findings.push({
          reason: 'D4',
          verdict: 'WARN',
          path: at2,
          message: 'gate output is empty',
          resume: 'check that the gate produced output; attach it unabridged',
        });
      if (e.exit === undefined)
        findings.push({
          reason: 'D4',
          verdict: 'STOP',
          path: at2,
          message: 'evidence has no exit code line ("exit N")',
          resume: 're-run the gate unmodified and keep its exit code',
        });
      else if (e.exit !== 0)
        findings.push({
          reason: 'D4',
          verdict: 'STOP',
          path: at2,
          message: `reported as pass, but the evidence exits ${e.exit}`,
          resume: 'a non-zero exit is a failure; answer fail',
        });
      if (!e.cmd)
        findings.push({
          reason: 'D4',
          verdict: 'STOP',
          path: at2,
          message: 'evidence does not show the command that ran ("$ <cmd>")',
          resume: 're-run the gate from gates.yaml and keep the command line',
        });
      else if (compound(e.cmd))
        findings.push({
          reason: 'D4',
          verdict: 'STOP',
          path: at2,
          message: `the gate did not run as a single command: ${e.cmd}`,
          resume: 'run the gate exactly as gates.yaml declares it (C5)',
        });
    }
  return findings;
}

/** T5 — an rc closes: every planned ticket of the release's intents is done and recorded. */
export function rcClose(root: string, release: string | undefined): Finding[] {
  if (!release)
    return [
      {
        reason: 'F2',
        verdict: 'STOP',
        message: 'rc-close needs the release version (--release <version>)',
      },
    ];
  const intents = intentIds(root).filter((id) => {
    const i = intentFile(root, id, 'intent');
    return i?.data['status'] === 'approved' && String(i.data['version']) === release;
  });
  if (intents.length === 0)
    return [
      {
        reason: 'F2',
        verdict: 'STOP',
        message: `no approved intent has version ${release}`,
        resume: 'check the version, or set version: in the intents this release bundles',
      },
    ];
  const findings: Finding[] = [];
  const history = historyPages(root);
  const open = openTickets(root);
  for (const id of intents) {
    const p = intentFile(root, id, 'plan');
    const planned = list(p?.data['tickets']);
    if (!p || planned.length === 0) {
      findings.push({
        reason: 'F2',
        verdict: 'STOP',
        path: p?.path,
        message: `intent ${id} has no planned tickets`,
        resume: 'plan.md tickets: lists one id per order-of-work item',
      });
      continue;
    }
    for (const t of planned) {
      const f = open.find((o) => o.data['id'] === t);
      if (f)
        findings.push({
          reason: 'F2',
          verdict: 'STOP',
          path: f.path,
          message: `ticket ${t} is still open (${str(f.data['status'])})`,
          resume: 'finish it, write its history line, then delete the ticket file',
        });
      else if (!history.some((h) => mentions(h.text, t)))
        findings.push({
          reason: 'F2',
          verdict: 'STOP',
          message: `ticket ${t} is gone but no history page mentions it`,
          resume: 'write what was done in .loctx/history/',
        });
    }
    for (const o of open)
      if (o.data['intent'] === id && !planned.includes(str(o.data['id'])))
        findings.push({
          reason: 'P2',
          verdict: 'STOP',
          path: o.path,
          message: `ticket ${str(o.data['id'])} is not in the plan of intent ${id}`,
          resume: 'add it to plan.md (departure log) or close it',
        });
  }
  if (findings.length === 0) findings.push(...nextRc(root, release));
  return findings;
}

/**
 * The next rc number from the local ledger `.loctx/release/<V>.md` (one `- rc.N …` line per rc):
 * rc.1 when there is no ledger, else the last recorded rc + 1. A number already recorded is F2.
 */
function nextRc(root: string, release: string): Finding[] {
  const path = join(root, '.loctx', 'release', `${release}.md`);
  const recorded = existsSync(path)
    ? [...readFileSync(path, 'utf8').matchAll(/^\s*[-*]\s*rc\.(\d+)\b/gm)].map((m) => Number(m[1]))
    : [];
  const next = (recorded.at(-1) ?? 0) + 1;
  if (recorded.includes(next))
    return [
      {
        reason: 'F2',
        verdict: 'STOP',
        path,
        message: `${release}-rc.${next} is already recorded`,
        resume:
          'a version number is never reused; fix the ledger order or record the later rc last',
      },
    ];
  return [
    {
      reason: 'F2',
      verdict: 'WARN',
      path: existsSync(path) ? path : undefined,
      message: `next rc: ${release}-rc.${next}`,
    },
  ];
}
