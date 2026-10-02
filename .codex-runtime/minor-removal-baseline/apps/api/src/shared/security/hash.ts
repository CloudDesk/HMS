import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString('base64url');
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

  return ['scrypt', salt, derivedKey.toString('base64url')].join('$');
};

export const verifyPassword = async (password: string, passwordHash: string) => {
  const [algorithm, salt, storedHash] = passwordHash.split('$');

  if (algorithm !== 'scrypt' || !salt || !storedHash) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;
  const storedKey = Buffer.from(storedHash, 'base64url');

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
};
