import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import { MANIFEST, SETTINGS_SCHEMA, sha, type Generated } from './generate.js';
import { workTreeReader, type Reader } from './reader.js';

/** `.agents/harness/generated.yaml` — which vendor files reins wrote, and what they looked like. */
interface Manifest {
  schema: 'reins/generated@1';
  files: Record<string, string>;
  /** per merged file (`.claude/settings.json`): the deny rules reins wrote last time */
  owned?: Record<string, string[]>;
}

export function readManifest(root: string, rd: Reader = workTreeReader(root)): Manifest {
  const text = rd.read(MANIFEST);
  if (text === undefined) return { schema: 'reins/generated@1', files: {} };
  const m = parse(text) as Partial<Manifest> | null;
  return {
    schema: 'reins/generated@1',
    files: m?.files ?? {},
    ...(m?.owned ? { owned: m.owned } : {}),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * `.claude/settings.json` with reins' deny rules merged in (design §6). Only the rules reins wrote are
 * its own: `was` (what it wrote last time) minus `now` leaves, `now` is appended where missing, and every
 * other key and entry stays as the user has it, in order. Null when the text is not a settings object.
 */
export function mergeSettings(text: string, now: string[], was: string[]): string | null {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(doc)) return null;
  const perms = doc['permissions'] ?? {};
  if (!isObj(perms)) return null;
  const cur = perms['deny'] ?? [];
  if (!Array.isArray(cur)) return null;
  const gone = new Set(was.filter((r) => !now.includes(r)));
  const kept = (cur as unknown[]).filter((r) => !(typeof r === 'string' && gone.has(r)));
  const deny = [...kept, ...now.filter((r) => !kept.includes(r))];
  const out: Record<string, unknown> =
    '$schema' in doc ? { ...doc } : { $schema: SETTINGS_SCHEMA, ...doc };
  const nextPerms = { ...perms, deny };
  if (deny.length === 0 && !('deny' in perms))
    delete (nextPerms as Record<string, unknown>)['deny'];
  if ('permissions' in doc || Object.keys(nextPerms).length) out['permissions'] = nextPerms;
  return `${JSON.stringify(out, null, 2)}\n`;
}

/** The string rules in `permissions.deny` of a settings file; empty when it has none or cannot be read. */
function settingsDeny(text: string): string[] {
  try {
    const doc = JSON.parse(text) as { permissions?: { deny?: unknown } } | null;
    const d = doc?.permissions?.deny;
    return Array.isArray(d) ? d.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

export interface GenWriteResult {
  written: string[];
  removed: string[];
  unchanged: string[];
  refused: { path: string; why: string }[];
}

/**
 * Write generated files without trampling anyone (design §6): reins overwrites only what it wrote and
 * nobody touched since; a hand-edited one is refused (listed) unless `force`; a file it never wrote is
 * always left alone. `.claude/settings.json` is the exception: it is merged, never refused for holding
 * the user's entries, and `force` changes nothing for it.
 */
export function writeGenerated(
  root: string,
  gen: Generated,
  dryRun: boolean,
  force = false,
): GenWriteResult {
  const res: GenWriteResult = {
    written: [],
    removed: [],
    unchanged: [],
    refused: [],
  };
  const manifest = readManifest(root);
  const before = manifest.files;
  const ownedBefore = manifest.owned ?? {};
  const after: Record<string, string> = {};
  const owned: Record<string, string[]> = {};
  const wanted = new Set(gen.writes.map((w) => w.path));
  for (const w of gen.writes) {
    const abs = join(root, w.path);
    const next = sha(w.content);
    if (w.deny && existsSync(abs)) {
      const text = readFileSync(abs, 'utf8');
      // no list yet (0.3.0 or earlier): an untouched file is all reins', a touched one is only added to
      const was = ownedBefore[w.path] ?? (before[w.path] === sha(text) ? settingsDeny(text) : []);
      const merged = mergeSettings(text, w.deny, was);
      if (merged === null) {
        res.refused.push({
          path: w.path,
          why: 'not a settings object reins can merge into (invalid JSON, or `permissions` / `permissions.deny` of another shape) — left alone; fix it and run `reins update`',
        });
        const prior = before[w.path];
        if (prior) after[w.path] = prior;
        const priorOwned = ownedBefore[w.path];
        if (priorOwned) owned[w.path] = priorOwned;
        continue;
      }
      if (merged === text) res.unchanged.push(w.path);
      else {
        if (!dryRun) writeFileSync(abs, merged);
        res.written.push(w.path);
      }
      after[w.path] = sha(merged);
      owned[w.path] = w.deny;
      continue;
    }
    if (w.deny) owned[w.path] = w.deny;
    if (!existsSync(abs)) {
      if (!dryRun) {
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, w.content);
      }
      res.written.push(w.path);
      after[w.path] = next;
      continue;
    }
    const disk = sha(readFileSync(abs, 'utf8'));
    if (disk === next) {
      res.unchanged.push(w.path);
      after[w.path] = next;
    } else if (before[w.path] === disk || (force && before[w.path])) {
      if (!dryRun) writeFileSync(abs, w.content);
      res.written.push(w.path);
      after[w.path] = next;
    } else {
      res.refused.push({
        path: w.path,
        why: before[w.path]
          ? 'edited by hand since reins generated it — keep the change in .agents/harness, or run `reins update --force` to overwrite it'
          : 'exists and was not generated by reins — merge it by hand, or delete it and run `reins update`',
      });
      const prior = before[w.path];
      if (prior) after[w.path] = prior;
    }
  }
  // files reins wrote earlier that are no longer generated (a group switched off, a role moved to another vendor)
  for (const [path, hash] of Object.entries(before)) {
    if (wanted.has(path)) continue;
    const abs = join(root, path);
    if (!existsSync(abs)) continue;
    const mine = ownedBefore[path];
    if (mine && sha(readFileSync(abs, 'utf8')) !== hash) {
      // a merged file the user also wrote in: take reins' rules out and leave the rest
      const text = readFileSync(abs, 'utf8');
      const rest = mergeSettings(text, [], mine);
      if (rest !== null && rest !== text) {
        if (!dryRun) writeFileSync(abs, rest);
        res.written.push(path);
      }
      continue;
    }
    if (sha(readFileSync(abs, 'utf8')) === hash || force) {
      if (!dryRun) unlinkSync(abs);
      res.removed.push(path);
    } else {
      res.refused.push({
        path,
        why: 'no longer generated, but edited by hand — delete it yourself if it is not needed',
      });
      after[path] = hash;
    }
  }
  const changed =
    JSON.stringify(after) !== JSON.stringify(before) ||
    JSON.stringify(owned) !== JSON.stringify(ownedBefore);
  if (changed && !dryRun) {
    mkdirSync(dirname(join(root, MANIFEST)), { recursive: true });
    writeFileSync(
      join(root, MANIFEST),
      `# vendor files generated by reins — do not edit; \`reins update\` rewrites it\n${stringify({ schema: 'reins/generated@1', files: after, ...(Object.keys(owned).length ? { owned } : {}) })}`,
    );
  }
  return res;
}
