import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from './app.js';

describe('createApp', () => {
  let distDir: string;

  beforeEach(() => {
    distDir = mkdtempSync(path.join(os.tmpdir(), 'client-dist-'));
    writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>Git History</title>');
    writeFileSync(path.join(distDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    mkdirSync(path.join(distDir, 'assets'));
    writeFileSync(path.join(distDir, 'assets', 'index-abc123.js'), 'console.log(1);');
  });

  afterEach(() => {
    rmSync(distDir, { recursive: true, force: true });
  });

  it('serves the client page at /', async () => {
    const res = await request(createApp({ clientDistDir: distDir })).get('/');

    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toContain('<title>Git History</title>');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('serves the page for / with a query string', async () => {
    const res = await request(createApp({ clientDistDir: distDir })).get('/?repo=x&path=a.ts');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Git History</title>');
  });

  it('serves hashed assets as immutable and other files normally', async () => {
    const app = createApp({ clientDistDir: distDir });

    const asset = await request(app).get('/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.type).toBe('text/javascript');
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');

    const favicon = await request(app).get('/favicon.svg');
    expect(favicon.status).toBe(200);
    expect(favicon.headers['cache-control']).not.toContain('immutable');
  });

  it('responds 404 for files that are not in the build', async () => {
    const res = await request(createApp({ clientDistDir: distDir })).get('/assets/missing.js');

    expect(res.status).toBe(404);
  });

  it('refuses to start when the directory has no index.html', () => {
    rmSync(path.join(distDir, 'index.html'));

    expect(() => createApp({ clientDistDir: distDir })).toThrow(/CLIENT_DIST_DIR has no index\.html/);
  });

  it('explains how to serve the client when no directory is configured', async () => {
    const res = await request(createApp({})).get('/');

    expect(res.status).toBe(404);
    expect(res.text).toContain('CLIENT_DIST_DIR');
  });
});
