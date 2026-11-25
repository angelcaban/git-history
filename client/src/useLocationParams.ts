import { useSyncExternalStore } from 'react';

const NAVIGATE_EVENT = 'app:navigate';

export type LocationParams = Record<string, string | null | undefined>;

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

/** The page's query string, so the open repository and file survive reloads and can be shared. */
export function useLocationParams(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, () => location.search);
  return new URLSearchParams(search);
}

/** A same-page link with the given query parameters, dropping empty ones. */
export function hrefFor(params: LocationParams): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value) search.set(name, value);
  }
  const query = search.toString();
  return query ? `?${query}` : location.pathname;
}

/** Pushes a history entry with the given query parameters, dropping empty ones. */
export function navigate(params: LocationParams) {
  history.pushState(null, '', hrefFor(params));
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/**
 * Changes parameters of the current history entry without re-rendering, so that
 * going back to it restores them (for example, the lines the user was looking at).
 */
export function rememberInCurrentEntry(params: LocationParams) {
  const search = new URLSearchParams(location.search);
  for (const [name, value] of Object.entries(params)) {
    if (value) search.set(name, value);
    else search.delete(name);
  }
  history.replaceState(history.state, '', `?${search.toString()}`);
}
