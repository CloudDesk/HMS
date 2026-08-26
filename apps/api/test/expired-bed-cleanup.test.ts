import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { AdmissionsConfigurationService } from '../src/modules/admissions-configuration/admissions-configuration.service.js';
import { AdmissionsConfigurationRepository } from '../src/modules/admissions-configuration/admissions-configuration.repository.js';
import { BedHoldModel, BedModel, WardModel } from '../src/modules/admissions-configuration/admissions-configuration.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';

test('Finding 8 — Expired Bed-Hold Cleanup', async (t) => {
  await setupTestDatabase();

  const repository = new AdmissionsConfigurationRepository();
  const service = new AdmissionsConfigurationService(repository);
  
  const branchId = createObjectId();
  const actorId = createObjectId();

  t.beforeEach(async () => {
    mock.method(repository, 'hasBranchAccess', async () => true);
    mock.method(repository, 'audit', async () => {});

    await BranchModel.create({ _id: branchId, name: 'Test Branch', code: 'TEST', status: 'ACTIVE' });
  });

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
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

  await t.test('Test 1 — Future hold remains ACTIVE', async () => {
    await seedHolds(1, false); // 1 future hold

    // trigger cleanup via summary()
    await service.summary(branchId, actorId, {});

    const activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    assert.equal(activeHolds, 1, 'Future hold should remain ACTIVE');
  });

  await t.test('Test 2 — Expired hold becomes EXPIRED', async () => {
    await seedHolds(1, true); // 1 expired hold

    await service.summary(branchId, actorId, {});

    const activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    const expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });
    assert.equal(activeHolds, 0, 'Expired hold should no longer be ACTIVE');
    assert.equal(expiredHolds, 1, 'Expired hold should become EXPIRED');
  });

  await t.test('Test 3 — 101+ expired holds are all eventually processed', async () => {
    await seedHolds(101, true);

    await service.summary(branchId, actorId, {});

    const activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    const expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });
    
    assert.equal(activeHolds, 0, 'All 101 expired holds should be processed');
    assert.equal(expiredHolds, 101, 'All 101 expired holds should become EXPIRED');
  });

  await t.test('Test 4 & 5 — 1,001+ backlog is bounded per invocation and clears on repeat', async () => {
    // 1001 holds is too many to insert quickly without slowing tests down, let's just insert 1001.
    // Actually, mongo memory server is fast, inserting 1001 records is trivial.
    await seedHolds(1005, true);

    // Call it once
    await service.summary(branchId, actorId, {});

    let activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    let expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });
    
    // MAX_BATCHES = 10, batch_size = 100 => processes exactly 1000
    assert.equal(expiredHolds, 1000, 'Exactly 1000 holds should be processed in the first bounded invocation');
    assert.equal(activeHolds, 5, '5 holds should remain ACTIVE to prove the boundary');

    // Call it again (Test 5)
    await service.summary(branchId, actorId, {});
    
    activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });

    assert.equal(activeHolds, 0, 'Remaining 5 holds should be processed on the next invocation');
    assert.equal(expiredHolds, 1005, 'All holds should eventually be EXPIRED');
  });

  await t.test('Test 6 — Concurrent cleanup is safe', async () => {
    await seedHolds(50, true);

    // Run two cleanups concurrently
    await Promise.all([
      service.summary(branchId, actorId, {}),
      service.summary(branchId, actorId, {})
    ]);

    const activeHolds = await BedHoldModel.countDocuments({ status: 'ACTIVE' });
    const expiredHolds = await BedHoldModel.countDocuments({ status: 'EXPIRED' });
    
    assert.equal(activeHolds, 0);
    assert.equal(expiredHolds, 50, 'Exactly 50 holds should be EXPIRED without double processing or corruption');
  });

  await t.test('Test 7 — Expired hold releases bed availability', async () => {
    await seedHolds(1, true);

    const bedBefore = await BedModel.findOne({});
    assert.equal(bedBefore?.status, 'RESERVED');

    await service.summary(branchId, actorId, {});

    const bedAfter = await BedModel.findOne({});
    assert.equal(bedAfter?.status, 'AVAILABLE', 'Bed should be AVAILABLE after hold expires');
    assert.equal(bedAfter?.currentHoldId, null, 'currentHoldId should be null');
  });
});
