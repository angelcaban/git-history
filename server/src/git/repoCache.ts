import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import type { SimpleGit } from 'simple-git';
import { ApiError } from '../errors.js';

export interface RepoCacheOptions {
  cacheDir: string;
  refreshIntervalMs: number;
  gitTimeoutMs: number;
}

/**
 * Keeps a bare clone of every repository that has been requested, keyed by URL.
 * The first request for a URL clones it; later requests reuse the clone and fetch
 * at most once per `refreshIntervalMs`. Concurrent requests for the same URL share
 * one clone or fetch.
 */
export class RepoCache {
  private readonly options: RepoCacheOptions;
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly lastSynced = new Map<string, number>();
  private readonly clients = new Map<string, SimpleGit>();

  constructor(options: RepoCacheOptions) {
    this.options = options;
  }

  /** Returns a git client for an up-to-date local clone of `url`. */
  async open(url: string): Promise<SimpleGit> {
    const dir = this.dirFor(url);
    let pending = this.inflight.get(dir);
    if (!pending) {
      pending = this.sync(url, dir).finally(() => this.inflight.delete(dir));
      this.inflight.set(dir, pending);
    }
    await pending;
    return this.client(dir);
  }

  private dirFor(url: string): string {
    const key = createHash('sha256').update(url).digest('hex').slice(0, 40);
    return path.join(this.options.cacheDir, `${key}.git`);
  }

  private client(dir: string): SimpleGit {
    let git = this.clients.get(dir);
    if (!git) {
      git = this.createGit(dir);
      this.clients.set(dir, git);
    }
    return git;
  }

  private createGit(baseDir: string): SimpleGit {
    return simpleGit({
      baseDir,
      strict: true,
      allowEnvironment: ['GIT_TERMINAL_PROMPT', 'GIT_LITERAL_PATHSPECS'],
      timeout: { block: this.options.gitTimeoutMs },
    }).env({
      ...passthroughEnv(),
      // Fail instead of hanging on a credential prompt for private repositories.
      GIT_TERMINAL_PROMPT: '0',
      // Treat requested paths literally rather than as globs.
      GIT_LITERAL_PATHSPECS: '1',
    });
  }

  private async sync(url: string, dir: string): Promise<void> {
    const synced = this.lastSynced.get(dir);
    const exists = existsSync(path.join(dir, 'HEAD'));
    if (exists && synced !== undefined && Date.now() - synced < this.options.refreshIntervalMs) {
      return;
    }

    if (!exists) {
      await this.clone(url, dir);
    } else {
      try {
        await this.client(dir).raw([
          'fetch',
          '--prune',
          '--quiet',
          'origin',
          '+refs/heads/*:refs/heads/*',
          '+refs/tags/*:refs/tags/*',
        ]);
      } catch (error) {
        // Serving a slightly stale clone beats failing the request outright.
        console.warn(`Fetch failed for cached repository ${dir}; serving cached copy.`, describe(error));
      }
    }
    this.lastSynced.set(dir, Date.now());
  }

  private async clone(url: string, dir: string): Promise<void> {
    await mkdir(this.options.cacheDir, { recursive: true });
    // Clone into a temporary directory and rename it into place so a half-finished
    // clone is never mistaken for a usable one.
    const tmp = `${dir}.tmp-${randomBytes(6).toString('hex')}`;
    try {
      await this.createGit(this.options.cacheDir).raw(['clone', '--bare', '--quiet', '--', url, tmp]);
    } catch (error) {
      await rm(tmp, { recursive: true, force: true });
      throw new ApiError('UPSTREAM_ERROR', `Could not clone repository: ${describe(error)}`);
    }
    try {
      await rename(tmp, dir);
    } catch (error) {
      // Another process may have won the race; use its clone if it is there.
      await rm(tmp, { recursive: true, force: true });
      if (!existsSync(path.join(dir, 'HEAD'))) throw error;
    }
  }
}

// Only these variables reach git. Passing the whole environment would forward things like
// GIT_EDITOR, which simple-git's strict mode rejects.
const PASSTHROUGH_ENV = [
  'PATH',
  'HOME',
  'USER',
  'LANG',
  'TMPDIR',
  'SSH_AUTH_SOCK',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
];

function passthroughEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of PASSTHROUGH_ENV) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  return env;
}

/** First line of a git error, with any credentials embedded in URLs removed. */
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.trim().split('\n')[0] ?? '';
  return firstLine.replace(/\/\/[^/@\s]+@/g, '//***@');
}
