import type { Person } from './blame.js';
import { LINE_LOG_FORMAT, unquote } from './lineHistory.js';

export interface FileHistoryEntry {
  sha: string;
  /**
   * Parents rewritten by git's history simplification to the nearest ancestors
   * that also changed the file, so the entries form a graph.
   */
  parents: string[];
  author: Person;
  committer: Person;
  summary: string;
  /** Path of the file in this commit. */
  path: string;
  /** True when the file appeared in this commit (added, or renamed from a path not tracked yet). */
  added: boolean;
}

const RECORD = '\x1e';
const FIELD = '\x1f';

/** The `--format` that `parseFileLog` expects, with `--name-status` output after each header. */
export const FILE_LOG_FORMAT = LINE_LOG_FORMAT;

/**
 * Parses `git log --parents --name-status -M --format=FILE_LOG_FORMAT -- <paths>`,
 * newest commit first. `paths` are the tracked paths, newest name first; it picks
 * each commit's path and fills in merges, which have no name-status lines.
 */
export function parseFileLog(output: string, paths: string[]): FileHistoryEntry[] {
  const entries: FileHistoryEntry[] = [];

  for (const record of output.split(RECORD)) {
    if (record.trim() === '') continue;
    const [headerLine = '', ...rows] = record.split('\n');
    const [sha = '', parents = '', an = '', ae = '', ad = '', cn = '', ce = '', cd = '', summary = ''] =
      headerLine.split(FIELD);

    // Name-status rows: "M\tpath", "A\tpath", "D\tpath", "R087\told\tnew", "C100\tsrc\tdst".
    const changes = rows
      .filter((row) => /^[A-Z]\d*\t/.test(row))
      .map((row) => {
        const [status = '', ...rowPaths] = row.split('\t');
        return { status: status[0]!, path: unquote(rowPaths.at(-1) ?? '') };
      });
    const change = paths.map((tracked) => changes.find((c) => c.path === tracked)).find((c) => c !== undefined);

    entries.push({
      sha,
      parents: parents === '' ? [] : parents.split(' '),
      author: { name: an, email: ae, date: new Date(ad).toISOString() },
      committer: { name: cn, email: ce, date: new Date(cd).toISOString() },
      summary,
      path: change?.path ?? '',
      added: change?.status === 'A',
    });
  }

  // Merges list no changes; give them their first parent's path. Parents come
  // later in the list, so walk from the oldest commit.
  const bySha = new Map(entries.map((entry) => [entry.sha, entry]));
  for (const entry of [...entries].reverse()) {
    if (entry.path !== '') continue;
    const parent = entry.parents.map((sha) => bySha.get(sha)).find((p) => p && p.path !== '');
    entry.path = parent?.path ?? paths[0] ?? '';
  }

  return entries;
}

/** Parses `git diff-tree -r -M --name-status <sha>` and returns the path renamed to `path`, if any. */
export function parseRenameSource(output: string, path: string): string | null {
  for (const row of output.split('\n')) {
    const [status = '', from, to] = row.split('\t');
    if (status.startsWith('R') && from !== undefined && to !== undefined && unquote(to) === path) {
      return unquote(from);
    }
  }
  return null;
}
