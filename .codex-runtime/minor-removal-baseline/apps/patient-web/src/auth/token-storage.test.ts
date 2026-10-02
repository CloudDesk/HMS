// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStorage } from './token-storage';

describe('Token Storage Security & Lifecycle', () => {
  beforeEach(() => {
    tokenStorage.clear();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('stores and retrieves access tokens purely in-memory', () => {
    expect(tokenStorage.getAccessToken()).toBe(null);
    tokenStorage.setTokens({ accessToken: 'jwt-test-token-123', expiresIn: 300 });
    expect(tokenStorage.getAccessToken()).toBe('jwt-test-token-123');

    tokenStorage.clear();
    expect(tokenStorage.getAccessToken()).toBe(null);
  });

  it('never leaks tokens or credentials to sessionStorage or localStorage', () => {
    tokenStorage.setTokens({ accessToken: 'jwt-secret-token', expiresIn: 300 });

    expect(sessionStorage.getItem('access_token')).toBe(null);
    expect(sessionStorage.getItem('refresh_token')).toBe(null);
    expect(sessionStorage.getItem('token')).toBe(null);
    expect(localStorage.getItem('access_token')).toBe(null);
    expect(localStorage.getItem('token')).toBe(null);
  });

  it('calculates token expiration threshold correctly', () => {
    expect(tokenStorage.isAccessTokenExpired()).toBe(true);

    tokenStorage.setTokens({ accessToken: 'valid-token', expiresIn: 300 });
    expect(tokenStorage.isAccessTokenExpired()).toBe(false);

    tokenStorage.setTokens({ accessToken: 'expiring-token', expiresIn: 5 });
    expect(tokenStorage.isAccessTokenExpired(15_000)).toBe(true);
  });
});
