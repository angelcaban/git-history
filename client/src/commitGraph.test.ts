import { describe, expect, it } from 'vitest';
import { layoutGraph } from './commitGraph';

describe('layoutGraph', () => {
  it('keeps a linear history in one lane', () => {
    const { rows, lanes } = layoutGraph([
      { sha: 'c', parents: ['b'] },
      { sha: 'b', parents: ['a'] },
      { sha: 'a', parents: [] },
    ]);

    expect(lanes).toBe(1);
    expect(rows).toEqual([
      { column: 0, edges: [{ part: 'bottom', from: 0, to: 0 }] },
      { column: 0, edges: [{ part: 'top', from: 0, to: 0 }, { part: 'bottom', from: 0, to: 0 }] },
      { column: 0, edges: [{ part: 'top', from: 0, to: 0 }] },
    ]);
  });

  it('branches a merge into a second lane and joins it back at the fork', () => {
    //   m        merge of a and b
    //   |\
    //   a |
    //   | b
    //   |/
    //   r
    const { rows, lanes } = layoutGraph([
      { sha: 'm', parents: ['a', 'b'] },
      { sha: 'a', parents: ['r'] },
      { sha: 'b', parents: ['r'] },
      { sha: 'r', parents: [] },
    ]);

    expect(lanes).toBe(2);
    expect(rows.map((row) => row.column)).toEqual([0, 0, 1, 0]);
    expect(rows[0]!.edges).toEqual([
      { part: 'bottom', from: 0, to: 0 },
      { part: 'bottom', from: 0, to: 1 },
    ]);
    expect(rows[1]!.edges).toEqual([
      { part: 'top', from: 0, to: 0 },
      { part: 'through', from: 1, to: 1 },
      { part: 'bottom', from: 0, to: 0 },
    ]);
    // b's parent r is already lane 0's target, so b's line joins lane 0.
    expect(rows[2]!.edges).toEqual([
      { part: 'through', from: 0, to: 0 },
      { part: 'top', from: 1, to: 1 },
      { part: 'bottom', from: 1, to: 0 },
    ]);
    expect(rows[3]!.edges).toEqual([{ part: 'top', from: 0, to: 0 }]);
  });

  it('starts branch tips without children in a free lane', () => {
    const { rows } = layoutGraph([
      { sha: 'x', parents: ['r'] },
      { sha: 'y', parents: ['r'] },
      { sha: 'r', parents: [] },
    ]);

    expect(rows.map((row) => row.column)).toEqual([0, 1, 0]);
    expect(rows[2]!.edges).toEqual([{ part: 'top', from: 0, to: 0 }]);
  });

  it('leaves a lane open for a parent outside the list', () => {
    const { rows } = layoutGraph([{ sha: 'b', parents: ['a'] }]);

    expect(rows[0]!.edges).toEqual([{ part: 'bottom', from: 0, to: 0 }]);
  });
});
