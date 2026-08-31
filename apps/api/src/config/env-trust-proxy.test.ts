import { describe, expect, it } from 'vitest';
import { parseTrustProxy } from './env.js';

describe('trusted proxy configuration', () => {
  it('disables forwarding-header trust by default', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('accepts explicit trusted proxy addresses and CIDR ranges', () => {
    expect(parseTrustProxy('127.0.0.1, 10.0.0.0/8, loopback')).toEqual([
      '127.0.0.1',
      '10.0.0.0/8',
      'loopback',
    ]);
  });

  it('rejects unrestricted or malformed proxy trust', () => {
    expect(() => parseTrustProxy('true')).toThrow(/unrestricted proxy trust/i);
    expect(() => parseTrustProxy('not-a-proxy')).toThrow(/invalid proxy/i);
    expect(() => parseTrustProxy('192.0.2.1/99')).toThrow(/invalid proxy/i);
  });
});
