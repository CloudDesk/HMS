// Side-effect import required so @fastify/cookie's module augmentation of
// FastifyRequest.cookies and FastifyReply.setCookie/clearCookie is in scope.
import '@fastify/cookie';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import {
  changePasswordBodySchema,
  loginBodySchema,
  logoutBodySchema,
  passwordResetConfirmBodySchema,
  passwordResetRequestBodySchema,
  refreshBodySchema,
} from './auth.schemas.js';

// ---------------------------------------------------------------------------
// Cookie constants
// ---------------------------------------------------------------------------

/** Name of the HttpOnly refresh-token cookie. */
const REFRESH_COOKIE_NAME = 'hms-refresh-token';

/**
 * Restrict the cookie to authentication endpoints only so it is not sent to
 * /api/patients, /api/billing, etc.
 */
const REFRESH_COOKIE_PATH = '/api/auth';

/**
 * Returns the options object used when setting the refresh-token cookie.
 * All security attributes are derived from environment configuration.
 */
const refreshCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: env.auth.cookie.secure,
  sameSite: env.auth.cookie.sameSite,
  path: REFRESH_COOKIE_PATH,
  maxAge,
  // Only set domain when explicitly configured; omitting it keeps the cookie
  // scoped to the exact host, which is more restrictive.
  ...(env.auth.cookie.domain ? { domain: env.auth.cookie.domain } : {}),
});

/**
 * Options used when clearing the cookie. The path/domain MUST match the
 * options used when the cookie was set; otherwise browsers will not delete it.
 */
const clearCookieOptions = () => ({
  path: REFRESH_COOKIE_PATH,
  ...(env.auth.cookie.domain ? { domain: env.auth.cookie.domain } : {}),
});

// ---------------------------------------------------------------------------
// Route body types
// ---------------------------------------------------------------------------

type LoginBody = {
  identifier: string;
  password: string;
};

// Refresh body is intentionally empty — the token comes from the HttpOnly cookie.
type RefreshBody = Record<string, never>;

// Logout body retained as empty; the refresh token comes from the HttpOnly cookie.
type LogoutBody = Record<string, never>;

type ChangePasswordBody = {
  currentPassword: string;
  newPassword: string;
};

type PasswordResetRequestBody = {
  identifier: string;
};

type PasswordResetConfirmBody = {
  resetToken: string;
  newPassword: string;
};

const metadataFromRequest = (request: FastifyRequest) => ({
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export const registerAuthRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  /**
   * POST /api/auth/login
   *
   * Authenticates the user. On success:
   * - Sets an HttpOnly refresh-token cookie (not exposed to JavaScript).
   * - Returns the access token and user in the response body.
   *   `refreshToken` and `refreshExpiresIn` are intentionally omitted from
   *   the JSON body to prevent XSS-based exfiltration.
   */
  app.post<{ Body: LoginBody }>(
    '/api/auth/login',
    {
      schema: {
        body: loginBodySchema,
      },
    },
    async (request, reply) => {
      const session = await services.auth.login(request.body, metadataFromRequest(request));

      // Set the refresh token in an HttpOnly cookie — not readable by JavaScript.
      reply.setCookie(
        REFRESH_COOKIE_NAME,
        session.tokens.refreshToken,
        refreshCookieOptions(env.auth.refreshTokenTtlSeconds),
      );

      // Strip refreshToken and refreshExpiresIn from the response body so they
      // are never exposed to frontend JavaScript.
      const safeTokens = {
        accessToken: session.tokens.accessToken,
        tokenType: session.tokens.tokenType,
        expiresIn: session.tokens.expiresIn,
      };

      return ok({ user: session.user, tokens: safeTokens });
    },
  );

  /**
   * POST /api/auth/refresh
   *
   * Rotates the session. The browser supplies the refresh token automatically
   * via the HttpOnly cookie. No body is expected from the client.
   *
   * On success:
   * - Existing refresh token is revoked (rotation already implemented in service).
   * - New refresh token is placed in the replacement HttpOnly cookie.
   * - New access token is returned in the response body only.
   */
  app.post<{ Body: RefreshBody }>(
    '/api/auth/refresh',
    {
      schema: {
        body: refreshBodySchema,
      },
    },
    async (request, reply) => {
      const cookieToken = request.cookies[REFRESH_COOKIE_NAME];

      if (!cookieToken) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      const session = await services.auth.refresh(
        { refreshToken: cookieToken },
        metadataFromRequest(request),
      );

      // Replace the cookie with the newly rotated refresh token.
      reply.setCookie(
        REFRESH_COOKIE_NAME,
        session.tokens.refreshToken,
        refreshCookieOptions(env.auth.refreshTokenTtlSeconds),
      );

      // Strip refresh token fields from the response body.
      const safeTokens = {
        accessToken: session.tokens.accessToken,
        tokenType: session.tokens.tokenType,
        expiresIn: session.tokens.expiresIn,
      };

      return ok({ user: session.user, tokens: safeTokens });
    },
  );

  /**
   * POST /api/auth/logout
   *
   * Revokes the staff session. The refresh token is read from the HttpOnly
   * cookie. The cookie is then cleared from the browser.
   */
  app.post<{ Body: LogoutBody }>(
    '/api/auth/logout',
    {
      preHandler: authenticate(services),
      schema: {
        body: logoutBodySchema,
      },
    },
    async (request, reply) => {
      const cookieToken = request.cookies[REFRESH_COOKIE_NAME];

      await services.auth.logout(
        request.user!.id,
        cookieToken,
        metadataFromRequest(request),
      );

      // Clear the cookie. Path and domain MUST match what was used when setting
      // the cookie, otherwise the browser will not remove it.
      reply.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions());

      return ok({ ok: true });
    },
  );

  app.get(
    '/api/auth/me',
    {
      preHandler: authenticate(services),
    },
    async (request) => ok(await services.auth.getCurrentUser(request.user!.id)),
  );

  app.get(
    '/api/auth/password-policy',
    {
      preHandler: authenticate(services),
    },
    async () => ok(services.auth.getPasswordPolicy()),
  );

  app.post<{ Body: ChangePasswordBody }>(
    '/api/auth/change-password',
    {
      preHandler: authenticate(services),
      schema: {
        body: changePasswordBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.auth.changePassword(
          {
            userId: request.user!.id,
            currentPassword: request.body.currentPassword,
            newPassword: request.body.newPassword,
          },
          metadataFromRequest(request),
        ),
      ),
  );

  app.post<{ Body: PasswordResetRequestBody }>(
    '/api/auth/password-reset/request',
    {
      schema: {
        body: passwordResetRequestBodySchema,
      },
    },
    async (request) =>
      ok(await services.auth.requestPasswordReset(request.body, metadataFromRequest(request))),
  );

  app.post<{ Body: PasswordResetConfirmBody }>(
    '/api/auth/password-reset/confirm',
    {
      schema: {
        body: passwordResetConfirmBodySchema,
      },
    },
    async (request) =>
      ok(await services.auth.confirmPasswordReset(request.body, metadataFromRequest(request))),
  );
};
