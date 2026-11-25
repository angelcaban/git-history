// Parent values the resolvers pass around, where they differ from the plain git
// structures. codegen.ts maps each GraphQL type to one of these or to a type in src/git.
import type { Config } from '../config.js';
import type { BlameCommit, BlameLine, BlameResult } from '../git/blame.js';
import type { FileHistoryEntry } from '../git/fileHistory.js';
import type { LineHistoryEntry } from '../git/lineHistory.js';
import type { RepoCache } from '../git/repoCache.js';
import type { LineRange } from '../git/validation.js';

export interface GraphQLContext {
  repos: RepoCache;
  config: Config;
}

export type BlameModel = BlameResult & { path: string };

export type BlameLineModel = BlameLine & { commit: BlameCommit };

export interface FileContentsModel {
  path: string;
  oid: string;
  size: number;
  binary: boolean;
  encoding: 'utf8' | 'base64';
  content: string;
}

export interface LineHistoryModel {
  path: string;
  range: LineRange;
  annotations: BlameModel;
  history: LineHistoryEntry[];
}

export interface FileHistoryModel {
  path: string;
  commits: FileHistoryEntry[];
  truncated: boolean;
}
