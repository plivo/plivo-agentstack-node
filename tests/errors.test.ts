import { describe, it, expect } from 'bun:test';
import {
  PlivoError,
  AuthenticationError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServerError,
  WebSocketError,
} from '../src/errors.js';

describe('Error hierarchy', () => {
  it('PlivoError has statusCode and body', () => {
    const err = new PlivoError('test error', 400, 'api-1', { detail: 'info' });
    expect(err.message).toBe('test error');
    expect(err.statusCode).toBe(400);
    expect(err.apiId).toBe('api-1');
    expect(err.body).toEqual({ detail: 'info' });
    expect(err.name).toBe('PlivoError');
    expect(err).toBeInstanceOf(Error);
  });

  it('PlivoError defaults', () => {
    const err = new PlivoError('bare');
    expect(err.statusCode).toBe(0);
    expect(err.apiId).toBe('');
    expect(err.body).toEqual({});
  });

  it('RateLimitError has retryAfter and defaults to 429', () => {
    const err = new RateLimitError('slow down', 5);
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(5);
    expect(err.name).toBe('RateLimitError');
    expect(err).toBeInstanceOf(PlivoError);
    expect(err).toBeInstanceOf(Error);
  });

  it('RateLimitError retryAfter defaults to null', () => {
    const err = new RateLimitError('slow down');
    expect(err.retryAfter).toBeNull();
  });

  it('ForbiddenError extends PlivoError with 403', () => {
    const err = new ForbiddenError('forbidden');
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe('ForbiddenError');
    expect(err).toBeInstanceOf(PlivoError);
    expect(err).toBeInstanceOf(Error);
  });

  it('AuthenticationError is instanceof PlivoError', () => {
    const err = new AuthenticationError('bad creds');
    expect(err.statusCode).toBe(401);
    expect(err).toBeInstanceOf(PlivoError);
  });

  it('ValidationError is instanceof PlivoError', () => {
    const err = new ValidationError('invalid input');
    expect(err.statusCode).toBe(400);
    expect(err).toBeInstanceOf(PlivoError);
  });

  it('NotFoundError is instanceof PlivoError', () => {
    const err = new NotFoundError('not found');
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(PlivoError);
  });

  it('ServerError is instanceof PlivoError', () => {
    const err = new ServerError('server error', 502);
    expect(err.statusCode).toBe(502);
    expect(err).toBeInstanceOf(PlivoError);
  });

  it('ServerError defaults to 500', () => {
    const err = new ServerError('server error');
    expect(err.statusCode).toBe(500);
  });

  it('WebSocketError is instanceof PlivoError', () => {
    const err = new WebSocketError('ws error');
    expect(err).toBeInstanceOf(PlivoError);
    expect(err.name).toBe('WebSocketError');
  });

  it('all error types are instanceof PlivoError', () => {
    const errors = [
      new AuthenticationError('a'),
      new ForbiddenError('b'),
      new ValidationError('c'),
      new NotFoundError('d'),
      new RateLimitError('e'),
      new ServerError('f'),
      new WebSocketError('g'),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(PlivoError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
