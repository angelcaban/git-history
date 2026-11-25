import type { SimpleGit } from 'simple-git';
import type { Config } from '../config.js';
import { ApiError } from '../errors.js';
import { parseBlamePorcelain } from './blame.js';
import type { BlameResult } from './blame.js';
import { FILE_LOG_FORMAT, parseFileLog, parseRenameSource } from './fileHistory.js';
import type { FileHistoryEntry } from './fileHistory.js';
import { LINE_LOG_FORMAT, parseLineLog } from './lineHistory.js';
import type { LineHistoryEntry } from './lineHistory.js';
import type { RepoCache } from './repoCache.js';
import { parseLsTree } from './tree.js';
import type { DirectoryNode } from './tree.js';
import { validateRef, validateRepoUrl } from './validation.js';
import type { LineRange } from './validation.js';

/** A repository clone with a ref resolved to a single commit. */
export interface OpenedRepository {
  url: string;
  ref: string;
  commit: string;
  git: SimpleGit;
}

export interface Blob {
  oid: string;
  size: number;
  binary: boolean;
  content: Buffer;
}

/** Validates the URL and ref, makes sure the clone is fresh, and resolves the ref to a commit. */
export async function openRepository(
  cache: RepoCache,
  config: Config,
  rawUrl: string,
  rawRef: string | null | undefined,
): Promise<OpenedRepository> {
  const url = validateRepoUrl(rawUrl, config);
  const ref = rawRef == null || rawRef === '' ? 'HEAD' : validateRef(rawRef);
  const git = await cache.open(url);
  let commit: string;
  try {
    commit = (await git.raw(['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`])).trim();
  } catch {
    commit = '';
  }
  if (commit === '') {
    throw new ApiError('NOT_FOUND', `Unknown ref "${ref}"`);
  }
  return { url, ref, commit, git };
}

export async function readTree(repo: OpenedRepository): Promise<DirectoryNode> {
  return parseLsTree(await repo.git.raw(['ls-tree', '-r', '-t', '-l', '-z', '--full-tree', repo.commit]));
}

export async function readBlob(repo: OpenedRepository, path: string, maxBytes: number): Promise<Blob> {
  const entry = (await repo.git.raw(['ls-tree', '-l', '-z', repo.commit, '--', path])).split('\0')[0] ?? '';
  const tab = entry.indexOf('\t');
  const [, type, oid = '', size] = entry.slice(0, tab).split(/ +/);
  if (entry === '' || entry.slice(tab + 1) !== path) {
    throw new ApiError('NOT_FOUND', `No file "${path}" at ${repo.commit}`);
  }
  if (type !== 'blob') {
    throw new ApiError('BAD_USER_INPUT', `"${path}" is not a file`);
  }
  if (Number(size) > maxBytes) {
    throw new ApiError('PAYLOAD_TOO_LARGE', `"${path}" is larger than ${maxBytes} bytes`);
  }
  const content = await repo.git.showBuffer([oid]);
  // Same heuristic git uses: a NUL byte in the first 8000 bytes means binary.
  const binary = content.subarray(0, 8000).includes(0);
  return { oid, size: Number(size), binary, content };
}

export async function readTextBlob(repo: OpenedRepository, path: string, maxBytes: number): Promise<Blob> {
  const blob = await readBlob(repo, path, maxBytes);
  if (blob.binary) {
    throw new ApiError('UNSUPPORTED_MEDIA_TYPE', `"${path}" is a binary file`);
  }
  return blob;
}

export async function blame(repo: OpenedRepository, path: string, range?: LineRange): Promise<BlameResult> {
  const lines = range ? ['-L', `${range.start},${range.end}`] : [];
  return parseBlamePorcelain(await repo.git.raw(['blame', '--porcelain', ...lines, repo.commit, '--', path]));
}

/** Every commit that changed the lines in `range`, newest first, following renames. */
export async function lineLog(repo: OpenedRepository, path: string, range: LineRange): Promise<LineHistoryEntry[]> {
  return parseLineLog(
    await repo.git.raw([
      'log',
      `-L${range.start},${range.end}:${path}`,
      `--format=${LINE_LOG_FORMAT}`,
      '--no-color',
      '--no-ext-diff',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      repo.commit,
    ]),
  );
}

/** Renames followed at most, so a pathological history cannot loop for long. */
const MAX_RENAMES = 20;

/**
 * Commits that changed `path`, newest first, at most `first` of them. Parents are
 * rewritten to commits that also changed the file (`--parents` with pathspec
 * limiting), which `--follow` would not do. Renames are followed by re-running the
 * log with the old path added whenever the oldest commit renamed the file in.
 */
export async function fileLog(
  repo: OpenedRepository,
  path: string,
  first: number,
): Promise<{ commits: FileHistoryEntry[]; truncated: boolean }> {
  const paths = [path];
  for (let renames = 0; ; renames++) {
    const entries = parseFileLog(
      await repo.git.raw([
        'log',
        '--parents',
        // Newest first, but never a parent before its children, which the graph needs.
        '--date-order',
        '--name-status',
        '-M',
        `--format=${FILE_LOG_FORMAT}`,
        `--max-count=${first + 1}`,
        '--no-color',
        repo.commit,
        '--',
        ...paths,
      ]),
      paths,
    );
    const truncated = entries.length > first;
    const commits = entries.slice(0, first);
    if (truncated || renames >= MAX_RENAMES) return { commits, truncated };

    const newPaths: string[] = [];
    for (const root of commits.filter((commit) => commit.added && commit.parents.length === 0)) {
      const output = await repo.git.raw(['diff-tree', '-r', '-M', '--name-status', '--no-commit-id', root.sha]);
      const from = parseRenameSource(output, root.path);
      if (from !== null && !paths.includes(from) && !newPaths.includes(from)) newPaths.push(from);
    }
    if (newPaths.length === 0) return { commits, truncated };
    paths.push(...newPaths);
  }
}

export function countLines(content: Buffer): number {
  if (content.length === 0) return 0;
  let count = 0;
  for (const byte of content) if (byte === 0x0a) count++;
  return content[content.length - 1] === 0x0a ? count : count + 1;
}
