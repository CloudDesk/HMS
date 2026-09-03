import { describe, expect, it } from 'vitest';
import { parseCorsOrigins, resolveAllowedCorsOrigins } from './env.js';

describe('CORS configuration security', () => {
  it('accepts explicitly configured allowed origins', () => {
    const origins = parseCorsOrigins('http://example.com, https://app.example.com');
    const resolved = resolveAllowedCorsOrigins(origins);

    expect(resolved).toContain('http://example.com');
    expect(resolved).toContain('https://app.example.com');
    expect(resolved).toContain('http://localhost:5173');
  });

  it('filters out wildcard origin from credentialed origins list', () => {
    const origins = parseCorsOrigins('*');
    const resolved = resolveAllowedCorsOrigins(origins);

    expect(resolved).not.toContain('*');
    expect(resolved.every((origin) => origin !== '*')).toBe(true);
  });

  it('ensures wildcard configuration cannot result in credentialed arbitrary-origin access', () => {
    const userOrigins = parseCorsOrigins('*, http://trusted.domain.com');
    const resolved = resolveAllowedCorsOrigins(userOrigins);

    expect(resolved).toContain('http://trusted.domain.com');
    expect(resolved).not.toContain('*');
  });
});
