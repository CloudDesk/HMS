import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config', () => ({ appConfig: { apiBaseUrl: 'https://hms.example.test/api' } }));
import { apiClient } from './client';
describe('API success envelope unwrapping', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([null, false, 0, '', { id: 'resource' }])('preserves the exact data value %j', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } })));
    expect(await apiClient.request('/resource', { auth: false })).toEqual(data);
  });
  it('continues to support a response without an envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'raw' }), { status: 200, headers: { 'content-type': 'application/json' } })));
    expect(await apiClient.request('/resource', { auth: false })).toEqual({ id: 'raw' });
  });
});
