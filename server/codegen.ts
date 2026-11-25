import type { CodegenConfig } from '@graphql-codegen/cli';

// Generates resolver types from src/graphql/schema.graphql. Mappers tie each GraphQL
// type to the existing TypeScript structure resolvers return for it, so the schema
// and the git layer cannot drift apart without a type error. Run `npm run codegen`
// after changing the schema.
const config: CodegenConfig = {
  schema: 'src/graphql/schema.graphql',
  generates: {
    'src/graphql/__generated__/resolvers-types.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        useTypeImports: true,
        enumsAsTypes: true,
        useIndexSignature: true,
        contextType: '../models.js#GraphQLContext',
        // Mapped types share names with the generated GraphQL types; import them as e.g. FileNodeMapper.
        mapperTypeSuffix: 'Mapper',
        enumValues: {
          FileEncoding: { UTF8: 'utf8', BASE64: 'base64' },
          HunkLineType: { CONTEXT: 'context', ADDED: 'added', REMOVED: 'removed' },
        },
        mappers: {
          Repository: '../../git/repository.js#OpenedRepository',
          FileNode: '../../git/tree.js#FileNode',
          SubmoduleNode: '../../git/tree.js#SubmoduleNode',
          DirectoryNode: '../../git/tree.js#DirectoryNode',
          FileContents: '../models.js#FileContentsModel',
          Person: '../../git/blame.js#Person',
          BlameCommit: '../../git/blame.js#BlameCommit',
          BlameLine: '../models.js#BlameLineModel',
          Blame: '../models.js#BlameModel',
          LineRange: '../../git/validation.js#LineRange',
          FileHistory: '../models.js#FileHistoryModel',
          FileHistoryCommit: '../../git/fileHistory.js#FileHistoryEntry',
          LineHistory: '../models.js#LineHistoryModel',
          LineHistoryEntry: '../../git/lineHistory.js#LineHistoryEntry',
          Hunk: '../../git/lineHistory.js#Hunk',
          HunkLine: '../../git/lineHistory.js#HunkLine',
        },
      },
    },
  },
};

export default config;
