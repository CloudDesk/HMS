import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from './auth-api';
import { appConfig } from '../config';

describe('authApi Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests OTP with phone number', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            success: true,
            resendAvailableAt: '2026-08-25T15:30:00.000Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const result = await authApi.requestOtp('+919876543210');

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `${appConfig.apiBaseUrl}/patient-portal/otp/request`
    );
    expect(
      JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
    ).toEqual({
      phone: '+919876543210',
    });
    expect(result.success).toBe(true);
    expect(result.resendAvailableAt).toBe('2026-08-25T15:30:00.000Z');
  });

  it('verifies OTP and receives registration token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            success: true,
            registrationToken: 'reg-token-123',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const result = await authApi.verifyOtp('+919876543210', '1234');

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `${appConfig.apiBaseUrl}/patient-portal/otp/verify`
    );
    expect(
      JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
    ).toEqual({
      phone: '+919876543210',
      otp: '1234',
    });
    expect(result.registrationToken).toBe('reg-token-123');
  });

  it('performs atomic patient signup returning authenticated session', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            user: {
              id: 'usr-2',
              username: '+919876543210',
              email: 'new@example.com',
              fullName: 'New Patient',
              status: 'active',
              roles: [{ id: 'role-1', code: 'PATIENT', name: 'Patient' }],
            },
            tokens: {
              accessToken: 'new-user-jwt',
              expiresIn: 900,
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const signupData = {
      account_type: 'PATIENT' as const,
      phone: '+919876543210',
      registration_token: 'reg-token-999',
      full_name: 'New Patient',
      email: 'new@example.com',
    };

    const result = await authApi.signup(signupData);

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `${appConfig.apiBaseUrl}/patient-portal/signup`
    );
    expect(
      JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)
    ).toEqual(signupData);
    expect(result.user.fullName).toBe('New Patient');
    expect(result.tokens.accessToken).toBe('new-user-jwt');
  });
});
