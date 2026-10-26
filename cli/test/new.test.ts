import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  newIntent,
  newRequest,
  newTicket,
  nextBusNumber,
  nextIntentId,
  nextTicketNumber,
  planStepCount,
} from '../src/commands/new.js';
import { loadSchemas, validateFile } from '../src/lib/schema.js';

const HARNESS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'harness');

function project(): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-new-'));
  cpSync(HARNESS, join(d, 'harness'), { recursive: true });
  return d;
}
function put(root: string, rel: string, text: string) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}
const schemas = loadSchemas(HARNESS);
const ok = (name: string, root: string, rel: string, whole = false) =>
  expect(validateFile(schemas.get(name)!, join(root, rel), whole)).toEqual([]);
const PLAN = `---\nintent: "012"\nstatus: active\nagents: { implement: [implementer] }\ntickets: ["012-1", "012-4"]\n---\n## 작업 순서\n1. a\n2. b\n3. c\n\n## 위험\n1. x\n`;

describe('reins new — numbering (C-2)', () => {
  it('intent ids: empty, holes', () => {
    expect(nextIntentId([])).toBe('001');
    expect(nextIntentId(['001', '002', '005'])).toBe('006');
  });
  it('ticket numbers: open, history-only and planned ids', () => {
    expect(nextTicketNumber('012')).toBe(1);
    expect(nextTicketNumber('012', ['012-1'], [], ['012-3'])).toBe(4);
    expect(nextTicketNumber('012', ['013-9'], ['012-7'], [])).toBe(8);
  });
  it('bus numbers follow the ticket only', () => {
    expect(nextBusNumber('012-1', [])).toBe('01');
    expect(
      nextBusNumber('012-1', [
        '012-1_01.request.yaml',
        '012-1_03.response.yaml',
        '012-10_09.request.yaml',
      ]),
    ).toBe('04');
  });
  it('counts the plan steps', () => {
    expect(planStepCount(PLAN.split('---\n')[2]!)).toBe(3);
    expect(planStepCount('no section')).toBeNull();
  });
});

describe('reins new — files (C-1, C-3, C-12)', () => {
  it('intent: next id, schema-valid, then refuses to overwrite', () => {
    const d = project();
    put(d, '.agents/intent/003_old/intent.md', 'x');
    const r = newIntent(d, 'fresh', { version: '0.3.0', origin: 'agent' });
    expect([r.code, r.stdout]).toEqual([0, '.agents/intent/004_fresh/intent.md\n']);
    ok('intent', d, '.agents/intent/004_fresh/intent.md');
    const text = readFileSync(join(d, '.agents/intent/004_fresh/intent.md'), 'utf8');
    expect(text).toContain('version: "0.3.0"');
    expect(text).toContain('origin: agent');
    expect(newIntent(d, 'Bad Slug').code).toBe(1);
    expect(newIntent(d, 'x', { origin: 'nobody' }).code).toBe(1);
  });

  it('ticket: plan_step, history number, schema-valid; out-of-range step exits 1', () => {
    const d = project();
    put(d, '.agents/intent/012_thing/plan.md', PLAN);
    put(d, '.loctx/history/2026-10-26-1000_012-5-done.md', '# 012-5 — done\n');
    const r = newTicket(d, '012', '2', 'second', {
      depends: '012-1,012-4',
      release: 'stabilization',
    });
    expect([r.code, r.stdout]).toEqual([0, '.loctx/ticket/012-6_second.md\n']);
    ok('ticket', d, '.loctx/ticket/012-6_second.md');
    const text = readFileSync(join(d, '.loctx/ticket/012-6_second.md'), 'utf8');
    expect(text).toContain('plan_step: 2');
    expect(text).toContain('depends: [012-1, 012-4]');
    expect(text).toContain('branch: feat/012-thing');
    const bad = newTicket(d, '012', '4', 'too-far');
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain('outside');
    expect(newTicket(d, '099', '1', 'x').code).toBe(1);
  });

  it('request: defaults by kind, next bus number, schema-valid', () => {
    const d = project();
    put(d, '.loctx/bus/012-1_01.request.yaml', 'x');
    const r = newRequest(d, '012-1', 'verify');
    expect([r.code, r.stdout]).toEqual([0, '.loctx/bus/012-1_02.request.yaml\n']);
    ok('bus-request', d, '.loctx/bus/012-1_02.request.yaml', true);
    const text = readFileSync(join(d, '.loctx/bus/012-1_02.request.yaml'), 'utf8');
    expect(text).toContain('to: verify-tool');
    expect(text).toContain('intent: "012"');
    expect(newRequest(d, '012-1', 'review').code).toBe(0);
    expect(readFileSync(join(d, '.loctx/bus/012-1_03.request.yaml'), 'utf8')).toContain(
      'to: code-review',
    );
    const bad = newRequest(d, '012-1', 'question', { from: 'nobody' });
    expect(bad.code).toBe(1);
    expect(newRequest(d, '012-1', 'implement', { to: 'ghost' }).code).toBe(1);
    ok('bus-request', d, '.loctx/bus/012-1_03.request.yaml', true);
  });

  it('request: question and stop-report need --from', () => {
    const d = project();
    for (const k of ['question', 'stop-report']) {
      const r = newRequest(d, '012-1', k);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain('--from');
    }
    const r = newRequest(d, '012-1', 'question', { from: 'implementer' });
    expect(r.code).toBe(0);
    const text = readFileSync(join(d, r.stdout.trim()), 'utf8');
    expect(text).toMatch(/from: implementer/);
    expect(text).toMatch(/to: pl/);
    expect(newRequest(d, '012-1', 'bogus').code).toBe(1);
  });

  it('never overwrites an existing file', () => {
    const d = project();
    put(d, '.agents/intent/012_thing/plan.md', PLAN.replace('["012-1", "012-4"]', '[]'));
    // a file at the computed path that numbering cannot see (no valid frontmatter id)
    put(d, '.loctx/ticket/012-1_same.md', 'keep');
    const r = newTicket(d, '012', '1', 'same');
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('already exists');
    expect(readFileSync(join(d, '.loctx/ticket/012-1_same.md'), 'utf8')).toBe('keep');
  });
});
