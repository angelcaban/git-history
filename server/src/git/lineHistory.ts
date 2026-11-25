import type { Person } from './blame.js';

export interface HunkLine {
  type: 'context' | 'added' | 'removed';
  content: string;
  /** Line number before the change; null for added lines. */
  oldLineNumber: number | null;
  /** Line number after the change; null for removed lines. */
  newLineNumber: number | null;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: HunkLine[];
}

export interface LineHistoryEntry {
  sha: string;
  parents: string[];
  author: Person;
  committer: Person;
  summary: string;
  /** Path of the file in this commit. */
  path: string;
  /** Path of the file in the parent; null when the commit introduced the lines. */
  previousPath: string | null;
  /** How the tracked lines changed in this commit. */
  hunks: Hunk[];
}

const RECORD = '\x1e';
const FIELD = '\x1f';

/** The `--format` that `parseLineLog` expects. */
export const LINE_LOG_FORMAT = '%x1e' + ['%H', '%P', '%an', '%ae', '%aI', '%cn', '%ce', '%cI', '%s'].join('%x1f');

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/** Parses `git log -L <range>:<path> --format=LINE_LOG_FORMAT` output, newest commit first. */
export function parseLineLog(output: string): LineHistoryEntry[] {
  const entries: LineHistoryEntry[] = [];

  for (const record of output.split(RECORD)) {
    if (record.trim() === '') continue;
    const newline = record.indexOf('\n');
    const headerLine = newline === -1 ? record : record.slice(0, newline);
    const patch = newline === -1 ? '' : record.slice(newline + 1);
    const [sha = '', parents = '', an = '', ae = '', ad = '', cn = '', ce = '', cd = '', summary = ''] =
      headerLine.split(FIELD);

    const entry: LineHistoryEntry = {
      sha,
      parents: parents === '' ? [] : parents.split(' '),
      author: { name: an, email: ae, date: new Date(ad).toISOString() },
      committer: { name: cn, email: ce, date: new Date(cd).toISOString() },
      summary,
      path: '',
      previousPath: null,
      hunks: [],
    };
    parsePatch(patch, entry);
    entries.push(entry);
  }

  return entries;
}

function parsePatch(patch: string, entry: LineHistoryEntry): void {
  let hunk: Hunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const row of patch.split('\n')) {
    // File headers only appear before the first hunk; inside a hunk "--- x" is a removed line.
    if (hunk === null && row.startsWith('--- ')) {
      const oldPath = row.slice(4);
      entry.previousPath = oldPath === '/dev/null' ? null : stripPrefix(unquote(oldPath), 'a/');
      continue;
    }
    if (hunk === null && row.startsWith('+++ ')) {
      entry.path = stripPrefix(unquote(row.slice(4)), 'b/');
      continue;
    }

    const header = HUNK_HEADER.exec(row);
    if (header) {
      hunk = {
        oldStart: Number(header[1]),
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart: Number(header[3]),
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        lines: [],
      };
      oldLine = hunk.oldStart;
      newLine = hunk.newStart;
      entry.hunks.push(hunk);
      continue;
    }
    if (hunk === null) continue;

    const marker = row[0];
    const content = row.slice(1);
    if (marker === ' ') {
      hunk.lines.push({ type: 'context', content, oldLineNumber: oldLine++, newLineNumber: newLine++ });
    } else if (marker === '+') {
      hunk.lines.push({ type: 'added', content, oldLineNumber: null, newLineNumber: newLine++ });
    } else if (marker === '-') {
      hunk.lines.push({ type: 'removed', content, oldLineNumber: oldLine++, newLineNumber: null });
    }
    // "\ No newline at end of file" and blank separators are ignored.
  }
}

function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', '"': '"', '\\': '\\', a: '\x07', b: '\b', f: '\f', r: '\r', v: '\v' };

/** Undoes git's C-style quoting of unusual paths ("a/caf\303\251.txt"). */
export function unquote(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  const bytes: number[] = [];
  const body = value.slice(1, -1);
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch !== '\\') {
      bytes.push(...Buffer.from(ch, 'utf8'));
      continue;
    }
    const next = body[i + 1] ?? '';
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(body.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(...Buffer.from(ESCAPES[next] ?? next, 'utf8'));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString('utf8');
}
