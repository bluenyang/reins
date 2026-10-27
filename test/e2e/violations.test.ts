import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Violation scenarios V1–V25 (intents 003, 004): each one breaks a rule on purpose in a throwaway git repository
 * and runs the built `cli/dist/reins.js` as a child process. The test reads the stop report (`--json`) and the
 * exit code — it never calls the verifier as a function. `test/e2e/build.ts` (vitest globalSetup) builds first.
 */

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const CLI = join(ROOT, 'cli', 'dist', 'reins.js');
const TOTAL = 25; // rows of the scenario table in the spec

const EXIT = { CONTINUE: 0, HOLD: 10, STOP: 20, ESCALATE: 30 } as const;
type Verdict = keyof typeof EXIT;

interface Finding {
  reason: string;
  verdict: string;
  path?: string;
  message: string;
}
interface Report {
  verdict: Verdict;
  findings: Finding[];
}

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

function put(root: string, rel: string, text: string) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

function reins(cwd: string, args: string[], input?: string) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input });
  // a --json run that printed nothing fails with its exit code, signal and stderr, not a bare JSON error
  if (args.includes('--json') && !r.stdout?.trim())
    throw new Error(
      `reins ${args.join(' ')}: no output (exit ${r.status}, signal ${r.signal})\n${r.stderr}`,
    );
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** The repository that every scenario starts from: an initial commit plus `install graph --mode auto`, committed. */
let template: string;
const copies: string[] = [];

beforeAll(() => {
  template = mkdtempSync(join(tmpdir(), 'reins-violations-tpl-'));
  git(template, 'init', '-q');
  git(template, 'commit', '-q', '--allow-empty', '-m', 'init');
  const r = reins(template, ['install', 'graph', '--mode', 'auto']);
  if (r.code !== 0) throw new Error(`install failed (${r.code}): ${r.stderr}`);
  git(template, 'add', '-A');
  git(template, 'commit', '-q', '-m', 'chore: install reins');
});

afterAll(() => {
  for (const d of [template, ...copies])
    if (d) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function fresh(): string {
  const d = mkdtempSync(join(tmpdir(), 'reins-violations-'));
  cpSync(template, d, { recursive: true });
  copies.push(d);
  return d;
}

// ---- fixtures: the frontmatter shapes of harness/templates and harness/schemas ----

const INTENT = (status: string, extra = '') =>
  `---\nid: "001"\nslug: demo\nversion: 0.2.0\nstatus: ${status}\norigin: user\napprovals: ${
    status === 'approved' ? '[{role: user, at: 2026-10-25}]' : '[]'
  }\n${extra}---\n## 문제\n—\n`;
const SPEC = `---\nintent: "001"\nstatus: accepted\napprovals: []\nsummary_for_user: "x"\n---\n## 요구 해석\n- S-1 —\n`;
const PLAN = (tickets = '["001-1", "001-2"]') =>
  `---\nintent: "001"\nstatus: reviewed\nagents: { implement: [implementer] }\ntickets: ${tickets}\n---\n## 작업 순서\n1. a\n2. b\n`;
const TICKET = (id: string, extra = '') =>
  `---\nid: ${id}\nintent: "001"\nplan_step: 1\ntitle: t\nstatus: todo\nrelease: planned\nrole: implementer\n${extra}---\n## 목적\n—\n`;

/** An intent the user approved (committed with the Approved-by trailer), an accepted spec and a reviewed plan. */
function chain(d: string, o: { intent?: string; plan?: string } = {}) {
  put(d, '.agents/intent/001_demo/intent.md', INTENT(o.intent ?? 'approved'));
  put(d, '.agents/intent/001_demo/spec.md', SPEC);
  put(d, '.agents/intent/001_demo/plan.md', o.plan ?? PLAN());
  git(d, 'add', '.agents/intent');
  git(d, 'commit', '-q', '-m', 'docs(intent): approve 001', '-m', 'Approved-by: user');
}

function bus(d: string, id: string, verdict: string, evidence: string) {
  put(
    d,
    `.loctx/bus/${id}.request.yaml`,
    `schema: reins/bus/request@1\nid: ${id}\nfrom: pl\nto: verify-tool\nticket: 001-1\nintent: "001"\nkind: verify\nchanges: []\nwhy: w\nrevert: r\n`,
  );
  put(
    d,
    `.loctx/bus/${id}.response.yaml`,
    `schema: reins/bus/response@1\nrequest: ${id}\nfrom: verify-tool\nverdict: ${verdict}\ngrounds: g\nmay_proceed: true\nevidence: ${JSON.stringify(evidence)}\n`,
  );
}

// ---- the table ----

interface Scenario {
  id: string;
  violation: string;
  /** given a fresh repository, makes the violation and asserts that it is caught; throws otherwise */
  run: (d: string) => void;
}

/** A verifier scenario: break a rule, run `reins <args> --json`, expect the reason id, verdict and exit code. */
function stops(
  id: string,
  violation: string,
  args: string[],
  expected: { reason: string; verdict: Verdict; path?: string; message?: string },
  setup: (d: string) => void,
  stdin?: (d: string) => string,
): Scenario {
  return {
    id,
    violation,
    run: (d) => {
      setup(d);
      const r = reins(d, [...args, '--json'], stdin?.(d));
      const report = JSON.parse(r.stdout) as Report;
      // the finding that names this very violation, not just any finding of the same reason
      const own = report.findings.filter(
        (f) =>
          f.reason === expected.reason &&
          f.verdict === expected.verdict &&
          (expected.path === undefined || f.path === expected.path) &&
          (expected.message === undefined || f.message.includes(expected.message)),
      );
      expect(own.length, r.stdout).toBeGreaterThan(0);
      expect(report.verdict).toBe(expected.verdict);
      expect(r.code).toBe(EXIT[expected.verdict]);
    },
  };
}

const preCommit = ['check', '--stage', 'pre-commit'];
const drift = ['check', '--drift'];
const ticketStart = (t: string) => ['check', '--stage', 'ticket-start', '--ticket', t];
const verdict = ['check', '--stage', 'verdict', '--ticket', '001-1'];

const SCENARIOS: Scenario[] = [
  stops('V1', '.env staged', preCommit, { reason: 'C4', verdict: 'STOP', path: '.env' }, (d) => {
    put(d, '.env', 'TOKEN=x\n');
    git(d, 'add', '-f', '.env');
  }),
  stops(
    'V2',
    'a .loctx/ file force-staged',
    preCommit,
    { reason: 'F2', verdict: 'STOP', path: '.loctx/note.md', message: 'local-only' },
    (d) => {
      put(d, '.loctx/note.md', 'local\n');
      git(d, 'add', '-f', '.loctx/note.md');
    },
  ),
  stops(
    'V3',
    '.loctx/ removed from .gitignore',
    preCommit,
    { reason: 'F2', verdict: 'STOP', message: 'not in .gitignore' },
    (d) => put(d, '.gitignore', '# nothing ignored\n'),
  ),
  stops(
    'V4',
    'installed role file edited by hand',
    drift,
    {
      reason: 'F2',
      verdict: 'STOP',
      path: '.agents/harness/roles/implementer.md',
      message: 'differs from upstream',
    },
    (d) => appendFileSync(join(d, '.agents/harness/roles/implementer.md'), '\nedited\n'),
  ),
  stops(
    'V5',
    'generated .claude/agents/* edited by hand',
    drift,
    {
      reason: 'C3',
      verdict: 'STOP',
      path: '.claude/agents/reins-implementer.md',
      message: 'edited by hand',
    },
    (d) => appendFileSync(join(d, '.claude/agents/reins-implementer.md'), '\nedited\n'),
  ),
  stops(
    'V6',
    'SKILL.md name differs from its directory',
    drift,
    {
      reason: 'F2',
      verdict: 'STOP',
      path: '.agents/skills/foo/SKILL.md',
      message: 'must equal its directory',
    },
    (d) =>
      put(
        d,
        '.agents/skills/foo/SKILL.md',
        '---\nname: bar\ndescription: A skill whose name is not its directory.\n---\n# foo\n',
      ),
  ),
  stops(
    'V7',
    'ticket frontmatter breaks the schema',
    drift,
    { reason: 'F2', verdict: 'STOP', path: '.loctx/ticket/001-1_x.md', message: 'ticket:' },
    (d) =>
      put(d, '.loctx/ticket/001-1_x.md', TICKET('001-1').replace('status: todo', 'status: wizard')),
  ),
  stops(
    'V8',
    'push whose remote commit is not an ancestor',
    ['check', '--stage', 'pre-push'],
    { reason: 'A1', verdict: 'HOLD', path: 'refs/heads/main', message: 'not an ancestor' },
    (d) => {
      const base = git(d, 'rev-parse', 'HEAD');
      const branch = git(d, 'rev-parse', '--abbrev-ref', 'HEAD');
      git(d, 'commit', '-q', '--allow-empty', '-m', 'local');
      put(d, '.loctx/local-sha', git(d, 'rev-parse', 'HEAD'));
      git(d, 'checkout', '-q', '-b', 'remote-side', base);
      git(d, 'commit', '-q', '--allow-empty', '-m', 'remote');
      put(d, '.loctx/remote-sha', git(d, 'rev-parse', 'HEAD'));
      git(d, 'checkout', '-q', branch);
    },
    (d) => {
      const sha = (f: string) => readFileSync(join(d, '.loctx', f), 'utf8').trim();
      return `refs/heads/main ${sha('local-sha')} refs/heads/main ${sha('remote-sha')}\n`;
    },
  ),
  stops(
    'V9',
    'ticket started under a draft intent',
    ticketStart('001-1'),
    { reason: 'B3', verdict: 'HOLD', message: 'intent 001 is draft' },
    (d) => {
      chain(d, { intent: 'draft' });
      put(d, '.loctx/ticket/001-1_x.md', TICKET('001-1'));
    },
  ),
  stops(
    'V10',
    'ticket started with an open ask',
    ticketStart('001-1'),
    { reason: 'B1', verdict: 'HOLD', message: 'open ask "which output format?"' },
    (d) => {
      chain(d);
      put(d, '.loctx/ticket/001-1_x.md', TICKET('001-1', 'asks: ["which output format?"]\n'));
    },
  ),
  stops(
    'V11',
    'ticket that the plan does not list',
    ticketStart('001-3'),
    { reason: 'P2', verdict: 'STOP', message: 'ticket 001-3 is not in the plan' },
    (d) => {
      chain(d);
      put(d, '.loctx/ticket/001-3_x.md', TICKET('001-3'));
    },
  ),
  stops(
    'V12',
    'pass without evidence',
    verdict,
    { reason: 'D5', verdict: 'STOP', message: 'pass without evidence' },
    (d) => bus(d, '001-1_01', 'pass', ''),
  ),
  stops(
    'V13',
    'gate evidence that went through a pipe',
    verdict,
    { reason: 'D4', verdict: 'STOP', message: 'did not run as a single command' },
    (d) => bus(d, '001-1_01', 'pass', '$ pnpm test | tail -5\nok\nexit 0'),
  ),
  stops(
    'V14',
    'exit 1 reported as pass',
    verdict,
    { reason: 'D4', verdict: 'STOP', message: 'exits 1' },
    (d) => bus(d, '001-1_01', 'pass', '$ pnpm test\n1 failed\nexit 1'),
  ),
  stops(
    'V15',
    'two failed verifications in a row',
    verdict,
    { reason: 'D1', verdict: 'ESCALATE', message: '2 failed verification rounds' },
    (d) => {
      bus(d, '001-1_01', 'fail', '$ pnpm test\nexit 1');
      bus(d, '001-1_02', 'fail', '$ pnpm test\nexit 1');
    },
  ),
  stops(
    'V16',
    'rc closed while a ticket is open',
    ['check', '--stage', 'rc-close', '--release', '0.2.0'],
    {
      reason: 'F2',
      verdict: 'STOP',
      path: '.loctx/ticket/001-1_x.md',
      message: 'ticket 001-1 is still open',
    },
    (d) => {
      chain(d, { plan: PLAN('["001-1"]') });
      put(d, '.loctx/ticket/001-1_x.md', TICKET('001-1'));
    },
  ),
  {
    id: 'V17',
    violation: 'a gate that is not a single command is not run (C5)',
    run: (d) => {
      put(
        d,
        '.agents/harness/gates.yaml',
        'schema: reins/gates@1\ngates:\n  piped:\n    cmd: "echo ran | cat"\norder: [piped]\nmutating_forbidden: true\nevidence: raw\n',
      );
      const r = reins(d, ['gate', '--json']);
      const out = JSON.parse(r.stdout) as {
        runs: { gate: string; exit: number | null; skipped?: string }[];
      };
      expect(r.code).toBe(1);
      expect(out.runs).toHaveLength(1);
      expect(out.runs[0]?.exit).toBeNull();
      expect(out.runs[0]?.skipped).toContain('C5');
      expect(existsSync(join(d, '.loctx/reports/adhoc_piped.log'))).toBe(false);
    },
  },
  {
    id: 'V18',
    violation: 'generated settings.json denies secret reads, force pushes and --no-verify',
    run: (d) => {
      // generate it here, through the built CLI, rather than reading what the template happens to hold
      rmSync(join(d, '.claude'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      const r = reins(d, ['install', 'graph', '--mode', 'auto']);
      expect(r.code, r.stderr).toBe(0);
      const settings = JSON.parse(readFileSync(join(d, '.claude/settings.json'), 'utf8')) as {
        permissions: { deny: string[] };
      };
      expect(settings.permissions.deny).toEqual(
        expect.arrayContaining([
          'Read(**/.env)',
          'Bash(git push --force *)',
          'Bash(git commit --no-verify *)',
          'Bash(git commit -n *)',
        ]),
      );
    },
  },
  {
    id: 'V19',
    violation: 'a role file is broken in the index only; the working tree is restored',
    run: (d) => {
      const rel = '.agents/harness/roles/implementer.md';
      const orig = readFileSync(join(d, rel), 'utf8');
      put(d, rel, orig.replace('role: implementer', 'role: someone-else'));
      git(d, 'add', rel);
      put(d, rel, orig); // the working tree is fine, the commit would not be
      const r = reins(d, [...preCommit, '--json']);
      const report = JSON.parse(r.stdout) as Report;
      expect(
        report.findings.some((f) => f.reason === 'F2' && f.verdict === 'STOP' && f.path === rel),
        r.stdout,
      ).toBe(true);
      expect(report.verdict).toBe('STOP');
      expect(r.code).toBe(EXIT.STOP);
      // the converse: only the working tree is broken, nothing staged for it -> passes
      git(d, 'reset', '-q', '--', rel);
      git(d, 'checkout', '-q', '--', rel);
      put(d, rel, orig.replace('role: implementer', 'role: someone-else'));
      const ok = reins(d, [...preCommit, '--json']);
      expect(JSON.parse(ok.stdout), ok.stdout).toMatchObject({ verdict: 'CONTINUE', findings: [] });
      expect(ok.code).toBe(0);
    },
  },
  {
    id: 'V20',
    violation: 'a bus response that breaks its schema (fixes: "none") reported as pass',
    run: (d) => {
      const good = '$ pnpm test\nok\nexit 0';
      bus(d, '001-1_01', 'pass', good);
      const rp = '.loctx/bus/001-1_01.response.yaml';
      const text = readFileSync(join(d, rp), 'utf8');
      put(d, rp, text + 'fixes: "none"\n');
      const r = reins(d, [...verdict, '--json']);
      const report = JSON.parse(r.stdout) as Report;
      expect(
        report.findings.some(
          (f) => f.reason === 'F2' && f.verdict === 'STOP' && f.message.includes('bus-response'),
        ),
        r.stdout,
      ).toBe(true);
      expect(r.code).toBe(EXIT.STOP);
      // a request that breaks its schema is the same
      put(d, rp, text);
      const qp = '.loctx/bus/001-1_01.request.yaml';
      put(d, qp, readFileSync(join(d, qp), 'utf8').replace('kind: verify', 'kind: verify\nfoo: 1'));
      const q = JSON.parse(reins(d, [...verdict, '--json']).stdout) as Report;
      expect(q.findings.some((f) => f.reason === 'F2' && f.message.includes('bus-request'))).toBe(
        true,
      );
      // only the last exchange is checked: a broken earlier one is ignored
      put(d, qp, readFileSync(join(d, qp), 'utf8').replace('foo: 1\n', ''));
      put(
        d,
        '.loctx/bus/001-1_00.request.yaml',
        'schema: reins/bus/request@1\nid: 001-1_00\nbogus: 1\nkind: verify\n',
      );
      put(
        d,
        '.loctx/bus/001-1_00.response.yaml',
        'schema: reins/bus/response@1\nfixes: "none"\nverdict: fail\n',
      );
      const ok = reins(d, [...verdict, '--json']);
      expect(JSON.parse(ok.stdout), ok.stdout).toMatchObject({ verdict: 'CONTINUE', findings: [] });
      expect(ok.code).toBe(0);
    },
  },
  stops(
    'V21',
    'an absolute in-repository evidence path is read, and its exit 1 stops',
    verdict,
    { reason: 'D4', verdict: 'STOP', message: 'exits 1' },
    (d) => {
      put(d, '.loctx/reports/e.log', '$ pnpm test\nfailed\nexit 1\n');
      bus(d, '001-1_01', 'pass', join(d, '.loctx/reports/e.log'));
    },
  ),
  stops(
    'V22',
    'an absolute evidence path outside the repository',
    verdict,
    { reason: 'D5', verdict: 'STOP', message: 'evidence path outside the repository' },
    (d) => {
      const out = join(mkdtempSync(join(tmpdir(), 'reins-ev-')), 'e.log');
      writeFileSync(out, '$ pnpm test\nok\nexit 0\n');
      bus(d, '001-1_01', 'pass', out);
    },
  ),
  {
    id: 'V23',
    violation: 'gate output is empty: a warning, the verdict stays',
    run: (d) => {
      bus(d, '001-1_01', 'pass', '$ pnpm tsc --noEmit\nexit 0');
      const r = reins(d, [...verdict, '--json']);
      const report = JSON.parse(r.stdout) as Report;
      expect(
        report.findings.some(
          (f) => f.reason === 'D4' && f.verdict === 'WARN' && f.message === 'gate output is empty',
        ),
        r.stdout,
      ).toBe(true);
      expect(report.verdict).toBe('CONTINUE');
      expect(r.code).toBe(0);
    },
  },
  {
    id: 'V24',
    violation: 'a managed block in AGENTS.md edited by hand (drift, override, staged pre-commit)',
    run: (d) => {
      const own = (r: ReturnType<typeof reins>) =>
        (JSON.parse(r.stdout) as Report).findings.filter(
          (f) =>
            f.reason === 'F2' &&
            f.verdict === 'STOP' &&
            f.path === 'AGENTS.md' &&
            f.message === 'managed block "workflow" was edited by hand',
        );
      const orig = readFileSync(join(d, 'AGENTS.md'), 'utf8');
      const edited = orig.replace(
        '<!-- reins:end workflow -->',
        'one more rule\n<!-- reins:end workflow -->',
      );
      expect(edited).not.toBe(orig);
      put(d, 'AGENTS.md', edited);
      const r = reins(d, [...drift, '--json']);
      expect(own(r).length, r.stdout).toBeGreaterThan(0);
      expect(r.code).toBe(EXIT.STOP);
      // pre-commit sees it only once the file is staged
      expect(own(reins(d, [...preCommit, '--json'])).length).toBe(0);
      git(d, 'add', '--', 'AGENTS.md');
      const pc = reins(d, [...preCommit, '--json']);
      expect(own(pc).length, pc.stdout).toBeGreaterThan(0);
      expect(pc.code).toBe(EXIT.STOP);
      // an override silences it
      put(d, 'AGENTS.md', `${edited}\n<!-- reins:override workflow -->\n`);
      const ov = reins(d, [...drift, '--json']);
      expect(own(ov).length, ov.stdout).toBe(0);
      // deleting the whole block is caught too, in drift and in staged pre-commit
      const gone = orig.replace(
        /<!-- reins:begin workflow [\s\S]*?<!-- reins:end workflow -->/,
        '',
      );
      expect(gone).not.toBe(orig);
      const miss = (r: ReturnType<typeof reins>) =>
        (JSON.parse(r.stdout) as Report).findings.filter(
          (f) =>
            f.reason === 'F2' &&
            f.verdict === 'STOP' &&
            f.message === 'managed block "workflow" is missing',
        );
      put(d, 'AGENTS.md', gone);
      const md = reins(d, [...drift, '--json']);
      expect(miss(md).length, md.stdout).toBeGreaterThan(0);
      expect(md.code).toBe(EXIT.STOP);
      git(d, 'add', '--', 'AGENTS.md');
      const mp = reins(d, [...preCommit, '--json']);
      expect(miss(mp).length, mp.stdout).toBeGreaterThan(0);
      expect(mp.code).toBe(EXIT.STOP);
      put(d, 'AGENTS.md', `${gone}\n<!-- reins:override workflow -->\n`);
      expect(miss(reins(d, [...drift, '--json'])).length).toBe(0);
      // the project replaced the block with its own section of the same heading: left alone
      put(d, 'AGENTS.md', `${gone}\n## Workflow\n\nOur own workflow.\n`);
      const own2 = reins(d, [...drift, '--json']);
      expect(miss(own2).length, own2.stdout).toBe(0);
    },
  },
  stops(
    'V25',
    'push deletes a tag (a branch deletion passes)',
    ['check', '--stage', 'pre-push'],
    { reason: 'A1', verdict: 'HOLD', path: 'refs/tags/v0.1.0', message: 'push deletes tag v0.1.0' },
    () => undefined,
    (d) => {
      const sha = git(d, 'rev-parse', 'HEAD');
      const zero = '0'.repeat(40);
      // the branch-deletion line must not add a finding of its own
      const r = reins(
        d,
        ['check', '--stage', 'pre-push', '--json'],
        `(delete) ${zero} refs/heads/old ${sha}\n`,
      );
      expect(JSON.parse(r.stdout), r.stdout).toMatchObject({ verdict: 'CONTINUE', findings: [] });
      return `(delete) ${zero} refs/tags/v0.1.0 ${sha}\n`;
    },
  ),
];

/**
 * Scenarios that did not stop as the spec expects (spec S-5). They are left out of SCENARIOS — not skipped, not
 * marked as expected failures — and recorded here, in docs/violations.md and on the 0.1.0 stabilization list.
 */
const GAPS: { id: string; expected: string; actual: string }[] = [];

const stopped: string[] = [];

describe('violation scenarios (the real cli/dist/reins.js, one throwaway repository each)', () => {
  it('control: the untouched template passes pre-commit and drift', () => {
    for (const args of [preCommit, drift]) {
      const r = reins(template, [...args, '--json']);
      expect(JSON.parse(r.stdout), r.stdout).toMatchObject({ verdict: 'CONTINUE', findings: [] });
      expect(r.code).toBe(0);
    }
  });

  it.each(SCENARIOS)('$id $violation', (s) => {
    s.run(fresh());
    stopped.push(s.id);
  });

  it('violations: N/N stopped', () => {
    const n = SCENARIOS.length;
    process.stdout.write(`violations: ${stopped.length}/${n} stopped\n`);
    expect(stopped.length).toBe(n);
    expect(n + GAPS.length).toBe(TOTAL);
  });
});

const stage = (d: string, ...p: string[]) => git(d, 'add', '--', ...p);
const run = (d: string) => {
  const r = reins(d, [...preCommit, '--json']);
  return { report: JSON.parse(r.stdout) as Report, code: r.code, out: r.stdout };
};

describe('pre-commit reads the index, not the working tree (S-1)', () => {
  const INTENT_REL = '.agents/intent/001_demo/intent.md';
  const SCHEMA_REL = '.agents/harness/schemas/intent.schema.json';
  const breakSchema = (d: string) => {
    const j = JSON.parse(readFileSync(join(d, SCHEMA_REL), 'utf8')) as { required: string[] };
    j.required.push('nonexistent_field');
    put(d, SCHEMA_REL, JSON.stringify(j));
  };

  it('an unstaged schema change does not alter validation of staged content', () => {
    const d = fresh();
    put(d, INTENT_REL, INTENT('draft'));
    stage(d, INTENT_REL);
    breakSchema(d); // working tree only
    const ok = run(d);
    expect(ok.report, ok.out).toMatchObject({ verdict: 'CONTINUE', findings: [] });
    stage(d, SCHEMA_REL); // now the commit would carry the stricter schema
    const bad = run(d);
    expect(
      bad.report.findings.some((f) => f.path === INTENT_REL && f.reason === 'F2'),
      bad.out,
    ).toBe(true);
    expect(bad.code).toBe(EXIT.STOP);
  });

  it('an unstaged generator-input change does not affect the verdict; a staged one is judged against the indexed outputs', () => {
    const d = fresh();
    const B = '.agents/harness/bindings.yaml';
    const orig = readFileSync(join(d, B), 'utf8');
    const changed = orig.replace(/model: claude-[\w.-]+/, 'model: claude-changed-1');
    expect(changed).not.toBe(orig);
    put(d, '.claude/trigger.txt', 'x\n');
    stage(d, '.claude/trigger.txt'); // makes pre-commit run the generated-files check
    put(d, B, changed); // working tree only
    const ok = run(d);
    expect(ok.report, ok.out).toMatchObject({ verdict: 'CONTINUE', findings: [] });
    stage(d, B);
    const bad = run(d);
    expect(
      bad.report.findings.some((f) => f.reason === 'F2' && f.path?.startsWith('.claude/')),
      bad.out,
    ).toBe(true);
    expect(bad.code).toBe(EXIT.STOP);
  });
});
