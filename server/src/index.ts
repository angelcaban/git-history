import { createServer } from 'node:http';
import { createApp } from './app.js';
import { configFromEnv } from './config.js';
import { attachGraphQL, GRAPHQL_PATH } from './graphql/server.js';

const PORT = process.env.PORT || 3000;

async function main() {
  const config = configFromEnv();
  const httpServer = createServer(createApp(config));
  await attachGraphQL(httpServer, config);
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`GraphQL over WebSocket at ws://localhost:${PORT}${GRAPHQL_PATH}`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
