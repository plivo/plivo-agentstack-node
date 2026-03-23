/**
 * Exception hierarchy for the Plivo Agent SDK.
 *
 * Mapping:
 *   400 -> ValidationError
 *   401 -> AuthenticationError
 *   403 -> ForbiddenError
 *   404 -> NotFoundError
 *   429 -> RateLimitError
 *   5xx -> ServerError
 *   WS  -> WebSocketError
 */

export class PlivoError extends Error {
  statusCode: number;
  apiId: string;
  body: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 0,
    apiId: string = '',
    body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'PlivoError';
    this.statusCode = statusCode;
    this.apiId = apiId;
    this.body = body;
  }
}

export class AuthenticationError extends PlivoError {
  constructor(message: string, apiId?: string, body?: Record<string, unknown>) {
    super(message, 401, apiId, body);
    this.name = 'AuthenticationError';
  }
}

export class ForbiddenError extends PlivoError {
  constructor(message: string, apiId?: string, body?: Record<string, unknown>) {
    super(message, 403, apiId, body);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends PlivoError {
  constructor(message: string, apiId?: string, body?: Record<string, unknown>) {
    super(message, 400, apiId, body);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends PlivoError {
  constructor(message: string, apiId?: string, body?: Record<string, unknown>) {
    super(message, 404, apiId, body);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends PlivoError {
  retryAfter: number | null;

  constructor(
    message: string,
    retryAfter: number | null = null,
    apiId?: string,
    body?: Record<string, unknown>,
  ) {
    super(message, 429, apiId, body);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class ServerError extends PlivoError {
  constructor(
    message: string,
    statusCode: number = 500,
    apiId?: string,
    body?: Record<string, unknown>,
  ) {
    super(message, statusCode, apiId, body);
    this.name = 'ServerError';
  }
}

export class WebSocketError extends PlivoError {
  constructor(message: string) {
    super(message);
    this.name = 'WebSocketError';
  }
}
