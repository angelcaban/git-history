import { useState } from 'react';

export const DEFAULT_PANE_WIDTH = 288;
export const MIN_PANE_WIDTH = 160;
/** Room left for the main pane when the navigation pane is at its widest. */
const MIN_MAIN_WIDTH = 240;

const STORAGE_KEY = 'navPaneWidth';

export function clampPaneWidth(width: number): number {
  const max = Math.max(MIN_PANE_WIDTH, window.innerWidth - MIN_MAIN_WIDTH);
  return Math.round(Math.min(Math.max(width, MIN_PANE_WIDTH), max));
}

function readStoredWidth(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return stored > 0 ? clampPaneWidth(stored) : DEFAULT_PANE_WIDTH;
  } catch {
    return DEFAULT_PANE_WIDTH;
  }
}

/** The navigation pane's width in pixels, remembered across visits in this browser. */
export function usePaneWidth(): [number, (width: number) => void] {
  const [width, setWidth] = useState(readStoredWidth);

  const update = (next: number) => {
    const clamped = clampPaneWidth(next);
    setWidth(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // Storage can be unavailable (private browsing, blocked site data); the width still applies.
    }
  };

  return [width, update];
}
