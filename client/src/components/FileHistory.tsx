import { useEffect, type MouseEvent } from 'react';
import { FILE_HISTORY_QUERY, type FileHistoryCommit, type FileHistoryResult } from '../api/queries';
import { useQuery } from '../api/useQuery';
import { layoutGraph, type GraphEdge } from '../commitGraph';
import { useHistoryBaseParams, type HistoryBase } from '../historyBase';
import { hrefFor, navigate } from '../useLocationParams';

type Props = {
  url: string;
  /** The commit the Code tab shows. */
  commit: string;
  /** The file's path in `commit`. */
  path: string;
  /** Where to list commits from; null to list them from `commit`. */
  base: HistoryBase | null;
};

const HISTORY_LIMIT = 500;
const ROW_HEIGHT = 28;
const LANE_WIDTH = 14;
const LANE_COLORS = ['#0284c7', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0d9488', '#dc2626', '#4f46e5'];

/**
 * The commits that changed a file, drawn as the file's own branch-and-merge graph,
 * with the version the Code tab shows highlighted.
 */
export function FileHistory({ url, commit, path, base }: Props) {
  const list = useQuery<FileHistoryResult>(
    FILE_HISTORY_QUERY,
    base
      ? { url, ...(base.ref ? { ref: base.ref } : {}), path: base.path, first: HISTORY_LIMIT }
      : { url, ref: commit, path, first: HISTORY_LIMIT },
  );
  // The version on show is the newest commit up to `commit` that changed the file.
  // `commit` itself may not have (↶ goes to a parent), so ask for it. Without a
  // base the list starts at `commit`, and its first entry is that version.
  const version = useQuery<FileHistoryResult>(FILE_HISTORY_QUERY, base ? { url, ref: commit, path, first: 1 } : null);

  const history = list?.status === 'success' ? list.data.repository.fileHistory : null;
  const currentSha = base
    ? version?.status === 'success'
      ? version.data.repository.fileHistory.commits[0]?.sha
      : undefined
    : history?.commits[0]?.sha;

  useEffect(() => {
    if (!history || !currentSha) return;
    document.getElementById(rowId(currentSha))?.scrollIntoView({ block: 'center' });
  }, [history, currentSha]);

  if (list?.status === 'loading') return <p className="p-4 text-sm text-zinc-500">Loading history…</p>;
  if (list?.status === 'error') {
    return (
      <p role="alert" className="p-4 text-sm text-red-600 dark:text-red-400">
        {list.error.message}
      </p>
    );
  }
  if (!history) return null;

  const { commits, truncated } = history;
  const graph = layoutGraph(commits);
  const graphWidth = graph.lanes * LANE_WIDTH;
  const currentListed = currentSha !== undefined && commits.some((entry) => entry.sha === currentSha);

  return (
    <div>
      {currentSha && !currentListed && (
        <p role="status" className="border-b border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
          The version on the Code tab, from commit {currentSha.slice(0, 8)}, is not in this list.
        </p>
      )}
      <table aria-label="Commit history" className="w-full border-collapse text-xs">
        <tbody>
          {commits.map((entry, index) => {
            const current = entry.sha === currentSha;
            return (
              <tr
                key={entry.sha}
                id={rowId(entry.sha)}
                aria-current={current || undefined}
                style={{ height: ROW_HEIGHT }}
                className={
                  current
                    ? 'bg-amber-100 font-medium dark:bg-amber-900/40'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }
              >
                <td className="p-0 pl-2 align-top" style={{ width: graphWidth + 8 }}>
                  <GraphCell row={graph.rows[index]!} width={graphWidth} current={current} />
                </td>
                <td className="w-px whitespace-nowrap px-2 font-mono">
                  <CommitLink url={url} entry={entry} />
                </td>
                <td className="max-w-0 truncate px-2" title={entry.summary}>
                  {entry.summary}
                  {entry.path !== (base?.path ?? path) && (
                    <span className="ml-2 rounded bg-zinc-200 px-1 font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {entry.path}
                    </span>
                  )}
                </td>
                <td className="w-px whitespace-nowrap px-2 text-zinc-500" title={entry.author.email}>
                  {entry.author.name}
                </td>
                <td className="w-px whitespace-nowrap px-2 text-zinc-500" title={entry.author.date}>
                  {entry.author.date.slice(0, 10)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {truncated && (
        <p className="p-4 text-xs text-zinc-500">Showing the latest {HISTORY_LIMIT} commits that changed this file.</p>
      )}
    </div>
  );
}

const rowId = (sha: string) => `history-${sha}`;

function CommitLink({ url, entry }: { url: string; entry: FileHistoryCommit }) {
  // Opens the code view of the file as it was in this commit.
  const target = { repo: url, ref: entry.sha, path: entry.path, ...useHistoryBaseParams() };
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(target);
  };
  return (
    <a href={hrefFor(target)} onClick={handleClick} className="text-sky-700 hover:underline dark:text-sky-400">
      {entry.sha.slice(0, 8)}
    </a>
  );
}

const x = (lane: number) => lane * LANE_WIDTH + LANE_WIDTH / 2;
const color = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length];

function edgePath({ part, from, to }: GraphEdge): string {
  const mid = ROW_HEIGHT / 2;
  if (part === 'through') return `M${x(from)} 0V${ROW_HEIGHT}`;
  if (part === 'top') return `M${x(from)} 0C${x(from)} ${mid} ${x(to)} 0 ${x(to)} ${mid}`;
  return `M${x(from)} ${mid}C${x(from)} ${ROW_HEIGHT} ${x(to)} ${mid} ${x(to)} ${ROW_HEIGHT}`;
}

type GraphCellProps = { row: ReturnType<typeof layoutGraph>['rows'][number]; width: number; current: boolean };

function GraphCell({ row, width, current }: GraphCellProps) {
  return (
    <svg width={width} height={ROW_HEIGHT} aria-hidden className="block">
      {row.edges.map((edge, i) => (
        <path
          key={i}
          d={edgePath(edge)}
          fill="none"
          strokeWidth={2}
          // Lines into a lane take that lane's color.
          stroke={color(edge.part === 'top' ? edge.from : edge.to)}
        />
      ))}
      <circle
        cx={x(row.column)}
        cy={ROW_HEIGHT / 2}
        r={current ? 5.5 : 4}
        fill={color(row.column)}
        className="stroke-white dark:stroke-zinc-950"
        strokeWidth={1.5}
      />
    </svg>
  );
}
