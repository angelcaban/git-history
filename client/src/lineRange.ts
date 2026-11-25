export type LineRange = { start: number; end: number };

/** Parses the `lines` parameter: `12` or `12-20`. */
export function parseLineRange(value: string | null): LineRange | null {
  const match = value?.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  return start >= 1 && end >= start ? { start, end } : null;
}

export function formatLineRange({ start, end }: LineRange): string {
  return start === end ? String(start) : `${start}-${end}`;
}
