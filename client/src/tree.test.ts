import { describe, expect, it } from 'vitest';
import { ancestors, buildTree } from './tree';

describe('buildTree', () => {
  it('nests files under directories, directories first, each sorted by name', () => {
    const tree = buildTree([
      { __typename: 'FileNode', path: 'README.md' },
      { __typename: 'FileNode', path: 'src/b.ts' },
      { __typename: 'FileNode', path: 'src/a.ts' },
      { __typename: 'SubmoduleNode', path: 'vendor/lib' },
      { __typename: 'FileNode', path: 'src/util/x.ts' },
    ]);

    expect(tree).toEqual([
      {
        kind: 'directory',
        name: 'src',
        path: 'src',
        children: [
          {
            kind: 'directory',
            name: 'util',
            path: 'src/util',
            children: [{ kind: 'file', name: 'x.ts', path: 'src/util/x.ts' }],
          },
          { kind: 'file', name: 'a.ts', path: 'src/a.ts' },
          { kind: 'file', name: 'b.ts', path: 'src/b.ts' },
        ],
      },
      {
        kind: 'directory',
        name: 'vendor',
        path: 'vendor',
        children: [{ kind: 'submodule', name: 'lib', path: 'vendor/lib' }],
      },
      { kind: 'file', name: 'README.md', path: 'README.md' },
    ]);
  });

  it('returns an empty tree for no files', () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe('ancestors', () => {
  it('lists the containing directories, outermost first', () => {
    expect(ancestors('a/b/c.txt')).toEqual(['a', 'a/b']);
    expect(ancestors('c.txt')).toEqual([]);
  });
});
