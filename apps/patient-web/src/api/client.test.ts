import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './client';
import { tokenStorage } from '../auth/token-storage';
import { ApiError } from './api-error';

describe('apiClient pre-emptive refresh handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tokenStorage.clear();
    apiClient.setRefreshHandler(null);
    apiClient.setUnauthorizedHandler(null);
  });

  it('aborts immediately and calls unauthorizedHandler when pre-emptive refresh fails (returns null)', async () => {
    // Simulate expired token in storage
    vi.spyOn(tokenStorage, 'isAccessTokenExpired').mockReturnValue(true);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const refreshHandler = vi.fn().mockResolvedValue(null);
    const unauthorizedHandler = vi.fn();

    apiClient.setRefreshHandler(refreshHandler);
    apiClient.setUnauthorizedHandler(unauthorizedHandler);

    await expect(apiClient.request('/test-endpoint')).rejects.toThrow(ApiError);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('proceeds with request when pre-emptive refresh succeeds', async () => {
    vi.spyOn(tokenStorage, 'isAccessTokenExpired').mockReturnValue(true);
    vi.spyOn(tokenStorage, 'getAccessToken').mockReturnValue('new-access-token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { success: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const refreshHandler = vi.fn().mockResolvedValue('new-access-token');
    const unauthorizedHandler = vi.fn();

    apiClient.setRefreshHandler(refreshHandler);
    apiClient.setUnauthorizedHandler(unauthorizedHandler);

    const result = await apiClient.request<{ success: boolean }>('/test-endpoint');
    expect(result).toEqual({ success: true });
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(unauthorizedHandler).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('validates response against provided Zod schema and returns parsed data', async () => {
    const { z } = await import('zod');
    const testSchema = z.object({
      id: z.string(),
      count: z.number(),
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'item-1', count: 42 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await apiClient.request('/test-schema', {
      auth: false,
      schema: testSchema,
    });
    expect(result).toEqual({ id: 'item-1', count: 42 });
  });

  it('throws ApiError with SCHEMA_VALIDATION_ERROR when payload does not match schema', async () => {
    const { z } = await import('zod');
    const testSchema = z.object({
      id: z.string(),
      count: z.number(),
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'item-1', count: 'not-a-number' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      apiClient.request('/test-schema', {
        auth: false,
        schema: testSchema,
      }),
    ).rejects.toThrow(ApiError);
  });
});
