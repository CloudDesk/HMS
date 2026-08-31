import { tokenStorage } from '../auth/token-storage';
import { appConfig } from '../config';
import { ApiError } from './api-error';

type Options = Omit<RequestInit, 'body'> & {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
  body?: unknown;
};
type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;
let unauthorizedHandler: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

const requestOnce = async <T>(path: string, options: Options) => {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData))
    headers.set('content-type', 'application/json');
  if (options.auth !== false && tokenStorage.getAccessToken())
    headers.set('authorization', `Bearer ${tokenStorage.getAccessToken()}`);
  const response = await fetch(
    `${appConfig.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`,
    {
      ...options,
      credentials: options.credentials ?? 'include',
      headers,
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
    },
  );
  const payload = response.headers.get('content-type')?.includes('application/json')
    ? ((await response.json()) as { data?: T; error?: { message?: string; code?: string } })
    : null;
  if (!response.ok)
    throw new ApiError(
      payload?.error?.message ?? response.statusText ?? 'Request failed',
      response.status,
      payload?.error?.code,
    );
  return (payload?.data ?? payload) as T;
};

const downloadOnce = async (path: string, options: Options) => {
  const headers = new Headers(options.headers);
  if (options.auth !== false && tokenStorage.getAccessToken())
    headers.set('authorization', `Bearer ${tokenStorage.getAccessToken()}`);
  const response = await fetch(
    `${appConfig.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`,
    {
      ...options,
      credentials: options.credentials ?? 'include',
      headers,
      body:
        options.body === undefined
          ? undefined
          : options.body instanceof FormData
            ? options.body
            : JSON.stringify(options.body),
    },
  );
  if (!response.ok) {
    const payload = response.headers.get('content-type')?.includes('application/json')
      ? ((await response.json()) as { error?: { message?: string; code?: string } })
      : null;
    throw new ApiError(
      payload?.error?.message ?? response.statusText ?? 'Download failed',
      response.status,
      payload?.error?.code,
    );
  }
  const disposition = response.headers.get('content-disposition');
  return {
    blob: await response.blob(),
    fileName: disposition?.match(/filename="([^"]+)"/)?.[1] ?? null,
  };
};

export const apiClient = {
  setRefreshHandler(handler: RefreshHandler | null) {
    refreshHandler = handler;
  },
  setUnauthorizedHandler(handler: (() => void) | null) {
    unauthorizedHandler = handler;
  },
  async request<T>(path: string, options: Options = {}) {
    if (options.auth !== false && tokenStorage.isAccessTokenExpired() && refreshHandler) {
      refreshPromise ??= refreshHandler().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
    }
    try {
      return await requestOnce<T>(path, options);
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.status !== 401 ||
        options.auth === false ||
        options.retryOnUnauthorized === false ||
        !refreshHandler
      )
        throw error;
      refreshPromise ??= refreshHandler().finally(() => {
        refreshPromise = null;
      });
      const token = await refreshPromise;
      if (!token) {
        unauthorizedHandler?.();
        throw error;
      }
      return requestOnce<T>(path, { ...options, retryOnUnauthorized: false });
    }
  },
  async download(path: string, options: Options = {}) {
    if (options.auth !== false && tokenStorage.isAccessTokenExpired() && refreshHandler) {
      refreshPromise ??= refreshHandler().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
    }
    try {
      return await downloadOnce(path, options);
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.status !== 401 ||
        options.auth === false ||
        options.retryOnUnauthorized === false ||
        !refreshHandler
      )
        throw error;
      refreshPromise ??= refreshHandler().finally(() => {
        refreshPromise = null;
      });
      const token = await refreshPromise;
      if (!token) {
        unauthorizedHandler?.();
        throw error;
      }
      return downloadOnce(path, { ...options, retryOnUnauthorized: false });
    }
  },
};
