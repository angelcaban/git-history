import { request } from './api/client';
import { PARENT_LINES_QUERY, type ParentLinesResult } from './api/queries';
import type { LineRange } from './lineRange';

type History = ParentLinesResult['repository']['lineHistory']['history'];

/**
 * Where lines that `sha` changed were in its parent, from the old side of its diff
 * hunks. Lines the commit only added map to the line they were inserted after.
 * Null when the history has no hunks for `sha`.
 */
export function parentRange(history: History, sha: string): LineRange | null {
  const hunks = history.find((entry) => entry.sha === sha)?.hunks ?? [];
  if (hunks.length === 0) return null;
  const start = Math.min(...hunks.map((hunk) => Math.max(hunk.oldStart, 1)));
  const end = Math.max(...hunks.map((hunk) => Math.max(hunk.oldStart + hunk.oldLines - 1, hunk.oldStart, 1)));
  return { start, end };
}

/** Asks the server where `lines` of `path` at `sha` were in that commit's parent. */
export async function fetchParentRange(url: string, sha: string, path: string, lines: LineRange) {
  const data = await request<ParentLinesResult>(PARENT_LINES_QUERY, {
    url,
    ref: sha,
    path,
    start: lines.start,
    end: lines.end,
  });
  return parentRange(data.repository.lineHistory.history, sha);
}
