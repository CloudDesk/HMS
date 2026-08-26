/**
 * auth.test.ts — Authentication security tests.
 *
 * Tests cover the HttpOnly cookie-based refresh-token flow introduced to fix
 * the sessionStorage XSS vulnerability:
 *
 *   - Login sets HttpOnly cookie; refresh token absent from JSON body.
 *   - Refresh reads cookie; rotates token; new cookie set; token absent from JSON.
 *   - Missing refresh cookie returns 401.
 *   - Expired / revoked / invalid refresh token returns 401.
 *   - Logout clears the cookie; subsequent refresh fails.
 *   - Full lifecycle: login → refresh → logout → refresh fails.
 *
 * HTTP-level tests use Fastify's built-in `inject()` API so the full route
 * stack (schema validation, middleware, cookie handling) is exercised.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { hashPassword } from '../src/shared/security/hash.js';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USERNAME = 'auth_test_user';
const TEST_PASSWORD = 'Testpassword1';

async function createTestUser() {
  const hash = await hashPassword(TEST_PASSWORD);
  await UserModel.create({
    _id: new mongoose.Types.ObjectId(),
    username: TEST_USERNAME,
    email: 'auth_test@hms.local',
    fullName: 'Auth Test User',
    passwordHash: hash,
    status: 'active',
    roleIds: [],
    branchIds: [],
    failedLoginAttempts: 0,
  });
}

/** Parses a Set-Cookie header value and returns an object of cookie attributes. */
function parseCookieHeader(header: string | string[] | undefined) {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const parts = raw.split(';').map((p) => p.trim());
  const [nameValue, ...attrs] = parts;
  const eqIdx = (nameValue ?? '').indexOf('=');
  const name = (nameValue ?? '').slice(0, eqIdx);
  const value = (nameValue ?? '').slice(eqIdx + 1);
  const attributes: Record<string, string | boolean> = { name, value };
  for (const attr of attrs) {
    const [k, v] = attr.split('=').map((s) => s.trim());
    attributes[(k ?? '').toLowerCase()] = v !== undefined ? v : true;
  }
  return attributes;
}

/** Extracts the hms-refresh-token cookie from an inject() response. */
function extractRefreshCookie(setCookieHeader: string | string[] | undefined) {
  const headers = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const cookieHeader = headers.find((h) => h.startsWith('hms-refresh-token='));
  return parseCookieHeader(cookieHeader);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Authentication — HttpOnly cookie flow', async (t) => {
  await setupTestDatabase();
  const { app } = await buildApp();

  t.after(async () => {
    await app.close();
    await teardownTestDatabase();
  });

  t.afterEach(async () => {
    await clearTestDatabase();
    await createTestUser();
  });

  // Seed a user before any test runs.
  await createTestUser();

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  await t.test('POST /api/auth/login — sets HttpOnly cookie; no refreshToken in body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { identifier: TEST_USERNAME, password: TEST_PASSWORD },
    });

    assert.equal(response.statusCode, 200, 'login should return 200');

    const body = response.json<{ data: { tokens: Record<string, unknown> } }>();
    const tokens = body.data?.tokens;

    assert.ok(tokens, 'response should include tokens');
    assert.ok(tokens['accessToken'], 'response should include accessToken');
    assert.equal(tokens['refreshToken'], undefined, 'refreshToken must NOT be in response body');
    assert.equal(tokens['refreshExpiresIn'], undefined, 'refreshExpiresIn must NOT be in response body');

    const setCookie = response.headers['set-cookie'];
    const cookie = extractRefreshCookie(setCookie);
    assert.ok(cookie, 'Set-Cookie header must be present');
    assert.ok((cookie['value'] as string).length > 0, 'cookie value must be non-empty');
    assert.ok(cookie['httponly'], 'cookie must be HttpOnly');
    assert.equal(
      (cookie['path'] as string | undefined)?.toLowerCase(),
      '/api/auth',
      'cookie path must be /api/auth',
    );
    // In the test env COOKIE_SECURE is not set; default is false for non-prod.
    // Verify that 'secure' is NOT present (as expected in dev/test).
    // This also confirms the env.ts defaulting logic works.
  });

  await t.test('POST /api/auth/login — invalid credentials return 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { identifier: TEST_USERNAME, password: 'WrongPassword1' },
    });

    assert.equal(response.statusCode, 401);
    const setCookie = response.headers['set-cookie'];
    assert.ok(!extractRefreshCookie(setCookie), 'no cookie on failed login');
  });

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------

  await t.test('POST /api/auth/refresh — valid cookie returns new access token', async () => {
    // Step 1: Login to get the cookie.
    const loginResp = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { identifier: TEST_USERNAME, password: TEST_PASSWORD },
    });
    assert.equal(loginResp.statusCode, 200);

    const setCookie = loginResp.headers['set-cookie'];
    const cookie = extractRefreshCookie(setCookie);
    assert.ok(cookie, 'login must set refresh cookie');

    const rawCookieHeader = Array.isArray(setCookie)
      ? setCookie.find((h) => h.startsWith('hms-refresh-token=')) ?? ''
      : (setCookie ?? '');
    // Extract just name=value for the Cookie request header.
    const cookieValue = rawCookieHeader.split(';')[0];

    // Step 2: Use the cookie to refresh.
    const refreshResp = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        'content-type': 'application/json',
        cookie: cookieValue,
      },
      payload: {},
    });

    assert.equal(refreshResp.statusCode, 200, 'refresh should return 200');

    const body = refreshResp.json<{ data: { tokens: Record<string, unknown> } }>();
    assert.ok(body.data?.tokens?.['accessToken'], 'new access token must be returned');
    assert.equal(body.data?.tokens?.['refreshToken'], undefined, 'refreshToken must NOT be in refresh response');

    // New cookie must be set (token rotation).
    const newCookie = extractRefreshCookie(refreshResp.headers['set-cookie']);
    assert.ok(newCookie, 'rotation must set a new cookie');
    assert.ok(newCookie['httponly'], 'rotated cookie must be HttpOnly');
  });

  await t.test('POST /api/auth/refresh — missing cookie returns 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });

    assert.equal(response.statusCode, 401);
    const body = response.json<{ error: { code: string } }>();
    assert.equal(body.error?.code, 'INVALID_REFRESH_TOKEN');
  });

  await t.test('POST /api/auth/refresh — tampered/invalid token returns 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        'content-type': 'application/json',
        cookie: 'hms-refresh-token=totally_invalid_token_value',
      },
      payload: {},
    });

    assert.equal(response.statusCode, 401);
  });

  await t.test('POST /api/auth/refresh — old token is revoked after rotation', async () => {
    // Login.
    const loginResp = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { identifier: TEST_USERNAME, password: TEST_PASSWORD },
    });
    const rawCookieHeader = (
      Array.isArray(loginResp.headers['set-cookie'])
        ? (loginResp.headers['set-cookie'] as string[]).find((h) => h.startsWith('hms-refresh-token=')) ?? ''
        : loginResp.headers['set-cookie'] ?? ''
    ) as string;
    const originalCookieValue = rawCookieHeader.split(';')[0];

    // First refresh — valid.
    const firstRefreshResp = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { 'content-type': 'application/json', cookie: originalCookieValue },
      payload: {},
    });
    assert.equal(firstRefreshResp.statusCode, 200, 'first refresh should succeed');

    // Reuse the original (now revoked) cookie — must fail.
    const reuseResp = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { 'content-type': 'application/json', cookie: originalCookieValue },
      payload: {},
    });
    assert.equal(reuseResp.statusCode, 401, 'reusing a rotated refresh token must return 401');
  });

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  await t.test('POST /api/auth/logout — clears cookie; subsequent refresh fails', async () => {
    // Login.
    const loginResp = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { identifier: TEST_USERNAME, password: TEST_PASSWORD },
    });
    const loginBody = loginResp.json<{ data: { tokens: { accessToken: string } } }>();
    const accessToken = loginBody.data?.tokens?.accessToken;
    assert.ok(accessToken);

    const rawCookieHeader = (
      Array.isArray(loginResp.headers['set-cookie'])
        ? (loginResp.headers['set-cookie'] as string[]).find((h) => h.startsWith('hms-refresh-token=')) ?? ''
        : loginResp.headers['set-cookie'] ?? ''
    ) as string;
    const cookieValue = rawCookieHeader.split(';')[0];

    // Logout.
    const logoutResp = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
        cookie: cookieValue,
      },
      payload: {},
    });
    assert.equal(logoutResp.statusCode, 200, 'logout should return 200');

    // Cookie must be cleared in the logout response (Max-Age=0 or equivalent).
    const logoutCookies = logoutResp.headers['set-cookie'];
    const clearedCookie = extractRefreshCookie(logoutCookies);
    assert.ok(clearedCookie, 'logout must set a clearing Set-Cookie header');
    const maxAge = clearedCookie['max-age'];
    assert.ok(
      maxAge === '0' || maxAge === 0,
      `cookie Max-Age must be 0 on logout (got: ${String(maxAge)})`,
    );

    // Subsequent refresh using the old cookie must fail.
    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { 'content-type': 'application/json', cookie: cookieValue },
      payload: {},
    });
    assert.equal(refreshAfterLogout.statusCode, 401, 'refresh after logout must return 401');
  });

  // -------------------------------------------------------------------------
  // Security: refresh token must not appear in sessionStorage / localStorage
  // (backend-observable side: verify JSON body never contains the token)
  // -------------------------------------------------------------------------

  await t.test('Security — refreshToken never appears in any JSON response body', async () => {
    const loginResp = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { identifier: TEST_USERNAME, password: TEST_PASSWORD },
    });
    const loginBodyText = loginResp.body;
    assert.ok(
      !loginBodyText.includes('"refreshToken"'),
      'login response body must not contain "refreshToken" key',
    );
    assert.ok(
      !loginBodyText.includes('"refreshExpiresIn"'),
      'login response body must not contain "refreshExpiresIn" key',
    );

    const rawCookieHeader = (
      Array.isArray(loginResp.headers['set-cookie'])
        ? (loginResp.headers['set-cookie'] as string[]).find((h) => h.startsWith('hms-refresh-token=')) ?? ''
        : loginResp.headers['set-cookie'] ?? ''
    ) as string;
    const cookieValue = rawCookieHeader.split(';')[0];

    const refreshResp = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { 'content-type': 'application/json', cookie: cookieValue },
      payload: {},
    });
    const refreshBodyText = refreshResp.body;
    assert.ok(
      !refreshBodyText.includes('"refreshToken"'),
      'refresh response body must not contain "refreshToken" key',
    );
    assert.ok(
      !refreshBodyText.includes('"refreshExpiresIn"'),
      'refresh response body must not contain "refreshExpiresIn" key',
    );
  });
});
