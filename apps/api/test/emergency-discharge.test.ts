import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AppError } from '../src/shared/errors/app-error.js';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { createObjectId } from './factories.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';

test('Emergency Discharge Financial Closure Tests (Finding 5)', async (t) => {
  await setupTestDatabase();

  const branchId = createObjectId();
  const actor = createObjectId();
  const encounterId = createObjectId();

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  const runDischargeTest = async (
    ordersExist: boolean,
    isFinanciallyClosed: boolean | Error,
  ) => {
    const mockSession = await mongoose.startSession();
    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => true),
      getRecord: mock.fn(async () => ({
        _id: encounterId,
        status: 'READY_FOR_DISPOSITION',
        consultation: {},
        assignedDoctorId: createObjectId(),
        orders: ordersExist ? [{}] : [],
        patientId: createObjectId(),
        departmentId: createObjectId(),
      })),
      transition: mock.fn(async () => true),
      audit: mock.fn(async () => {}),
      departmentScope: mock.fn(async () => null),
    };

    const mockBilling = {
      isEncounterFinanciallyClosed: mock.fn(async () => {
        if (isFinanciallyClosed instanceof Error) throw isFinanciallyClosed;
        return isFinanciallyClosed;
      })
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      { addEmergencyTimeline: mock.fn() } as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      mockBilling as unknown as ConstructorParameters<typeof EmergencyService>[5],
    );

    const dispositionData = {
      decision: 'DISCHARGE',
      reason: 'Standard discharge',
    };

    return service.disposition(encounterId, branchId, dispositionData as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyDispositionDTO, actor, {} as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyMetadata);
  };

  await t.test('Test 1 - Orders + settled billing -> SUCCESS', async () => {
    await assert.doesNotReject(runDischargeTest(true, true));
  });

  await t.test('Test 2 - Orders + outstanding billing -> DENIED', async () => {
    const p = runDischargeTest(true, false);
    await assert.rejects(p, (err: unknown) => {
      return err instanceof AppError && err.code === 'EMERGENCY_BILLING_CLOSURE_REQUIRED';
    });
  });

  await t.test('Test 3 - Orders + partially paid billing -> DENIED', async () => {
    // Partially paid implies not financially closed in the Billing repo
    const p = runDischargeTest(true, false);
    await assert.rejects(p, (err: unknown) => {
      return err instanceof AppError && err.code === 'EMERGENCY_BILLING_CLOSURE_REQUIRED';
    });
  });

  await t.test('Test 4 - No orders + settled billing -> SUCCESS', async () => {
    await assert.doesNotReject(runDischargeTest(false, true));
  });

  await t.test('Test 5 - No orders + outstanding billing -> DENIED', async () => {
    const p = runDischargeTest(false, false);
    await assert.rejects(p, (err: unknown) => {
      return err instanceof AppError && err.code === 'EMERGENCY_BILLING_CLOSURE_REQUIRED';
    });
  });

  await t.test('Test 6 - Billing verification failure -> NOT ALLOWED (safe failure)', async () => {
    const p = runDischargeTest(true, new AppError('Service unavailable', 503, 'BILLING_SERVICE_DOWN'));
    await assert.rejects(p, (err: unknown) => {
      return err instanceof AppError && err.code === 'BILLING_SERVICE_DOWN';
    });
  });

  await t.test('Test 7 - Client billing manipulation -> Backend ignores client state', async () => {
    const mockSession = await mongoose.startSession();
    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => true),
      getRecord: mock.fn(async () => ({
        _id: encounterId,
        status: 'READY_FOR_DISPOSITION',
        consultation: {},
        assignedDoctorId: createObjectId(),
        orders: [],
        patientId: createObjectId(),
        departmentId: createObjectId(),
      })),
      departmentScope: mock.fn(async () => null),
    };
    const mockBilling = {
      isEncounterFinanciallyClosed: mock.fn(async () => false) // backend says unpaid
    };
    const service = new EmergencyService(mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0], {} as unknown as ConstructorParameters<typeof EmergencyService>[1], {} as unknown as ConstructorParameters<typeof EmergencyService>[2], {} as unknown as ConstructorParameters<typeof EmergencyService>[3], {} as unknown as ConstructorParameters<typeof EmergencyService>[4], mockBilling as unknown as ConstructorParameters<typeof EmergencyService>[5]);
    
    // Simulate client sending rogue billingStatus
    const dispositionData = {
      decision: 'DISCHARGE',
      billingStatus: 'SETTLED', 
    };

    const p = service.disposition(encounterId, branchId, dispositionData as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyDispositionDTO, actor, {} as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyMetadata);
    await assert.rejects(p, (err: unknown) => {
      return err instanceof AppError && err.code === 'EMERGENCY_BILLING_CLOSURE_REQUIRED';
    });
  });
});
