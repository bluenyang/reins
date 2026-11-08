import { describe, expect, it } from 'vitest';
import {
  auditBinding,
  auditRequired,
  convertV1,
  mergeLocal,
  pmBinding,
  resolveRoles,
  validateBindings,
  type BindingsV2,
} from '../src/lib/bindings2.js';

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
    expect(pmBinding(doc)).toEqual({ vendor: 'claude', model: 'claude-opus-5-5' });
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

  it('the audit runs on the auditor model, else the PM; required unless false', () => {
    const base: BindingsV2 = { schema: 'reins/bindings@2', default: fable };
    expect(auditBinding(base)).toEqual(fable);
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
    expect(doc.default).toEqual({ vendor: 'claude', model: 'claude-opus-5-5' });
    expect(doc.groups?.pl).toMatchObject({ vendor: 'openai', model: 'gpt-6.1-sol' });
    expect(doc.groups?.pl?.roles?.['code-reviewer']).toEqual(sol);
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
