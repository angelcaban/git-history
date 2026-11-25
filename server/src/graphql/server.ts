import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { ExecutionResult, FormattedExecutionResult } from 'graphql';
import { useServer } from 'graphql-ws/use/ws';
import { WebSocketServer } from 'ws';
import type { Config } from '../config.js';
import { RepoCache } from '../git/repoCache.js';
import type { GraphQLContext } from './models.js';
import { resolvers } from './resolvers.js';

export const GRAPHQL_PATH = '/graphql';

export function createSchema() {
  const typeDefs = readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8');
  return makeExecutableSchema<GraphQLContext>({ typeDefs, resolvers });
}

/**
 * Serves the GraphQL API over WebSocket (graphql-ws protocol) at /graphql on an
 * existing HTTP server. graphql-ws owns the socket protocol; queries are executed
 * through Apollo Server so its error formatting and plugins apply.
 */
export async function attachGraphQL(httpServer: Server, config: Config): Promise<{ dispose(): Promise<void> }> {
  const schema = createSchema();
  const context: GraphQLContext = { repos: new RepoCache(config), config };

  const apollo = new ApolloServer<GraphQLContext>({
    schema,
    includeStacktraceInErrorResponses: false,
    formatError: (formatted, error) => {
      // ApiErrors and GraphQL syntax/validation errors carry their own codes and are
      // meant for clients. Anything else is a bug or an unexpected git failure.
      if (formatted.extensions?.code !== 'INTERNAL_SERVER_ERROR') return formatted;
      console.error(error);
      return { message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
    },
  });
  await apollo.start();

  const wsServer = new WebSocketServer({ server: httpServer, path: GRAPHQL_PATH });
  const wsCleanup = useServer(
    {
      schema,
      context,
      execute: async ({ document, variableValues, operationName, contextValue }) => {
        const response = await apollo.executeOperation(
          {
            query: document,
            ...(variableValues ? { variables: variableValues } : {}),
            ...(operationName ? { operationName } : {}),
          },
          { contextValue: contextValue as GraphQLContext },
        );
        if (response.body.kind !== 'single') {
          throw new Error('Incremental delivery (@defer/@stream) is not supported');
        }
        // Apollo has already run formatError, so errors here are plain formatted objects
        // rather than GraphQLErrors. onNext below sends them as they are.
        return response.body.singleResult as ExecutionResult;
      },
      // By default graphql-ws calls toJSON() on each GraphQLError, which the formatted
      // errors from `execute` do not have.
      onNext: (_ctx, _id, _payload, _args, result) => result as FormattedExecutionResult,
    },
    wsServer,
  );

  return {
    async dispose() {
      await wsCleanup.dispose();
      await new Promise<void>((resolve) => wsServer.close(() => resolve()));
      await apollo.stop();
    },
  };
}
