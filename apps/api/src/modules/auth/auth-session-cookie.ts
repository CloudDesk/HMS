import type { FastifyReply } from 'fastify';
import { env } from '../../config/env.js';

export const REFRESH_COOKIE_NAME = 'hms-refresh-token';
const REFRESH_COOKIE_PATH = '/api/auth';

type IssuedAuthSession<TUser> = {
  user: TUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
    refreshExpiresIn: number;
  };
};

const cookieScope = () => ({
  path: REFRESH_COOKIE_PATH,
  ...(env.auth.cookie.domain ? { domain: env.auth.cookie.domain } : {}),
});

export const setRefreshSessionCookie = (reply: FastifyReply, refreshToken: string) => {
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...cookieScope(),
    httpOnly: true,
    secure: env.auth.cookie.secure,
    sameSite: env.auth.cookie.sameSite,
    maxAge: env.auth.refreshTokenTtlSeconds,
  });
};

export const clearRefreshSessionCookie = (reply: FastifyReply) => {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    ...cookieScope(),
    httpOnly: true,
    secure: env.auth.cookie.secure,
    sameSite: env.auth.cookie.sameSite,
  });
};

export const establishRefreshSession = <TUser>(
  reply: FastifyReply,
  session: IssuedAuthSession<TUser>,
) => {
  setRefreshSessionCookie(reply, session.tokens.refreshToken);
  return {
    user: session.user,
    tokens: {
      accessToken: session.tokens.accessToken,
      tokenType: session.tokens.tokenType,
      expiresIn: session.tokens.expiresIn,
    },
  };
};
