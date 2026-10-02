import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { buildApp } from '../src/app.js';
import { seedDatabase } from '../src/database/seed.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Role Soft Delete & Partial Unique Index', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const adminUserId = createObjectId();
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    await BranchModel.create([
      { _id: new Types.ObjectId(createObjectId()), name: 'Main Branch', code: 'MB01', status: 'ACTIVE' },
      { _id: new Types.ObjectId(createObjectId()), name: 'Secondary Branch', code: 'SB01', status: 'ACTIVE' },
    ]);
    await seedDatabase();

    // Ensure RoleModel indexes are synced in test db
    await RoleModel.syncIndexes();

    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' }).lean();
    const passwordHash = await hashPassword('Admin123!');
    await UserModel.create({
      _id: new Types.ObjectId(adminUserId),
      username: 'role_test_admin',
      email: 'role.test.admin@test.local',
      passwordHash,
      fullName: 'Role Test Admin',
      roleIds: superAdminRole ? [superAdminRole._id] : [],
      status: 'active',
    });

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    adminToken = signJwt(
      { sub: adminUserId, username: 'role_test_admin' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  it('allows creating a role, rejects duplicate active role, and allows re-creating after soft-delete', async () => {
    // 1. Create Role "Dental Receptionist"
    const createRes1 = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'DENTAL_RECEPTIONIST',
        name: 'Dental Receptionist',
        status: 'active',
        type: 'custom',
        color: '#2563eb',
      },
    });
    expect(createRes1.statusCode).toBe(201);
    const createdRole1 = createRes1.json().data;
    expect(createdRole1.code).toBe('DENTAL_RECEPTIONIST');
    expect(createdRole1.name).toBe('Dental Receptionist');

    // 2. Attempt duplicate active role -> should fail 409
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'DENTAL_RECEPTIONIST',
        name: 'Dental Receptionist',
        status: 'active',
        type: 'custom',
      },
    });
    expect(dupRes.statusCode).toBe(409);

    // 3. Deactivate first (soft delete requires inactive role)
    const deactRes = await app.inject({
      method: 'PATCH',
      url: `/api/roles/${createdRole1.id}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'inactive' },
    });
    expect(deactRes.statusCode).toBe(200);

    // Soft delete the role
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/roles/${createdRole1.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    // Verify it is marked deleted in DB
    const deletedInDb = await RoleModel.findById(createdRole1.id).lean();
    expect(deletedInDb?.deletedAt).not.toBeNull();

    // 4. Re-create role with the exact same code / name -> should succeed!
    const createRes2 = await app.inject({
      method: 'POST',
      url: '/api/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        code: 'DENTAL_RECEPTIONIST',
        name: 'Dental Receptionist',
        status: 'active',
        type: 'custom',
        color: '#16a34a',
      },
    });
    expect(createRes2.statusCode).toBe(201);
    const createdRole2 = createRes2.json().data;
    expect(createdRole2.code).toBe('DENTAL_RECEPTIONIST');
    expect(createdRole2.id).not.toBe(createdRole1.id);
  });
});
