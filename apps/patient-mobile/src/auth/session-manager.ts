import type { z } from 'zod';
import { ApiFailure, friendlyError, toApiFailure } from '../api/errors';
import type { Connectivity, MobileTransport } from '../api/transport';
import type { SessionStore } from '../storage/session-store';
import type { AuthApi } from './auth-api';
import { otpFormSchema, phoneSchema, type NativeSession, type PublicUser, type SavedSession } from './contracts';

export type AuthState = {
  status: 'initializing' | 'unauthenticated' | 'requestingOtp' | 'otpVerification' | 'authenticated' | 'refreshing' | 'loggingOut' | 'error';
  user?: PublicUser; phone?: string; resendAt?: number; message?: string;
  recovery?: 'restore' | 'reauth' | 'storage';
  errorDetails?: ApiFailure;
};
export class SessionManager {
  private state: AuthState = { status: 'initializing' };
  private listeners = new Set<() => void>();
  private access?: { value: string; expiresAt: number };
  private saved: SavedSession | null = null;
  private generation = 0;
  private boot?: Promise<void>;
  private refreshFlight?: Promise<string | null>;
  constructor(private readonly api: AuthApi, private readonly store: SessionStore,
    private readonly transport: MobileTransport, private readonly connected: Connectivity,
    private readonly device: { platform: 'android' | 'ios'; appVersion: string }, private readonly now = Date.now) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private set(state: AuthState) { this.state = state; for (const listener of this.listeners) listener(); }
  private async online() {
    try { return await this.connected(); } catch { return false; }
  }
  start() {
    this.boot ??= this.initialize();
    return this.boot;
  }
  private async initialize() {
    const generation = this.generation;
    this.set({ status: 'initializing' });
    try {
      const saved = await this.store.initialize();
      if (generation !== this.generation) return;
      this.saved = saved;
      if (!saved) { this.set({ status: 'unauthenticated' }); return; }
      if (Date.parse(saved.expiresAt) <= this.now()) { await this.invalidate(); return; }
      if (saved.status !== 'ready') { this.uncertain(); return; }
      await this.refresh();
    } catch { this.storageError(); }
  }
  async requestOtp(rawPhone: string) {
    if (!['unauthenticated', 'otpVerification'].includes(this.state.status)) return;
    const parsed = phoneSchema.safeParse(rawPhone);
    if (!parsed.success) { this.set({ ...this.state, message: 'Enter a valid phone number, including country code.' }); return; }
    if (this.state.phone === parsed.data && (this.state.resendAt ?? 0) > this.now()) return;
    const previous = this.state;
    const generation = this.generation;
    this.set({ ...previous, status: 'requestingOtp', message: undefined });
    try {
      if (!await this.online()) throw new ApiFailure('offline');
      const response = await this.api.requestOtp(parsed.data);
      if (generation === this.generation) this.set({ status: 'otpVerification', phone: parsed.data, resendAt: Date.parse(response.resendAvailableAt), errorDetails: undefined });
    } catch (error) {
      if (generation === this.generation) {
        this.set({
          ...previous,
          message: friendlyError(error),
          errorDetails: toApiFailure(error, '/patient-portal/mobile/auth/request-otp', 'POST'),
        });
      }
    }
  }
  backToPhone() {
    if (this.state.status === 'otpVerification') this.set({ status: 'unauthenticated', phone: this.state.phone });
  }
  async verifyOtp(otp: string) {
    if (this.state.status !== 'otpVerification' || !this.state.phone) return;
    const parsed = otpFormSchema.safeParse({ otp });
    if (!parsed.success) { this.set({ ...this.state, message: 'Enter the four-digit verification code.' }); return; }
    const previous = this.state;
    const phone = this.state.phone;
    const generation = this.generation;
    this.set({ ...previous, status: 'requestingOtp', message: undefined, errorDetails: undefined });
    try {
      if (!await this.online()) throw new ApiFailure('offline');
      const result = await this.api.login({ phone, otp: parsed.data.otp,
        installationId: this.store.installationId, ...this.device });
      if (generation !== this.generation) { await this.revokeQuietly(result.tokens.refreshToken); return; }
      await this.accept(result, generation);
    } catch (error) {
      if (generation === this.generation && this.getSnapshot().status !== 'error') {
        this.set({
          ...previous,
          message: friendlyError(error),
          errorDetails: toApiFailure(error, '/patient-portal/mobile/auth/login', 'POST'),
        });
      }
    }
  }
  private async accept(result: NativeSession, generation: number) {
    const saved: SavedSession = { refreshToken: result.tokens.refreshToken, sessionId: result.session.id,
      expiresAt: result.session.expiresAt, installationId: this.store.installationId,
      apiBaseUrl: this.transport.config.apiBaseUrl, status: 'ready' };
    try { await this.store.save(saved); } catch {
      await this.revokeQuietly(result.tokens.refreshToken);
      if (generation === this.generation) this.storageError();
      return;
    }
    if (generation !== this.generation) { await this.store.clear().catch(() => this.storageError()); return; }
    this.saved = saved;
    this.access = { value: result.tokens.accessToken, expiresAt: this.now() + result.tokens.expiresIn * 1000 };
    this.set({ status: 'authenticated', user: result.user });
  }
  refresh() {
    if (this.refreshFlight) return this.refreshFlight;
    const flight = this.rotate().finally(() => { if (this.refreshFlight === flight) this.refreshFlight = undefined; });
    this.refreshFlight = flight;
    return flight;
  }
  private async rotate(): Promise<string | null> {
    const saved = this.saved;
    if (!saved || this.state.status === 'loggingOut' || this.state.recovery === 'storage') return null;
    if (saved.status !== 'ready') { this.uncertain(); return null; }
    const generation = this.generation;
    if (Date.parse(saved.expiresAt) <= this.now()) { await this.invalidate(); return null; }
    this.set({ ...this.state, status: 'refreshing', message: undefined, recovery: undefined });
    if (!await this.online()) {
      if (generation === this.generation) this.set({ status: 'error', recovery: 'restore', message: friendlyError(new ApiFailure('offline')) });
      return null;
    }
    if (generation !== this.generation) return null;
    const pending: SavedSession = { ...saved, status: 'in-flight' };
    try { await this.store.save(pending); } catch { this.storageError(); return null; }
    if (generation !== this.generation) return null;
    this.saved = pending;
    try {
      const result = await this.api.refresh(saved.refreshToken);
      if (generation !== this.generation) { await this.revokeQuietly(result.tokens.refreshToken); return null; }
      if (result.session.id !== saved.sessionId) throw new ApiFailure('contract');
      await this.accept(result, generation);
      return this.access?.value ?? null;
    } catch (error) {
      if (generation !== this.generation) return null;
      if (error instanceof ApiFailure && error.kind === 'auth') { await this.invalidate(); return null; }
      if (error instanceof ApiFailure && error.status === 429 && error.code === 'AUTH_RATE_LIMITED') {
        try { await this.store.save(saved); this.saved = saved;
          this.set({ status: 'error', recovery: 'restore', message: friendlyError(error) });
        } catch { this.storageError(); }
      } else {
        this.saved = { ...pending, status: 'uncertain' };
        try { await this.store.save(this.saved); this.uncertain(); } catch { this.storageError(); }
      }
      return null;
    }
  }
  private uncertain() {
    this.access = undefined;
    this.set({ status: 'error', recovery: 'reauth',
      message: 'We could not confirm your session refresh. Your saved session has been kept secure. Sign in again to continue safely.' });
  }
  private storageError() {
    this.access = undefined;
    this.set({ status: 'error', recovery: 'storage', message: 'Secure storage is unavailable. Unlock your device and retry secure cleanup.' });
  }
  async retry() {
    if (this.state.recovery === 'restore') await this.refresh();
    else if (this.state.recovery === 'storage') {
      await this.logout();
      if (this.state.status === 'unauthenticated') { this.boot = undefined; await this.start(); }
    }
  }
  async accessToken(): Promise<string | null> {
    if (this.boot && this.state.status === 'initializing') await this.boot;
    if (this.state.status === 'authenticated' && this.access && this.access.expiresAt - 30_000 > this.now()) return this.access.value;
    return this.refresh();
  }
  async foreground() {
    if (this.state.status === 'authenticated') await this.accessToken();
  }
  async authenticatedRequest<T>(path: string, schema: z.ZodType<T>, options?: {
    method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; query?: Record<string, string | number | boolean | undefined | null>;
  }): Promise<T> {
    const token = await this.accessToken();
    if (!token) throw new ApiFailure('auth');
    const generation = this.generation;
    try {
      const result = await this.transport.request(path, schema, { ...options, accessToken: token });
      if (generation !== this.generation) throw new ApiFailure('auth');
      return result;
    } catch (error) {
      if (generation === this.generation && error instanceof ApiFailure && error.status === 401) await this.invalidate();
      throw error; // No blind replay, especially for future non-idempotent mutations.
    }
  }
  async logout() {
    if (this.state.status === 'loggingOut') return;
    ++this.generation;
    const proof = this.saved?.refreshToken;
    this.saved = null; this.access = undefined;
    this.set({ status: 'loggingOut' });
    // Start revocation, then immediately clear local credentials; no offline logout queue.
    const revocation = proof ? this.revokeQuietly(proof) : Promise.resolve(true);
    try { await this.store.clear(); } catch { this.storageError(); await revocation; return; }
    const revoked = await revocation;
    this.set({ status: 'unauthenticated', message: revoked ? undefined
      : 'Signed out on this device. The server could not be reached to confirm session revocation.' });
  }
  private async revokeQuietly(proof: string): Promise<boolean> {
    try { if (!await this.online()) return false; await this.api.logout(proof); return true; } catch { return false; }
  }
  private async invalidate() {
    ++this.generation; this.saved = null; this.access = undefined;
    try { await this.store.clear();
      this.set({ status: 'unauthenticated', message: 'Your session has expired. Please sign in again.' });
    } catch { this.storageError(); }
  }
}
