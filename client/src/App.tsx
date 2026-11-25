import { FILES_QUERY, type FilesResult } from './api/queries';
import { useQuery } from './api/useQuery';
import { FileTree } from './components/FileTree';
import { FileView, type FileViewTab } from './components/FileView';
import { PaneResizer } from './components/PaneResizer';
import { RepoForm } from './components/RepoForm';
import { HistoryBaseContext, type HistoryBase } from './historyBase';
import { parseLineRange } from './lineRange';
import { buildTree } from './tree';
import { usePaneWidth } from './usePaneWidth';
import { navigate, useLocationParams } from './useLocationParams';

function App() {
  const params = useLocationParams();
  const repoUrl = params.get('repo');
  const ref = params.get('ref');
  const path = params.get('path');
  const lines = parseLineRange(params.get('lines'));
  const tab: FileViewTab = params.get('view') === 'history' ? 'history' : 'code';
  // The default tab is left out of the URL.
  const view = tab === 'code' ? null : tab;
  // Set once the user follows a commit link; picking a file or going back to latest clears it.
  const basePath = params.get('basePath');
  const historyBase: HistoryBase | null = basePath ? { ref: params.get('baseRef'), path: basePath } : null;
  const baseParams = { baseRef: historyBase?.ref, basePath: historyBase?.path };

  const files = useQuery<FilesResult>(FILES_QUERY, repoUrl ? { url: repoUrl, ...(ref ? { ref } : {}) } : null);
  const repository = files?.status === 'success' ? files.data.repository : null;
  const [paneWidth, setPaneWidth] = usePaneWidth();

  return (
    <div className="flex h-svh flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex items-center gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h1 className="shrink-0 text-base font-semibold">Git History</h1>
        <RepoForm initialUrl={repoUrl ?? ''} onSubmit={(url) => navigate({ repo: url })} />
        {repository && (
          <span className="shrink-0 font-mono text-xs text-zinc-500" title={repository.commit}>
            {ref ? `at ${repository.commit.slice(0, 8)}` : repository.commit.slice(0, 8)}
          </span>
        )}
        {ref && (
          <button
            type="button"
            // Under the name the file has at the start of its history, in case it was renamed since.
            onClick={() => navigate({ repo: repoUrl, path: historyBase?.path ?? path, view })}
            className="shrink-0 text-xs text-sky-700 hover:underline dark:text-sky-400"
          >
            Back to latest
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          id="file-tree-pane"
          // The cap keeps room for the file view if the window shrinks after resizing.
          style={{ width: paneWidth, maxWidth: 'calc(100% - 240px)' }}
          className="shrink-0 overflow-auto border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {files?.status === 'loading' && <p className="p-3 text-sm text-zinc-500">Loading repository…</p>}
          {files?.status === 'error' && (
            <p role="alert" className="p-3 text-sm text-red-600 dark:text-red-400">
              {files.error.message}
            </p>
          )}
          {repository && (
            <FileTree
              // Reset expanded directories when a different repository or commit loads.
              key={`${repoUrl}@${repository.commit}`}
              entries={buildTree(repository.files)}
              selectedPath={path}
              onSelect={(selected) => navigate({ repo: repoUrl, ref, path: selected, view })}
            />
          )}
        </aside>
        <PaneResizer width={paneWidth} onResize={setPaneWidth} controls="file-tree-pane" />

        <main className="min-w-0 flex-1 overflow-auto">
          {repository && repoUrl && path ? (
            // Commit links carry the base along, starting it at the current file if unset.
            <HistoryBaseContext value={historyBase ?? { ref, path }}>
              <FileView
                url={repoUrl}
                commit={repository.commit}
                path={path}
                lines={lines}
                tab={tab}
                onTabChange={(next) =>
                  navigate({
                    repo: repoUrl,
                    ref,
                    path,
                    lines: params.get('lines'),
                    view: next === 'code' ? null : next,
                    ...baseParams,
                  })
                }
                historyBase={historyBase}
              />
            </HistoryBaseContext>
          ) : (
            <p className="p-4 text-sm text-zinc-500">
              {repoUrl ? 'Select a file to view it.' : 'Enter a repository URL to browse it.'}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
