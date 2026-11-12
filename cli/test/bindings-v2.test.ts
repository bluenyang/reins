import { describe, expect, it } from 'vitest';
import { cliOf, localDelegation, renderDelegation, FALLBACK_RULE } from '../src/lib/agents-md.js';
import {
  auditBinding,
  defaultBindings,
  auditFallback,
  auditRequired,
  convertV1,
  fallbackProblems,
  mergeLocal,
  resolveRoles,
  validateBindings,
  type BindingsV2,
} from '../src/lib/bindings.js';

const sonnet = { vendor: 'claude', model: 'claude-sonnet-5-5' };
const terra = { vendor: 'openai', model: 'gpt-6.1-terra' };
const sol = { vendor: 'openai', model: 'gpt-6.1-sol' };
const fable = { vendor: 'claude', model: 'claude-fable-5-1' };

const pick = (doc: BindingsV2, group: string, role: string) =>
  resolveRoles(doc).find((r) => r.group === group && r.role === role)!;

describe('bindings v2 resolution (019 S-4, S-5)', () => {
  it('single mode is the default and switches every group off', () => {
    const doc: BindingsV2 = { schema: 'reins/bindings@2', groups: { implementer: sonnet } };
    expect(resolveRoles(doc).every((r) => !r.on && r.source === 'off')).toBe(true);
  });

  it('a group without a model is off in multi mode', () => {
    const doc: BindingsV2 = { schema: 'reins/bindings@2', mode: 'multi', groups: {} };
    expect(pick(doc, 'executor', 'researcher')).toMatchObject({ on: false, models: [] });
  });

  it('a role override beats the group, which covers the other roles', () => {
    const doc: BindingsV2 = {
      schema: 'reins/bindings@2',
      mode: 'multi',
      groups: { implementer: { ...sonnet, roles: { doc: fable } } },
    };
    expect(pick(doc, 'implementer', 'code')).toMatchObject({ models: [sonnet], source: 'group' });
    expect(pick(doc, 'implementer', 'doc')).toMatchObject({ models: [fable], source: 'role' });
  });

  it('pl: the first model is control, one reviewer, discussion uses all', () => {
    const doc: BindingsV2 = {
      schema: 'reins/bindings@2',
      mode: 'multi',
      groups: { pl: { models: [sonnet, terra, sol] } },
    };
    expect(pick(doc, 'pl', 'control').models).toEqual([sonnet]);
    expect(pick(doc, 'pl', 'code-reviewer').models).toEqual([terra]);
    expect(pick(doc, 'pl', 'discussion').models).toEqual([sonnet, terra, sol]);
  });

  it('pl with one model: that model controls and reviews', () => {
    const doc: BindingsV2 = { schema: 'reins/bindings@2', mode: 'multi', groups: { pl: sonnet } };
    expect(pick(doc, 'pl', 'control').models).toEqual([sonnet]);
    expect(pick(doc, 'pl', 'plan-reviewer').models).toEqual([sonnet]);
  });

  it('the advisor committee uses every model', () => {
    const doc: BindingsV2 = {
      schema: 'reins/bindings@2',
      mode: 'multi',
      groups: { advisor: { models: [fable, sol] } },
    };
    expect(pick(doc, 'advisor', 'committee').models).toEqual([fable, sol]);
  });

  it('the audit runs on the auditor model, else on no named model; required unless false', () => {
    const base: BindingsV2 = { schema: 'reins/bindings@2', default: fable };
    // `default` named the PM's model before 0.3.2; nothing reads it now (022 S-27a)
    expect(auditBinding(base)).toBeUndefined();
    expect(mergeLocal(base, { default: sol }).default).toBeUndefined();
    expect(mergeLocal(base, {}).default).toBeUndefined();
    expect(defaultBindings([]).default).toBeUndefined();
    expect(auditBinding({ ...base, groups: { auditor: sol } })).toEqual(sol);
    expect(auditRequired(base)).toBe(true);
    expect(auditRequired({ ...base, audit: { required: false } })).toBe(false);
  });
});

describe('local override (019 S-4)', () => {
  it('wins per key and replaces a group as a whole', () => {
    const team: BindingsV2 = {
      schema: 'reins/bindings@2',
      mode: 'single',
      groups: { pl: { models: [sonnet, terra] }, implementer: sonnet },
    };
    const merged = mergeLocal(team, { mode: 'multi', groups: { pl: sol } });
    expect(merged.mode).toBe('multi');
    expect(merged.groups?.pl).toEqual(sol);
    expect(merged.groups?.implementer).toEqual(sonnet);
    expect(mergeLocal(team, undefined)).toBe(team);
  });
});

describe('schema (019 S-4)', () => {
  it('accepts a full file and refuses run-time keys and half bindings', () => {
    const ok: BindingsV2 = {
      schema: 'reins/bindings@2',
      mode: 'multi',
      audit: { required: true },
      default: fable,
      tools: { claude: { cli: 'claude', use: true } },
      groups: { pl: { models: [sonnet, terra], roles: { 'doc-reviewer': sonnet } }, auditor: sol },
    };
    expect(validateBindings(ok)).toEqual([]);
    expect(validateBindings({ ...ok, escalation: ['pl', 'pm'] })).not.toEqual([]);
    expect(validateBindings({ ...ok, groups: { implementer: { vendor: 'claude' } } })).not.toEqual(
      [],
    );
    expect(validateBindings({ ...ok, groups: { implementer: { models: [sonnet] } } })).not.toEqual(
      [],
    );
  });
});

describe('version 1 → 2 (019 S-15, design §7)', () => {
  it('maps roles to groups, keeps single mode and says what was dropped', () => {
    const { doc, notes } = convertV1({
      schema: 'reins/bindings@1',
      vendors: {
        claude: { cli: 'claude', available: true },
        openai: { cli: 'codex', available: false },
      },
      roles: {
        pm: { vendor: 'claude', model: 'claude-opus-5-5' },
        pl: { vendor: 'openai', model: 'gpt-6.1-sol' },
        'code-review': { vendor: 'openai', model: 'gpt-6.1-sol', fallback: 'x' },
        implementer: { vendor: 'claude', model: 'claude-sonnet-5-5', parallel: 4 },
        'qa-design': { vendor: 'google', model: 'gemini-4-argon-high' },
        lookup: { vendor: 'cursor', model: 'cursor-grok', enabled: false },
      },
      escalation: ['pl', 'pm', 'advisor'],
    });
    expect(validateBindings(doc)).toEqual([]);
    expect(doc.mode).toBe('single');
    expect(doc.default).toBeUndefined();
    expect(notes).toContain(
      'role pm: not moved — the PM is the model in the conversation, no setting names it',
    );
    expect(doc.groups?.pl).toMatchObject({ vendor: 'openai', model: 'gpt-6.1-sol' });
    // a fallback moves with the model it belonged to (021 S-19)
    expect(doc.groups?.pl?.roles?.['code-reviewer']).toEqual({
      ...sol,
      fallback: { vendor: 'claude', model: 'x' },
    });
    expect(notes).toContain('role code-review: fallback → pl.code-reviewer (claude x)');
    expect(doc.groups?.planner?.roles?.['qa-designer']?.vendor).toBe('google');
    expect(doc.groups?.executor).toBeUndefined();
    expect(doc.tools).toEqual({
      claude: { cli: 'claude', use: true },
      openai: { cli: 'codex', use: false },
    });
    expect(notes).toContain('role lookup: was off, left off');
    expect(notes).toContain('escalation: dropped (no run-time keys)');
    expect(notes.some((n) => n.includes('parallel dropped'))).toBe(true);
    expect(notes.some((n) => n.startsWith('mode: single'))).toBe(true);
  });
});

describe('fallback models (021 S-16, S-17, S-19)', () => {
  const astra = { vendor: 'openai', model: 'gpt-6-astra' };
  const base: BindingsV2 = { schema: 'reins/bindings@2', mode: 'multi' };
  const withGroups = (groups: BindingsV2['groups']): BindingsV2 => ({ ...base, groups });

  it('(a) the schema takes one on a group and on a role, and nowhere else', () => {
    expect(
      validateBindings(
        withGroups({
          implementer: { ...sonnet, fallback: terra, roles: { doc: { ...sonnet, fallback: sol } } },
          pl: { models: [sonnet, terra], fallback: fable },
        }),
      ),
    ).toEqual([]);
    const bad = (doc: unknown) => validateBindings(doc).length > 0;
    expect(bad({ ...base, default: { ...fable, fallback: sonnet } })).toBe(true);
    expect(
      bad(
        withGroups({ implementer: { ...sonnet, fallback: { ...terra, fallback: sol } } } as never),
      ),
    ).toBe(true);
    expect(bad(withGroups({ pl: { models: [{ ...sonnet, fallback: terra }] } } as never))).toBe(
      true,
    );
    expect(
      bad(withGroups({ implementer: { ...sonnet, fallback: 'gpt-6.1-terra' } } as never)),
    ).toBe(true);
  });

  it("(b) a fallback goes with the model: the group's for roles on the group model, its own for a role with one", () => {
    const doc = withGroups({
      implementer: {
        ...sonnet,
        fallback: terra,
        roles: { doc: { ...sonnet, fallback: sol }, qa: fable },
      },
      executor: { ...sonnet },
      pl: { models: [sonnet, terra], fallback: fable },
    });
    expect(pick(doc, 'implementer', 'code').fallback).toEqual(terra); // the group's
    expect(pick(doc, 'implementer', 'doc').fallback).toEqual(sol); // its own
    expect(pick(doc, 'implementer', 'qa').fallback).toBeUndefined(); // own model, no fallback: none
    expect(pick(doc, 'executor', 'researcher').fallback).toBeUndefined();
    expect(pick(doc, 'pl', 'discussion').fallback).toEqual(fable); // several models, one fallback
    // single mode: nothing is on, so nothing has one
    expect(resolveRoles({ ...doc, mode: 'single' }).some((r) => r.fallback)).toBe(false);
  });

  it('a fallback needs a model beside it in the same file and must be another model', () => {
    expect(fallbackProblems(withGroups({ implementer: { ...sonnet, fallback: terra } }))).toEqual(
      [],
    );
    expect(fallbackProblems({ groups: { implementer: { fallback: terra } } })[0]).toMatch(
      /^implementer: a fallback needs the group's model in the same file/,
    );
    expect(
      fallbackProblems(withGroups({ implementer: { ...sonnet, fallback: sonnet } }))[0],
    ).toMatch(/the fallback is the group's own model/);
    expect(
      fallbackProblems(withGroups({ pl: { models: [sonnet, terra], fallback: terra } }))[0],
    ).toMatch(/the fallback is the group's own model/);
    expect(
      fallbackProblems(
        withGroups({ pl: { ...sonnet, roles: { control: { ...sol, fallback: sol } } } }),
      )[0],
    ).toMatch(/^pl\.control: the fallback is the role's own model/);
    // a personal file that sets only a fallback would switch the group off for that person
    const merged = mergeLocal(withGroups({ implementer: sonnet }), {
      groups: { implementer: { fallback: terra } },
    });
    expect(pick(merged, 'implementer', 'code').on).toBe(false);
  });

  it('(c) the table cell names the fallback and how to call it: another vendor, Claude, a writing group', () => {
    const doc: BindingsV2 = {
      ...withGroups({
        pl: { ...sonnet, roles: { 'code-reviewer': { ...sol, fallback: terra } } },
        implementer: { ...sonnet, fallback: terra },
        executor: { ...terra, fallback: sonnet },
      }),
      tools: { openai: { cli: 'codex' } },
    };
    const t = renderDelegation(doc);
    // a reviewer stays read-only on its fallback too
    expect(t).toContain(
      '| pl/code-reviewer | openai gpt-6.1-sol | `codex exec -m gpt-6.1-sol -s read-only -` (task on stdin); fallback: openai gpt-6.1-terra — `codex exec -m gpt-6.1-terra -s read-only -` (task on stdin) |',
    );
    // a writing group writes on its fallback too
    expect(t).toContain(
      '| implementer/code | claude claude-sonnet-5-5 | subagent `rs-implementer-code`; fallback: openai gpt-6.1-terra — `codex exec -m gpt-6.1-terra -s workspace-write -` (task on stdin) |',
    );
    // a Claude fallback has no agent file of its own
    expect(t).toContain(
      '; fallback: claude claude-sonnet-5-5 — a general subagent on `claude-sonnet-5-5`, given the `researcher` section of `.agents/harness/roles/executor.md` |',
    );
    // a role without one has nothing after its call
    expect(t).toContain('| pl/control | claude claude-sonnet-5-5 | subagent `rs-pl-control` |');
    expect(t).toContain(FALLBACK_RULE);
    expect(FALLBACK_RULE).toContain('cannot be made');
    expect(FALLBACK_RULE).toContain('say that you did and why');
    expect(FALLBACK_RULE).toContain('stop and ask');
    // a person's own table is drawn the same way
    expect(localDelegation(base, doc)).toContain('; fallback: openai gpt-6.1-terra — ');
  });

  it('(d, l) without a fallback the section is what 0.3.0 wrote, to the letter', () => {
    const doc: BindingsV2 = {
      ...withGroups({ pl: { ...sonnet, roles: { 'code-reviewer': sol } }, auditor: astra }),
      tools: { openai: { cli: 'codex' } },
    };
    const t = renderDelegation(doc);
    expect(t).not.toContain('fallback');
    expect(t.split('\n').slice(-3)).toEqual([
      'Routine review takes one reviewer; `pl/discussion` and `advisor/committee` (every listed model, without seeing each other) are for large decisions, audit remedies, incidents and unresolved disagreements.',
      '',
      'Audit: **required every version**; run it on openai gpt-6-astra in a fresh run that gets only the records, never this conversation.',
    ]);
  });

  it("(k) the audit line names the auditor's fallback, in single mode too", () => {
    for (const mode of ['single', 'multi'] as const) {
      const doc: BindingsV2 = { ...base, mode, groups: { auditor: { ...astra, fallback: fable } } };
      expect(auditFallback(doc)).toEqual(fable);
      expect(renderDelegation(doc)).toContain(
        'run it on openai gpt-6-astra (fallback: claude claude-fable-5-1, when that model cannot be called — say so in the audit report) in a fresh run',
      );
    }
    expect(auditFallback(withGroups({ auditor: astra }))).toBeUndefined();
    expect(auditFallback(base)).toBeUndefined();
  });

  it('(g) a version-1 fallback moves with its model; one that cannot be read, or is the model, is dropped and said', () => {
    const { doc, notes } = convertV1({
      schema: 'reins/bindings@1',
      roles: {
        pm: { vendor: 'claude', model: 'claude-opus-5-5' },
        implementer: { ...sonnet, fallback: { vendor: 'openai', model: 'gpt-6.1-terra' } },
        docs: { ...sonnet, fallback: 'gpt-6.1-sol' },
        'code-review': { ...sol, fallback: 7 },
        deploy: { ...sonnet, fallback: 'claude-sonnet-5-5' },
        planner: { ...fable, fallback: {} },
      },
    });
    expect(validateBindings(doc)).toEqual([]);
    expect(fallbackProblems(doc)).toEqual([]);
    expect(doc.groups?.implementer).toMatchObject({ ...sonnet, fallback: terra });
    expect(doc.groups?.implementer?.roles?.['doc']).toEqual({ ...sonnet, fallback: sol });
    expect(doc.groups?.pl?.roles?.['code-reviewer']).toEqual(sol);
    expect(doc.groups?.executor?.roles?.['deployer']).toEqual(sonnet);
    expect(notes).toContain('role implementer: fallback → implementer (openai gpt-6.1-terra)');
    expect(notes).toContain('role docs: fallback → implementer.doc (openai gpt-6.1-sol)');
    expect(notes).toContain('role code-review: fallback dropped (not a model)');
    expect(notes).toContain('role deploy: fallback dropped (same as the model)');
    expect(notes).toContain('role planner: fallback dropped (not a model)');
  });
});

describe('the command of a call line (021 S-28)', () => {
  const doc = (tools?: BindingsV2['tools']): BindingsV2 => ({
    schema: 'reins/bindings@2',
    mode: 'multi',
    ...(tools ? { tools } : {}),
    groups: {
      pl: { ...terra, fallback: { vendor: 'google', model: 'gemini-4-argon-high' } },
      executor: { vendor: 'cursor', model: 'cursor-grok-4.5-high-fast' },
      advisor: {
        vendor: 'acme',
        model: 'acme-1',
        fallback: { vendor: 'openai', model: 'gpt-6-astra' },
      },
    },
  });

  it('without a recorded CLI it is the one reins knows for the vendor, in the call and in the fallback', () => {
    expect(cliOf(doc(), 'openai')).toBe('codex');
    const t = renderDelegation(doc());
    expect(t).toContain(
      '| pl/control | openai gpt-6.1-terra | `codex exec -m gpt-6.1-terra -s read-only -` (task on stdin); fallback: google gemini-4-argon-high — `agy -p "<task>" --model gemini-4-argon-high --mode plan` |',
    );
    expect(t).toContain('`cursor-agent -p --model cursor-grok-4.5-high-fast "<task>"`');
    expect(t).not.toMatch(/`openai exec|`google -p|`cursor -p/);
    // a vendor reins does not know keeps its name; its openai fallback is still codex
    expect(t).toContain(
      '| advisor/committee | acme acme-1 | `acme` with model `acme-1`; fallback: openai gpt-6-astra — `codex exec -m gpt-6-astra -s read-only -` (task on stdin) |',
    );
  });

  it('a recorded CLI wins, so a table written from detected tools does not change', () => {
    const t = renderDelegation(doc({ openai: { cli: 'my-codex' }, google: { cli: 'gemini' } }));
    expect(t).toContain('`my-codex exec -m gpt-6.1-terra -s read-only -`');
    expect(t).toContain('`gemini -p "<task>" --model gemini-4-argon-high --mode plan`');
    // a tool entry without a cli (only use: false, say) falls back to the default as well
    expect(renderDelegation(doc({ openai: { use: true } }))).toContain(
      '`codex exec -m gpt-6.1-terra',
    );
  });
});
