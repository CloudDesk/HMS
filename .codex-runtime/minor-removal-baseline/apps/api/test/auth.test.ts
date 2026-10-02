import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { assertRefreshCookieConfiguration } from '../src/config/env.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { hashPassword } from '../src/shared/security/hash.js';

const username = 'auth_test_user';
const password = 'Testpassword1';

const cookieHeader = (header: string | string[] | undefined) => {
  const values = Array.isArray(header) ? header : header ? [header] : [];
  return values.find((value) => value.startsWith('hms-refresh-token=')) ?? '';
};

const requestCookie = (header: string | string[] | undefined) => cookieHeader(header).split(';')[0] ?? '';

describe('shared authentication refresh-cookie lifecycle', () => {
  let mongodb: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create();
    await mongoose.connect(mongodb.getUri());
    ({ app } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongodb.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await UserModel.create({
      username,
      email: 'auth_test@hms.local',
      fullName: 'Auth Test User',
      passwordHash: await hashPassword(password),
      status: 'active',
      roleIds: [],
      branchIds: [],
      departmentIds: [],
      failedLoginAttempts: 0,
    });
  });

  const login = () => app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { identifier: username, password },
  });

  it('sets a scoped HttpOnly cookie and returns no refresh token', async () => {
    const response = await login();
    const cookie = cookieHeader(response.headers['set-cookie']).toLowerCase();

    expect(response.statusCode).toBe(200);
    expect(cookie).toContain('httponly');
    expect(cookie).toContain('path=/api/auth');
    expect(cookie).toContain('samesite=lax');
    expect(response.body).not.toContain('refreshToken');
    expect(response.body).not.toContain('refreshExpiresIn');
  });

  it('rotates the cookie from an empty refresh request body', async () => {
    const loginResponse = await login();
    const originalCookie = requestCookie(loginResponse.headers['set-cookie']);
    const refreshed = await app.inject({
      method: 'POST', url: '/api/auth/refresh', headers: { cookie: originalCookie }, payload: {},
    });

    expect(refreshed.statusCode).toBe(200);
    expect(requestCookie(refreshed.headers['set-cookie'])).not.toBe(originalCookie);
    expect(refreshed.body).not.toContain('refreshToken');

    const reuse = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie: originalCookie }, payload: {} });
    expect(reuse.statusCode).toBe(401);
  });

  it('revokes the session and clears the cookie on logout', async () => {
    const loginResponse = await login();
    const body = loginResponse.json<{ data: { tokens: { accessToken: string } } }>();
    const cookie = requestCookie(loginResponse.headers['set-cookie']);
    const logout = await app.inject({
      method: 'POST', url: '/api/auth/logout',
      headers: { authorization: `Bearer ${body.data.tokens.accessToken}`, cookie }, payload: {},
    });

    expect(logout.statusCode).toBe(200);
    expect(cookieHeader(logout.headers['set-cookie']).toLowerCase()).toContain('max-age=0');
    const refresh = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: { cookie }, payload: {} });
    expect(refresh.statusCode).toBe(401);
  });

  it('rejects insecure production and SameSite=None cookie configuration', () => {
    expect(() => assertRefreshCookieConfiguration({
      production: true, secure: false, sameSite: 'lax',
    })).toThrow('COOKIE_SECURE must be enabled in production');
    expect(() => assertRefreshCookieConfiguration({
      production: false, secure: false, sameSite: 'none',
    })).toThrow('COOKIE_SECURE must be enabled when COOKIE_SAME_SITE is none');
  });
});
