import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { AdmissionsConfigurationService } from '../src/modules/admissions-configuration/admissions-configuration.service.js';
import { AdmissionsConfigurationRepository } from '../src/modules/admissions-configuration/admissions-configuration.repository.js';
import { BedHoldModel, BedModel, WardModel } from '../src/modules/admissions-configuration/admissions-configuration.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';

describe('Finding 8 — Expired Bed-Hold Cleanup', () => {
  let repository: AdmissionsConfigurationRepository;
  let service: AdmissionsConfigurationService;
  
  const branchId = createObjectId();
  const actorId = createObjectId();

  beforeAll(async () => {
    await setupTestDatabase();
    repository = new AdmissionsConfigurationRepository();
    service = new AdmissionsConfigurationService(repository);
  }, 30000);

  beforeEach(async () => {
    vi.spyOn(repository, 'hasBranchAccess').mockImplementation(async () => true);
    vi.spyOn(repository, 'audit').mockImplementation(async () => {});

    await BranchModel.create({ _id: branchId, name: 'Test Branch', code: 'TEST', status: 'ACTIVE' });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  const seedHolds = async (count: number, expired: boolean) => {
    const wardId = createObjectId();
    await WardModel.create({ 
      _id: wardId, 
      branchId, 
      name: 'W1', 
      code: 'W1', 
      status: 'ACTIVE',
      floor: '1',
      wardType: 'GENERAL',
      createdBy: actorId,
      updatedBy: actorId
    });

    const holds = [];
    const beds = [];

    const now = new Date();
    // if expired is true, expiresAt is 1 hour ago. if false, 1 hour in the future.
    const expiresAt = new Date(now.getTime() + (expired ? -3600000 : 3600000));

    for (let i = 0; i < count; i++) {
      const bedId = createObjectId();
      const holdId = createObjectId();
      
      beds.push({
        _id: bedId,
        branchId,
        wardId,
        bedNumber: `B-${i}`,
        bedCategory: 'STANDARD',
        status: 'RESERVED',
        currentHoldId: holdId,
        createdBy: actorId,
        updatedBy: actorId
      });

      holds.push({
        _id: holdId,
        holdNumber: `H-${i}`,
        branchId,
        wardId,
        bedId,
        wardName: 'W1',
        bedNumber: `B-${i}`,
        bedCategory: 'STANDARD',
        patientId: createObjectId(),
        status: 'ACTIVE',
        expiresAt,
        heldAt: new Date(now.getTime() - 7200000), // 2 hours ago
        reason: 'Test hold',
        requestHash: `req-${i}`,
        idempotencyKey: `idem-${i}`,
        createdBy: actorId,
        updatedBy: actorId,
        version: 0
      });
    }

    await BedModel.insertMany(beds);
    await BedHoldModel.insertMany(holds);
  };

  it('Test 1 — Future hold remains ACTIVE', async () => {
    await seedHolds(1, false); // 1 future hold

    // trigger cleanup via summary()
    await service.summary(branchId, actorId, {});

    const activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    expect(activeHolds).toBe(1);
  });

  it('Test 2 — Expired hold becomes EXPIRED', async () => {
    await seedHolds(1, true); // 1 expired hold

    await service.summary(branchId, actorId, {});

    const activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    const expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });
    expect(activeHolds).toBe(0);
    expect(expiredHolds).toBe(1);
  });

  it('Test 3 — 101+ expired holds are all eventually processed', async () => {
    await seedHolds(101, true);

    await service.summary(branchId, actorId, {});

    const activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    const expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });
    
    expect(activeHolds).toBe(0);
    expect(expiredHolds).toBe(101);
  });

  it('Test 4 & 5 — 1,001+ backlog is bounded per invocation and clears on repeat', async () => {
    await seedHolds(1005, true);

    // Call it once
    await service.summary(branchId, actorId, {});

    let activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    let expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });
    
    // MAX_BATCHES = 10, batch_size = 100 => processes exactly 1000
    expect(expiredHolds).toBe(1000);
    expect(activeHolds).toBe(5);

    // Call it again (Test 5)
    await service.summary(branchId, actorId, {});
    
    activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });

    expect(activeHolds).toBe(0);
    expect(expiredHolds).toBe(1005);
  }, 60000);

  it('Test 6 — Concurrent cleanup is safe', async () => {
    await seedHolds(50, true);

    // Run two cleanups concurrently
    await Promise.all([
      service.summary(branchId, actorId, {}),
      service.summary(branchId, actorId, {})
    ]);

    const activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    const expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });
    
    expect(activeHolds).toBe(0);
    expect(expiredHolds).toBe(50);
  });

  it('Test 7 — Expired hold releases bed availability', async () => {
    await seedHolds(1, true);

    const bedBefore = await BedModel.findOne({});
    expect(bedBefore?.status).toBe('RESERVED');

    await service.summary(branchId, actorId, {});

    const bedAfter = await BedModel.findOne({});
    expect(bedAfter?.status).toBe('AVAILABLE');
    expect(bedAfter?.currentHoldId).toBeNull();
  });
});
