import { describe, expect, it } from 'vitest';
import { parentRange } from './parentLines';

const SHA = 'a'.repeat(40);

describe('parentRange', () => {
  it('spans the old side of every hunk for the commit', () => {
    const history = [
      { sha: SHA, hunks: [{ oldStart: 10, oldLines: 3 }, { oldStart: 20, oldLines: 2 }] },
      { sha: 'b'.repeat(40), hunks: [{ oldStart: 1, oldLines: 1 }] },
    ];
    expect(parentRange(history, SHA)).toEqual({ start: 10, end: 21 });
  });

  it('points added lines at the line they were inserted after', () => {
    expect(parentRange([{ sha: SHA, hunks: [{ oldStart: 7, oldLines: 0 }] }], SHA)).toEqual({ start: 7, end: 7 });
    expect(parentRange([{ sha: SHA, hunks: [{ oldStart: 0, oldLines: 0 }] }], SHA)).toEqual({ start: 1, end: 1 });
  });

  it('is null when the commit is not in the history', () => {
    expect(parentRange([], SHA)).toBeNull();
  });
});
