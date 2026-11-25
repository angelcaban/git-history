import { ApiError } from '../errors.js';
import { blame, countLines, fileLog, lineLog, openRepository, readBlob, readTextBlob, readTree } from '../git/repository.js';
import type { TreeNode } from '../git/tree.js';
import { validateFilePath, validateLimit, validateLineRange } from '../git/validation.js';
import type { Resolvers } from './__generated__/resolvers-types.js';

export const resolvers: Resolvers = {
  Query: {
    repository: (_parent, { url, ref }, { repos, config }) => openRepository(repos, config, url, ref),
  },

  Repository: {
    tree: async (repo, { path }) => {
      const root = await readTree(repo);
      if (path == null || path.replace(/^\/+|\/+$/g, '') === '') return root;
      const target = validateFilePath(path);
      const found = findNode(root, target);
      if (!found) throw new ApiError('NOT_FOUND', `No directory "${target}" at ${repo.commit}`);
      if (found.type !== 'directory') throw new ApiError('BAD_USER_INPUT', `"${target}" is not a directory`);
      return found;
    },

    files: async (repo) => {
      const files: TreeNode[] = [];
      const walk = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'directory') walk(node.children);
          else files.push(node);
        }
      };
      walk((await readTree(repo)).children);
      return files;
    },

    file: async (repo, { path: rawPath }, { config }) => {
      const path = validateFilePath(rawPath);
      const blob = await readBlob(repo, path, config.maxFileBytes);
      const encoding = blob.binary ? 'base64' : 'utf8';
      return { path, oid: blob.oid, size: blob.size, binary: blob.binary, encoding, content: blob.content.toString(encoding) };
    },

    blame: async (repo, { path: rawPath }, { config }) => {
      const path = validateFilePath(rawPath);
      await readTextBlob(repo, path, config.maxFileBytes);
      return { path, ...(await blame(repo, path)) };
    },

    fileHistory: async (repo, { path: rawPath, first }) => {
      const path = validateFilePath(rawPath);
      const limit = validateLimit(first, 200, 1000);
      return { path, ...(await fileLog(repo, path, limit)) };
    },

    lineHistory: async (repo, { path: rawPath, start, end }, { config }) => {
      const path = validateFilePath(rawPath);
      const range = validateLineRange(start, end);
      const lineCount = countLines((await readTextBlob(repo, path, config.maxFileBytes)).content);
      if (range.end > lineCount) {
        throw new ApiError('BAD_USER_INPUT', `${path} has only ${lineCount} line${lineCount === 1 ? '' : 's'}`);
      }
      const [annotations, history] = await Promise.all([blame(repo, path, range), lineLog(repo, path, range)]);
      return { path, range, annotations: { path, ...annotations }, history };
    },
  },

  TreeNode: {
    __resolveType: (node) => {
      switch (node.type) {
        case 'file':
          return 'FileNode';
        case 'submodule':
          return 'SubmoduleNode';
        case 'directory':
          return 'DirectoryNode';
      }
    },
  },

  Blame: {
    lines: ({ lines, commits }) => lines.map((line) => ({ ...line, commit: commits[line.sha]! })),
    commits: ({ commits }) => Object.values(commits),
  },

  FileEncoding: { UTF8: 'utf8', BASE64: 'base64' },
  HunkLineType: { CONTEXT: 'context', ADDED: 'added', REMOVED: 'removed' },
};

function findNode(root: TreeNode, path: string): TreeNode | undefined {
  let node: TreeNode | undefined = root;
  for (const name of path.split('/')) {
    node = node.type === 'directory' ? node.children.find((child) => child.name === name) : undefined;
    if (!node) return undefined;
  }
  return node;
}
