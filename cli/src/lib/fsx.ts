import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/** A planned write. Install, migrate and update compute these first, then apply — so --dry-run is exact. */
export interface Write {
  path: string; // repository-relative
  content: string;
  why: string;
}

export interface Applied {
  created: string[];
  changed: string[];
  unchanged: string[];
  /** upstream files the tier no longer installs, deleted by update (design §6) */
  removed: string[];
}

export function apply(root: string, writes: Write[], dryRun: boolean): Applied {
  const out: Applied = { created: [], changed: [], unchanged: [], removed: [] };
  for (const w of writes) {
    const abs = join(root, w.path);
    const exists = existsSync(abs);
    if (exists && readFileSync(abs, 'utf8') === w.content) {
      out.unchanged.push(w.path);
      continue;
    }
    (exists ? out.changed : out.created).push(w.path);
    if (!dryRun) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, w.content);
    }
  }
  return out;
}

/** `relative(from, to)` with `/` separators on every platform — the form git, globs and stored paths use. */
export function relPath(from: string, to: string): string {
  const rel = relative(from, to);
  return sep === '/' ? rel : rel.split(sep).join('/');
}

/** Every file under `dir`, as `/`-separated paths relative to `dir`. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relPath(dir, p));
    }
  };
  walk(dir);
  return out.toSorted();
}
