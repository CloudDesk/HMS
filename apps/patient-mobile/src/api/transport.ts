import { z } from 'zod';
import type { PublicConfig } from '../config/config';
import { ApiFailure, type ApiErrorCategory, type LegacyApiKind } from './errors';

export type Connectivity = () => Promise<boolean>;

export class MobileTransport {
  constructor(
    readonly config: PublicConfig,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 45_000
  ) {}

  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: {
      method?: 'GET' | 'POST' | 'PATCH';
      body?: unknown;
      accessToken?: string;
      query?: Record<string, string | number | boolean | undefined | null>;
    } = {}
  ): Promise<T> {
    const method = options.method ?? 'GET';

    // Public client paths cannot smuggle credentials into queries or redirect hosts.
    if (!/^\/[a-zA-Z0-9/_-]+$/.test(path)) {
      throw new ApiFailure({
        category: 'HTTP_400',
        kind: 'validation',
        code: 'INVALID_PATH',
        endpoint: path,
        method,
        userMessage: 'Invalid request path.',
      });
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      let url = `${this.config.apiBaseUrl}${path}`;
      if (options.query) {
        const search = new URLSearchParams();
        for (const [k, v] of Object.entries(options.query)) {
          if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
        }
        const qs = search.toString();
        if (qs) url += `?${qs}`;
      }

      response = await this.fetcher(url, {
        method,
        credentials: 'omit',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof ApiFailure) throw error;
      if (timedOut || (error instanceof Error && error.name === 'AbortError')) {
        throw new ApiFailure({
          category: 'TIMEOUT',
          kind: 'network',
          status: 408,
          code: 'TIMEOUT',
          endpoint: path,
          method,
          retryable: true,
          originalError: error,
        });
      }
      throw new ApiFailure({
        category: 'NETWORK_ERROR',
        kind: 'network',
        code: 'NETWORK_ERROR',
        endpoint: path,
        method,
        retryable: true,
        originalError: error,
      });
    } finally {
      clearTimeout(timer);
    }

    const headerRequestId =
      typeof response.headers?.get === 'function'
        ? response.headers.get('x-request-id') ?? response.headers.get('X-Request-Id') ?? undefined
        : undefined;

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = z
        .object({
          error: z
            .object({
              code: z.string().optional(),
              message: z.string().optional(),
              requestId: z.string().optional(),
            })
            .optional(),
          code: z.string().optional(),
          message: z.string().optional(),
          requestId: z.string().optional(),
        })
        .safeParse(payload);

      const serverCode = parsed.success
        ? parsed.data.error?.code ?? parsed.data.code
        : undefined;

      const serverRequestId = parsed.success
        ? parsed.data.error?.requestId ?? parsed.data.requestId ?? headerRequestId
        : headerRequestId;

      const serverMessage = parsed.success
        ? parsed.data.error?.message ?? parsed.data.message
        : undefined;

      const category: ApiErrorCategory =
        response.status === 400
          ? 'HTTP_400'
          : response.status === 401
          ? 'HTTP_401'
          : response.status === 403
          ? 'HTTP_403'
          : response.status === 404
          ? 'HTTP_404'
          : response.status === 409
          ? 'HTTP_409'
          : response.status === 422
          ? 'HTTP_422'
          : response.status === 429
          ? 'HTTP_429'
          : response.status >= 500
          ? 'HTTP_5XX'
          : 'UNKNOWN_ERROR';

      const kind: LegacyApiKind =
        response.status === 401 || response.status === 403
          ? 'auth'
          : response.status >= 500
          ? 'server'
          : 'validation';

      throw new ApiFailure({
        category,
        kind,
        status: response.status,
        code: serverCode ?? (response.status >= 500 ? 'SERVER_ERROR' : undefined),
        requestId: serverRequestId,
        endpoint: path,
        method,
        originalError: serverMessage,
      });
    }

    const parsed = z.object({ data: schema }).safeParse(payload);
    if (!parsed.success) {
      throw new ApiFailure({
        category: 'INVALID_RESPONSE',
        kind: 'contract',
        status: response.status,
        code: 'CONTRACT_MISMATCH',
        requestId: headerRequestId,
        endpoint: path,
        method,
        retryable: false,
      });
    }

    return parsed.data.data;
  }
}
