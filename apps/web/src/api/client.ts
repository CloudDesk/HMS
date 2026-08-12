import { appConfig } from '../config';
import { tokenStorage } from '../auth/token-storage';
import { ApiError, type ApiErrorPayload } from './api-error';

type ApiEnvelope<T> = {
  data: T;
};

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
  body?: unknown;
};

type RefreshHandler = () => Promise<string | null>;
type UnauthorizedHandler = () => void;
type ApiDownloadResponse = {
  blob: Blob;
  fileName: string | null;
};

let refreshHandler: RefreshHandler | null = null;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let refreshPromise: Promise<string | null> | null = null;

const getUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${appConfig.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const readJson = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  return (await response.json()) as unknown;
};

const toApiError = (response: Response, payload: unknown) => {
  const apiPayload = payload as ApiErrorPayload | null;
  const error = apiPayload?.error;

  return new ApiError(
    error?.message ?? response.statusText ?? 'Request failed',
    response.status,
    error?.code,
    error?.requestId,
    error?.details,
  );
};

const createHeaders = (options: ApiRequestOptions) => {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !(options.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  if (options.auth !== false) {
    const token = tokenStorage.getAccessToken();

    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
  }

  return headers;
};

const fetchEnvelope = async <T>(path: string, options: ApiRequestOptions) => {
  const response = await fetch(getUrl(path), {
    ...options,
    body:
      options.body === undefined || options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body),
    headers: createHeaders(options),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return ((payload as ApiEnvelope<T> | null)?.data ?? payload) as T;
};

const readFileName = (response: Response) => {
  const disposition = response.headers.get('content-disposition');
  const match = disposition?.match(/filename="([^"]+)"/);

  return match?.[1] ?? null;
};

const fetchDownload = async (path: string, options: ApiRequestOptions): Promise<ApiDownloadResponse> => {
  const response = await fetch(getUrl(path), {
    ...options,
    body:
      options.body === undefined || options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body),
    headers: createHeaders(options),
  });

  if (!response.ok) {
    throw toApiError(response, await readJson(response));
  }

  return {
    blob: await response.blob(),
    fileName: readFileName(response),
  };
};

const refreshAccessToken = async () => {
  if (!refreshHandler) {
    return null;
  }

  refreshPromise ??= refreshHandler().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

const shouldTryRefresh = (error: unknown, options: ApiRequestOptions) =>
  error instanceof ApiError &&
  error.status === 401 &&
  options.auth !== false &&
  options.retryOnUnauthorized !== false;

export const apiClient = {
  setRefreshHandler(handler: RefreshHandler | null) {
    refreshHandler = handler;
  },

  setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
    unauthorizedHandler = handler;
  },

  async request<T>(path: string, options: ApiRequestOptions = {}) {
    if (options.auth !== false && tokenStorage.isAccessTokenExpired()) {
      await refreshAccessToken();
    }

    try {
      return await fetchEnvelope<T>(path, options);
    } catch (error) {
      if (!shouldTryRefresh(error, options)) {
        throw error;
      }

      const refreshedToken = await refreshAccessToken();

      if (!refreshedToken) {
        unauthorizedHandler?.();
        throw error;
      }

      try {
        return await fetchEnvelope<T>(path, {
          ...options,
          retryOnUnauthorized: false,
        });
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          unauthorizedHandler?.();
        }

        throw retryError;
      }
    }
  },

  async download(path: string, options: ApiRequestOptions = {}) {
    if (options.auth !== false && tokenStorage.isAccessTokenExpired()) {
      await refreshAccessToken();
    }

    try {
      return await fetchDownload(path, options);
    } catch (error) {
      if (!shouldTryRefresh(error, options)) {
        throw error;
      }

      const refreshedToken = await refreshAccessToken();
      if (!refreshedToken) {
        unauthorizedHandler?.();
        throw error;
      }

      try {
        return await fetchDownload(path, {
          ...options,
          retryOnUnauthorized: false,
        });
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          unauthorizedHandler?.();
        }
        throw retryError;
      }
    }
  },
};
