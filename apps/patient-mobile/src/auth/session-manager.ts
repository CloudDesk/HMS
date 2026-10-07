import type { z } from 'zod';
import { ApiFailure, friendlyError, toApiFailure } from '../api/errors';
import type { Connectivity, MobileTransport } from '../api/transport';
import type { SessionStore } from '../storage/session-store';
import type { AuthApi } from './auth-api';
import {
  otpFormSchema,
  phoneSchema,
  registrationFormSchema,
  type NativeSession,
  type PublicUser,
  type RegistrationFormValues,
  type SavedSession,
} from './contracts';

export type AuthState = {
  status:
    | 'initializing'
    | 'unauthenticated'
    | 'requestingOtp'
    | 'otpVerification'
    | 'verifyingOtp'
    | 'resendingOtp'
    | 'registrationDetails'
    | 'registering'
    | 'authenticated'
    | 'refreshing'
    | 'loggingOut'
    | 'error';
  authMode?: 'login' | 'register';
  user?: PublicUser;
  phone?: string;
  registrationToken?: string;
  resendAt?: number;
  message?: string;
  recovery?: 'restore' | 'reauth' | 'storage';
  errorDetails?: ApiFailure;
};
export class SessionManager {
  private state: AuthState = { status: 'initializing', authMode: 'login' };
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
      if (!saved) {
        const pendingReg = await this.store.readRegistrationSession();
        if (pendingReg && pendingReg.registrationToken && Date.parse(pendingReg.expiresAt) > this.now()) {
          this.set({
            status: 'registrationDetails',
            authMode: 'register',
            phone: pendingReg.phone,
            registrationToken: pendingReg.registrationToken,
          });
          return;
        }
        this.set({ status: 'unauthenticated', authMode: 'login' });
        return;
      }
      if (Date.parse(saved.expiresAt) <= this.now()) { await this.invalidate(); return; }
      if (saved.status === 'in-flight') {
        saved.status = 'ready';
        try {
          await this.store.save(saved);
        } catch {
          // ignore storage error on in-flight reset
        }
      }
      if (saved.status !== 'ready') { this.uncertain(); return; }
      await this.refresh();
    } catch {
      this.set({ status: 'unauthenticated', authMode: 'login' });
    }
  }
  setAuthMode(mode: 'login' | 'register') {
    if (this.state.status === 'unauthenticated' || this.state.status === 'otpVerification') {
      this.set({ ...this.state, authMode: mode, message: undefined, errorDetails: undefined });
    }
  }
  clearError() {
    if (this.state.message || this.state.errorDetails) {
      this.set({ ...this.state, message: undefined, errorDetails: undefined });
    }
  }
  async requestOtp(rawPhone: string, mode?: 'login' | 'register') {
    if (!['unauthenticated', 'otpVerification'].includes(this.state.status)) return;
    const parsed = phoneSchema.safeParse(rawPhone);
    if (!parsed.success) { this.set({ ...this.state, message: 'Enter a valid phone number, including country code.', errorDetails: undefined }); return; }
    if (this.state.phone === parsed.data && (this.state.resendAt ?? 0) > this.now()) {
      const remainingSec = Math.max(1, Math.ceil(((this.state.resendAt ?? 0) - this.now()) / 1000));
      this.set({ ...this.state, message: `Please wait ${remainingSec}s before requesting a new code.`, errorDetails: undefined });
      return;
    }
    const targetMode = mode ?? this.state.authMode ?? 'login';
    const previous = this.state;
    const generation = this.generation;
    const isResend = previous.status === 'otpVerification';
    this.set({
      ...previous,
      status: isResend ? 'resendingOtp' : 'requestingOtp',
      authMode: targetMode,
      message: undefined,
      errorDetails: undefined,
    });
    try {
      if (!await this.online()) throw new ApiFailure('offline');
      const response = await this.api.requestOtp(parsed.data);
      if (generation === this.generation) {
        this.set({
          status: 'otpVerification',
          authMode: targetMode,
          phone: parsed.data,
          resendAt: Date.parse(response.resendAvailableAt),
          errorDetails: undefined,
          message: undefined,
        });
      }
    } catch (error) {
      if (generation === this.generation) {
        const isRateLimited =
          error instanceof ApiFailure && (error.status === 429 || error.code === 'AUTH_RATE_LIMITED');
        this.set({
          ...previous,
          phone: parsed.data,
          resendAt: isRateLimited
            ? previous.resendAt && previous.resendAt > this.now()
              ? previous.resendAt
              : this.now() + 60_000
            : previous.resendAt,
          message: friendlyError(error),
          errorDetails: toApiFailure(error, '/patient-portal/otp/request', 'POST'),
        });
      }
    }
  }
  backToPhone() {
    if (this.state.status === 'otpVerification' || this.state.status === 'registrationDetails') {
      this.store.clearRegistrationSession().catch(() => {});
      this.set({
        status: 'unauthenticated',
        authMode: this.state.authMode ?? 'login',
        phone: this.state.phone,
        registrationToken: undefined,
        message: undefined,
        errorDetails: undefined,
      });
    }
  }
  async verifyOtp(otp: string) {
    if (this.state.status !== 'otpVerification' || !this.state.phone) return;
    if (this.state.authMode === 'register') {
      return this.verifyRegistrationOtp(otp);
    }
    const parsed = otpFormSchema.safeParse({ otp });
    if (!parsed.success) { this.set({ ...this.state, message: 'Enter the four-digit verification code.' }); return; }
    const previous = this.state;
    const phone = this.state.phone;
    const generation = this.generation;
    this.set({ ...previous, status: 'verifyingOtp', message: undefined, errorDetails: undefined });
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
          status: 'otpVerification',
          message: friendlyError(error),
          errorDetails: toApiFailure(error, '/patient-portal/login/otp', 'POST'),
        });
      }
    }
  }
  async verifyRegistrationOtp(otp: string) {
    if (this.state.status !== 'otpVerification' || !this.state.phone) return;
    const parsed = otpFormSchema.safeParse({ otp });
    if (!parsed.success) {
      this.set({ ...this.state, message: 'Enter the four-digit verification code.' });
      return;
    }
    const previous = this.state;
    const phone = this.state.phone;
    const generation = this.generation;
    this.set({ ...previous, status: 'verifyingOtp', message: undefined, errorDetails: undefined });
    try {
      if (!await this.online()) throw new ApiFailure('offline');
      const registrationToken = await this.api.verifyRegistrationOtp(phone, parsed.data.otp);
      if (generation === this.generation) {
        await this.store.saveRegistrationSession({
          phone,
          registrationToken,
          expiresAt: new Date(this.now() + 15 * 60 * 1000).toISOString(),
        }).catch(() => {});

        this.set({
          status: 'registrationDetails',
          authMode: 'register',
          phone,
          registrationToken,
          errorDetails: undefined,
          message: undefined,
        });
      }
    } catch (error) {
      if (generation === this.generation) {
        this.set({
          ...previous,
          status: 'otpVerification',
          message: friendlyError(error),
          errorDetails: toApiFailure(error, '/patient-portal/otp/verify', 'POST'),
        });
      }
    }
  }
  async registerPatient(values: RegistrationFormValues) {
    if (this.state.status !== 'registrationDetails' || !this.state.phone || !this.state.registrationToken) return;
    const parsed = registrationFormSchema.safeParse(values);
    if (!parsed.success) {
      this.set({ ...this.state, message: parsed.error.issues[0]?.message ?? 'Invalid registration details.' });
      return;
    }
    const previous = this.state;
    const phone = this.state.phone;
    const registrationToken = this.state.registrationToken;
    const generation = this.generation;
    this.set({ ...previous, status: 'registering', message: undefined, errorDetails: undefined });
    try {
      if (!await this.online()) throw new ApiFailure('offline');

      const names = parsed.data.fullName.trim().split(/\s+/);
      const firstName = names[0] || parsed.data.fullName.trim();
      const lastName = names.slice(1).join(' ') || '.';

      const result = await this.api.signup({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone,
        registrationToken,
        platform: this.device.platform,
        appVersion: this.device.appVersion,
        selfProfile: {
          firstName,
          lastName,
          dateOfBirth: parsed.data.dateOfBirth,
          gender: parsed.data.gender,
          preferredBranchId: parsed.data.preferredBranchId,
          bloodGroup: parsed.data.bloodGroup || null,
          address: {
            line1: parsed.data.line1 || null,
            city: parsed.data.city || null,
            state: parsed.data.state || null,
            postalCode: parsed.data.postalCode || null,
          },
        },
      });
      if (generation !== this.generation) {
        await this.revokeQuietly(result.tokens.refreshToken);
        return;
      }

      await this.store.clearRegistrationSession().catch(() => {});
      await this.accept(result, generation);
    } catch (error) {
      if (generation === this.generation) {
        const isInvalidToken =
          error instanceof ApiFailure &&
          (error.status === 401 ||
            error.code === 'INVALID_REGISTRATION_TOKEN' ||
            error.message?.includes('registration session is invalid or has expired'));

        if (isInvalidToken) {
          await this.store.clearRegistrationSession().catch(() => {});
          this.set({
            ...previous,
            status: 'registrationDetails',
            registrationToken: undefined,
            message: 'The registration session is invalid or has expired. Please verify your mobile number again.',
            errorDetails: toApiFailure(error, '/patient-portal/signup', 'POST'),
          });
          return;
        }

        this.set({
          ...previous,
          status: 'registrationDetails',
          message: friendlyError(error),
          errorDetails: toApiFailure(error, '/patient-portal/signup', 'POST'),
        });
      }
    }
  }
  cancelRegistration() {
    this.store.clearRegistrationSession().catch(() => {});
    this.set({
      status: 'unauthenticated',
      authMode: 'login',
      phone: this.state.phone,
      registrationToken: undefined,
      message: undefined,
      errorDetails: undefined,
    });
  }
  async getPublicBranches() {
    return this.api.getPublicBranches();
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
      if (
        error instanceof ApiFailure &&
        (error.kind === 'auth' || error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        await this.invalidate();
        return null;
      }
      if (
        error instanceof ApiFailure &&
        (error.kind === 'network' ||
          error.kind === 'offline' ||
          error.category === 'TIMEOUT' ||
          error.category === 'NETWORK_ERROR' ||
          error.code === 'TIMEOUT' ||
          error.code === 'NETWORK_ERROR' ||
          error.status === 429 ||
          error.status === 502 ||
          error.status === 503 ||
          error.status === 504 ||
          (typeof error.status === 'number' && error.status >= 500 && error.status <= 504))
      ) {
        try {
          await this.store.save(saved);
          this.saved = saved;
          this.set({
            status: 'error',
            recovery: 'restore',
            message: friendlyError(error),
            errorDetails: error,
          });
        } catch {
          this.storageError();
        }
        return null;
      }
      this.saved = { ...pending, status: 'uncertain' };
      try {
        await this.store.save(this.saved);
        this.uncertain();
      } catch {
        this.storageError();
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
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string | number | boolean | undefined | null>;
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
  async authenticatedMultipartRequest<T>(path: string, schema: z.ZodType<T>, formData: FormData): Promise<T> {
    const token = await this.accessToken();
    if (!token) throw new ApiFailure('auth');
    const generation = this.generation;
    try {
      const result = await this.transport.uploadMultipart(path, schema, formData, { accessToken: token });
      if (generation !== this.generation) throw new ApiFailure('auth');
      return result;
    } catch (error) {
      if (generation === this.generation && error instanceof ApiFailure && error.status === 401) await this.invalidate();
      throw error;
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
      : 'Signed out on this device. The server could not be reached to confirm session revocation.', errorDetails: undefined });
  }
  private async revokeQuietly(proof: string): Promise<boolean> {
    try { if (!await this.online()) return false; await this.api.logout(proof); return true; } catch { return false; }
  }
  private async invalidate() {
    ++this.generation; this.saved = null; this.access = undefined;
    try { await this.store.clear();
      this.set({ status: 'unauthenticated', message: 'Your session has expired. Please sign in again.', errorDetails: undefined });
    } catch { this.storageError(); }
  }
}
