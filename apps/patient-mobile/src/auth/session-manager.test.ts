import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiFailure } from '../api/errors';
import type { MobileTransport } from '../api/transport';
import type { AuthApi } from './auth-api';
import type { NativeSession, SavedSession } from './contracts';
import { SessionManager } from './session-manager';
import { SessionStore, type PrivateStorage } from '../storage/session-store';

class InMemoryPrivateStorage implements PrivateStorage {
  secret: string | null = null;
  marker: string | null = null;
  nextId = '22222222-2222-4222-8222-222222222222';

  async readSecret() {
    return this.secret;
  }
  async writeSecret(value: string) {
    this.secret = value;
  }
  async deleteSecret() {
    this.secret = null;
  }
  async readMarker() {
    return this.marker;
  }
  async writeMarker(value: string) {
    this.marker = value;
  }
  randomId() {
    return this.nextId;
  }
}

describe('SessionManager', () => {
  const apiBaseUrl = 'http://10.0.2.2:4000/api';
  let storage: InMemoryPrivateStorage;
  let store: SessionStore;
  let mockApi: {
    requestOtp: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    verifyRegistrationOtp: ReturnType<typeof vi.fn>;
    signup: ReturnType<typeof vi.fn>;
    completeProfile: ReturnType<typeof vi.fn>;
    getPublicBranches: ReturnType<typeof vi.fn>;
  };
  let mockTransport: {
    config: { environment: 'development'; apiBaseUrl: string };
    request: ReturnType<typeof vi.fn>;
  };
  let isOnline: boolean;
  let currentTime: number;

  const sampleUser = {
    id: 'user-123',
    username: '+919876543210',
    fullName: 'John Patient',
    email: 'john@example.com',
    status: 'active' as const,
    lastLoginAt: '2026-09-25T10:00:00.000Z',
    branches: [{ id: 'b1', code: 'MAIN', name: 'Main' }],
    roles: [{ id: 'r1', code: 'PATIENT', name: 'Patient' }],
    permissions: [{ code: 'portal:read', module: 'portal', screen: 'home', action: 'read' }],
  };

  const createSampleSession = (refreshToken: string, accessToken = 'access.jwt'): NativeSession => ({
    user: sampleUser,
    tokens: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshExpiresIn: 604800,
    },
    session: {
      id: '507f1f77bcf86cd799439011',
      platform: 'android',
      appVersion: '0.1.0',
      createdAt: '2026-09-25T10:00:00.000Z',
      lastUsedAt: '2026-09-25T10:00:00.000Z',
      expiresAt: '2026-10-02T10:00:00.000Z',
    },
  });

  const createManager = () => {
    return new SessionManager(
      mockApi as unknown as AuthApi,
      store,
      mockTransport as unknown as MobileTransport,
      async () => isOnline,
      { platform: 'android', appVersion: '0.1.0' },
      () => currentTime
    );
  };

  beforeEach(() => {
    storage = new InMemoryPrivateStorage();
    currentTime = Date.parse('2026-09-25T10:00:00.000Z');
    store = new SessionStore(storage, apiBaseUrl, () => currentTime);
    isOnline = true;

    mockApi = {
      requestOtp: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
      verifyRegistrationOtp: vi.fn(),
      signup: vi.fn(),
      completeProfile: vi.fn(),
      getPublicBranches: vi.fn(),
    };

    mockTransport = {
      config: { environment: 'development', apiBaseUrl },
      request: vi.fn(),
    };
  });

  it('starts unauthenticated when no saved session exists', async () => {
    const manager = createManager();
    await manager.start();
    expect(manager.getSnapshot().status).toBe('unauthenticated');
  });

  it('restores authenticated session on startup when valid refresh credential exists', async () => {
    await store.initialize();
    const initialSession: SavedSession = {
      refreshToken: 'a'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(initialSession);

    const rotatedSession = createSampleSession('b'.repeat(64), 'new.access.jwt');
    mockApi.refresh.mockResolvedValue(rotatedSession);

    const manager = createManager();
    await manager.start();

    expect(manager.getSnapshot().status).toBe('authenticated');
    expect(manager.getSnapshot().user?.fullName).toBe('John Patient');
    expect(mockApi.refresh).toHaveBeenCalledWith('a'.repeat(64));

    // Access token is available in memory
    const token = await manager.accessToken();
    expect(token).toBe('new.access.jwt');

    // Access token is NOT persisted in storage
    const rawSecret = await storage.readSecret();
    expect(rawSecret).not.toContain('new.access.jwt');
    expect(rawSecret).toContain('b'.repeat(64));
  });

  it('handles full login flow: request OTP -> verify OTP -> authenticated state', async () => {
    const manager = createManager();
    await manager.start();
    expect(manager.getSnapshot().status).toBe('unauthenticated');

    mockApi.requestOtp.mockResolvedValue({
      success: true,
      resendAvailableAt: new Date(currentTime + 60_000).toISOString(),
    });

    await manager.requestOtp('+919876543210');
    expect(manager.getSnapshot().status).toBe('otpVerification');
    expect(manager.getSnapshot().phone).toBe('+919876543210');

    const sessionResponse = createSampleSession('r'.repeat(64), 'initial.access.jwt');
    mockApi.login.mockResolvedValue(sessionResponse);

    await manager.verifyOtp('1234');
    expect(manager.getSnapshot().status).toBe('authenticated');
    expect(manager.getSnapshot().user?.id).toBe('user-123');
    expect(await manager.accessToken()).toBe('initial.access.jwt');
  });

  it('preserves stored credential when refresh fails due to offline connectivity', async () => {
    await store.initialize();
    const initialSession: SavedSession = {
      refreshToken: 'x'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(initialSession);

    isOnline = false; // Device is offline

    const manager = createManager();
    await manager.start();

    // Must move to error with restore recovery, NOT destroy the refresh token
    expect(manager.getSnapshot().status).toBe('error');
    expect(manager.getSnapshot().recovery).toBe('restore');

    // Stored secret must still be preserved
    const saved = JSON.parse((await storage.readSecret()) ?? '{}');
    expect(saved.refreshToken).toBe('x'.repeat(64));
    expect(saved.status).toBe('ready');
  });

  it('preserves stored credential when refresh fails due to timeout (Render cold-start)', async () => {
    await store.initialize();
    const initialSession: SavedSession = {
      refreshToken: 't'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(initialSession);

    mockApi.refresh.mockRejectedValue(
      new ApiFailure({
        category: 'TIMEOUT',
        kind: 'network',
        code: 'TIMEOUT',
      })
    );

    const manager = createManager();
    await manager.start();

    expect(manager.getSnapshot().status).toBe('error');
    expect(manager.getSnapshot().recovery).toBe('restore');

    // Stored credential preserved as ready
    const saved = JSON.parse((await storage.readSecret()) ?? '{}');
    expect(saved.refreshToken).toBe('t'.repeat(64));
    expect(saved.status).toBe('ready');
  });

  it('preserves stored credential when refresh fails due to network error', async () => {
    await store.initialize();
    const initialSession: SavedSession = {
      refreshToken: 'n'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(initialSession);

    mockApi.refresh.mockRejectedValue(
      new ApiFailure({
        category: 'NETWORK_ERROR',
        kind: 'network',
        code: 'NETWORK_ERROR',
      })
    );

    const manager = createManager();
    await manager.start();

    expect(manager.getSnapshot().status).toBe('error');
    expect(manager.getSnapshot().recovery).toBe('restore');

    const saved = JSON.parse((await storage.readSecret()) ?? '{}');
    expect(saved.refreshToken).toBe('n'.repeat(64));
    expect(saved.status).toBe('ready');
  });

  it('preserves stored credential and sets restore state on HTTP 502/503/504 gateway errors', async () => {
    for (const status of [502, 503, 504]) {
      await store.initialize();
      const initialSession: SavedSession = {
        refreshToken: 'g'.repeat(64),
        sessionId: '507f1f77bcf86cd799439011',
        expiresAt: '2026-10-02T10:00:00.000Z',
        installationId: store.installationId,
        apiBaseUrl,
        status: 'ready',
      };
      await store.save(initialSession);

      mockApi.refresh.mockRejectedValue(new ApiFailure('server', status));

      const manager = createManager();
      await manager.start();

      expect(manager.getSnapshot().status).toBe('error');
      expect(manager.getSnapshot().recovery).toBe('restore');

      const saved = JSON.parse((await storage.readSecret()) ?? '{}');
      expect(saved.refreshToken).toBe('g'.repeat(64));
      expect(saved.status).toBe('ready');
    }
  });

  it('clears storage and sets unauthenticated on definitive auth rejection (401 INVALID_REFRESH_TOKEN)', async () => {
    await store.initialize();
    const initialSession: SavedSession = {
      refreshToken: 'k'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(initialSession);

    mockApi.refresh.mockRejectedValue(new ApiFailure('auth', 401, 'INVALID_REFRESH_TOKEN'));

    const manager = createManager();
    await manager.start();

    expect(manager.getSnapshot().status).toBe('unauthenticated');
    expect(await storage.readSecret()).toBeNull();
  });

  it('clears storage and sets unauthenticated on 403 SESSION_REVOKED', async () => {
    await store.initialize();
    const initialSession: SavedSession = {
      refreshToken: 'v'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(initialSession);

    mockApi.refresh.mockRejectedValue(new ApiFailure('auth', 403, 'SESSION_REVOKED'));

    const manager = createManager();
    await manager.start();

    expect(manager.getSnapshot().status).toBe('unauthenticated');
    expect(await storage.readSecret()).toBeNull();
  });

  it('allows user to retry connection after a timeout and successfully authenticate', async () => {
    await store.initialize();
    const initialSession: SavedSession = {
      refreshToken: 'r'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(initialSession);

    // First attempt fails with timeout (cold start)
    mockApi.refresh.mockRejectedValueOnce(
      new ApiFailure({ category: 'TIMEOUT', kind: 'network', code: 'TIMEOUT' })
    );

    const manager = createManager();
    await manager.start();

    expect(manager.getSnapshot().status).toBe('error');
    expect(manager.getSnapshot().recovery).toBe('restore');

    // Second attempt (user clicks Retry Connection) succeeds
    const rotatedSession = createSampleSession('w'.repeat(64), 'retried.jwt');
    mockApi.refresh.mockResolvedValueOnce(rotatedSession);

    await manager.retry();

    expect(manager.getSnapshot().status).toBe('authenticated');
    expect(manager.getSnapshot().user?.fullName).toBe('John Patient');
  });

  it('recovers in-flight status to ready on startup without permanently latching into uncertain', async () => {
    await store.initialize();
    const inFlightSession: SavedSession = {
      refreshToken: 'f'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'in-flight',
    };
    await store.save(inFlightSession);

    const rotatedSession = createSampleSession('g'.repeat(64), 'recovered.jwt');
    mockApi.refresh.mockResolvedValue(rotatedSession);

    const manager = createManager();
    await manager.start();

    expect(manager.getSnapshot().status).toBe('authenticated');
    expect(mockApi.refresh).toHaveBeenCalledWith('f'.repeat(64));
  });

  it('performs single-flight refresh when multiple callers request refresh concurrently', async () => {
    await store.initialize();
    const initialSession: SavedSession = {
      refreshToken: 's'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(initialSession);

    const rotatedSession = createSampleSession('t'.repeat(64), 'single-flight.jwt');
    mockApi.refresh.mockImplementation(async () => {
      // Simulate slow network
      return rotatedSession;
    });

    const manager = createManager();
    await store.initialize(); // Ensure manager has store initialized
    // Trigger start which refreshes
    const startPromise = manager.start();
    const concurrentTokenPromise = manager.accessToken();

    const [, token] = await Promise.all([startPromise, concurrentTokenPromise]);
    expect(token).toBe('single-flight.jwt');
    expect(mockApi.refresh).toHaveBeenCalledTimes(1);
  });

  it('logout clears local credentials, sets signedOut tombstone, and calls API', async () => {
    const manager = createManager();
    await manager.start();

    const sessionResponse = createSampleSession('l'.repeat(64), 'logout.test.jwt');
    mockApi.login.mockResolvedValue(sessionResponse);
    mockApi.requestOtp.mockResolvedValue({ success: true, resendAvailableAt: new Date().toISOString() });

    await manager.requestOtp('+919876543210');
    await manager.verifyOtp('1234');
    expect(manager.getSnapshot().status).toBe('authenticated');

    mockApi.logout.mockResolvedValue({ ok: true });

    await manager.logout();

    expect(manager.getSnapshot().status).toBe('unauthenticated');
    expect(await storage.readSecret()).toBeNull();
    const marker = JSON.parse((await storage.readMarker()) ?? '{}');
    expect(marker.signedOut).toBe(true);
    expect(mockApi.logout).toHaveBeenCalledWith('l'.repeat(64));
  });

  it('authenticatedRequest attaches bearer token and executes successfully', async () => {
    const manager = createManager();
    await manager.start();

    const sessionResponse = createSampleSession('p'.repeat(64), 'bearer.access.jwt');
    mockApi.login.mockResolvedValue(sessionResponse);
    mockApi.requestOtp.mockResolvedValue({ success: true, resendAvailableAt: new Date().toISOString() });

    await manager.requestOtp('+919876543210');
    await manager.verifyOtp('1234');

    mockTransport.request.mockResolvedValue({ id: 'p-1', name: 'Profile Data' });

    const result = await manager.authenticatedRequest(
      '/patient-portal/profile',
      z.object({ id: z.string(), name: z.string() })
    );

    expect(result).toEqual({ id: 'p-1', name: 'Profile Data' });
    expect(mockTransport.request).toHaveBeenCalledWith(
      '/patient-portal/profile',
      expect.anything(),
      { accessToken: 'bearer.access.jwt' }
    );
  });

  describe('New Patient Registration Flow', () => {
    it('sets auth mode and requests registration OTP', async () => {
      const manager = createManager();
      await manager.start();

      mockApi.requestOtp.mockResolvedValue({
        success: true,
        resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
      });

      manager.setAuthMode('register');
      expect(manager.getSnapshot().authMode).toBe('register');

      await manager.requestOtp('+919876543210', 'register');
      expect(manager.getSnapshot().status).toBe('otpVerification');
      expect(manager.getSnapshot().authMode).toBe('register');
      expect(manager.getSnapshot().phone).toBe('+919876543210');
      expect(mockApi.requestOtp).toHaveBeenCalledWith('+919876543210');
    });

    it('verifies registration OTP and transitions to registrationDetails with registrationToken', async () => {
      const manager = createManager();
      await manager.start();

      mockApi.requestOtp.mockResolvedValue({
        success: true,
        resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
      });
      mockApi.verifyRegistrationOtp.mockResolvedValue('reg-token-xyz-789');

      await manager.requestOtp('+919876543210', 'register');
      await manager.verifyRegistrationOtp('1234');

      const state = manager.getSnapshot();
      expect(state.status).toBe('registrationDetails');
      expect(state.authMode).toBe('register');
      expect(state.registrationToken).toBe('reg-token-xyz-789');
      expect(state.phone).toBe('+919876543210');
    });

    it('completes atomic patient registration in a single signup call with selfProfile and establishes authenticated session', async () => {
      const manager = createManager();
      await manager.start();

      mockApi.requestOtp.mockResolvedValue({
        success: true,
        resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
      });
      mockApi.verifyRegistrationOtp.mockResolvedValue('reg-token-xyz-789');

      const signupSession = createSampleSession('r'.repeat(64), 'reg.access.token');
      mockApi.signup.mockResolvedValue(signupSession);

      await manager.requestOtp('+919876543210', 'register');
      await manager.verifyRegistrationOtp('1234');

      await manager.registerPatient({
        fullName: 'Aarav Patel',
        email: 'aarav@example.com',
        dateOfBirth: '1995-06-20',
        gender: 'MALE',
        preferredBranchId: 'branch-1',
        bloodGroup: 'B+',
        line1: '456 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400020',
      });

      const state = manager.getSnapshot();
      expect(state.status).toBe('authenticated');
      expect(state.user?.fullName).toBe('John Patient');
      expect(mockApi.signup).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Aarav Patel',
          email: 'aarav@example.com',
          phone: '+919876543210',
          registrationToken: 'reg-token-xyz-789',
          selfProfile: {
            firstName: 'Aarav',
            lastName: 'Patel',
            dateOfBirth: '1995-06-20',
            gender: 'MALE',
            preferredBranchId: 'branch-1',
            bloodGroup: 'B+',
            address: {
              line1: '456 Marine Drive',
              city: 'Mumbai',
              state: 'Maharashtra',
              postalCode: '400020',
            },
          },
        })
      );
      expect(mockApi.completeProfile).not.toHaveBeenCalled();
    });

    it('fails registration and does not authenticate when signup throws an error (including 409 DUPLICATE)', async () => {
      const manager = createManager();
      await manager.start();

      mockApi.requestOtp.mockResolvedValue({
        success: true,
        resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
      });
      mockApi.verifyRegistrationOtp.mockResolvedValue('reg-token-xyz-789');

      mockApi.signup.mockRejectedValue(
        new ApiFailure({
          kind: 'validation',
          status: 409,
          code: 'DUPLICATE_PATIENT',
          userMessage: 'A possible existing patient record was found.',
        })
      );

      await manager.requestOtp('+919876543210', 'register');
      await manager.verifyRegistrationOtp('1234');

      await manager.registerPatient({
        fullName: 'Aarav Patel',
        email: 'aarav@example.com',
        dateOfBirth: '1995-06-20',
        gender: 'MALE',
        preferredBranchId: 'branch-1',
      });

      const state = manager.getSnapshot();
      expect(state.status).toBe('registrationDetails');
      expect(state.message).toContain('A possible existing patient record was found');
      expect(mockApi.completeProfile).not.toHaveBeenCalled();
    });

    it('cancels registration and returns to unauthenticated state', async () => {
      const manager = createManager();
      await manager.start();

      mockApi.requestOtp.mockResolvedValue({
        success: true,
        resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
      });
      mockApi.verifyRegistrationOtp.mockResolvedValue('reg-token-xyz-789');

      await manager.requestOtp('+919876543210', 'register');
      await manager.verifyRegistrationOtp('1234');

      expect(manager.getSnapshot().status).toBe('registrationDetails');

      manager.cancelRegistration();

      const state = manager.getSnapshot();
      expect(state.status).toBe('unauthenticated');
      expect(state.authMode).toBe('login');
      expect(state.registrationToken).toBeUndefined();
    });

    it('restores pending registration session on start if non-expired', async () => {
      await store.initialize();
      await store.saveRegistrationSession({
        phone: '+919876543210',
        registrationToken: 'saved-token-123',
        expiresAt: new Date(currentTime + 10 * 60 * 1000).toISOString(),
      });

      const manager = createManager();
      await manager.start();

      const state = manager.getSnapshot();
      expect(state.status).toBe('registrationDetails');
      expect(state.authMode).toBe('register');
      expect(state.phone).toBe('+919876543210');
      expect(state.registrationToken).toBe('saved-token-123');
    });

    it('clears registration token and session from storage on 401 INVALID_REGISTRATION_TOKEN', async () => {
      const manager = createManager();
      await manager.start();

      mockApi.requestOtp.mockResolvedValue({
        success: true,
        resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
      });
      mockApi.verifyRegistrationOtp.mockResolvedValue('expired-token-456');

      mockApi.signup.mockRejectedValue(
        new ApiFailure({
          kind: 'auth',
          status: 401,
          code: 'INVALID_REGISTRATION_TOKEN',
          userMessage: 'The registration session is invalid or has expired. Please verify your mobile number again.',
        })
      );

      await manager.requestOtp('+919876543210', 'register');
      await manager.verifyRegistrationOtp('1234');

      expect(await store.readRegistrationSession()).not.toBeNull();

      await manager.registerPatient({
        fullName: 'Daniel Test',
        email: 'daniel@example.com',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        preferredBranchId: 'branch-1',
      });

      const state = manager.getSnapshot();
      expect(state.status).toBe('registrationDetails');
      expect(state.registrationToken).toBeUndefined();
      expect(state.message).toBe('The registration session is invalid or has expired. Please verify your mobile number again.');
      expect(await store.readRegistrationSession()).toBeNull();
    });

    it('sets cooldown resendAt and user-friendly error on 429 AUTH_RATE_LIMITED', async () => {
      const manager = createManager();
      await manager.start();

      mockApi.requestOtp.mockRejectedValue(
        new ApiFailure({
          kind: 'validation',
          status: 429,
          code: 'AUTH_RATE_LIMITED',
          userMessage: 'Too many attempts. Please wait before trying again.',
        })
      );

      await manager.requestOtp('+919876543210', 'login');

      const state = manager.getSnapshot();
      expect(state.message).toBe('Too many attempts. Please wait before trying again.');
      expect(state.resendAt).toBeDefined();
      expect(state.resendAt!).toBeGreaterThan(currentTime);
    });
  });
});
