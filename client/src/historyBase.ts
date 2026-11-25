import { createContext, useContext } from 'react';

/**
 * Where the user started browsing a file's history: the History tab lists commits
 * from here, so it keeps showing the whole history while the Code tab moves to
 * older commits. `ref` null means the repository's default branch.
 */
export type HistoryBase = { ref: string | null; path: string };

export const HistoryBaseContext = createContext<HistoryBase | null>(null);

/** URL parameters that carry the history base along a commit link. */
export function useHistoryBaseParams(): { baseRef: string | null; basePath: string | null } {
  const base = useContext(HistoryBaseContext);
  return { baseRef: base?.ref ?? null, basePath: base?.path ?? null };
}
