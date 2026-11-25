import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from 'graphql-ws';
import type { Client } from 'graphql-ws';
import WebSocket from 'ws';
import type { Config } from '../config.js';
import { attachGraphQL, GRAPHQL_PATH } from './server.js';

let workDir: string;
let repoUrl: string;
const shas: Record<string, string> = {};

function git(cwd: string, args: string[], date?: string): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Test User', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}) },
    },
  ).trim();
}

function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    cacheDir: path.join(workDir, 'cache'),
    refreshIntervalMs: 60_000,
    gitTimeoutMs: 30_000,
    allowedHosts: [],
    allowFileUrls: true,
    maxFileBytes: 1024 * 1024,
    ...overrides,
  };
}

interface TestServer {
  client: Client;
  close(): Promise<void>;
}

async function startServer(config: Config): Promise<TestServer> {
  const httpServer: Server = createServer();
  const graphql = await attachGraphQL(httpServer, config);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  const client = createClient({
    url: `ws://127.0.0.1:${port}${GRAPHQL_PATH}`,
    webSocketImpl: WebSocket,
    retryAttempts: 0,
  });
  return {
    client,
    async close() {
      await client.dispose();
      await graphql.dispose();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

interface Result {
  data?: any;
  errors?: { message: string; extensions?: { code?: string } }[];
}

async function run(server: TestServer, query: string, variables: Record<string, unknown> = {}): Promise<Result> {
  const results = server.client.iterate({ query, variables });
  const { value } = await results.next();
  await results.return?.();
  return value as Result;
}

/**
 * History of the fixture repository:
 *   first:   README.md, src/app.ts ("one\ntwo\nthree\n"), image.bin
 *   second:  src/app.ts line 2 -> "TWO"
 *   rename:  src/app.ts -> src/main.ts (no content change)
 *   fourth:  src/main.ts line 2 -> "Two!", appends line 4
 */
beforeAll(() => {
  workDir = mkdtempSync(path.join(os.tmpdir(), 'git-history-test-'));
  const repo = path.join(workDir, 'origin');
  mkdirSync(path.join(repo, 'src'), { recursive: true });
  git(repo, ['init', '--quiet', '--initial-branch=main']);

  writeFileSync(path.join(repo, 'README.md'), '# Fixture\n');
  writeFileSync(path.join(repo, 'src/app.ts'), 'one\ntwo\nthree\n');
  writeFileSync(path.join(repo, 'image.bin'), Buffer.from([0x89, 0x50, 0x00, 0x01]));
  git(repo, ['add', '.']);
  git(repo, ['commit', '--quiet', '-m', 'First commit'], '2024-01-01T00:00:00Z');
  shas.first = git(repo, ['rev-parse', 'HEAD']);
  git(repo, ['tag', 'v1']);

  writeFileSync(path.join(repo, 'src/app.ts'), 'one\nTWO\nthree\n');
  git(repo, ['commit', '--quiet', '-am', 'Shout line two'], '2024-02-01T00:00:00Z');
  shas.second = git(repo, ['rev-parse', 'HEAD']);

  git(repo, ['mv', 'src/app.ts', 'src/main.ts']);
  git(repo, ['commit', '--quiet', '-m', 'Rename app to main'], '2024-03-01T00:00:00Z');
  shas.rename = git(repo, ['rev-parse', 'HEAD']);

  writeFileSync(path.join(repo, 'src/main.ts'), 'one\nTwo!\nthree\nfour\n');
  git(repo, ['commit', '--quiet', '-am', 'Calm line two'], '2024-04-01T00:00:00Z');
  shas.fourth = git(repo, ['rev-parse', 'HEAD']);

  repoUrl = pathToFileURL(repo).href;
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

let server: TestServer;

beforeEach(async () => {
  server = await startServer(testConfig());
});

afterEach(async () => {
  await server.close();
});

const TREE = /* GraphQL */ `
  query Tree($url: String!, $ref: String, $path: String) {
    repository(url: $url, ref: $ref) {
      commit
      tree(path: $path) {
        path
        children {
          __typename
          ... on FileNode { name path size }
          ... on DirectoryNode { name path children { __typename ... on FileNode { path size } } }
        }
      }
    }
  }
`;

describe('Repository.tree', () => {
  it('returns the nested file tree at HEAD', async () => {
    const { data, errors } = await run(server, TREE, { url: repoUrl });

    expect(errors).toBeUndefined();
    expect(data.repository.commit).toBe(shas.fourth);
    expect(data.repository.tree).toEqual({
      path: '',
      children: [
        {
          __typename: 'DirectoryNode',
          name: 'src',
          path: 'src',
          children: [{ __typename: 'FileNode', path: 'src/main.ts', size: 20 }],
        },
        { __typename: 'FileNode', name: 'README.md', path: 'README.md', size: 10 },
        { __typename: 'FileNode', name: 'image.bin', path: 'image.bin', size: 4 },
      ],
    });
  });

  it('returns a subdirectory and accepts a tag as the ref', async () => {
    const { data } = await run(server, TREE, { url: repoUrl, ref: 'v1', path: 'src' });

    expect(data.repository.commit).toBe(shas.first);
    expect(data.repository.tree.children).toEqual([{ __typename: 'FileNode', name: 'app.ts', path: 'src/app.ts', size: 14 }]);
  });

  it('lists every file flat', async () => {
    const { data } = await run(
      server,
      `query($url: String!) { repository(url: $url) { files { ... on FileNode { path } } } }`,
      { url: repoUrl },
    );

    expect(data.repository.files.map((file: { path: string }) => file.path)).toEqual(['src/main.ts', 'README.md', 'image.bin']);
  });

  it('reports NOT_FOUND for an unknown ref', async () => {
    const { errors } = await run(server, TREE, { url: repoUrl, ref: 'no-such-branch' });

    expect(errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('rejects file:// URLs unless enabled', async () => {
    const strict = await startServer(testConfig({ allowFileUrls: false }));
    try {
      const { errors } = await run(strict, TREE, { url: repoUrl });
      expect(errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    } finally {
      await strict.close();
    }
  });

  it('rejects queries that do not match the schema', async () => {
    const results = server.client.iterate({ query: '{ repository { commit } }' });

    await expect(results.next()).rejects.toEqual([
      expect.objectContaining({ message: expect.stringMatching(/argument "url"/) }),
    ]);
  });
});

const FILE = /* GraphQL */ `
  query File($url: String!, $ref: String, $path: String!) {
    repository(url: $url, ref: $ref) {
      file(path: $path) { path size binary encoding content }
    }
  }
`;

describe('Repository.file', () => {
  it('returns text file contents', async () => {
    const { data } = await run(server, FILE, { url: repoUrl, path: 'src/main.ts' });

    expect(data.repository.file).toEqual({
      path: 'src/main.ts',
      size: 20,
      binary: false,
      encoding: 'UTF8',
      content: 'one\nTwo!\nthree\nfour\n',
    });
  });

  it('returns the contents at an earlier commit', async () => {
    const { data } = await run(server, FILE, { url: repoUrl, path: 'src/app.ts', ref: shas.second });

    expect(data.repository.file.content).toBe('one\nTWO\nthree\n');
  });

  it('base64-encodes binary files', async () => {
    const { data } = await run(server, FILE, { url: repoUrl, path: 'image.bin' });

    expect(data.repository.file).toMatchObject({ binary: true, encoding: 'BASE64', content: 'iVAAAQ==' });
  });

  it.each([
    ['nope.txt', 'NOT_FOUND'],
    ['src', 'BAD_USER_INPUT'],
    ['../etc/passwd', 'BAD_USER_INPUT'],
  ])('reports %s as %s', async (filePath, code) => {
    const { errors } = await run(server, FILE, { url: repoUrl, path: filePath });

    expect(errors?.[0]?.extensions?.code).toBe(code);
  });
});

const BLAME = /* GraphQL */ `
  query Blame($url: String!, $path: String!) {
    repository(url: $url) {
      blame(path: $path) {
        lines { lineNumber content sha originalLineNumber originalPath commit { summary } }
        commits {
          sha summary boundary
          author { name email date }
          previous { sha path }
        }
      }
    }
  }
`;

describe('Repository.blame', () => {
  it('annotates every line with the commit that last changed it', async () => {
    const { data, errors } = await run(server, BLAME, { url: repoUrl, path: 'src/main.ts' });

    expect(errors).toBeUndefined();
    const { lines, commits } = data.repository.blame;
    expect(lines.map((line: { content: string; sha: string }) => [line.content, line.sha])).toEqual([
      ['one', shas.first],
      ['Two!', shas.fourth],
      ['three', shas.first],
      ['four', shas.fourth],
    ]);
    expect(lines[0]).toMatchObject({
      lineNumber: 1,
      originalLineNumber: 1,
      originalPath: 'src/app.ts',
      commit: { summary: 'First commit' },
    });
    expect(commits).toHaveLength(2);
    expect(commits.find((commit: { sha: string }) => commit.sha === shas.fourth)).toEqual({
      sha: shas.fourth,
      summary: 'Calm line two',
      boundary: false,
      author: { name: 'Test User', email: 'test@example.com', date: '2024-04-01T00:00:00.000Z' },
      previous: { sha: shas.rename, path: 'src/main.ts' },
    });
    expect(commits.find((commit: { sha: string }) => commit.sha === shas.first)).toMatchObject({ boundary: true, previous: null });
  });

  it('refuses to blame binary files', async () => {
    const { errors } = await run(server, BLAME, { url: repoUrl, path: 'image.bin' });

    expect(errors?.[0]?.extensions?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });
});

const LINE_HISTORY = /* GraphQL */ `
  query LineHistory($url: String!, $path: String!, $start: Int!, $end: Int) {
    repository(url: $url) {
      lineHistory(path: $path, start: $start, end: $end) {
        range { start end }
        annotations { lines { lineNumber content sha } }
        history {
          sha parents summary path previousPath
          hunks { lines { type content oldLineNumber newLineNumber } }
        }
      }
    }
  }
`;

describe('Repository.lineHistory', () => {
  it('follows a line back through every change, across a rename', async () => {
    const { data, errors } = await run(server, LINE_HISTORY, { url: repoUrl, path: 'src/main.ts', start: 2 });

    expect(errors).toBeUndefined();
    const { range, annotations, history } = data.repository.lineHistory;
    expect(range).toEqual({ start: 2, end: 2 });
    expect(annotations.lines).toEqual([{ lineNumber: 2, content: 'Two!', sha: shas.fourth }]);
    expect(history.map((entry: { sha: string }) => entry.sha)).toEqual([shas.fourth, shas.second, shas.first]);
    expect(history[0]).toMatchObject({ path: 'src/main.ts', previousPath: 'src/main.ts', summary: 'Calm line two' });
    expect(history[0].hunks[0].lines).toEqual([
      { type: 'REMOVED', content: 'TWO', oldLineNumber: 2, newLineNumber: null },
      { type: 'ADDED', content: 'Two!', oldLineNumber: null, newLineNumber: 2 },
    ]);
    expect(history[1]).toMatchObject({ path: 'src/app.ts', previousPath: 'src/app.ts' });
    expect(history[2]).toMatchObject({ path: 'src/app.ts', previousPath: null, parents: [] });
  });

  it('accepts a range of adjacent lines', async () => {
    const { data } = await run(server, LINE_HISTORY, { url: repoUrl, path: 'src/main.ts', start: 3, end: 4 });

    const { annotations, history } = data.repository.lineHistory;
    expect(annotations.lines.map((line: { content: string }) => line.content)).toEqual(['three', 'four']);
    expect(history.map((entry: { sha: string }) => entry.sha)).toEqual([shas.fourth, shas.first]);
  });

  it('rejects ranges past the end of the file', async () => {
    const { errors } = await run(server, LINE_HISTORY, { url: repoUrl, path: 'src/main.ts', start: 4, end: 9 });

    expect(errors?.[0]).toMatchObject({ message: expect.stringMatching(/only 4 lines/), extensions: { code: 'BAD_USER_INPUT' } });
  });

  it('rejects an inverted range', async () => {
    const { errors } = await run(server, LINE_HISTORY, { url: repoUrl, path: 'src/main.ts', start: 3, end: 2 });

    expect(errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});

const FILE_HISTORY = /* GraphQL */ `
  query FileHistory($url: String!, $ref: String, $path: String!, $first: Int) {
    repository(url: $url, ref: $ref) {
      fileHistory(path: $path, first: $first) {
        path
        truncated
        commits { sha parents summary path author { name } }
      }
    }
  }
`;

describe('Repository.fileHistory', () => {
  it('lists the commits that changed the file, across a rename', async () => {
    const { data, errors } = await run(server, FILE_HISTORY, { url: repoUrl, path: 'src/main.ts' });

    expect(errors).toBeUndefined();
    expect(data.repository.fileHistory).toEqual({
      path: 'src/main.ts',
      truncated: false,
      commits: [
        { sha: shas.fourth, parents: [shas.rename], summary: 'Calm line two', path: 'src/main.ts', author: { name: 'Test User' } },
        { sha: shas.rename, parents: [shas.second], summary: 'Rename app to main', path: 'src/main.ts', author: { name: 'Test User' } },
        { sha: shas.second, parents: [shas.first], summary: 'Shout line two', path: 'src/app.ts', author: { name: 'Test User' } },
        { sha: shas.first, parents: [], summary: 'First commit', path: 'src/app.ts', author: { name: 'Test User' } },
      ],
    });
  });

  it('stops at `first` commits and says so', async () => {
    const { data } = await run(server, FILE_HISTORY, { url: repoUrl, path: 'src/main.ts', first: 2 });

    expect(data.repository.fileHistory.truncated).toBe(true);
    expect(data.repository.fileHistory.commits.map((c: { sha: string }) => c.sha)).toEqual([shas.fourth, shas.rename]);
  });

  it('rejects an out-of-range `first`', async () => {
    const { errors } = await run(server, FILE_HISTORY, { url: repoUrl, path: 'src/main.ts', first: 0 });

    expect(errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });

  it('keeps branches and merges, skipping commits that did not touch the file', async () => {
    // main:    start - unrelated - rename(f -> g) - main side - merge - unrelated - after
    // feature:                          \- feature side - unrelated -/
    const repo = path.join(workDir, 'branchy');
    mkdirSync(repo);
    const commit = (message: string) => {
      git(repo, ['commit', '--quiet', '-am', message]);
      return git(repo, ['rev-parse', 'HEAD']);
    };
    git(repo, ['init', '--quiet', '--initial-branch=main']);
    writeFileSync(path.join(repo, 'f.txt'), 'a\n');
    writeFileSync(path.join(repo, 'other'), '1\n');
    git(repo, ['add', '.']);
    const start = commit('Start');
    writeFileSync(path.join(repo, 'other'), '2\n');
    commit('Unrelated');
    git(repo, ['mv', 'f.txt', 'g.txt']);
    const rename = commit('Rename');
    git(repo, ['checkout', '--quiet', '-b', 'feature']);
    writeFileSync(path.join(repo, 'g.txt'), 'a\nfeature\n');
    const feature = commit('Feature side');
    writeFileSync(path.join(repo, 'other'), '3\n');
    commit('Unrelated on feature');
    git(repo, ['checkout', '--quiet', 'main']);
    writeFileSync(path.join(repo, 'g.txt'), 'main\na\n');
    const mainSide = commit('Main side');
    git(repo, ['merge', '--quiet', '--no-edit', 'feature']);
    const merge = git(repo, ['rev-parse', 'HEAD']);
    writeFileSync(path.join(repo, 'other'), '4\n');
    commit('Unrelated after merge');
    writeFileSync(path.join(repo, 'g.txt'), 'main\na\nfeature\nend\n');
    const after = commit('After');

    const { data, errors } = await run(server, FILE_HISTORY, { url: pathToFileURL(repo).href, path: 'g.txt' });

    expect(errors).toBeUndefined();
    const commits = data.repository.fileHistory.commits.map((c: { sha: string; parents: string[]; path: string }) => [
      c.sha,
      c.parents,
      c.path,
    ]);
    // Merge sides are ordered by date, which ties here; compare as a set after the fixed ends.
    expect(commits[0]).toEqual([after, [merge], 'g.txt']);
    expect(commits[1]).toEqual([merge, [mainSide, feature], 'g.txt']);
    expect(commits.slice(2, 4)).toEqual(
      expect.arrayContaining([
        [mainSide, [rename], 'g.txt'],
        [feature, [rename], 'g.txt'],
      ]),
    );
    expect(commits.slice(4)).toEqual([
      [rename, [start], 'g.txt'],
      [start, [], 'f.txt'],
    ]);
  });
});
