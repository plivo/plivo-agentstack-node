import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  PlivoError,
  AuthenticationError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServerError,
} from './errors.js';

export interface TransportOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  backoffFactor?: number;
}

// snake_case <-> camelCase transforms

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

function transformKeys(
  obj: unknown,
  transform: (key: string) => string,
): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((item) => transformKeys(item, transform));
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[transform(key)] = transformKeys(value, transform);
    }
    return result;
  }
  return obj;
}

export class HttpTransport {
  private client: AxiosInstance;
  private _authId: string;
  private maxRetries: number;
  private backoffFactor: number;

  constructor(authId: string, authToken: string, options?: TransportOptions) {
    this._authId = authId;
    this.maxRetries = options?.maxRetries ?? 3;
    this.backoffFactor = options?.backoffFactor ?? 0.5;

    this.client = axios.create({
      baseURL: options?.baseUrl ?? 'https://api.plivo.com',
      timeout: options?.timeout ?? 30000,
      auth: { username: authId, password: authToken },
      headers: {
        'User-Agent': 'plivo-agentstack-node/0.1.0',
        'Content-Type': 'application/json',
      },
    });
  }

  get authId(): string {
    return this._authId;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      data?: Record<string, unknown>;
      params?: Record<string, unknown>;
    },
  ): Promise<T> {
    // Transform outgoing camelCase to snake_case
    const data = options?.data
      ? (transformKeys(options.data, camelToSnake) as Record<string, unknown>)
      : undefined;
    const params = options?.params
      ? (transformKeys(options.params, camelToSnake) as Record<string, unknown>)
      : undefined;

    // Filter out undefined params
    const filteredParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined),
        )
      : undefined;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.request({
          method,
          url: path,
          data,
          params: filteredParams,
        });

        if (response.status === 204) {
          return null as T;
        }

        // Transform incoming snake_case to camelCase
        return transformKeys(response.data, snakeToCamel) as T;
      } catch (error) {
        const axiosError = error as AxiosError;

        if (!axiosError.response) {
          throw new PlivoError(
            axiosError.message || 'Network error',
            0,
          );
        }

        const status = axiosError.response.status;
        const body = (axiosError.response.data || {}) as Record<string, unknown>;
        const apiId = (body.api_id as string) || '';
        const message =
          (body.error as string) ||
          (body.message as string) ||
          `HTTP ${status}`;

        if (status === 429) {
          const retryAfterHeader = axiosError.response.headers?.['retry-after'];
          const retryAfter = retryAfterHeader
            ? parseFloat(retryAfterHeader as string)
            : null;
          lastError = new RateLimitError(message, retryAfter, apiId, body);
          const wait =
            retryAfter ?? this.backoffFactor * Math.pow(2, attempt);
          await sleep(wait * 1000);
          continue;
        }

        if (status >= 500) {
          lastError = new ServerError(message, status, apiId, body);
          if (attempt < this.maxRetries) {
            const wait = this.backoffFactor * Math.pow(2, attempt);
            await sleep(wait * 1000);
            continue;
          }
          throw lastError;
        }

        // Non-retryable errors
        switch (status) {
          case 400:
            throw new ValidationError(message, apiId, body);
          case 401:
            throw new AuthenticationError(message, apiId, body);
          case 403:
            throw new ForbiddenError(message, apiId, body);
          case 404:
            throw new NotFoundError(message, apiId, body);
          default:
            throw new PlivoError(message, status, apiId, body);
        }
      }
    }

    throw lastError!;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
