import { GraphQLError } from 'graphql';

export type ErrorCode =
  | 'BAD_USER_INPUT'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UPSTREAM_ERROR';

/** An error that is safe to show to API clients. Its code is sent as `extensions.code`. */
export class ApiError extends GraphQLError {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message, { extensions: { code } });
    this.name = 'ApiError';
    this.code = code;
  }
}
