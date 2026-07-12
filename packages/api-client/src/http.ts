import type { ApiErrorBody } from '@mindflow/types';

export interface TokenStrategy {
  getAccessToken(): string | null | Promise<string | null>;
  setTokens(accessToken: string, refreshToken?: string): void | Promise<void>;
  clear(): void | Promise<void>;
}

export class InMemoryTokenStrategy implements TokenStrategy {
  private accessToken: string | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setTokens(accessToken: string): void {
    this.accessToken = accessToken;
  }

  clear(): void {
    this.accessToken = null;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiClientError';
    this.statusCode = body.statusCode;
    this.code = body.code;
    this.requestId = body.requestId;
    this.details = body.details;
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  tokenStrategy?: TokenStrategy;
  requestIdHeader?: string;
  fetchImpl?: typeof fetch;
  generateRequestId?: () => string;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly tokenStrategy?: TokenStrategy;
  private readonly requestIdHeader: string;
  private readonly fetchImpl: typeof fetch;
  private readonly generateRequestId: () => string;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.tokenStrategy = config.tokenStrategy;
    this.requestIdHeader = config.requestIdHeader ?? 'x-request-id';
    this.fetchImpl = config.fetchImpl ?? (globalThis.fetch as typeof fetch);
    this.generateRequestId =
      config.generateRequestId ??
      (() => (globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}`));
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers(options.headers);
    if (!headers.has('content-type') && options.body && !(options.body instanceof FormData)) {
      headers.set('content-type', 'application/json');
    }
    const requestId = this.generateRequestId();
    headers.set(this.requestIdHeader, requestId);

    const token = this.tokenStrategy ? await this.tokenStrategy.getAccessToken() : null;
    if (token) headers.set('authorization', `Bearer ${token}`);

    const response = await this.fetchImpl(url.toString(), {
      ...options,
      headers,
    } as RequestInit);

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorBody: ApiErrorBody =
        isJson && typeof data === 'object' && data !== null
          ? (data as ApiErrorBody)
          : {
              statusCode: response.status,
              code: 'INTERNAL_ERROR',
              message: 'Unexpected error',
              requestId,
              timestamp: new Date().toISOString(),
              path: url.pathname,
            };
      throw new ApiClientError(errorBody);
    }

    return data as T;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}
