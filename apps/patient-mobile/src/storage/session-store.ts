import { z } from 'zod';
import { savedSessionSchema, type SavedSession } from '../auth/contracts';

export interface PrivateStorage {
  readSecret(): Promise<string | null>;
  writeSecret(value: string): Promise<void>;
  deleteSecret(): Promise<void>;
  readMarker(): Promise<string | null>;
  writeMarker(value: string): Promise<void>;
  randomId(): string;
}
export interface PendingRegistrationSession {
  phone: string;
  registrationToken: string;
  expiresAt: string;
}

const pendingRegistrationPayloadSchema = z.object({
  type: z.literal('pending_registration'),
  phone: z.string(),
  registrationToken: z.string(),
  expiresAt: z.string(),
  installationId: z.string(),
  apiBaseUrl: z.string(),
});

const markerSchema = z.object({ installationId: z.uuid(), signedOut: z.boolean() }).strict();
type Marker = z.infer<typeof markerSchema>;
const decode = (value: string | null): unknown => {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
};
export class SessionStore {
  private marker?: Marker;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: PrivateStorage, private readonly apiBaseUrl: string, private readonly now = Date.now) {}
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
  initialize() {
    return this.serial(async () => {
      const text = await this.storage.readMarker();
      const parsed = markerSchema.safeParse(decode(text));
      if (!parsed.success) {
        // Keychain data can survive reinstall. Never restore it without its install marker.
        await this.storage.deleteSecret();
        this.marker = { installationId: this.storage.randomId(), signedOut: true };
        await this.storage.writeMarker(JSON.stringify(this.marker));
      } else this.marker = parsed.data;
      if (this.marker.signedOut) { await this.storage.deleteSecret(); return null; }
      const raw = await this.storage.readSecret();
      const decoded = decode(raw);
      if (
        decoded &&
        typeof decoded === 'object' &&
        'type' in decoded &&
        (decoded as { type?: unknown }).type === 'pending_registration'
      ) {
        return null;
      }
      const saved = savedSessionSchema.safeParse(decoded);
      if (!saved.success || saved.data.installationId !== this.marker.installationId || saved.data.apiBaseUrl !== this.apiBaseUrl) {
        await this.clearInternal(); return null;
      }
      return saved.data;
    });
  }
  get installationId() {
    if (!this.marker) throw new Error('Storage not initialized');
    return this.marker.installationId;
  }
  save(bundle: SavedSession) {
    return this.serial(async () => {
      const data = savedSessionSchema.parse(bundle);
      if (!this.marker || data.installationId !== this.marker.installationId || data.apiBaseUrl !== this.apiBaseUrl) throw new Error('Storage binding mismatch');
      await this.storage.writeSecret(JSON.stringify(data));
      await this.storage.writeMarker(JSON.stringify({ ...this.marker, signedOut: false }));
      this.marker = { ...this.marker, signedOut: false };
    });
  }
  saveRegistrationSession(bundle: { phone: string; registrationToken: string; expiresAt: string }) {
    return this.serial(async () => {
      if (!this.marker) throw new Error('Storage not initialized');
      const payload = {
        type: 'pending_registration' as const,
        phone: bundle.phone,
        registrationToken: bundle.registrationToken,
        expiresAt: bundle.expiresAt,
        installationId: this.marker.installationId,
        apiBaseUrl: this.apiBaseUrl,
      };
      await this.storage.writeSecret(JSON.stringify(payload));
      await this.storage.writeMarker(JSON.stringify({ ...this.marker, signedOut: false }));
      this.marker = { ...this.marker, signedOut: false };
    });
  }
  readRegistrationSession(): Promise<PendingRegistrationSession | null> {
    return this.serial(async () => {
      if (!this.marker || this.marker.signedOut) return null;
      const raw = await this.storage.readSecret();
      const parsed = pendingRegistrationPayloadSchema.safeParse(decode(raw));
      if (
        parsed.success &&
        parsed.data.installationId === this.marker.installationId &&
        parsed.data.apiBaseUrl === this.apiBaseUrl
      ) {
        if (Date.parse(parsed.data.expiresAt) <= this.now()) {
          await this.clearRegistrationSessionInternal();
          return null;
        }
        return {
          phone: parsed.data.phone,
          registrationToken: parsed.data.registrationToken,
          expiresAt: parsed.data.expiresAt,
        };
      }
      return null;
    });
  }
  clearRegistrationSession() {
    return this.serial(() => this.clearRegistrationSessionInternal());
  }
  private async clearRegistrationSessionInternal() {
    const raw = await this.storage.readSecret();
    const decoded = decode(raw);
    if (
      decoded &&
      typeof decoded === 'object' &&
      'type' in decoded &&
      (decoded as { type?: unknown }).type === 'pending_registration'
    ) {
      await this.storage.deleteSecret().catch(() => {});
    }
  }
  clear() { return this.serial(() => this.clearInternal()); }
  private async clearInternal() {
    // A non-secret tombstone prevents restoration even if secure deletion fails.
    let failed = false;
    if (this.marker) {
      this.marker = { ...this.marker, signedOut: true };
      try { await this.storage.writeMarker(JSON.stringify(this.marker)); } catch { failed = true; }
    }
    try { await this.storage.deleteSecret(); } catch { failed = true; }
    if (failed) throw new Error('Private storage cleanup unavailable');
  }
}
