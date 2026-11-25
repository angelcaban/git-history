import type { KeyboardEvent, PointerEvent } from 'react';
import { DEFAULT_PANE_WIDTH, MIN_PANE_WIDTH } from '../usePaneWidth';

type Props = {
  width: number;
  onResize: (width: number) => void;
  /** id of the pane this handle resizes. */
  controls: string;
};

const KEYBOARD_STEP = 16;

/** A vertical drag handle on the right edge of a pane. Double-click resets the width. */
export function PaneResizer({ width, onResize, controls }: Props) {
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // Keep the drag from selecting text in the panes.
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;
    document.body.style.cursor = 'col-resize';

    const move = (moveEvent: globalThis.PointerEvent) => onResize(startWidth + moveEvent.clientX - startX);
    const end = () => {
      document.body.style.cursor = '';
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEYBOARD_STEP * 4 : KEYBOARD_STEP;
    const next =
      event.key === 'ArrowLeft'
        ? width - step
        : event.key === 'ArrowRight'
          ? width + step
          : event.key === 'Home'
            ? MIN_PANE_WIDTH
            : event.key === 'End'
              ? Infinity
              : null;
    if (next === null) return;
    event.preventDefault();
    onResize(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize file tree"
      aria-controls={controls}
      aria-valuenow={width}
      aria-valuemin={MIN_PANE_WIDTH}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onResize(DEFAULT_PANE_WIDTH)}
      title="Drag to resize, double-click to reset"
      // Overlaps the pane border so the grab area is wider than the 1px line.
      className="relative z-20 -mx-1 w-2 shrink-0 cursor-col-resize touch-none transition-colors hover:bg-sky-500/40 focus-visible:bg-sky-500/60 focus-visible:outline-none"
    />
  );
}
