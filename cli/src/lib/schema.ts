import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import type { Reader } from './reader.js';
import { splitFrontmatter } from './skills.js';

export interface SchemaIssue {
  path: string;
  message: string;
}

/** The same, read through a `Reader` from a repository-relative harness directory. */
export function loadSchemasFrom(rd: Reader, harnessRel: string): Map<string, ValidateFunction> {
  const dir = `${harnessRel}/schemas`;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const ids = new Map<string, string>();
  for (const p of rd
    .list(dir)
    .filter((x) => /^[^/]+\.schema\.json$/.test(x.slice(dir.length + 1)))) {
    const schema = JSON.parse(rd.read(p) ?? '{}') as { $id?: string };
    ajv.addSchema(schema);
    if (schema.$id) ids.set(p.slice(dir.length + 1).replace(/\.schema\.json$/, ''), schema.$id);
  }
  const out = new Map<string, ValidateFunction>();
  for (const [name, id] of ids) {
    const v = ajv.getSchema(id);
    if (v) out.set(name, v);
  }
  return out;
}

/** Loads every `*.schema.json` in the harness and compiles them by file name (`intent`, `bus-request`, …). */
export function loadSchemas(harness: string): Map<string, ValidateFunction> {
  const dir = join(harness, 'schemas');
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.schema.json')) : [];
  const ids = new Map<string, string>();
  for (const f of files) {
    const schema = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { $id?: string };
    ajv.addSchema(schema); // registered under its $id, so cross-file $refs resolve
    if (schema.$id) ids.set(f.replace(/\.schema\.json$/, ''), schema.$id);
  }
  const out = new Map<string, ValidateFunction>();
  for (const [name, id] of ids) {
    const v = ajv.getSchema(id);
    if (v) out.set(name, v);
  }
  return out;
}

function errors(v: ValidateFunction, path: string): SchemaIssue[] {
  return (v.errors ?? []).map((e) => ({
    path,
    message: `${e.instancePath || '(root)'} ${e.message ?? 'invalid'}`,
  }));
}

/** Validates a Markdown file's YAML frontmatter, or a whole YAML file when `whole` is set. */
export function validateFile(
  v: ValidateFunction,
  path: string,
  whole = false,
  content?: string,
): SchemaIssue[] {
  const text = content ?? readFileSync(path, 'utf8');
  let data: unknown;
  let error: string | undefined;
  if (whole) {
    try {
      data = parse(text);
    } catch (e) {
      error = (e as Error).message.split('\n')[0];
    }
  } else ({ data, error } = splitFrontmatter(text));
  if (data == null)
    return [{ path, message: error ? `not valid YAML: ${error}` : 'missing YAML frontmatter' }];
  return v(data) ? [] : errors(v, path);
}

/** Which schema a file belongs to, from where it lives. */
export function schemaFor(rel: string): { schema: string; whole: boolean } | null {
  const name = basename(rel);
  if (/(^|\/)intent\/[^/]+\/intent\.md$/.test(rel) || rel.endsWith('templates/intent.md'))
    return { schema: 'intent', whole: false };
  if (/(^|\/)intent\/[^/]+\/spec\.md$/.test(rel) || rel.endsWith('templates/spec.md'))
    return { schema: 'spec', whole: false };
  if (/(^|\/)intent\/[^/]+\/plan\.md$/.test(rel) || rel.endsWith('templates/plan.md'))
    return { schema: 'plan', whole: false };
  if (/(^|\/)\.loctx\/ticket\/[^/]+\.md$/.test(rel) || rel.endsWith('templates/ticket.md'))
    return { schema: 'ticket', whole: false };
  if (
    /(^|\/)(knowledge|knowledge-seeds\/[^/]+)\/[^/]+\.md$/.test(rel) ||
    rel.endsWith('templates/knowledge.md')
  )
    return { schema: 'knowledge', whole: false };
  if (name.endsWith('.request.yaml') || rel.endsWith('templates/bus/request.yaml'))
    return { schema: 'bus-request', whole: true };
  if (name.endsWith('.response.yaml') || rel.endsWith('templates/bus/response.yaml'))
    return { schema: 'bus-response', whole: true };
  return null;
}
