import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { GraphQLRequestError } from '../api/client';
import { BLAME_QUERY, type BlameCommit, type BlameLine, type BlameResult } from '../api/queries';
import { useQuery } from '../api/useQuery';
import { formatLineRange, type LineRange } from '../lineRange';
import { useHistoryBaseParams, type HistoryBase } from '../historyBase';
import { fetchParentRange } from '../parentLines';
import { FileHistory } from './FileHistory';
import { hrefFor, navigate, rememberInCurrentEntry } from '../useLocationParams';

export type FileViewTab = 'code' | 'history';

const TABS: { id: FileViewTab; label: string }[] = [
  { id: 'code', label: 'Code' },
  { id: 'history', label: 'History' },
];

type Props = {
  url: string;
  commit: string;
  path: string;
  /** Lines to highlight and scroll to once the file loads. */
  lines: LineRange | null;
  tab: FileViewTab;
  onTabChange: (tab: FileViewTab) => void;
  /** Where the History tab lists commits from; null to list them from `commit`. */
  historyBase: HistoryBase | null;
};

/** A file in two tabs: its annotated code and the history of commits that changed it. */
export function FileView({ url, commit, path, lines, tab, onTabChange, historyBase }: Props) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Arrow keys move between tabs, as in other tab lists.
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const index = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
    onTabChange(next.id);
    document.getElementById(tabId(next.id))?.focus();
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-end gap-4 border-b border-zinc-200 bg-zinc-50 px-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="min-w-0 flex-1 truncate py-2 font-mono text-sm">{path}</h2>
        <div role="tablist" aria-label="File views" className="flex shrink-0 gap-1" onKeyDown={handleKeyDown}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={panelId(id)}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => onTabChange(id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                tab === id
                  ? 'border-sky-600 font-medium text-zinc-900 dark:text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} className="flex-1">
        {tab === 'code' ? (
          <CodeView url={url} commit={commit} path={path} lines={lines} />
        ) : (
          <FileHistory url={url} commit={commit} path={path} base={historyBase} />
        )}
      </div>
    </div>
  );
}

const tabId = (tab: FileViewTab) => `file-tab-${tab}`;
const panelId = (tab: FileViewTab) => `file-panel-${tab}`;

function CodeView({ url, commit, path, lines }: Pick<Props, 'url' | 'commit' | 'path' | 'lines'>) {
  const state = useQuery<BlameResult>(BLAME_QUERY, { url, ref: commit, path });
  const blame = state?.status === 'success' ? state.data.repository.blame : null;
  const scrollTo = lines?.start;

  useEffect(() => {
    if (!blame || scrollTo === undefined) return;
    document.getElementById(lineId(scrollTo))?.scrollIntoView({ block: 'center' });
  }, [blame, scrollTo]);

  return (
    <>
      {state?.status === 'loading' && <p className="p-4 text-sm text-zinc-500">Loading {path}…</p>}
      {state?.status === 'error' && <FileError error={state.error} />}
      {blame && <BlameTable url={url} blame={blame} highlight={lines} />}
    </>
  );
}

function lineId(lineNumber: number) {
  return `L${lineNumber}`;
}

function FileError({ error }: { error: Error }) {
  const code = error instanceof GraphQLRequestError ? error.code : undefined;
  const message =
    code === 'UNSUPPORTED_MEDIA_TYPE'
      ? 'Binary file, not shown.'
      : code === 'PAYLOAD_TOO_LARGE'
        ? 'File is too large to show.'
        : error.message;
  return (
    <p role={code ? 'status' : 'alert'} className="p-4 text-sm text-zinc-500">
      {message}
    </p>
  );
}

/** A run of consecutive lines last changed by the same commit. */
type Block = { commit: BlameCommit | undefined; lines: BlameLine[] };

function toBlocks(blame: BlameResult['repository']['blame']): Block[] {
  const commits = new Map(blame.commits.map((commit) => [commit.sha, commit]));
  const blocks: Block[] = [];
  for (const line of blame.lines) {
    const last = blocks.at(-1);
    if (last && last.lines[0]?.sha === line.sha) last.lines.push(line);
    else blocks.push({ commit: commits.get(line.sha), lines: [line] });
  }
  return blocks;
}

type BlameTableProps = {
  url: string;
  blame: BlameResult['repository']['blame'];
  highlight: LineRange | null;
};

function BlameTable({ url, blame, highlight }: BlameTableProps) {
  if (blame.lines.length === 0) return <p className="p-4 text-sm text-zinc-500">Empty file.</p>;

  return (
    <table className="w-full border-collapse font-mono text-xs leading-5">
      {toBlocks(blame).map((block, blockIndex) => (
        <tbody
          key={block.lines[0]!.lineNumber}
          className={blockIndex > 0 ? 'border-t border-zinc-200 dark:border-zinc-800' : undefined}
        >
          {block.lines.map((line, index) => {
            const highlighted =
              highlight !== null && line.lineNumber >= highlight.start && line.lineNumber <= highlight.end;
            return (
              <tr
                key={line.lineNumber}
                id={lineId(line.lineNumber)}
                aria-current={highlighted || undefined}
                className={highlighted ? 'bg-amber-100 dark:bg-amber-900/40' : undefined}
              >
                <td className="w-72 max-w-72 border-r border-zinc-200 bg-zinc-50 px-2 align-top text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  {index === 0 && block.commit && <Annotation url={url} commit={block.commit} block={block} />}
                </td>
                <td className="w-px select-none border-r border-zinc-200 px-2 text-right align-top text-zinc-400 dark:border-zinc-800">
                  {line.lineNumber}
                </td>
                <td className="whitespace-pre px-2 align-top">{line.content}</td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
}

function Annotation({ url, commit, block }: { url: string; commit: BlameCommit; block: Block }) {
  const [pending, setPending] = useState(false);
  const first = block.lines[0]!;
  const last = block.lines.at(-1)!;
  const here = formatLineRange({ start: first.lineNumber, end: last.lineNumber });
  // Where these lines were in the commit that last changed them.
  const originalLines = block.lines.map((line) => line.originalLineNumber);
  const original = { start: Math.min(...originalLines), end: Math.max(...originalLines) };
  const baseParams = useHistoryBaseParams();
  const target = { repo: url, ref: commit.sha, path: first.originalPath, lines: formatLineRange(original), ...baseParams };
  const previous = commit.previous;
  // Until the parent's line numbers are looked up, links opened in a new tab use
  // the commit's own line numbers, which are usually close.
  const before = previous && { repo: url, ref: previous.sha, path: previous.path, lines: target.lines, ...baseParams };

  const handleCommitClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    // Going back returns to these lines in this file.
    rememberInCurrentEntry({ lines: here });
    navigate(target);
  };

  const handleBeforeClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!before || !isPlainClick(event)) return;
    event.preventDefault();
    if (pending) return;
    rememberInCurrentEntry({ lines: here });
    const from = location.search;
    setPending(true);
    let lines = before.lines;
    try {
      const range = await fetchParentRange(url, commit.sha, first.originalPath, original);
      if (range) lines = formatLineRange(range);
    } catch {
      // Fall back to the approximate lines.
    } finally {
      setPending(false);
    }
    // Skip it if the user went somewhere else in the meantime.
    if (location.search === from) navigate({ ...before, lines });
  };

  return (
    <div
      className="flex gap-2 truncate"
      title={`${commit.sha}\n${commit.author.name} <${commit.author.email}>\n${commit.author.date}\n\n${commit.summary}`}
    >
      <a
        href={hrefFor(target)}
        onClick={handleCommitClick}
        className="shrink-0 text-sky-700 hover:underline dark:text-sky-400"
      >
        {commit.sha.slice(0, 8)}
      </a>
      {before ? (
        <a
          href={hrefFor(before)}
          onClick={handleBeforeClick}
          aria-label={`Before ${commit.sha.slice(0, 8)}`}
          aria-busy={pending || undefined}
          title={`Show these lines before this commit, in ${before.ref.slice(0, 8)}`}
          className={`shrink-0 text-sky-700 hover:underline dark:text-sky-400 ${pending ? 'cursor-wait opacity-50' : ''}`}
        >
          ↶
        </a>
      ) : (
        // Keeps the columns aligned when there is nothing before (the commit added the file).
        <span aria-hidden className="w-[1ch] shrink-0" />
      )}
      <span className="shrink-0">{commit.author.date.slice(0, 10)}</span>
      <span className="truncate">{commit.author.name}</span>
    </div>
  );
}

/** A left click without modifiers; other clicks open new tabs or windows, which the browser handles. */
function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
