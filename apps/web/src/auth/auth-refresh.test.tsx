import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// @vitest-environment jsdom
import { apiClient } from '../api/client';
import { authApi } from './auth-api';
import { AuthProvider } from './AuthContext';
import type { AuthSession, AuthUser } from './auth-types';
import { tokenStorage } from './token-storage';
import { useAuth } from './useAuth';

const mockUser: AuthUser = {
  id: 'staff-user-id',
  username: 'doctor@example.test',
  email: 'doctor@example.test',
  fullName: 'Dr. Test',
  status: 'active',
  patientId: null,
  branches: [{ id: 'b1', name: 'Main Branch', code: 'MAIN' }],
  roles: [{ id: 'doctor-role-id', code: 'DOCTOR', name: 'Doctor' }],
  permissions: [{ code: 'Doctors_Directory_View', module: 'Doctors', screen: 'Directory', action: 'View' }],
};

const session: AuthSession = {
  user: mockUser,
  tokens: {
    accessToken: 'new-access-token',
    tokenType: 'Bearer',
    expiresIn: 900,
  },
};

const jsonResponse = <T,>(data: T, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('web auth token refresh and concurrent request handling', () => {
  beforeEach(() => {
    tokenStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initiates exactly one refresh request when multiple concurrent 401 requests occur', async () => {
    let refreshCount = 0;

    apiClient.setRefreshHandler(async () => {
      const res = await authApi.refresh();
      tokenStorage.setTokens(res.tokens);
      return res.tokens.accessToken;
    });

    tokenStorage.setTokens({ accessToken: 'expired-token', tokenType: 'Bearer', expiresIn: 900 });

    // Mock initial fetch returning 401
    let callCount = 0;
    vi.mocked(fetch).mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        refreshCount++;
        return Promise.resolve(jsonResponse(session));
      }
      callCount++;
      if (callCount <= 3) {
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 }));
      }
      return Promise.resolve(jsonResponse({ result: 'ok' }));
    });

    const p1 = apiClient.request('/api/resource1');
    const p2 = apiClient.request('/api/resource2');
    const p3 = apiClient.request('/api/resource3');

    const results = await Promise.all([p1, p2, p3]);

    expect(refreshCount).toBe(1);
    expect(results).toEqual([{ result: 'ok' }, { result: 'ok' }, { result: 'ok' }]);
    expect(tokenStorage.getAccessToken()).toBe('new-access-token');

    apiClient.setRefreshHandler(null);
  });

  it('safely clears auth state and triggers unauthorized handler when refresh fails with 401', async () => {
    let unauthorizedTriggered = false;

    vi.mocked(fetch).mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Refresh token expired' } }), { status: 401 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 }));
    });

    apiClient.setRefreshHandler(async () => {
      try {
        const res = await authApi.refresh();
        tokenStorage.setTokens(res.tokens);
        return res.tokens.accessToken;
      } catch {
        tokenStorage.clear();
        return null;
      }
    });

    apiClient.setUnauthorizedHandler(() => {
      unauthorizedTriggered = true;
    });

    tokenStorage.setTokens({ accessToken: 'invalid-token', tokenType: 'Bearer', expiresIn: 900 });

    await expect(apiClient.request('/api/protected-route')).rejects.toThrow();

    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(unauthorizedTriggered).toBe(true);

    apiClient.setRefreshHandler(null);
    apiClient.setUnauthorizedHandler(null);
  });

  it('restores session via AuthProvider on startup using refresh cookie', async () => {
    vi.mocked(fetch).mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/refresh')) {
        return Promise.resolve(jsonResponse(session));
      }
      return Promise.resolve(jsonResponse({ result: 'ok' }));
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let observedStatus = '';

    function Observer() {
      const { status } = useAuth();
      useEffect(() => {
        observedStatus = status;
      }, [status]);
      return null;
    }

    await act(async () => {
      root.render(
        <AuthProvider>
          <Observer />
        </AuthProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(observedStatus).toBe('authenticated');
    expect(tokenStorage.getAccessToken()).toBe('new-access-token');

    await act(async () => root.unmount());
    container.remove();
  });
});
