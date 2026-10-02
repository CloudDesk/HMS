import type { FastifyReply } from 'fastify';
import { env } from '../../config/env.js';

export const REFRESH_COOKIE_NAME = 'hms-refresh-token';
const REFRESH_COOKIE_PATH = '/api/auth';
export const PATIENT_REFRESH_COOKIE_NAME = 'hms-patient-refresh-token';
const PATIENT_REFRESH_COOKIE_PATH = '/api/patient-portal/auth';

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

const cookieScope = (path: string) => ({
  path,
  ...(env.auth.cookie.domain ? { domain: env.auth.cookie.domain } : {}),
});

const setSessionCookie = (
  reply: FastifyReply,
  name: string,
  path: string,
  refreshToken: string,
) => {
  reply.setCookie(name, refreshToken, {
    ...cookieScope(path),
    httpOnly: true,
    secure: env.auth.cookie.secure,
    sameSite: env.auth.cookie.sameSite,
    maxAge: env.auth.refreshTokenTtlSeconds,
  });
};

const clearSessionCookie = (reply: FastifyReply, name: string, path: string) => {
  reply.clearCookie(name, {
    ...cookieScope(path),
    httpOnly: true,
    secure: env.auth.cookie.secure,
    sameSite: env.auth.cookie.sameSite,
  });
};

export const setRefreshSessionCookie = (reply: FastifyReply, refreshToken: string) => {
  setSessionCookie(reply, REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, refreshToken);
};

export const clearRefreshSessionCookie = (reply: FastifyReply) => {
  clearSessionCookie(reply, REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH);
};

export const setPatientRefreshSessionCookie = (
  reply: FastifyReply,
  refreshToken: string,
) => {
  setSessionCookie(
    reply,
    PATIENT_REFRESH_COOKIE_NAME,
    PATIENT_REFRESH_COOKIE_PATH,
    refreshToken,
  );
};

export const clearPatientRefreshSessionCookie = (reply: FastifyReply) => {
  clearSessionCookie(reply, PATIENT_REFRESH_COOKIE_NAME, PATIENT_REFRESH_COOKIE_PATH);
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

export const establishPatientRefreshSession = <TUser>(
  reply: FastifyReply,
  session: IssuedAuthSession<TUser>,
) => {
  setPatientRefreshSessionCookie(reply, session.tokens.refreshToken);
  return {
    user: session.user,
    tokens: {
      accessToken: session.tokens.accessToken,
      tokenType: session.tokens.tokenType,
      expiresIn: session.tokens.expiresIn,
    },
  };
};
