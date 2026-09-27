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
const markerSchema = z.object({ installationId: z.uuid(), signedOut: z.boolean() }).strict();
type Marker = z.infer<typeof markerSchema>;
const decode = (value: string | null): unknown => {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
};
export class SessionStore {
  private marker?: Marker;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly storage: PrivateStorage, private readonly apiBaseUrl: string) {}
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
      const saved = savedSessionSchema.safeParse(decode(raw));
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
