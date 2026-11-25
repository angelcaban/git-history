import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import type { Config } from './config.js';

/**
 * Builds the Express app. With `clientDistDir` set it serves the built React client:
 * index.html at / and its assets next to it. The client keeps its state in the
 * query string, so / is its only page.
 */
export function createApp(config: Pick<Config, 'clientDistDir'>) {
  const app = express();
  app.use(express.json());

  const { clientDistDir } = config;
  if (clientDistDir === undefined) {
    app.get('/', (_req: Request, res: Response) => {
      res.status(404).type('text').send('The client is not served. Set CLIENT_DIST_DIR to the built client directory.');
    });
    return app;
  }

  const indexHtml = path.join(path.resolve(clientDistDir), 'index.html');
  if (!existsSync(indexHtml)) {
    throw new Error(`CLIENT_DIST_DIR has no index.html: ${indexHtml}. Run \`npm run build\` in client/ first.`);
  }

  app.get('/', (_req: Request, res: Response) => {
    // Always revalidate the page, so a redeploy picks up the new asset names.
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
  app.use(
    express.static(path.dirname(indexHtml), {
      index: false,
      setHeaders: (res, filePath) => {
        // Vite puts content hashes in the names of everything under assets/.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  return app;
}
