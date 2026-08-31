import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// @vitest-environment jsdom
import { authApi } from './auth-api';
import { AuthProvider } from './AuthContext';
import type { AuthSession } from './auth-types';
import { tokenStorage } from './token-storage';
import { useAuth } from './useAuth';

const session: AuthSession = {
  user: {
    id: 'patient-user-id',
    username: 'patient@example.test',
    email: 'patient@example.test',
    fullName: 'Patient User',
    status: 'active',
    patientId: 'patient-id',
    roles: [{ id: 'patient-role-id', code: 'PATIENT', name: 'Patient' }],
  },
  tokens: {
    accessToken: 'access-token',
    tokenType: 'Bearer',
    expiresIn: 900,
  },
};

const jsonResponse = <T,>(data: T) => new Response(JSON.stringify({ data }), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

describe('patient refresh-cookie frontend contract', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    tokenStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(session))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stores only the access token in memory', () => {
    const sessionSetItem = vi.spyOn(Storage.prototype, 'setItem');
    tokenStorage.setTokens(session.tokens);

    expect(tokenStorage.getAccessToken()).toBe('access-token');
    expect(sessionSetItem).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('removes refresh tokens left by the obsolete storage contract', () => {
    sessionStorage.setItem('hms.patient.refreshToken', 'legacy-token');
    localStorage.setItem('hms.patient.refreshExpiresAt', '123');

    tokenStorage.clearLegacyRefreshStorage();

    expect(sessionStorage.getItem('hms.patient.refreshToken')).toBeNull();
    expect(localStorage.getItem('hms.patient.refreshExpiresAt')).toBeNull();
  });

  it('refreshes with an empty body and credentialed cookie request', async () => {
    await authApi.refresh();

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(options?.credentials).toBe('include');
    expect(options?.body).toBe('{}');
    expect(String(options?.body)).not.toContain('refreshToken');
  });

  it('uses credentialed requests for OTP login and empty-body logout', async () => {
    await authApi.loginWithOtp('+27821234567', '4821');
    await authApi.logout();

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls[0]?.[1]?.credentials).toBe('include');
    expect(calls[1]?.[1]?.credentials).toBe('include');
    expect(calls[1]?.[1]?.body).toBe('{}');
  });

  it('restores a patient session on reload using only the refresh cookie', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let observedStatus = '';

    function Observer() {
      const { status } = useAuth();
      useEffect(() => { observedStatus = status; }, [status]);
      return null;
    }

    await act(async () => {
      root.render(<AuthProvider><Observer /></AuthProvider>);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(observedStatus).toBe('authenticated');
    expect(tokenStorage.getAccessToken()).toBe('access-token');
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain('/auth/refresh');

    await act(async () => root.unmount());
    container.remove();
  });
});
