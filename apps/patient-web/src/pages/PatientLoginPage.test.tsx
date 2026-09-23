import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api-error';
import { authApi } from '../auth/auth-api';
import { PatientLoginPage } from './PatientLoginPage';

const auth = vi.hoisted(() => ({
  status: 'unauthenticated', user: null, authError: null,
  clearAuthError: vi.fn(), loginWithOtp: vi.fn(),
}));
vi.mock('../auth/useAuth', () => ({ useAuth: () => auth }));

describe('patient login OTP request sequence', () => {
  let container: HTMLDivElement;
  let root: Root;

  const input = async (name: string, value: string) => {
    const field = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (!field) throw new Error(`Missing ${name} field`);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const submit = async () => {
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  };

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    vi.spyOn(authApi, 'requestOtp').mockResolvedValue({ success: true, resendAvailableAt: new Date(Date.now() + 60_000).toISOString() });
    auth.loginWithOtp.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<StrictMode><PatientLoginPage /></StrictMode>));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests once on Continue, never on mount/countdown/Verify, including StrictMode', async () => {
    expect(authApi.requestOtp).not.toHaveBeenCalled();
    await input('phone', '9999988888');
    await submit();
    expect(authApi.requestOtp).toHaveBeenCalledExactlyOnceWith('9999988888');
    await act(async () => vi.advanceTimersByTime(10_000));
    await input('otp', '4821');
    await submit();
    expect(auth.loginWithOtp).toHaveBeenCalledExactlyOnceWith('9999988888', '4821');
    expect(authApi.requestOtp).toHaveBeenCalledTimes(1);
  });

  it('does not generate another code after invalid verification; resends only on user action', async () => {
    auth.loginWithOtp.mockRejectedValue(new ApiError('The verification code is invalid or has expired', 401, 'INVALID_OTP'));
    await input('phone', '9999988888');
    await submit();
    await input('otp', '1234');
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('invalid or has expired');
    expect(authApi.requestOtp).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(60_000));
    const resend = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Resend code');
    expect(resend?.disabled).toBe(false);
    await act(async () => resend?.click());
    expect(authApi.requestOtp).toHaveBeenCalledTimes(2);
  });

  it('shows delivery configuration failure without offering verification of an unsent code', async () => {
    vi.mocked(authApi.requestOtp).mockRejectedValue(new ApiError('SMS verification is temporarily unavailable.', 503, 'SMS_NOT_CONFIGURED'));
    await input('phone', '9999988888');
    await submit();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('temporarily unavailable');
    expect(container.querySelector('input[name="otp"]')).toBeNull();
    expect(auth.loginWithOtp).not.toHaveBeenCalled();
  });
});
