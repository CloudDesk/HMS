import { useEffect, useState, useRef } from 'react';

// In-memory cache for fetched data URIs keyed by URL and token
const imageDataUriCache = new Map<string, string>();

export function clearAuthenticatedImageCache() {
  imageDataUriCache.clear();
}

export function getCachedAuthenticatedImage(url: string, token?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('file://')) return url;
  const cacheKey = `${url}|${token ?? ''}`;
  return imageDataUriCache.get(cacheKey) ?? null;
}

export async function fetchAuthenticatedImageDataUri(
  url: string,
  token?: string | null,
  signal?: AbortSignal
): Promise<string> {
  if (!url) throw new Error('Missing image URL');
  if (url.startsWith('data:') || url.startsWith('file://')) {
    return url;
  }

  const cacheKey = `${url}|${token ?? ''}`;
  const cached = imageDataUriCache.get(cacheKey);
  if (cached) return cached;

  const headers: Record<string, string> = {
    Accept: 'image/jpeg,image/png,image/*;q=0.9,*/*;q=0.8',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: 'omit',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load image (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : typeof Buffer !== 'undefined'
      ? Buffer.from(binary, 'binary').toString('base64')
      : '';
  const dataUri = `data:${contentType};base64,${base64}`;

  // Keep cache bounded
  if (imageDataUriCache.size > 100) {
    const firstKey = imageDataUriCache.keys().next().value;
    if (firstKey) imageDataUriCache.delete(firstKey);
  }
  imageDataUriCache.set(cacheKey, dataUri);

  return dataUri;
}

export interface UseAuthenticatedImageResult {
  uri: string | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

export function useAuthenticatedImage(
  url: string | null | undefined,
  token: string | null | undefined
): UseAuthenticatedImageResult {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ uri: string | null; isLoading: boolean; isError: boolean }>(() => {
    if (!url) return { uri: null, isLoading: false, isError: false };
    if (url.startsWith('data:') || url.startsWith('file://')) {
      return { uri: url, isLoading: false, isError: false };
    }
    const cached = getCachedAuthenticatedImage(url, token);
    if (cached) return { uri: cached, isLoading: false, isError: false };
    return { uri: null, isLoading: true, isError: false };
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) {
      setState({ uri: null, isLoading: false, isError: false });
      return;
    }

    if (url.startsWith('data:') || url.startsWith('file://')) {
      setState({ uri: url, isLoading: false, isError: false });
      return;
    }

    const cached = getCachedAuthenticatedImage(url, token);
    if (cached) {
      setState({ uri: cached, isLoading: false, isError: false });
      return;
    }

    if (token === null) {
      setState({ uri: null, isLoading: true, isError: false });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let isMounted = true;
    setState({ uri: null, isLoading: true, isError: false });

    fetchAuthenticatedImageDataUri(url, token, controller.signal)
      .then((dataUri) => {
        if (isMounted) {
          setState({ uri: dataUri, isLoading: false, isError: false });
        }
      })
      .catch(() => {
        if (isMounted && controller.signal.aborted) return;
        if (isMounted) {
          setState({ uri: null, isLoading: false, isError: true });
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [url, token, attempt]);

  const retry = () => setAttempt((a) => a + 1);

  return { ...state, retry };
}
