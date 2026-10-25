import { describe, expect, it } from 'vitest';
import { applyBlocks, parseBlocks } from '../src/lib/blocks.js';

const UP = parseBlocks(`<!-- reins:begin notice v=0.1.0 -->
> generated
<!-- reins:end notice -->

<!-- reins:begin workflow v=0.1.0 -->
## Workflow
- loop
<!-- reins:end workflow -->`);

describe('AGENTS.md managed blocks (design §5)', () => {
  it('inserts notice after the H1 and the rest at the end, then is idempotent', () => {
    const first = applyBlocks('# AGENTS.md\n\n## Project\nx\n', UP);
    expect(first.inserted).toEqual(['notice', 'workflow']);
    expect(first.text.indexOf('reins:begin notice')).toBeLessThan(first.text.indexOf('## Project'));
    const second = applyBlocks(first.text, UP);
    expect(second.text).toBe(first.text);
    expect(second.inserted).toEqual([]);
  });
  it('replaces an outdated block in place and leaves the project text alone', () => {
    const old =
      '# A\n\n## Project\nmine\n\n<!-- reins:begin workflow v=0.0.9 -->\n## Workflow\nold\n<!-- reins:end workflow -->\n';
    const r = applyBlocks(old, UP);
    expect(r.replaced).toEqual(['workflow']);
    expect(r.text).toContain('## Project\nmine');
    expect(r.text).not.toContain('old');
  });
  it('skips a block when the project already has that heading, and honours overrides', () => {
    const r = applyBlocks('# A\n\n## Workflow\nours\n', UP);
    expect(r.skipped.map((s) => s.name)).toEqual(['workflow']);
    const o = applyBlocks('# A\n<!-- reins:override notice -->\n', UP);
    expect(o.skipped.find((s) => s.name === 'notice')?.why).toMatch(/overridden/);
  });
});

describe('migrate swaps project sections for managed blocks', () => {
  it('replaces ## Workflow up to the next ## heading and returns the original', async () => {
    const { swapSections } = await import('../src/lib/blocks.js');
    const text =
      '# A\n\n## Project\nmine\n\n## Workflow\n- old rule\n### detail\nx\n\n## Language\nen\n';
    const r = swapSections(text, UP);
    expect(r.swapped).toEqual(['workflow']);
    expect(r.text).toContain('reins:begin workflow');
    expect(r.text).toContain('## Project\nmine');
    expect(r.text).toContain('## Language\nen');
    expect(r.text).not.toContain('old rule');
    expect(r.removed).toBe('## Workflow\n- old rule\n### detail\nx');
    expect(swapSections(r.text, UP).swapped).toEqual([]); // idempotent
  });
});
