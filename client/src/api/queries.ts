export const FILES_QUERY = /* GraphQL */ `
  query Files($url: String!, $ref: String) {
    repository(url: $url, ref: $ref) {
      commit
      files {
        __typename
        ... on FileNode { path }
        ... on SubmoduleNode { path }
      }
    }
  }
`;

export type RepoFile = { __typename: 'FileNode' | 'SubmoduleNode'; path: string };

export type FilesResult = {
  repository: { commit: string; files: RepoFile[] };
};

export const BLAME_QUERY = /* GraphQL */ `
  query Blame($url: String!, $ref: String!, $path: String!) {
    repository(url: $url, ref: $ref) {
      blame(path: $path) {
        lines { lineNumber content sha originalLineNumber originalPath }
        commits { sha summary author { name email date } previous { sha path } }
      }
    }
  }
`;

export type BlameLine = {
  lineNumber: number;
  content: string;
  sha: string;
  originalLineNumber: number;
  originalPath: string;
};

export type BlameCommit = {
  sha: string;
  summary: string;
  author: { name: string; email: string; date: string };
  /** The parent commit and the file's path there; null when the commit added the file. */
  previous: { sha: string; path: string } | null;
};

export type BlameResult = {
  repository: { blame: { lines: BlameLine[]; commits: BlameCommit[] } };
};

export const PARENT_LINES_QUERY = /* GraphQL */ `
  query ParentLines($url: String!, $ref: String!, $path: String!, $start: Int!, $end: Int!) {
    repository(url: $url, ref: $ref) {
      lineHistory(path: $path, start: $start, end: $end) {
        history { sha hunks { oldStart oldLines } }
      }
    }
  }
`;

export type ParentLinesResult = {
  repository: {
    lineHistory: { history: { sha: string; hunks: { oldStart: number; oldLines: number }[] }[] };
  };
};

export const FILE_HISTORY_QUERY = /* GraphQL */ `
  query FileHistory($url: String!, $ref: String, $path: String!, $first: Int) {
    repository(url: $url, ref: $ref) {
      fileHistory(path: $path, first: $first) {
        truncated
        commits { sha parents summary path author { name email date } }
      }
    }
  }
`;

export type FileHistoryCommit = {
  sha: string;
  parents: string[];
  summary: string;
  path: string;
  author: { name: string; email: string; date: string };
};

export type FileHistoryResult = {
  repository: { fileHistory: { truncated: boolean; commits: FileHistoryCommit[] } };
};
