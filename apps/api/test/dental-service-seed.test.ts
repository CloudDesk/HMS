/**
 * Dental Service Catalogue Seed — Integration Tests
 *
 * Verifies that seedDentalServices():
 *  1. Inserts all expected dental service entries when a dental department exists.
 *  2. Is idempotent — second run skips already-inserted services.
 *  3. Handles missing dental department gracefully (no crash, no partial insert).
 *  4. Inserted services are retrievable via the Service Catalogue API
 *     (GET /api/services with service_type=PROCEDURE).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { buildApp } from '../src/app.js';
import { seedDatabase } from '../src/database/seed.js';
import { seedDentalServices } from '../src/database/seed-dental-services.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Dental Service Catalogue Seed', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const adminUserId = createObjectId();

  let adminToken: string;

  // Expected dental service codes from seed-dental-services.ts
  const expectedCodes = [
    'DENT-REST-COMPOSITE',
    'DENT-REST-GIC',
    'DENT-REST-TEMP',
    'DENT-ENDO-RCT',
    'DENT-ENDO-CONSULT',
    'DENT-ENDO-RETREAT',
    'DENT-EXT-SIMPLE',
    'DENT-EXT-SURGICAL',
    'DENT-EXT-WISDOM',
    'DENT-PROS-CROWN',
    'DENT-PROS-ZIRCONIA',
    'DENT-PROS-PFM',
    'DENT-PROS-CROWN-PREP',
    'DENT-PROS-CROWN-FIT',
    'DENT-PROS-BRIDGE',
    'DENT-PREV-SCALING',
    'DENT-PREV-DEEPCLEAN',
    'DENT-PREV-FLUORIDE',
    'DENT-DIAG-CONSULT',
    'DENT-DIAG-IOPA',
    'DENT-DIAG-OPG',
  ];

  beforeAll(async () => {
    await setupTestDatabase();

    await BranchModel.create([
      { _id: new Types.ObjectId(branchId), name: 'Main Branch', code: 'MB01', status: 'ACTIVE' },
      { _id: new Types.ObjectId(createObjectId()), name: 'Secondary Branch', code: 'SB01', status: 'ACTIVE' },
    ]);

    await seedDatabase();

    // Create active dental department
    await DepartmentModel.create({
      _id: new Types.ObjectId(dentalDeptId),
      name: 'Dental Surgery',
      code: 'DENT',
      branchIds: [new Types.ObjectId(branchId)],
      status: 'ACTIVE',
      isClinical: true,
    });

    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' }).lean();
    const passwordHash = await hashPassword('Admin123!');
    await UserModel.create({
      _id: new Types.ObjectId(adminUserId),
      username: 'dental_seed_admin',
      email: 'dental.seed.admin@test.local',
      passwordHash,
      fullName: 'Dental Seed Admin',
      roleIds: superAdminRole ? [superAdminRole._id] : [],
      status: 'active',
    });

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    adminToken = signJwt(
      { sub: adminUserId, username: 'dental_seed_admin' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 1: Seeds all expected dental services when dental dept exists
  // ─────────────────────────────────────────────────────────────────────────────
  it('1. Seeds all expected dental services when an active Dental department exists', async () => {
    const result = await seedDentalServices();

    expect(result.departmentId).not.toBeNull();
    expect(result.departmentName).toMatch(/dental/i);
    expect(result.inserted).toHaveLength(expectedCodes.length);
    expect(result.skipped).toHaveLength(0);

    // Verify all codes were inserted
    for (const code of expectedCodes) {
      expect(result.inserted).toContain(code);
    }

    // Verify they are in the database
    const dbServices = await ServiceModel.find({
      code: { $in: expectedCodes },
      status: 'ACTIVE',
      deletedAt: null,
    }).lean();
    expect(dbServices).toHaveLength(expectedCodes.length);

    // Verify service type and required fields
    for (const svc of dbServices) {
      expect(svc.serviceType).toBe('PROCEDURE');
      expect(svc.status).toBe('ACTIVE');
      expect(svc.standardPrice).toBeGreaterThan(0);
      expect(svc.defaultDurationMinutes).toBeGreaterThan(0);
      expect(svc.bookingCapacity).toBeGreaterThan(0);
      expect(typeof svc.category).toBe('string');
      expect(typeof svc.description).toBe('string');
      expect(svc.departmentId.toString()).toBe(dentalDeptId);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 2: Idempotent — second run skips already-inserted services
  // ─────────────────────────────────────────────────────────────────────────────
  it('2. Is idempotent — second run skips existing services without error', async () => {
    const result = await seedDentalServices();

    expect(result.inserted).toHaveLength(0);
    expect(result.skipped).toHaveLength(expectedCodes.length);

    // Count in DB should still be the same
    const count = await ServiceModel.countDocuments({
      code: { $in: expectedCodes },
      deletedAt: null,
    });
    expect(count).toBe(expectedCodes.length);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 3: Throws an error when no active Dental department exists
  // ─────────────────────────────────────────────────────────────────────────────
  it('3. Throws an error when no active Dental department is found (does not silently succeed)', async () => {
    // Deactivate the dental department temporarily
    await DepartmentModel.updateOne(
      { _id: new Types.ObjectId(dentalDeptId) },
      { $set: { status: 'INACTIVE' } },
    );

    await expect(seedDentalServices()).rejects.toThrow(/No active Dental department found/i);

    // Restore
    await DepartmentModel.updateOne(
      { _id: new Types.ObjectId(dentalDeptId) },
      { $set: { status: 'ACTIVE' } },
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 4: Seeded services are retrievable via the Service Catalogue API
  // ─────────────────────────────────────────────────────────────────────────────
  it('4. Seeded dental services are retrievable via GET /api/services with service_type=PROCEDURE', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/services?service_type=PROCEDURE&department_id=${dentalDeptId}&limit=50`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    // Response shape: { data: { data: Service[], meta: {...} } }
    const services: Array<{
      code: string;
      name: string;
      service_type: string;
      category: string;
      standard_price: number;
      status: string;
      default_duration_minutes: number;
      booking_capacity: number;
    }> = body.data.data;

    // All expected codes should be present
    const returnedCodes = services.map((s) => s.code);
    for (const code of expectedCodes) {
      expect(returnedCodes).toContain(code);
    }

    // Check a representative service (RCT)
    const rct = services.find((s) => s.code === 'DENT-ENDO-RCT');
    expect(rct).toBeDefined();
    expect(rct!.name).toBe('Root Canal Treatment');
    expect(rct!.service_type).toBe('PROCEDURE');
    expect(rct!.category).toBe('Endodontics');
    expect(rct!.standard_price).toBe(12000);
    expect(rct!.status).toBe('ACTIVE');
    expect(rct!.default_duration_minutes).toBe(90);
    expect(rct!.booking_capacity).toBe(1);

    // Check a restorative service
    const composite = services.find((s) => s.code === 'DENT-REST-COMPOSITE');
    expect(composite).toBeDefined();
    expect(composite!.name).toBe('Direct Composite Filling');
    expect(composite!.category).toBe('Restorative');
    expect(composite!.standard_price).toBe(3500);
  });
});
