import type { GraphQLResolveInfo } from 'graphql';
import type { OpenedRepository as OpenedRepositoryMapper } from '../../git/repository.js';
import type { FileNode as FileNodeMapper, SubmoduleNode as SubmoduleNodeMapper, DirectoryNode as DirectoryNodeMapper } from '../../git/tree.js';
import type { FileContentsModel as FileContentsModelMapper, BlameLineModel as BlameLineModelMapper, BlameModel as BlameModelMapper, FileHistoryModel as FileHistoryModelMapper, LineHistoryModel as LineHistoryModelMapper, GraphQLContext } from '../models.js';
import type { Person as PersonMapper, BlameCommit as BlameCommitMapper } from '../../git/blame.js';
import type { LineRange as LineRangeMapper } from '../../git/validation.js';
import type { FileHistoryEntry as FileHistoryEntryMapper } from '../../git/fileHistory.js';
import type { LineHistoryEntry as LineHistoryEntryMapper, Hunk as HunkMapper, HunkLine as HunkLineMapper } from '../../git/lineHistory.js';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Blame = {
  __typename?: 'Blame';
  /** Every commit referenced by `lines`, once each. */
  commits: Array<BlameCommit>;
  lines: Array<BlameLine>;
  path: Scalars['String']['output'];
};

export type BlameCommit = {
  __typename?: 'BlameCommit';
  author: Person;
  /** True when this commit is the root of history. */
  boundary: Scalars['Boolean']['output'];
  committer: Person;
  /** The commit and path to blame next to step back past this commit. */
  previous?: Maybe<Revision>;
  sha: Scalars['String']['output'];
  summary: Scalars['String']['output'];
};

export type BlameLine = {
  __typename?: 'BlameLine';
  /** The commit that last changed this line. */
  commit: BlameCommit;
  content: Scalars['String']['output'];
  /** Line number in the blamed revision. */
  lineNumber: Scalars['Int']['output'];
  /** Line number of this line in `commit`. */
  originalLineNumber: Scalars['Int']['output'];
  /** Path of the file in `commit`. */
  originalPath: Scalars['String']['output'];
  /** Sha of the commit that last changed this line. */
  sha: Scalars['String']['output'];
};

export type DirectoryNode = {
  __typename?: 'DirectoryNode';
  /** Directories first, then files, each group sorted by name. */
  children: Array<TreeNode>;
  name: Scalars['String']['output'];
  path: Scalars['String']['output'];
};

export type FileContents = {
  __typename?: 'FileContents';
  /** True when the file contains a NUL byte in its first 8000 bytes. */
  binary: Scalars['Boolean']['output'];
  content: Scalars['String']['output'];
  /** UTF8 for text files, BASE64 for binary files. */
  encoding: FileEncoding;
  oid: Scalars['String']['output'];
  path: Scalars['String']['output'];
  /** Size in bytes. */
  size: Scalars['Float']['output'];
};

export type FileEncoding =
  | 'base64'
  | 'utf8';

export type FileHistory = {
  __typename?: 'FileHistory';
  commits: Array<FileHistoryCommit>;
  path: Scalars['String']['output'];
  /** True when older commits were left out because of `first`. */
  truncated: Scalars['Boolean']['output'];
};

export type FileHistoryCommit = {
  __typename?: 'FileHistoryCommit';
  author: Person;
  committer: Person;
  /**
   * Parents within the file's history: the nearest ancestors that also changed the
   * file. A parent missing from `commits` was left out because of `first`.
   */
  parents: Array<Scalars['String']['output']>;
  /** Path of the file in this commit. */
  path: Scalars['String']['output'];
  sha: Scalars['String']['output'];
  summary: Scalars['String']['output'];
};

export type FileNode = {
  __typename?: 'FileNode';
  mode: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** Blob object id. */
  oid: Scalars['String']['output'];
  path: Scalars['String']['output'];
  /** Size in bytes. A Float because GraphQL Int is limited to 32 bits. */
  size: Scalars['Float']['output'];
};

export type Hunk = {
  __typename?: 'Hunk';
  lines: Array<HunkLine>;
  newLines: Scalars['Int']['output'];
  newStart: Scalars['Int']['output'];
  oldLines: Scalars['Int']['output'];
  oldStart: Scalars['Int']['output'];
};

export type HunkLine = {
  __typename?: 'HunkLine';
  content: Scalars['String']['output'];
  /** Line number after the change; null for removed lines. */
  newLineNumber?: Maybe<Scalars['Int']['output']>;
  /** Line number before the change; null for added lines. */
  oldLineNumber?: Maybe<Scalars['Int']['output']>;
  type: HunkLineType;
};

export type HunkLineType =
  | 'added'
  | 'context'
  | 'removed';

export type LineHistory = {
  __typename?: 'LineHistory';
  /** Blame for the lines in `range`. */
  annotations: Blame;
  /** Commits that changed the lines, newest first. */
  history: Array<LineHistoryEntry>;
  path: Scalars['String']['output'];
  range: LineRange;
};

export type LineHistoryEntry = {
  __typename?: 'LineHistoryEntry';
  author: Person;
  committer: Person;
  /** How the tracked lines changed in this commit. */
  hunks: Array<Hunk>;
  parents: Array<Scalars['String']['output']>;
  /** Path of the file in this commit. */
  path: Scalars['String']['output'];
  /** Path of the file in the parent; null when this commit introduced the lines. */
  previousPath?: Maybe<Scalars['String']['output']>;
  sha: Scalars['String']['output'];
  summary: Scalars['String']['output'];
};

export type LineRange = {
  __typename?: 'LineRange';
  end: Scalars['Int']['output'];
  start: Scalars['Int']['output'];
};

export type Person = {
  __typename?: 'Person';
  /** ISO 8601 timestamp. */
  date: Scalars['String']['output'];
  email: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

/**
 * Read-only access to git repositories. Every operation is served over WebSocket
 * (graphql-ws protocol) at /graphql.
 */
export type Query = {
  __typename?: 'Query';
  /**
   * Opens a repository at a revision. The first request for a URL clones it on the
   * server; later requests reuse the clone and refresh it periodically.
   */
  repository: Repository;
};


/**
 * Read-only access to git repositories. Every operation is served over WebSocket
 * (graphql-ws protocol) at /graphql.
 */
export type QueryRepositoryArgs = {
  ref?: InputMaybe<Scalars['String']['input']>;
  url: Scalars['String']['input'];
};

/** A repository resolved to a single commit. */
export type Repository = {
  __typename?: 'Repository';
  /** Every line of a file with the commit that last changed it. */
  blame: Blame;
  /** Full sha of the commit that `ref` resolved to. */
  commit: Scalars['String']['output'];
  /** A file's contents. */
  file: FileContents;
  /**
   * Commits that changed a file, newest first, following it across renames. Each
   * commit's `parents` are rewritten to its nearest ancestors that also changed the
   * file, so the commits form the file's own history graph.
   */
  fileHistory: FileHistory;
  /** Every file and submodule in the repository, as a flat list. */
  files: Array<TreeNode>;
  /**
   * Blame for a range of lines plus every commit that changed those lines, newest
   * first, following the lines across renames.
   */
  lineHistory: LineHistory;
  /** The ref that was requested (`HEAD` when none was given). */
  ref: Scalars['String']['output'];
  /**
   * The directory at `path` (the repository root by default), with all of its
   * descendants. GraphQL selections have a fixed depth, so either select as many
   * levels of `children` as you need or use `files` for a flat listing.
   */
  tree: DirectoryNode;
  url: Scalars['String']['output'];
};


/** A repository resolved to a single commit. */
export type RepositoryBlameArgs = {
  path: Scalars['String']['input'];
};


/** A repository resolved to a single commit. */
export type RepositoryFileArgs = {
  path: Scalars['String']['input'];
};


/** A repository resolved to a single commit. */
export type RepositoryFileHistoryArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  path: Scalars['String']['input'];
};


/** A repository resolved to a single commit. */
export type RepositoryLineHistoryArgs = {
  end?: InputMaybe<Scalars['Int']['input']>;
  path: Scalars['String']['input'];
  start: Scalars['Int']['input'];
};


/** A repository resolved to a single commit. */
export type RepositoryTreeArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** A commit and the path a file had in it. */
export type Revision = {
  __typename?: 'Revision';
  path: Scalars['String']['output'];
  sha: Scalars['String']['output'];
};

export type SubmoduleNode = {
  __typename?: 'SubmoduleNode';
  name: Scalars['String']['output'];
  /** Commit the submodule is pinned to. */
  oid: Scalars['String']['output'];
  path: Scalars['String']['output'];
};

export type TreeNode = DirectoryNode | FileNode | SubmoduleNode;

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping of union types */
export type ResolversUnionTypes<_RefType extends Record<string, unknown>> = ResolversObject<{
  TreeNode:
    | ( DirectoryNodeMapper )
    | ( FileNodeMapper )
    | ( SubmoduleNodeMapper )
  ;
}>;


/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Blame: ResolverTypeWrapper<BlameModelMapper>;
  BlameCommit: ResolverTypeWrapper<BlameCommitMapper>;
  BlameLine: ResolverTypeWrapper<BlameLineModelMapper>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  DirectoryNode: ResolverTypeWrapper<DirectoryNodeMapper>;
  FileContents: ResolverTypeWrapper<FileContentsModelMapper>;
  FileEncoding: FileEncoding;
  FileHistory: ResolverTypeWrapper<FileHistoryModelMapper>;
  FileHistoryCommit: ResolverTypeWrapper<FileHistoryEntryMapper>;
  FileNode: ResolverTypeWrapper<FileNodeMapper>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Hunk: ResolverTypeWrapper<HunkMapper>;
  HunkLine: ResolverTypeWrapper<HunkLineMapper>;
  HunkLineType: HunkLineType;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  LineHistory: ResolverTypeWrapper<LineHistoryModelMapper>;
  LineHistoryEntry: ResolverTypeWrapper<LineHistoryEntryMapper>;
  LineRange: ResolverTypeWrapper<LineRangeMapper>;
  Person: ResolverTypeWrapper<PersonMapper>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Repository: ResolverTypeWrapper<OpenedRepositoryMapper>;
  Revision: ResolverTypeWrapper<Revision>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SubmoduleNode: ResolverTypeWrapper<SubmoduleNodeMapper>;
  TreeNode: ResolverTypeWrapper<ResolversUnionTypes<ResolversTypes>['TreeNode']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Blame: BlameModelMapper;
  BlameCommit: BlameCommitMapper;
  BlameLine: BlameLineModelMapper;
  Boolean: Scalars['Boolean']['output'];
  DirectoryNode: DirectoryNodeMapper;
  FileContents: FileContentsModelMapper;
  FileHistory: FileHistoryModelMapper;
  FileHistoryCommit: FileHistoryEntryMapper;
  FileNode: FileNodeMapper;
  Float: Scalars['Float']['output'];
  Hunk: HunkMapper;
  HunkLine: HunkLineMapper;
  Int: Scalars['Int']['output'];
  LineHistory: LineHistoryModelMapper;
  LineHistoryEntry: LineHistoryEntryMapper;
  LineRange: LineRangeMapper;
  Person: PersonMapper;
  Query: Record<PropertyKey, never>;
  Repository: OpenedRepositoryMapper;
  Revision: Revision;
  String: Scalars['String']['output'];
  SubmoduleNode: SubmoduleNodeMapper;
  TreeNode: ResolversUnionTypes<ResolversParentTypes>['TreeNode'];
}>;

export type BlameResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Blame'] = ResolversParentTypes['Blame']> = ResolversObject<{
  commits?: Resolver<Array<ResolversTypes['BlameCommit']>, ParentType, ContextType>;
  lines?: Resolver<Array<ResolversTypes['BlameLine']>, ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type BlameCommitResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['BlameCommit'] = ResolversParentTypes['BlameCommit']> = ResolversObject<{
  author?: Resolver<ResolversTypes['Person'], ParentType, ContextType>;
  boundary?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  committer?: Resolver<ResolversTypes['Person'], ParentType, ContextType>;
  previous?: Resolver<Maybe<ResolversTypes['Revision']>, ParentType, ContextType>;
  sha?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  summary?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type BlameLineResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['BlameLine'] = ResolversParentTypes['BlameLine']> = ResolversObject<{
  commit?: Resolver<ResolversTypes['BlameCommit'], ParentType, ContextType>;
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  lineNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  originalLineNumber?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  originalPath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sha?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type DirectoryNodeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['DirectoryNode'] = ResolversParentTypes['DirectoryNode']> = ResolversObject<{
  children?: Resolver<Array<ResolversTypes['TreeNode']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type FileContentsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['FileContents'] = ResolversParentTypes['FileContents']> = ResolversObject<{
  binary?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  encoding?: Resolver<ResolversTypes['FileEncoding'], ParentType, ContextType>;
  oid?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  size?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
}>;

export type FileEncodingResolvers = { BASE64: 'base64', UTF8: 'utf8' };

export type FileHistoryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['FileHistory'] = ResolversParentTypes['FileHistory']> = ResolversObject<{
  commits?: Resolver<Array<ResolversTypes['FileHistoryCommit']>, ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  truncated?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
}>;

export type FileHistoryCommitResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['FileHistoryCommit'] = ResolversParentTypes['FileHistoryCommit']> = ResolversObject<{
  author?: Resolver<ResolversTypes['Person'], ParentType, ContextType>;
  committer?: Resolver<ResolversTypes['Person'], ParentType, ContextType>;
  parents?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sha?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  summary?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type FileNodeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['FileNode'] = ResolversParentTypes['FileNode']> = ResolversObject<{
  mode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  oid?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  size?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type HunkResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Hunk'] = ResolversParentTypes['Hunk']> = ResolversObject<{
  lines?: Resolver<Array<ResolversTypes['HunkLine']>, ParentType, ContextType>;
  newLines?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  newStart?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  oldLines?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  oldStart?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type HunkLineResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['HunkLine'] = ResolversParentTypes['HunkLine']> = ResolversObject<{
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  newLineNumber?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  oldLineNumber?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['HunkLineType'], ParentType, ContextType>;
}>;

export type HunkLineTypeResolvers = { ADDED: 'added', CONTEXT: 'context', REMOVED: 'removed' };

export type LineHistoryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['LineHistory'] = ResolversParentTypes['LineHistory']> = ResolversObject<{
  annotations?: Resolver<ResolversTypes['Blame'], ParentType, ContextType>;
  history?: Resolver<Array<ResolversTypes['LineHistoryEntry']>, ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  range?: Resolver<ResolversTypes['LineRange'], ParentType, ContextType>;
}>;

export type LineHistoryEntryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['LineHistoryEntry'] = ResolversParentTypes['LineHistoryEntry']> = ResolversObject<{
  author?: Resolver<ResolversTypes['Person'], ParentType, ContextType>;
  committer?: Resolver<ResolversTypes['Person'], ParentType, ContextType>;
  hunks?: Resolver<Array<ResolversTypes['Hunk']>, ParentType, ContextType>;
  parents?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  previousPath?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sha?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  summary?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type LineRangeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['LineRange'] = ResolversParentTypes['LineRange']> = ResolversObject<{
  end?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  start?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type PersonResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Person'] = ResolversParentTypes['Person']> = ResolversObject<{
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  repository?: Resolver<ResolversTypes['Repository'], ParentType, ContextType, RequireFields<QueryRepositoryArgs, 'url'>>;
}>;

export type RepositoryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Repository'] = ResolversParentTypes['Repository']> = ResolversObject<{
  blame?: Resolver<ResolversTypes['Blame'], ParentType, ContextType, RequireFields<RepositoryBlameArgs, 'path'>>;
  commit?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  file?: Resolver<ResolversTypes['FileContents'], ParentType, ContextType, RequireFields<RepositoryFileArgs, 'path'>>;
  fileHistory?: Resolver<ResolversTypes['FileHistory'], ParentType, ContextType, RequireFields<RepositoryFileHistoryArgs, 'path'>>;
  files?: Resolver<Array<ResolversTypes['TreeNode']>, ParentType, ContextType>;
  lineHistory?: Resolver<ResolversTypes['LineHistory'], ParentType, ContextType, RequireFields<RepositoryLineHistoryArgs, 'path' | 'start'>>;
  ref?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tree?: Resolver<ResolversTypes['DirectoryNode'], ParentType, ContextType, Partial<RepositoryTreeArgs>>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type RevisionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Revision'] = ResolversParentTypes['Revision']> = ResolversObject<{
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sha?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type SubmoduleNodeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SubmoduleNode'] = ResolversParentTypes['SubmoduleNode']> = ResolversObject<{
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  oid?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TreeNodeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['TreeNode'] = ResolversParentTypes['TreeNode']> = ResolversObject<{
  __resolveType: TypeResolveFn<'DirectoryNode' | 'FileNode' | 'SubmoduleNode', ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  Blame?: BlameResolvers<ContextType>;
  BlameCommit?: BlameCommitResolvers<ContextType>;
  BlameLine?: BlameLineResolvers<ContextType>;
  DirectoryNode?: DirectoryNodeResolvers<ContextType>;
  FileContents?: FileContentsResolvers<ContextType>;
  FileEncoding?: FileEncodingResolvers;
  FileHistory?: FileHistoryResolvers<ContextType>;
  FileHistoryCommit?: FileHistoryCommitResolvers<ContextType>;
  FileNode?: FileNodeResolvers<ContextType>;
  Hunk?: HunkResolvers<ContextType>;
  HunkLine?: HunkLineResolvers<ContextType>;
  HunkLineType?: HunkLineTypeResolvers;
  LineHistory?: LineHistoryResolvers<ContextType>;
  LineHistoryEntry?: LineHistoryEntryResolvers<ContextType>;
  LineRange?: LineRangeResolvers<ContextType>;
  Person?: PersonResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Repository?: RepositoryResolvers<ContextType>;
  Revision?: RevisionResolvers<ContextType>;
  SubmoduleNode?: SubmoduleNodeResolvers<ContextType>;
  TreeNode?: TreeNodeResolvers<ContextType>;
}>;

