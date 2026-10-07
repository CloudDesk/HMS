import { beforeEach, describe, expect, it } from 'vitest';
import type { SavedSession } from '../auth/contracts';
import { SessionStore, type PrivateStorage } from './session-store';

class InMemoryPrivateStorage implements PrivateStorage {
  private secret: string | null = null;
  private marker: string | null = null;
  private nextId = '11111111-1111-4111-8111-111111111111';

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

  // Test helpers
  setRawSecret(val: string | null) {
    this.secret = val;
  }
  setRawMarker(val: string | null) {
    this.marker = val;
  }
}

describe('SessionStore', () => {
  const apiBaseUrl = 'http://10.0.2.2:4000/api';
  let storage: InMemoryPrivateStorage;
  let store: SessionStore;

  beforeEach(() => {
    storage = new InMemoryPrivateStorage();
    store = new SessionStore(storage, apiBaseUrl);
  });

  it('detects fresh install, deletes surviving keychain data, and initializes a new marker', async () => {
    // Simulate surviving keychain secret from previous installation
    storage.setRawSecret(JSON.stringify({ refreshToken: 'surviving' }));

    const result = await store.initialize();
    expect(result).toBeNull();
    expect(await storage.readSecret()).toBeNull();
    expect(store.installationId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('saves and restores a valid session matching installationId and apiBaseUrl', async () => {
    await store.initialize();
    const installationId = store.installationId;

    const session: SavedSession = {
      refreshToken: 'a'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId,
      apiBaseUrl,
      status: 'ready',
    };

    await store.save(session);

    // Create a new store instance with same underlying storage to simulate app restart
    const secondStore = new SessionStore(storage, apiBaseUrl);
    const restored = await secondStore.initialize();

    expect(restored).toEqual(session);
  });

  it('rejects restored session if apiBaseUrl changed', async () => {
    await store.initialize();
    const session: SavedSession = {
      refreshToken: 'a'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(session);

    // New store pointing to different environment
    const differentEnvStore = new SessionStore(storage, 'https://hospital.example.com/api');
    const restored = await differentEnvStore.initialize();

    expect(restored).toBeNull();
  });

  it('clearing session sets signedOut tombstone in marker and deletes secret', async () => {
    await store.initialize();
    const session: SavedSession = {
      refreshToken: 'a'.repeat(64),
      sessionId: '507f1f77bcf86cd799439011',
      expiresAt: '2026-10-02T10:00:00.000Z',
      installationId: store.installationId,
      apiBaseUrl,
      status: 'ready',
    };
    await store.save(session);

    await store.clear();

    expect(await storage.readSecret()).toBeNull();
    const marker = JSON.parse((await storage.readMarker()) ?? '{}');
    expect(marker.signedOut).toBe(true);
  });

  it('saves, reads, and clears pending registration session', async () => {
    await store.initialize();

    const pending = {
      phone: '+919876543210',
      registrationToken: 'test-reg-token-abc',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    await store.saveRegistrationSession(pending);

    const retrieved = await store.readRegistrationSession();
    expect(retrieved).toEqual(pending);

    // Initializing store does not wipe pending registration
    const secondStore = new SessionStore(storage, apiBaseUrl);
    const restoredAuth = await secondStore.initialize();
    expect(restoredAuth).toBeNull();

    const secondRetrieved = await secondStore.readRegistrationSession();
    expect(secondRetrieved).toEqual(pending);

    // Clear registration session
    await store.clearRegistrationSession();
    expect(await store.readRegistrationSession()).toBeNull();
  });

  it('returns null and purges expired pending registration session', async () => {
    await store.initialize();

    const expiredPending = {
      phone: '+919876543210',
      registrationToken: 'expired-token',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };

    await store.saveRegistrationSession(expiredPending);

    const retrieved = await store.readRegistrationSession();
    expect(retrieved).toBeNull();
  });
});
