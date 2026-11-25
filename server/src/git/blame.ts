export interface Person {
  name: string;
  email: string;
  /** ISO 8601 timestamp. */
  date: string;
}

export interface BlameCommit {
  sha: string;
  author: Person;
  committer: Person;
  summary: string;
  /** True when this commit is the root of history (or the edge of a shallow clone). */
  boundary: boolean;
  /** The commit and path to blame next to step back past this commit, if any. */
  previous: { sha: string; path: string } | null;
}

export interface BlameLine {
  /** Line number in the blamed revision. */
  lineNumber: number;
  content: string;
  /** Commit that last changed this line. */
  sha: string;
  /** Line number and path of this line in `sha`. */
  originalLineNumber: number;
  originalPath: string;
}

export interface BlameResult {
  lines: BlameLine[];
  /** Details for every commit referenced by `lines`, keyed by sha. */
  commits: Record<string, BlameCommit>;
}

const HEADER = /^([0-9a-f]{40,64}) (\d+) (\d+)(?: \d+)?$/;

/** Parses `git blame --porcelain` output. */
export function parseBlamePorcelain(output: string): BlameResult {
  const lines: BlameLine[] = [];
  const commits: Record<string, BlameCommit> = {};
  const rows = output.split('\n');
  // `filename` is only emitted on the first line of each group of consecutive lines
  // from the same commit; the rest of the group shares it.
  let groupPath = '';
  let i = 0;

  while (i < rows.length) {
    const header = HEADER.exec(rows[i]!);
    i++;
    if (!header) continue;
    const sha = header[1]!;
    const originalLineNumber = Number(header[2]);
    const lineNumber = Number(header[3]);

    // Key/value lines follow until the TAB-prefixed content line. Commit details
    // are only emitted the first time a commit appears.
    const fields = new Map<string, string>();
    let boundary = false;
    while (i < rows.length && !rows[i]!.startsWith('\t')) {
      const row = rows[i]!;
      const space = row.indexOf(' ');
      if (space === -1) {
        if (row === 'boundary') boundary = true;
      } else {
        fields.set(row.slice(0, space), row.slice(space + 1));
      }
      i++;
    }
    groupPath = fields.get('filename') ?? groupPath;
    const content = (rows[i] ?? '\t').slice(1);
    i++;

    if (!commits[sha] && fields.has('author')) {
      commits[sha] = {
        sha,
        author: person(fields, 'author'),
        committer: person(fields, 'committer'),
        summary: fields.get('summary') ?? '',
        boundary,
        previous: parsePrevious(fields.get('previous')),
      };
    }

    lines.push({
      lineNumber,
      content,
      sha,
      originalLineNumber,
      originalPath: groupPath,
    });
  }

  return { lines, commits };
}

function person(fields: Map<string, string>, prefix: 'author' | 'committer'): Person {
  const seconds = Number(fields.get(`${prefix}-time`) ?? 0);
  return {
    name: fields.get(prefix) ?? '',
    email: (fields.get(`${prefix}-mail`) ?? '').replace(/^<|>$/g, ''),
    date: new Date(seconds * 1000).toISOString(),
  };
}

function parsePrevious(value: string | undefined): BlameCommit['previous'] {
  if (!value) return null;
  const space = value.indexOf(' ');
  return { sha: value.slice(0, space), path: value.slice(space + 1) };
}
