import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/http/response.js';
import type { ServiceRegistry } from '../../shared/types/service-registry.js';
import { nativeLoginSchema, nativeLogoutSchema, nativeRefreshSchema, nativeSessionResponseSchema } from './native-auth.schemas.js';

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('Invalid native authentication request', 400, 'VALIDATION_ERROR');
  return result.data;
};

export const registerNativeAuthRoutes = async (app: FastifyInstance, services: ServiceRegistry) => {
  const prefix = '/api/patient-portal/mobile/auth';
  // Encapsulation limits cache headers and body limits to native credential endpoints.
  await app.register(async (native) => {
    native.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); });
    native.post(`${prefix}/login/otp`, { bodyLimit: 4096,
      schema: { response: { 200: nativeSessionResponseSchema } },
    }, async (request) => ok(
      await services.auth.nativeSessions.login(parse(nativeLoginSchema, request.body),
        { ipAddress: request.ip, userAgent: request.headers['user-agent'] }, services.auth, services.patientPortal),
    ));
    native.post(`${prefix}/refresh`, { bodyLimit: 4096,
      schema: { response: { 200: nativeSessionResponseSchema } },
    }, async (request) => ok(
      await services.auth.nativeSessions.refresh(parse(nativeRefreshSchema, request.body).refreshToken,
        { ipAddress: request.ip, userAgent: request.headers['user-agent'] }, services.auth),
    ));
    native.post(`${prefix}/logout`, { bodyLimit: 4096 }, async (request) => {
      const body = parse(nativeLogoutSchema, request.body ?? {});
      const header = request.headers.authorization;
      if (header && !header.startsWith('Bearer ')) throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
      return ok(await services.auth.nativeSessions.logout(body.refreshToken, header?.slice(7).trim(),
        { ipAddress: request.ip, userAgent: request.headers['user-agent'] }));
    });
  });
};
