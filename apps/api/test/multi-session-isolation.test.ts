import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { seedDatabase } from '../src/database/seed.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { RefreshTokenModel } from '../src/modules/auth/refresh-token.model.js';
import { sha256 } from '../src/shared/security/hash.js';

type RefreshTokenDocumentLean = {
  token: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedByTokenId?: Types.ObjectId | null;
};

describe('Multi-Session & Multi-Device Isolation', () => {
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
    const mbBranchId = new Types.ObjectId();
    const sbBranchId = new Types.ObjectId();

    await BranchModel.create([
      { _id: mbBranchId, name: 'Main Branch', status: 'ACTIVE', code: 'MB01' },
      { _id: sbBranchId, name: 'Secondary Branch', status: 'ACTIVE', code: 'SB01' },
    ]);

    await DepartmentModel.create([
      { name: 'Reception Department', code: 'RECP', branchIds: [mbBranchId, sbBranchId], status: 'ACTIVE' },
      { name: 'Nursing Department', code: 'NURS', branchIds: [mbBranchId, sbBranchId], status: 'ACTIVE' },
      { name: 'Pharmacy Department', code: 'PHAR', branchIds: [mbBranchId, sbBranchId], status: 'ACTIVE' },
      { name: 'Laboratory Department', code: 'LAB', branchIds: [mbBranchId, sbBranchId], status: 'ACTIVE' },
      { name: 'Imaging Radiology Department', code: 'RAD', branchIds: [mbBranchId, sbBranchId], status: 'ACTIVE' },
      { name: 'Billing Finance Department', code: 'BILL', branchIds: [mbBranchId, sbBranchId], status: 'ACTIVE' },
    ]);

    await seedDatabase();
  });

  const extractCookie = (setCookieHeader: string | string[] | undefined, cookieName: string): string => {
    const headers = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : typeof setCookieHeader === 'string'
        ? [setCookieHeader]
        : [];
    for (const header of headers) {
      const parts = header.split(';');
      for (const part of parts) {
        const [name, value] = part.trim().split('=');
        if (name === cookieName && value) {
          return decodeURIComponent(value);
        }
      }
    }
    return '';
  };

  it('A & B: Independent login from Device A and Device B creates isolated sessions for the same user', async () => {
    // Device A logs in as admin
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    expect(resA.statusCode).toBe(200);
    const tokenA = extractCookie(resA.headers['set-cookie'], 'hms-refresh-token');
    const accessA = resA.json().data.tokens.accessToken;
    expect(tokenA).toBeTruthy();
    expect(accessA).toBeTruthy();

    // Device B logs in as admin
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    expect(resB.statusCode).toBe(200);
    const tokenB = extractCookie(resB.headers['set-cookie'], 'hms-refresh-token');
    const accessB = resB.json().data.tokens.accessToken;
    expect(tokenB).toBeTruthy();
    expect(accessB).toBeTruthy();

    // Verify refresh tokens are completely distinct
    expect(tokenA).not.toBe(tokenB);
    expect(accessA).toBeTruthy();
    expect(accessB).toBeTruthy();

    // Verify both exist and are active in database
    const recordA = await RefreshTokenModel.findOne<RefreshTokenDocumentLean>({ token: sha256(tokenA) }).lean();
    const recordB = await RefreshTokenModel.findOne<RefreshTokenDocumentLean>({ token: sha256(tokenB) }).lean();
    expect(recordA).toBeTruthy();
    expect(recordB).toBeTruthy();
    expect(recordA?.revokedAt).toBeFalsy();
    expect(recordB?.revokedAt).toBeFalsy();
  });

  it('C & D: Device A logout does NOT invalidate Device B; Device B can still refresh and access routes', async () => {
    // Device A and B login
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    const tokenA = extractCookie(resA.headers['set-cookie'], 'hms-refresh-token');
    const accessA = resA.json().data.tokens.accessToken;

    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    const tokenB = extractCookie(resB.headers['set-cookie'], 'hms-refresh-token');
    const accessB = resB.json().data.tokens.accessToken;
    expect(accessB).toBeTruthy();

    // Device A logs out with cookie and bearer token
    const logoutA = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: `Bearer ${accessA}`,
        cookie: `hms-refresh-token=${encodeURIComponent(tokenA)}`,
      },
      payload: {},
    });
    expect(logoutA.statusCode).toBe(200);

    // Verify Device A session in DB is revoked
    const recordA = await RefreshTokenModel.findOne<RefreshTokenDocumentLean>({ token: sha256(tokenA) }).lean();
    expect(recordA?.revokedAt).toBeTruthy();

    // Verify Device B session in DB is STILL ACTIVE
    const recordB = await RefreshTokenModel.findOne<RefreshTokenDocumentLean>({ token: sha256(tokenB) }).lean();
    expect(recordB?.revokedAt).toBeFalsy();

    // Device B can refresh successfully
    const refreshB = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: {
        cookie: `hms-refresh-token=${encodeURIComponent(tokenB)}`,
      },
      payload: {},
    });
    expect(refreshB.statusCode).toBe(200);
    const newAccessB = refreshB.json().data.tokens.accessToken;
    expect(newAccessB).toBeTruthy();

    // Device B can use new access token to query /api/auth/me
    const meB = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${newAccessB}`,
      },
    });
    expect(meB.statusCode).toBe(200);
    expect(meB.json().data.username).toBe('admin');
  });

  it('E: Refreshing Device A does not change Device B session', async () => {
    // Both login
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    const tokenA = extractCookie(resA.headers['set-cookie'], 'hms-refresh-token');

    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    const tokenB = extractCookie(resB.headers['set-cookie'], 'hms-refresh-token');

    // Device A refreshes
    const refreshA = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: `hms-refresh-token=${encodeURIComponent(tokenA)}` },
      payload: {},
    });
    expect(refreshA.statusCode).toBe(200);
    const rotatedTokenA = extractCookie(refreshA.headers['set-cookie'], 'hms-refresh-token');
    expect(rotatedTokenA).toBeTruthy();
    expect(rotatedTokenA).not.toBe(tokenA);

    // Device B's original token is still valid and can also refresh
    const refreshB = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: `hms-refresh-token=${encodeURIComponent(tokenB)}` },
      payload: {},
    });
    expect(refreshB.statusCode).toBe(200);
    const rotatedTokenB = extractCookie(refreshB.headers['set-cookie'], 'hms-refresh-token');
    expect(rotatedTokenB).toBeTruthy();
    expect(rotatedTokenB).not.toBe(tokenB);
    expect(rotatedTokenB).not.toBe(rotatedTokenA);
  });

  it('F: Missing or invalid refresh token during logout does not revoke unrelated sessions', async () => {
    // Device A and B login
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    const accessA = resA.json().data.tokens.accessToken;

    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    const tokenB = extractCookie(resB.headers['set-cookie'], 'hms-refresh-token');

    // Device A logs out with valid bearer token but WITHOUT refresh cookie
    const logoutA = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${accessA}` },
      payload: {},
    });
    expect(logoutA.statusCode).toBe(200);

    // Device B's refresh token must still be valid
    const recordB = await RefreshTokenModel.findOne<RefreshTokenDocumentLean>({ token: sha256(tokenB) }).lean();
    expect(recordB?.revokedAt).toBeFalsy();

    const refreshB = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: `hms-refresh-token=${encodeURIComponent(tokenB)}` },
      payload: {},
    });
    expect(refreshB.statusCode).toBe(200);
  });

  it('G: Different users remain completely isolated across login, query, and logout', async () => {
    // Admin login
    const resAdmin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    const accessAdmin = resAdmin.json().data.tokens.accessToken;
    const tokenAdmin = extractCookie(resAdmin.headers['set-cookie'], 'hms-refresh-token');

    // Receptionist login
    const resRecept = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'receptionist', password: 'HmsPhase1Dev123!' },
    });
    const accessRecept = resRecept.json().data.tokens.accessToken;

    // Check profiles
    const meAdmin = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessAdmin}` },
    });
    expect(meAdmin.json().data.username).toBe('admin');

    const meRecept = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessRecept}` },
    });
    expect(meRecept.json().data.username).toBe('receptionist');

    // Admin logout
    await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: `Bearer ${accessAdmin}`,
        cookie: `hms-refresh-token=${encodeURIComponent(tokenAdmin)}`,
      },
      payload: {},
    });

    // Receptionist is still completely active
    const meReceptAfter = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessRecept}` },
    });
    expect(meReceptAfter.statusCode).toBe(200);
    expect(meReceptAfter.json().data.username).toBe('receptionist');
  });

  it('H: Interleaved concurrent requests verify no shared mutable global auth state exists', async () => {
    const resAdmin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'admin', password: 'Admin123!' },
    });
    const accessAdmin = resAdmin.json().data.tokens.accessToken;

    const resRecept = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'receptionist', password: 'HmsPhase1Dev123!' },
    });
    const accessRecept = resRecept.json().data.tokens.accessToken;

    // Concurrently fire 20 interleaved requests
    const promises = Array.from({ length: 20 }, (_, i) => {
      const isAdmin = i % 2 === 0;
      const token = isAdmin ? accessAdmin : accessRecept;
      const expectedUser = isAdmin ? 'admin' : 'receptionist';
      return app
        .inject({
          method: 'GET',
          url: '/api/auth/me',
          headers: { authorization: `Bearer ${token}` },
        })
        .then((res) => {
          expect(res.statusCode).toBe(200);
          expect(res.json().data.username).toBe(expectedUser);
        });
    });

    await Promise.all(promises);
  });
});
