import { ApiError } from '../errors.js';

export interface UrlPolicy {
  allowedHosts: string[];
  allowFileUrls: boolean;
}

const NETWORK_PROTOCOLS = new Set(['https:', 'http:', 'ssh:', 'git:']);
// scp-like syntax: user@host:path/to/repo.git
const SCP_LIKE = /^[A-Za-z0-9._~-]+@([A-Za-z0-9.-]+):(?!\/\/)(\S+)$/;
// Whitespace, control characters, and DEL.
const UNSAFE_CHARS = /[\s\x00-\x1f\x7f]/;

/**
 * Checks that a repository URL is something git should be allowed to clone.
 * Returns the URL unchanged so it can be used as the cache key.
 */
export function validateRepoUrl(raw: string, policy: UrlPolicy): string {
  if (raw === '' || raw.startsWith('-') || UNSAFE_CHARS.test(raw)) {
    throw new ApiError('BAD_USER_INPUT', 'Invalid repository URL');
  }

  let host: string;
  const scp = SCP_LIKE.exec(raw);
  if (scp) {
    host = scp[1]!;
  } else {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new ApiError('BAD_USER_INPUT', 'Invalid repository URL');
    }
    if (url.protocol === 'file:') {
      if (!policy.allowFileUrls) {
        throw new ApiError('BAD_USER_INPUT', 'file:// repository URLs are not enabled on this server');
      }
      return raw;
    }
    if (!NETWORK_PROTOCOLS.has(url.protocol)) {
      throw new ApiError('BAD_USER_INPUT', `Unsupported repository URL protocol "${url.protocol}"`);
    }
    host = url.hostname;
  }

  host = host.toLowerCase();
  if (policy.allowedHosts.length > 0 && !policy.allowedHosts.includes(host)) {
    throw new ApiError('FORBIDDEN', `Repositories on host "${host}" are not allowed`);
  }
  return raw;
}

/** Normalizes a repository-relative file path and rejects anything that could escape the tree. */
export function validateFilePath(raw: string): string {
  const trimmed = raw.replace(/^\/+|\/+$/g, '');
  if (trimmed === '' || raw.includes('\0')) {
    throw new ApiError('BAD_USER_INPUT', 'Invalid file path');
  }
  const segments = trimmed.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new ApiError('BAD_USER_INPUT', 'Invalid file path');
  }
  return trimmed;
}

/** Rejects refs that git could interpret as options or that contain unsafe characters. */
export function validateRef(raw: string): string {
  if (raw === '' || raw.startsWith('-') || UNSAFE_CHARS.test(raw)) {
    throw new ApiError('BAD_USER_INPUT', 'Invalid ref');
  }
  return raw;
}

function checkLineNumber(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ApiError('BAD_USER_INPUT', `${name} must be a positive integer`);
  }
  return value;
}

export interface LineRange {
  start: number;
  end: number;
}

/** Validates `start` and optional `end` (inclusive, 1-based). `end` defaults to `start`. */
export function validateLineRange(start: number, end: number | null | undefined): LineRange {
  const range = {
    start: checkLineNumber(start, 'start'),
    end: end == null ? checkLineNumber(start, 'start') : checkLineNumber(end, 'end'),
  };
  if (range.end < range.start) {
    throw new ApiError('BAD_USER_INPUT', 'end must be greater than or equal to start');
  }
  return range;
}

/** Validates an optional page size: an integer from 1 to `max`, `fallback` when omitted. */
export function validateLimit(value: number | null | undefined, fallback: number, max: number): number {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new ApiError('BAD_USER_INPUT', `first must be an integer from 1 to ${max}`);
  }
  return value;
}
