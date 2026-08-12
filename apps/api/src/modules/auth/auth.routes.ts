import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
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

type LoginBody = {
  identifier: string;
  password: string;
};

type RefreshBody = {
  refreshToken: string;
};

type LogoutBody = {
  refreshToken?: string;
};

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

export const registerAuthRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  app.post<{ Body: LoginBody }>(
    '/api/auth/login',
    {
      schema: {
        body: loginBodySchema,
      },
    },
    async (request) => ok(await services.auth.login(request.body, metadataFromRequest(request))),
  );

  app.post<{ Body: RefreshBody }>(
    '/api/auth/refresh',
    {
      schema: {
        body: refreshBodySchema,
      },
    },
    async (request) => ok(await services.auth.refresh(request.body, metadataFromRequest(request))),
  );

  app.post<{ Body: LogoutBody }>(
    '/api/auth/logout',
    {
      preHandler: authenticate(services),
      schema: {
        body: logoutBodySchema,
      },
    },
    async (request) =>
      ok(
        await services.auth.logout(
          request.user!.id,
          request.body.refreshToken,
          metadataFromRequest(request),
        ),
      ),
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
