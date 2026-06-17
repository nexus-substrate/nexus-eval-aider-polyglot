/**
 * Tests for the fenced-block extractor.
 *
 * Covers:
 *   - Legitimate multi-file extraction (the happy path the harness relies on)
 *   - ReDoS hardening: an adversarial ~200k-char input that previously
 *     triggered catastrophic/polynomial backtracking must complete fast.
 */
import { describe, it, expect } from 'vitest';

import { extractEditedFiles } from './file-extractor.js';

describe('extractEditedFiles', () => {
  it('extracts content for each fenced path block', () => {
    const response = [
      '```python path=src/foo.py',
      'def foo():',
      '    return 1',
      '```',
      'some prose between blocks',
      '```ts path=src/bar.ts',
      'export const bar = 2;',
      '```',
    ].join('\n');

    const out = extractEditedFiles(response);
    expect(out['src/foo.py']).toBe('def foo():\n    return 1');
    expect(out['src/bar.ts']).toBe('export const bar = 2;');
  });

  it('handles a block with an empty language token', () => {
    const response = '``` path=a/b.txt\nhello\n```';
    const out = extractEditedFiles(response);
    expect(out['a/b.txt']).toBe('hello');
  });

  it('returns an empty map when nothing matches', () => {
    expect(extractEditedFiles('no code here')).toEqual({});
  });

  it('completes in bounded time on adversarial ~200k-char input (ReDoS)', () => {
    // A long run of whitespace after the opening fence with no closing
    // fence is the shape that exercises overlapping `\s` quantifiers and
    // the unbounded `[\s\S]*?` tail. This must not hang.
    const adversarial = '```' + ' '.repeat(200_000);
    const start = performance.now();
    const out = extractEditedFiles(adversarial);
    const elapsed = performance.now() - start;
    expect(out).toEqual({});
    expect(elapsed).toBeLessThan(250);
  });

  it('completes in bounded time on near-miss path blocks (ReDoS)', () => {
    // Many almost-matching prefixes with no terminating fence.
    const adversarial = ('```js path='.repeat(20_000)) + 'x'.repeat(10_000);
    const start = performance.now();
    extractEditedFiles(adversarial);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(250);
  });
});
