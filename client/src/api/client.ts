import { createClient, type Client } from 'graphql-ws';

/** An error returned by the server, with its `extensions.code` when it has one. */
export class GraphQLRequestError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code: string | undefined) {
    super(message);
    this.name = 'GraphQLRequestError';
    this.code = code;
  }
}

let client: Client | undefined;

function getClient(): Client {
  // The server only speaks GraphQL over WebSocket. In development Vite proxies
  // /graphql to the server; in production the server serves this page itself.
  client ??= createClient({
    url: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/graphql`,
    lazy: true,
    retryAttempts: 3,
  });
  return client;
}

/** Runs a single query and resolves with its data, or rejects on the first error. */
export async function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const result = await getClient().iterate<T>({ query, variables }).next();
  if (result.done) throw new GraphQLRequestError('The server closed the request without a result', undefined);
  const { data, errors } = result.value;
  const error = errors?.[0];
  if (error) {
    const code = error.extensions?.code;
    throw new GraphQLRequestError(error.message, typeof code === 'string' ? code : undefined);
  }
  if (data == null) throw new GraphQLRequestError('The server returned no data', undefined);
  return data;
}
