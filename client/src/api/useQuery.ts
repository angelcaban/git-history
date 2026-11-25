import { useEffect, useState } from 'react';
import { request } from './client';

export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: T };

type Settled<T> = { key: string } & ({ error: Error } | { data: T });

/**
 * Runs `query` whenever its variables change. Pass `null` to skip it. Results for
 * earlier variables are ignored, so a slow response never replaces a newer one.
 */
export function useQuery<T>(query: string, variables: Record<string, unknown> | null): QueryState<T> | null {
  const key = variables ? JSON.stringify(variables) : null;
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (key === null) return;
    let current = true;
    request<T>(query, JSON.parse(key) as Record<string, unknown>).then(
      (data) => current && setSettled({ key, data }),
      (error: unknown) =>
        current && setSettled({ key, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      current = false;
    };
  }, [query, key]);

  if (key === null) return null;
  if (settled?.key !== key) return { status: 'loading' };
  return 'error' in settled ? { status: 'error', error: settled.error } : { status: 'success', data: settled.data };
}
