import type { FastifyReply } from 'fastify';
import { env } from '../../config/env.js';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export const setRefreshTokenCookie = (
  reply: FastifyReply,
  refreshToken: string,
  expiresInSeconds: number,
) => {
  reply.setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.app.environment === 'prod',
    sameSite: 'lax',
    path: '/',
    maxAge: expiresInSeconds,
  });
};

export const clearRefreshTokenCookie = (reply: FastifyReply) => {
  reply.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    path: '/',
  });
};
