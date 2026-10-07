// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAuthenticatedImageCache,
  useAuthenticatedImage,
} from './useAuthenticatedImage';

let root: Root;
let hookResult: ReturnType<typeof useAuthenticatedImage> | undefined;

function TestHarness({
  url,
  token,
}: {
  url?: string | null;
  token?: string | null;
}) {
  hookResult = useAuthenticatedImage(url, token);
  return null;
}

async function renderHook(url?: string | null, token?: string | null) {
  await act(async () => {
    root.render(createElement(TestHarness, { url, token }));
  });
}

describe('useAuthenticatedImage', () => {
  beforeEach(() => {
    clearAuthenticatedImageCache();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    root = createRoot(document.createElement('div'));
    hookResult = undefined;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null and does not load when url is null or empty', async () => {
    await renderHook(null, 'token');
    expect(hookResult?.uri).toBeNull();
    expect(hookResult?.isLoading).toBe(false);
    expect(hookResult?.isError).toBe(false);
  });

  it('returns data: or file:// URIs immediately without network fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    await renderHook('data:image/png;base64,abc', 'token');
    expect(hookResult?.uri).toBe('data:image/png;base64,abc');
    expect(hookResult?.isLoading).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    await renderHook('file:///path/to/image.jpg', 'token');
    expect(hookResult?.uri).toBe('file:///path/to/image.jpg');
    expect(hookResult?.isLoading).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('waits for token before fetching remote URLs', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    await renderHook('https://api.example.com/photo.jpg', null);
    expect(hookResult?.uri).toBeNull();
    expect(hookResult?.isLoading).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches remote image with Bearer token, converts to base64 data URI, and caches it', async () => {
    const fakeBytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    const fakeResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: vi.fn().mockResolvedValue(fakeBytes.buffer),
    };
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(fakeResponse as unknown as Response);

    await renderHook('https://api.example.com/photo.jpg', 'secret-token-123');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/photo.jpg',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token-123',
        }),
      })
    );

    expect(hookResult?.isLoading).toBe(false);
    expect(hookResult?.isError).toBe(false);
    expect(hookResult?.uri).toMatch(/^data:image\/jpeg;base64,/);

    // Second render with same URL should use cache and not fetch again
    fetchSpy.mockClear();
    await renderHook('https://api.example.com/photo.jpg', 'secret-token-123');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(hookResult?.uri).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('handles fetch failure and provides retry', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    } as unknown as Response);

    await renderHook('https://api.example.com/failed.jpg', 'bad-token');
    expect(hookResult?.isError).toBe(true);
    expect(hookResult?.uri).toBeNull();

    // Now mock success and retry
    const fakeBytes = new Uint8Array([1, 2, 3]);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: vi.fn().mockResolvedValue(fakeBytes.buffer),
    } as unknown as Response);

    await act(async () => {
      hookResult?.retry();
    });

    expect(hookResult?.isError).toBe(false);
    expect(hookResult?.uri).toMatch(/^data:image\/png;base64,/);
  });
});
