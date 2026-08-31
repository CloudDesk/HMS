import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';

describe('M-006 public authentication route limits', () => {
  let mongodb: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create();
    await mongoose.connect(mongodb.getUri());
    ({ app } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongodb.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  it('enforces OTP resend cooldown at the public request endpoint', async () => {
    const payload = { phone: '+27821234567' };
    const first = await app.inject({ method: 'POST', url: '/api/patient-portal/otp/request', payload });
    const repeated = await app.inject({ method: 'POST', url: '/api/patient-portal/otp/request', payload });
    expect(first.statusCode).toBe(200);
    expect(repeated.statusCode).toBe(429);
    expect(repeated.json()).toMatchObject({ error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication requests. Try again later.' } });
  });

  it('enforces normalized-identity limits at the staff login endpoint', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { identifier: attempt % 2 ? ' MISSING@EXAMPLE.TEST ' : 'missing@example.test', password: 'wrong' } });
      expect(response.statusCode).toBe(401);
    }
    const limited = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { identifier: 'missing@example.test', password: 'wrong' } });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'AUTH_RATE_LIMITED' } });
  });

  it('does not allow spoofed forwarding headers to rotate the OTP rate-limit IP', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/patient-portal/otp/request',
        headers: { 'x-forwarded-for': `198.51.100.${attempt + 1}` },
        payload: { phone: `+2782100${String(attempt).padStart(4, '0')}` },
      });
      expect(response.statusCode).toBe(200);
    }

    const limited = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/otp/request',
      headers: { 'x-forwarded-for': '203.0.113.250' },
      payload: { phone: '+27821009999' },
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: 'AUTH_RATE_LIMITED' } });
  });
});
