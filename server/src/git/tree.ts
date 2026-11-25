export interface FileNode {
  type: 'file';
  name: string;
  path: string;
  /** Blob object id. */
  oid: string;
  mode: string;
  size: number;
}

export interface SubmoduleNode {
  type: 'submodule';
  name: string;
  path: string;
  /** Commit the submodule is pinned to. */
  oid: string;
}

export interface DirectoryNode {
  type: 'directory';
  name: string;
  path: string;
  children: TreeNode[];
}

export type TreeNode = FileNode | SubmoduleNode | DirectoryNode;

/**
 * Builds a nested tree from `git ls-tree -r -z -l` output.
 * Each entry is `<mode> SP <type> SP <oid> SP+ <size> TAB <path>`, NUL-terminated.
 * Directories are sorted before files, each group alphabetically.
 */
export function parseLsTree(output: string): DirectoryNode {
  const root: DirectoryNode = { type: 'directory', name: '', path: '', children: [] };
  const directories = new Map<string, DirectoryNode>([['', root]]);

  const directoryFor = (dirPath: string): DirectoryNode => {
    const existing = directories.get(dirPath);
    if (existing) return existing;
    const slash = dirPath.lastIndexOf('/');
    const parent = directoryFor(slash === -1 ? '' : dirPath.slice(0, slash));
    const node: DirectoryNode = { type: 'directory', name: dirPath.slice(slash + 1), path: dirPath, children: [] };
    parent.children.push(node);
    directories.set(dirPath, node);
    return node;
  };

  for (const entry of output.split('\0')) {
    if (entry === '') continue;
    const tab = entry.indexOf('\t');
    const [mode = '', type, oid = '', size] = entry.slice(0, tab).split(/ +/);
    const entryPath = entry.slice(tab + 1);
    const slash = entryPath.lastIndexOf('/');
    const parent = directoryFor(slash === -1 ? '' : entryPath.slice(0, slash));
    const name = entryPath.slice(slash + 1);

    if (type === 'blob') {
      parent.children.push({ type: 'file', name, path: entryPath, oid, mode, size: Number(size) });
    } else if (type === 'commit') {
      parent.children.push({ type: 'submodule', name, path: entryPath, oid });
    } else if (type === 'tree') {
      directoryFor(entryPath);
    }
  }

  sortTree(root);
  return root;
}

function sortTree(dir: DirectoryNode): void {
  dir.children.sort((a, b) => {
    if ((a.type === 'directory') !== (b.type === 'directory')) return a.type === 'directory' ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  for (const child of dir.children) {
    if (child.type === 'directory') sortTree(child);
  }
}
