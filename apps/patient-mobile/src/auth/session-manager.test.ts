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
    store = new SessionStore(storage, apiBaseUrl);
    isOnline = true;
    currentTime = Date.parse('2026-09-25T10:00:00.000Z');

    mockApi = {
      requestOtp: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
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

  it('marks credential uncertain and disallows blind replay on ambiguous server 500 failure', async () => {
    await store.initialize();
    const initialSession: SavedSession = {
      refreshToken: 'm'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(initialSession);

    mockApi.refresh.mockRejectedValue(new ApiFailure('server', 500));

    const manager = createManager();
    await manager.start();

    // Must move to error with reauth recovery
    expect(manager.getSnapshot().status).toBe('error');
    expect(manager.getSnapshot().recovery).toBe('reauth');

    // Stored session has uncertain status
    const saved = JSON.parse((await storage.readSecret()) ?? '{}');
    expect(saved.status).toBe('uncertain');
  });

  it('clears storage and sets unauthenticated on definitive auth rejection (401)', async () => {
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
});
