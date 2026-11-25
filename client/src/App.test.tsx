import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { GraphQLRequestError, request } from './api/client';
import { BLAME_QUERY, FILE_HISTORY_QUERY, FILES_QUERY, PARENT_LINES_QUERY } from './api/queries';

vi.mock('./api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/client')>()),
  request: vi.fn(),
}));

const REPO = 'https://example.com/repo.git';
const COMMIT = 'a'.repeat(40);
const OLD_COMMIT = '1'.repeat(40);
const NEW_COMMIT = '2'.repeat(40);
const mockRequest = vi.mocked(request);

type Line = [sha: string, content: string, original?: { line: number; path: string }];

function blameOf(lines: Line[]) {
  const shas = [...new Set(lines.map(([sha]) => sha))];
  return {
    repository: {
      blame: {
        lines: lines.map(([sha, content, original], i) => ({
          lineNumber: i + 1,
          content,
          sha,
          originalLineNumber: original?.line ?? i + 1,
          originalPath: original?.path ?? 'src/main.ts',
        })),
        commits: shas.map((sha) => ({
          sha,
          summary: `Commit ${sha}`,
          author: { name: `Author ${sha.slice(0, 1)}`, email: 'a@example.com', date: '2024-03-05T10:00:00Z' },
          previous: sha === NEW_COMMIT ? { sha: OLD_COMMIT, path: 'old/main.ts' } : null,
        })),
      },
    },
  };
}

beforeEach(() => {
  history.replaceState(null, '', '/');
  // jsdom does not implement scrolling.
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  mockRequest.mockImplementation(async (query, variables) => {
    if (query === FILES_QUERY) {
      return {
        repository: {
          commit: (variables.ref as string | undefined) ?? COMMIT,
          files: [
            { __typename: 'FileNode', path: 'README.md' },
            { __typename: 'FileNode', path: 'src/main.ts' },
            { __typename: 'FileNode', path: 'logo.png' },
          ],
        },
      };
    }
    if (query === BLAME_QUERY) {
      if (variables.path === 'logo.png') throw new GraphQLRequestError('binary', 'UNSUPPORTED_MEDIA_TYPE');
      if (variables.ref === OLD_COMMIT) {
        // The file before it was moved to src/main.ts, with the imported lines at 5-6.
        return blameOf([1, 2, 3, 4, 5, 6].map((n): Line => [OLD_COMMIT, `old line ${n}`]));
      }
      return blameOf([
        [OLD_COMMIT, 'import x;', { line: 5, path: 'old/main.ts' }],
        [OLD_COMMIT, '', { line: 6, path: 'old/main.ts' }],
        [NEW_COMMIT, 'run(x);'],
      ]);
    }
    if (query === FILE_HISTORY_QUERY) {
      const person = { name: 'Ann', email: 'ann@example.com', date: '2024-03-05T10:00:00Z' };
      const commits = [
        { sha: NEW_COMMIT, parents: [OLD_COMMIT], summary: 'Run it', path: 'src/main.ts', author: person },
        { sha: OLD_COMMIT, parents: [], summary: 'Start in old/', path: 'old/main.ts', author: person },
      ];
      // At OLD_COMMIT only the older commit exists; elsewhere both do.
      const visible = variables.ref === OLD_COMMIT ? commits.slice(1) : commits;
      return {
        repository: {
          fileHistory: { truncated: false, commits: visible.slice(0, (variables.first as number) ?? 200) },
        },
      };
    }
    if (query === PARENT_LINES_QUERY) {
      // In the parent, the line NEW_COMMIT changed was lines 4-5.
      return {
        repository: {
          lineHistory: { history: [{ sha: NEW_COMMIT, hunks: [{ oldStart: 4, oldLines: 2 }] }] },
        },
      };
    }
    throw new Error(`Unexpected query ${query}`);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('App', () => {
  it('loads the file tree for an entered repository URL', async () => {
    render(<App />);

    await userEvent.type(screen.getByRole('textbox', { name: 'Repository URL' }), REPO);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    const tree = await screen.findByRole('tree', { name: 'Files' });
    expect(mockRequest).toHaveBeenCalledWith(FILES_QUERY, { url: REPO });
    expect(within(tree).getByRole('button', { name: 'README.md' })).toBeInTheDocument();
    expect(within(tree).queryByRole('button', { name: 'main.ts' })).not.toBeInTheDocument();
    expect(new URLSearchParams(location.search).get('repo')).toBe(REPO);
  });

  it('expands directories and shows an annotated file when clicked', async () => {
    history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}`);
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'src' }));
    await userEvent.click(screen.getByRole('button', { name: 'main.ts' }));

    expect(await screen.findByText('run(x);')).toBeInTheDocument();
    expect(mockRequest).toHaveBeenCalledWith(BLAME_QUERY, { url: REPO, ref: COMMIT, path: 'src/main.ts' });
    expect(screen.getByRole('heading', { name: 'src/main.ts' })).toBeInTheDocument();
    // One annotation per run of lines from the same commit.
    expect(screen.getAllByText('11111111')).toHaveLength(1);
    expect(screen.getAllByText('22222222')).toHaveLength(1);
    expect(screen.getAllByText('2024-03-05')).toHaveLength(2);
    expect(new URLSearchParams(location.search).get('path')).toBe('src/main.ts');
  });

  it('opens the file named in the URL with its directories expanded', async () => {
    history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts`);
    render(<App />);

    expect(await screen.findByText('import x;')).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { selected: true })).toHaveTextContent('main.ts');
  });

  it('says when a file is binary', async () => {
    history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}`);
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'logo.png' }));

    expect(await screen.findByText('Binary file, not shown.')).toBeInTheDocument();
  });

  it('shows the error when the repository cannot be opened', async () => {
    mockRequest.mockRejectedValue(new GraphQLRequestError('Host not allowed', 'FORBIDDEN'));
    history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}`);
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Host not allowed');
  });

  describe('navigation pane', () => {
    const pane = () => document.getElementById('file-tree-pane')!;
    const handle = () => screen.getByRole('separator', { name: 'Resize file tree' });

    it('resizes by dragging the handle and remembers the width', () => {
      // jsdom does not implement pointer capture.
      HTMLElement.prototype.setPointerCapture = vi.fn();
      const { unmount } = render(<App />);
      expect(pane()).toHaveStyle({ width: '288px' });

      fireEvent.pointerDown(handle(), { button: 0, clientX: 288, pointerId: 1 });
      fireEvent.pointerMove(handle(), { clientX: 400, pointerId: 1 });
      fireEvent.pointerUp(handle(), { clientX: 400, pointerId: 1 });
      fireEvent.pointerMove(handle(), { clientX: 500, pointerId: 1 });

      expect(pane()).toHaveStyle({ width: '400px' });
      expect(handle()).toHaveAttribute('aria-valuenow', '400');

      unmount();
      render(<App />);
      expect(pane()).toHaveStyle({ width: '400px' });
    });

    it('resizes from the keyboard within limits and resets on double-click', async () => {
      render(<App />);

      handle().focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(pane()).toHaveStyle({ width: '304px' });

      await userEvent.keyboard('{Home}');
      expect(pane()).toHaveStyle({ width: '160px' });
      await userEvent.keyboard('{ArrowLeft}');
      expect(pane()).toHaveStyle({ width: '160px' });

      // jsdom's window is 1024px wide; the main pane keeps 240px.
      await userEvent.keyboard('{End}');
      expect(pane()).toHaveStyle({ width: '784px' });

      await userEvent.dblClick(handle());
      expect(pane()).toHaveStyle({ width: '288px' });
    });
  });

  describe('commit links', () => {
    const params = () => Object.fromEntries(new URLSearchParams(location.search));

    it('opens the file at the commit and scrolls to the lines it had there', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts`);
      render(<App />);

      const link = await screen.findByRole('link', { name: '11111111' });
      expect(link).toHaveAttribute(
        'href',
        `?repo=${encodeURIComponent(REPO)}&ref=${OLD_COMMIT}&path=old%2Fmain.ts&lines=5-6&basePath=src%2Fmain.ts`,
      );
      await userEvent.click(link);

      expect(await screen.findByText('old line 6')).toBeInTheDocument();
      expect(params()).toEqual({ repo: REPO, ref: OLD_COMMIT, path: 'old/main.ts', lines: '5-6', basePath: 'src/main.ts' });
      expect(mockRequest).toHaveBeenCalledWith(FILES_QUERY, { url: REPO, ref: OLD_COMMIT });
      expect(mockRequest).toHaveBeenCalledWith(BLAME_QUERY, { url: REPO, ref: OLD_COMMIT, path: 'old/main.ts' });
      expect(screen.getByRole('heading', { name: 'old/main.ts' })).toBeInTheDocument();

      const highlighted = document.querySelectorAll('tr[aria-current]');
      expect([...highlighted].map((row) => row.id)).toEqual(['L5', 'L6']);
      expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(
        document.getElementById('L5'),
      );
    });

    it('goes back to the lines the link was followed from', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts`);
      render(<App />);

      await userEvent.click(await screen.findByRole('link', { name: '11111111' }));
      await screen.findByText('old line 6');
      history.back();

      expect(await screen.findByText('run(x);')).toBeInTheDocument();
      expect(params()).toEqual({ repo: REPO, path: 'src/main.ts', lines: '1-2' });
      await waitFor(() =>
        expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(
          document.getElementById('L1'),
        ),
      );
    });

    it('returns to the latest commit', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&ref=${OLD_COMMIT}&path=src/main.ts`);
      render(<App />);

      await userEvent.click(await screen.findByRole('button', { name: 'Back to latest' }));

      expect(await screen.findByText('run(x);')).toBeInTheDocument();
      expect(params()).toEqual({ repo: REPO, path: 'src/main.ts' });
    });

    it('opens the file before a commit at the lines it replaced', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts`);
      render(<App />);

      await userEvent.click(await screen.findByRole('link', { name: 'Before 22222222' }));

      expect(await screen.findByText('old line 6')).toBeInTheDocument();
      expect(mockRequest).toHaveBeenCalledWith(PARENT_LINES_QUERY, {
        url: REPO,
        ref: NEW_COMMIT,
        path: 'src/main.ts',
        start: 3,
        end: 3,
      });
      expect(params()).toEqual({ repo: REPO, ref: OLD_COMMIT, path: 'old/main.ts', lines: '4-5', basePath: 'src/main.ts' });
      const highlighted = document.querySelectorAll('tr[aria-current]');
      expect([...highlighted].map((row) => row.id)).toEqual(['L4', 'L5']);

      history.back();
      expect(await screen.findByText('run(x);')).toBeInTheDocument();
      expect(params()).toEqual({ repo: REPO, path: 'src/main.ts', lines: '3' });
    });

    it('falls back to the commit\'s line numbers when the lookup fails', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts`);
      const answer = mockRequest.getMockImplementation()!;
      mockRequest.mockImplementation(async (query, variables) => {
        if (query === PARENT_LINES_QUERY) throw new GraphQLRequestError('nope', 'BAD_USER_INPUT');
        return answer(query, variables);
      });
      render(<App />);

      await userEvent.click(await screen.findByRole('link', { name: 'Before 22222222' }));

      expect(await screen.findByText('old line 6')).toBeInTheDocument();
      expect(params()).toEqual({ repo: REPO, ref: OLD_COMMIT, path: 'old/main.ts', lines: '3', basePath: 'src/main.ts' });
    });

    it('has no link before a commit that added the file', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts`);
      render(<App />);

      await screen.findByRole('link', { name: '11111111' });
      expect(screen.queryByRole('link', { name: 'Before 11111111' })).not.toBeInTheDocument();
    });
  });

  describe('file tabs', () => {
    const params = () => Object.fromEntries(new URLSearchParams(location.search));

    it('switches between the code and the commit history', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts`);
      render(<App />);

      expect(await screen.findByText('run(x);')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');

      await userEvent.click(screen.getByRole('tab', { name: 'History' }));

      const table = await screen.findByRole('table', { name: 'Commit history' });
      expect(mockRequest).toHaveBeenCalledWith(FILE_HISTORY_QUERY, {
        url: REPO,
        ref: COMMIT,
        path: 'src/main.ts',
        first: 500,
      });
      const rows = within(table).getAllByRole('row');
      expect(rows.map((row) => within(row).getByRole('link').textContent)).toEqual(['22222222', '11111111']);
      // The old path shows on commits from before the rename.
      expect(within(rows[1]!).getByText('old/main.ts')).toBeInTheDocument();
      expect(screen.queryByText('run(x);')).not.toBeInTheDocument();
      expect(params()).toEqual({ repo: REPO, path: 'src/main.ts', view: 'history' });

      await userEvent.click(screen.getByRole('tab', { name: 'Code' }));
      expect(await screen.findByText('run(x);')).toBeInTheDocument();
      expect(params()).toEqual({ repo: REPO, path: 'src/main.ts' });
    });

    it('moves between tabs with the arrow keys', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts`);
      render(<App />);

      await screen.findByText('run(x);');
      screen.getByRole('tab', { name: 'Code' }).focus();
      await userEvent.keyboard('{ArrowRight}');

      expect(screen.getByRole('tab', { name: 'History' })).toHaveFocus();
      expect(await screen.findByRole('table', { name: 'Commit history' })).toBeInTheDocument();
    });

    it('opens the code at a commit from the history', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts&view=history`);
      render(<App />);

      await userEvent.click(await screen.findByRole('link', { name: '11111111' }));

      expect(await screen.findByText('old line 6')).toBeInTheDocument();
      expect(params()).toEqual({ repo: REPO, ref: OLD_COMMIT, path: 'old/main.ts', basePath: 'src/main.ts' });
    });

    it('stays on the history tab when picking another file', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts&view=history`);
      render(<App />);

      await userEvent.click(await screen.findByRole('button', { name: 'README.md' }));

      await waitFor(() =>
        expect(mockRequest).toHaveBeenCalledWith(FILE_HISTORY_QUERY, expect.objectContaining({ path: 'README.md' })),
      );
      expect(params()).toEqual({ repo: REPO, path: 'README.md', view: 'history' });
    });

    it('highlights the version on show and scrolls to it', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts&view=history`);
      render(<App />);

      await screen.findByRole('table', { name: 'Commit history' });
      const current = document.querySelector('tr[aria-current]');
      expect(current).toHaveTextContent('22222222');
      expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts.at(-1)).toBe(current);
    });

    it('keeps the whole history and highlights an older commit opened from the code', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts`);
      render(<App />);

      await userEvent.click(await screen.findByRole('link', { name: '11111111' }));
      await screen.findByText('old line 6');
      await userEvent.click(screen.getByRole('tab', { name: 'History' }));

      const table = await screen.findByRole('table', { name: 'Commit history' });
      // Listed from where browsing started, not from the older commit.
      expect(mockRequest).toHaveBeenCalledWith(FILE_HISTORY_QUERY, { url: REPO, path: 'src/main.ts', first: 500 });
      expect(within(table).getAllByRole('row')).toHaveLength(2);
      await waitFor(() => expect(document.querySelector('tr[aria-current]')).toHaveTextContent('11111111'));
      expect(mockRequest).toHaveBeenCalledWith(FILE_HISTORY_QUERY, {
        url: REPO,
        ref: OLD_COMMIT,
        path: 'old/main.ts',
        first: 1,
      });
      expect(params()).toEqual({
        repo: REPO,
        ref: OLD_COMMIT,
        path: 'old/main.ts',
        lines: '5-6',
        view: 'history',
        basePath: 'src/main.ts',
      });
    });

    it('moves the highlight when another commit is opened from the history', async () => {
      history.replaceState(null, '', `/?repo=${encodeURIComponent(REPO)}&path=src/main.ts&view=history`);
      render(<App />);

      await userEvent.click(await screen.findByRole('link', { name: '11111111' }));
      await screen.findByText('old line 6');
      await userEvent.click(screen.getByRole('tab', { name: 'History' }));

      await waitFor(() => expect(document.querySelector('tr[aria-current]')).toHaveTextContent('11111111'));
      expect(screen.getAllByRole('row')).toHaveLength(2);
    });

    it('goes back to the latest version under the name the file started with', async () => {
      history.replaceState(
        null,
        '',
        `/?repo=${encodeURIComponent(REPO)}&ref=${OLD_COMMIT}&path=old/main.ts&view=history&basePath=src/main.ts`,
      );
      render(<App />);

      await userEvent.click(await screen.findByRole('button', { name: 'Back to latest' }));

      expect(params()).toEqual({ repo: REPO, path: 'src/main.ts', view: 'history' });
    });

    it('starts over from a file picked in the tree', async () => {
      history.replaceState(
        null,
        '',
        `/?repo=${encodeURIComponent(REPO)}&ref=${OLD_COMMIT}&path=old/main.ts&basePath=src/main.ts`,
      );
      render(<App />);

      await userEvent.click(await screen.findByRole('button', { name: 'README.md' }));

      expect(params()).toEqual({ repo: REPO, ref: OLD_COMMIT, path: 'README.md' });
    });
  });
});
