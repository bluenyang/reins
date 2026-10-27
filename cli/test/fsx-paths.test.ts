import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isWithin } from '../src/lib/fsx.js';

describe('isWithin (win32 paths on any platform)', () => {
  const w = path.win32;
  it('accepts the root itself and anything under it', () => {
    expect(isWithin('C:\\repo', 'C:\\repo', w)).toBe(true);
    expect(isWithin('C:\\repo', 'C:\\repo\\.loctx\\reports\\e.log', w)).toBe(true);
    expect(isWithin('C:\\Repo', 'c:\\repo\\a', w)).toBe(true);
  });
  it('refuses siblings, parents and other drives', () => {
    expect(isWithin('C:\\repo', 'C:\\repo2\\a', w)).toBe(false);
    expect(isWithin('C:\\repo', 'C:\\other\\a', w)).toBe(false);
    expect(isWithin('C:\\repo', 'D:\\repo\\a', w)).toBe(false);
    expect(isWithin('C:\\repo\\sub', 'C:\\repo', w)).toBe(false);
  });
  it('works with posix paths', () => {
    expect(isWithin('/r', '/r/a/b')).toBe(true);
    expect(isWithin('/r', '/x/a')).toBe(false);
  });
});
