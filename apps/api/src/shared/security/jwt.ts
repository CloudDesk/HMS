import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../errors/app-error.js';

type JwtHeader = {
  alg: 'HS256';
  typ: 'JWT';
};

export type JwtPayload = {
  sub: string;
  username: string;
  iat: number;
  exp: number;
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

const decode = <T>(value: string): T => JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;

const sign = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('base64url');

export const signJwt = (
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds: number,
) => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header: JwtHeader = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const body: JwtPayload = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds,
  };
  const unsignedToken = `${encode(header)}.${encode(body)}`;
  const signature = sign(unsignedToken, secret);

  return `${unsignedToken}.${signature}`;
};

export const verifyJwt = (token: string, secret: string): JwtPayload => {
  const [encodedHeader, encodedPayload, signature] = token.split('.');

  if (!encodedHeader || !encodedPayload || !signature) {
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
  const received = Buffer.from(signature, 'base64url');
  const expected = Buffer.from(expectedSignature, 'base64url');

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  const header = decode<JwtHeader>(encodedHeader);

  if (header.alg !== 'HS256') {
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  const payload = decode<JwtPayload>(encodedPayload);

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }

  return payload;
};
