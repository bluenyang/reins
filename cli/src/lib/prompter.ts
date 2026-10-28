import type { Asker } from './ask.js';

/** A screen asks for a value; the user may also go back one screen or leave (Ctrl-C). */
export const BACK = Symbol('reins.prompt.back');
export const EXIT = Symbol('reins.prompt.exit');
export type Nav = typeof BACK | typeof EXIT;

export interface Option<T> {
  value: T;
  label: string;
  hint?: string;
}

export interface Prompter {
  select<T>(q: { message: string; options: Option<T>[]; initial?: T }): Promise<T | Nav>;
  multiselect<T>(q: {
    message: string;
    options: Option<T>[];
    initial?: T[];
    required?: boolean;
  }): Promise<T[] | Nav>;
  text(q: { message: string; initial?: string; placeholder?: string }): Promise<string | Nav>;
  confirm(q: { message: string; initial?: boolean }): Promise<boolean | Nav>;
  /** A line of context shown above the next question (not a question). */
  note(message: string): void;
}

/** stdin and stdout are both terminals: only then may a screen be drawn. */
export function isInteractive(
  stdin: { isTTY?: boolean } = process.stdin,
  stdout: { isTTY?: boolean } = process.stdout,
): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

/**
 * The real prompter. `@clack/prompts` is loaded here, on first use, so a run that never draws a screen
 * (non-TTY, `--json`, tests) never loads it. Cancel (Ctrl-C) becomes EXIT; nothing is written by the prompter.
 */
export async function clackPrompter(): Promise<Prompter> {
  const p = await import('@clack/prompts');
  const nav = <V>(v: V | symbol): V | typeof EXIT => (p.isCancel(v) ? EXIT : (v as V));
  return {
    async select<T>(q: { message: string; options: Option<T>[]; initial?: T }) {
      const v = await p.select<T>({
        message: q.message,
        options: q.options.map((o) => ({ value: o.value, label: o.label, hint: o.hint })) as never,
        initialValue: q.initial,
      });
      return nav<T>(v as T | symbol);
    },
    async multiselect<T>(q: {
      message: string;
      options: Option<T>[];
      initial?: T[];
      required?: boolean;
    }) {
      const v = await p.multiselect<T>({
        message: q.message,
        options: q.options.map((o) => ({ value: o.value, label: o.label, hint: o.hint })) as never,
        initialValues: q.initial,
        required: q.required ?? false,
      });
      return nav<T[]>(v as T[] | symbol);
    },
    async text(q) {
      const v = await p.text({
        message: q.message,
        initialValue: q.initial,
        placeholder: q.placeholder,
      });
      return nav<string>(v as string | symbol);
    },
    async confirm(q) {
      const v = await p.confirm({ message: q.message, initialValue: q.initial ?? true });
      return nav<boolean>(v as boolean | symbol);
    },
    note: (m) => p.log.message(m),
  };
}

export interface Asked {
  kind: 'select' | 'multiselect' | 'text' | 'confirm';
  message: string;
  values?: unknown[];
}

/** Tests: answers come from a queue in order; every question is recorded. An empty queue answers EXIT. */
export function scriptedPrompter(
  answers: unknown[],
): Prompter & { asked: Asked[]; notes: string[]; remaining: () => number } {
  const queue = [...answers];
  const asked: Asked[] = [];
  const notes: string[] = [];
  const next = (kind: Asked['kind'], message: string, values?: unknown[]): unknown => {
    asked.push({ kind, message, values });
    return queue.length ? queue.shift() : EXIT;
  };
  return {
    asked,
    notes,
    remaining: () => queue.length,
    select: async (q) =>
      next(
        'select',
        q.message,
        q.options.map((o) => o.value),
      ) as never,
    multiselect: async (q) =>
      next(
        'multiselect',
        q.message,
        q.options.map((o) => o.value),
      ) as never,
    text: async (q) => next('text', q.message) as never,
    confirm: async (q) => next('confirm', q.message) as never,
    note: (m) => {
      notes.push(m);
    },
  };
}

/**
 * Non-TTY bridge over the line-based `Asker`: each question is asked as one line and its answer parsed.
 * select/multiselect take a value (or label) / a comma-separated list; confirm takes y/n; text takes the line.
 * The default shown is the initial value.
 */
export function askerPrompter(asker: Asker): Prompter {
  const pick = <T>(raw: string, options: Option<T>[]): T | undefined =>
    options.find((o) => String(o.value) === raw || o.label === raw)?.value;
  return {
    async select(q) {
      const d = String(q.initial ?? q.options[0]?.value ?? '');
      const a = await asker.ask(
        `${q.message} (${q.options.map((o) => String(o.value)).join('/')})`,
        d,
      );
      return pick(a, q.options) ?? (q.options[0]?.value as never);
    },
    async multiselect(q) {
      const d = (q.initial ?? []).map(String).join(',');
      const a = await asker.ask(
        `${q.message} (${q.options.map((o) => String(o.value)).join(',')})`,
        d,
      );
      return a
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => pick(s, q.options))
        .filter((v): v is NonNullable<typeof v> => v !== undefined) as never;
    },
    async text(q) {
      return asker.ask(q.message, q.initial ?? '');
    },
    async confirm(q) {
      const d = (q.initial ?? true) ? 'y' : 'n';
      const a = (await asker.ask(`${q.message} (y/n)`, d)).toLowerCase();
      return a.startsWith('y');
    },
    note: () => {},
  };
}
