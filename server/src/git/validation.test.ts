import { ApiError } from '../errors.js';
import { validateLineRange, validateFilePath, validateRef, validateRepoUrl } from './validation.js';

const open = { allowedHosts: [], allowFileUrls: false };

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  return undefined;
}

describe('validateRepoUrl', () => {
  it.each([
    'https://github.com/org/repo.git',
    'http://git.internal/repo',
    'ssh://git@bitbucket.org/org/repo.git',
    'git@github.com:org/repo.git',
  ])('accepts %s', (url) => {
    expect(validateRepoUrl(url, open)).toBe(url);
  });

  it.each([
    '--upload-pack=touch /tmp/pwned',
    'ext::sh -c touch% /tmp/pwned',
    'ftp://example.com/repo',
    'https://example.com/repo name',
    'not a url',
  ])('rejects %s', (url) => {
    expect(codeOf(() => validateRepoUrl(url, open))).toBe('BAD_USER_INPUT');
  });

  it('only accepts file:// when enabled', () => {
    expect(codeOf(() => validateRepoUrl('file:///srv/repo', open))).toBe('BAD_USER_INPUT');
    expect(validateRepoUrl('file:///srv/repo', { allowedHosts: [], allowFileUrls: true })).toBe('file:///srv/repo');
  });

  it('enforces the host allowlist for both URL styles', () => {
    const policy = { allowedHosts: ['bitbucket.org'], allowFileUrls: false };
    expect(validateRepoUrl('https://bitbucket.org/org/repo.git', policy)).toBeTruthy();
    expect(validateRepoUrl('git@BitBucket.org:org/repo.git', policy)).toBeTruthy();
    expect(codeOf(() => validateRepoUrl('https://github.com/org/repo.git', policy))).toBe('FORBIDDEN');
    expect(codeOf(() => validateRepoUrl('git@github.com:org/repo.git', policy))).toBe('FORBIDDEN');
  });
});

describe('validateFilePath', () => {
  it('trims surrounding slashes', () => {
    expect(validateFilePath('/src/app.ts/')).toBe('src/app.ts');
  });

  it.each(['', '/', '../secret', 'src/../../x', 'src//app.ts', 'src/./app.ts'])('rejects "%s"', (raw) => {
    expect(codeOf(() => validateFilePath(raw))).toBe('BAD_USER_INPUT');
  });
});

describe('validateRef', () => {
  it('accepts branches, tags, and shas', () => {
    expect(validateRef('feature/x')).toBe('feature/x');
    expect(validateRef('v1.0.0')).toBe('v1.0.0');
  });

  it('rejects option-like and whitespace refs', () => {
    expect(codeOf(() => validateRef('--output=/tmp/x'))).toBe('BAD_USER_INPUT');
    expect(codeOf(() => validateRef('main branch'))).toBe('BAD_USER_INPUT');
  });
});

describe('validateLineRange', () => {
  it('defaults end to start', () => {
    expect(validateLineRange(5, undefined)).toEqual({ start: 5, end: 5 });
    expect(validateLineRange(5, null)).toEqual({ start: 5, end: 5 });
  });

  it.each([
    [0, undefined],
    [-1, undefined],
    [1.5, undefined],
    [5, 4],
  ])('rejects start=%s end=%s', (start, end) => {
    expect(codeOf(() => validateLineRange(start, end))).toBe('BAD_USER_INPUT');
  });
});
