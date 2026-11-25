import os from 'node:os';
import path from 'node:path';

export interface Config {
  /** Directory where bare clones of requested repositories are kept. */
  cacheDir: string;
  /** How long a clone is considered fresh before the next request triggers a fetch. */
  refreshIntervalMs: number;
  /** Kill a git process that produces no output for this long. */
  gitTimeoutMs: number;
  /** If non-empty, only repository URLs on these hosts are accepted. */
  allowedHosts: string[];
  /** Accept file:// URLs, which read repositories from the server's own filesystem. */
  allowFileUrls: boolean;
  /** Largest file the file and blame endpoints will return. */
  maxFileBytes: number;
  /** Built client (the output of `npm run build` in client/) to serve at /. Not served when unset. */
  clientDistDir?: string;
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number, got "${raw}"`);
  }
  return value;
}

export function configFromEnv(): Config {
  return {
    cacheDir: process.env.REPO_CACHE_DIR || path.join(os.tmpdir(), 'git-history-page', 'repos'),
    refreshIntervalMs: numberFromEnv('REPO_REFRESH_SECONDS', 60) * 1000,
    gitTimeoutMs: numberFromEnv('GIT_TIMEOUT_SECONDS', 120) * 1000,
    allowedHosts: (process.env.ALLOWED_GIT_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host !== ''),
    allowFileUrls: process.env.ALLOW_FILE_URLS === 'true',
    maxFileBytes: numberFromEnv('MAX_FILE_BYTES', 10 * 1024 * 1024),
    ...(process.env.CLIENT_DIST_DIR ? { clientDistDir: path.resolve(process.env.CLIENT_DIST_DIR) } : {}),
  };
}
