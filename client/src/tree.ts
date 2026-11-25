import type { RepoFile } from './api/queries';

export type TreeEntry =
  | { kind: 'directory'; name: string; path: string; children: TreeEntry[] }
  | { kind: 'file' | 'submodule'; name: string; path: string };

/** Turns the server's flat file list into a tree: directories first, then files, each sorted by name. */
export function buildTree(files: RepoFile[]): TreeEntry[] {
  const root: TreeEntry[] = [];
  const directories = new Map<string, TreeEntry[]>([['', root]]);

  const directory = (path: string): TreeEntry[] => {
    const existing = directories.get(path);
    if (existing) return existing;
    const slash = path.lastIndexOf('/');
    const children: TreeEntry[] = [];
    directory(path.slice(0, Math.max(slash, 0))).push({
      kind: 'directory',
      name: path.slice(slash + 1),
      path,
      children,
    });
    directories.set(path, children);
    return children;
  };

  for (const file of files) {
    const slash = file.path.lastIndexOf('/');
    directory(file.path.slice(0, Math.max(slash, 0))).push({
      kind: file.__typename === 'SubmoduleNode' ? 'submodule' : 'file',
      name: file.path.slice(slash + 1),
      path: file.path,
    });
  }

  for (const children of directories.values()) {
    children.sort(
      (a, b) =>
        Number(b.kind === 'directory') - Number(a.kind === 'directory') ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
  }
  return root;
}

/** The directory paths containing `path`, outermost first. */
export function ancestors(path: string): string[] {
  const parts = path.split('/').slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}
