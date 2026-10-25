/** Minimal glob → RegExp: `**` any path, `*` within a segment, `?` one char. Matches whole path. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c && '.+^${}()|[]\\'.includes(c)) re += `\\${c}`;
    else re += c;
  }
  return new RegExp(`^(?:.*/)?${re}$`);
}

export function matchesAny(path: string, globs: readonly string[]): string | null {
  for (const g of globs) if (globToRegExp(g).test(path)) return g;
  return null;
}
