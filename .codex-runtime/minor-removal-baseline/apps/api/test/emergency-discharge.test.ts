import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { AppError } from '../src/shared/errors/app-error.js';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { createObjectId } from './factories.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';

describe('Emergency Discharge Financial Closure Tests (Finding 5)', () => {
  const branchId = createObjectId();
  const actor = createObjectId();
  const encounterId = createObjectId();

  beforeAll(async () => {
    await setupTestDatabase();
  }, 30000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  const runDischargeTest = async (
    ordersExist: boolean,
    isFinanciallyClosed: boolean | Error,
  ) => {
    const mockSession = await mongoose.startSession();
    const mockRepo = {
      session: vi.fn(async () => mockSession),
      hasBranchAccess: vi.fn(async () => true),
      getRecord: vi.fn(async () => ({
        _id: encounterId,
        status: 'READY_FOR_DISPOSITION',
        consultation: {},
        assignedDoctorId: createObjectId(),
        orders: ordersExist ? [{}] : [],
        patientId: createObjectId(),
        departmentId: createObjectId(),
      })),
      transition: vi.fn(async () => true),
      audit: vi.fn(async () => {}),
      departmentScope: vi.fn(async () => null),
    };

    const mockBilling = {
      isEncounterFinanciallyClosed: vi.fn(async () => {
        if (isFinanciallyClosed instanceof Error) throw isFinanciallyClosed;
        return isFinanciallyClosed;
      })
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      { addEmergencyTimeline: vi.fn() } as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      mockBilling as unknown as ConstructorParameters<typeof EmergencyService>[5],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[6],
    );

    const dispositionData = {
      decision: 'DISCHARGE',
      reason: 'Standard discharge',
    };

    return service.disposition(encounterId, branchId, dispositionData as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyDispositionDTO, actor, {} as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyMetadata);
  };

  it('Test 1 - Orders + settled billing -> SUCCESS', async () => {
    await expect(runDischargeTest(true, true)).resolves.toBeDefined();
  });

  it('Test 2 - Orders + outstanding billing -> DENIED', async () => {
    await expect(runDischargeTest(true, false)).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === 'EMERGENCY_BILLING_CLOSURE_REQUIRED';
    });
  });

  it('Test 3 - Orders + partially paid billing -> DENIED', async () => {
    await expect(runDischargeTest(true, false)).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === 'EMERGENCY_BILLING_CLOSURE_REQUIRED';
    });
  });

  it('Test 4 - No orders + settled billing -> SUCCESS', async () => {
    await expect(runDischargeTest(false, true)).resolves.toBeDefined();
  });

  it('Test 5 - No orders + outstanding billing -> DENIED', async () => {
    await expect(runDischargeTest(false, false)).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === 'EMERGENCY_BILLING_CLOSURE_REQUIRED';
    });
  });

  it('Test 6 - Billing verification failure -> NOT ALLOWED (safe failure)', async () => {
    await expect(runDischargeTest(true, new AppError('Service unavailable', 503, 'BILLING_SERVICE_DOWN'))).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === 'BILLING_SERVICE_DOWN';
    });
  });

  it('Test 7 - Client billing manipulation -> Backend ignores client state', async () => {
    const mockSession = await mongoose.startSession();
    const mockRepo = {
      session: vi.fn(async () => mockSession),
      hasBranchAccess: vi.fn(async () => true),
      getRecord: vi.fn(async () => ({
        _id: encounterId,
        status: 'READY_FOR_DISPOSITION',
        consultation: {},
        assignedDoctorId: createObjectId(),
        orders: [],
        patientId: createObjectId(),
        departmentId: createObjectId(),
      })),
      departmentScope: vi.fn(async () => null),
    };
    const mockBilling = {
      isEncounterFinanciallyClosed: vi.fn(async () => false) // backend says unpaid
    };
    const service = new EmergencyService(mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0], {} as unknown as ConstructorParameters<typeof EmergencyService>[1], {} as unknown as ConstructorParameters<typeof EmergencyService>[2], {} as unknown as ConstructorParameters<typeof EmergencyService>[3], {} as unknown as ConstructorParameters<typeof EmergencyService>[4], mockBilling as unknown as ConstructorParameters<typeof EmergencyService>[5], {} as unknown as ConstructorParameters<typeof EmergencyService>[6]);
    
    // Simulate client sending rogue billingStatus
    const dispositionData = {
      decision: 'DISCHARGE',
      billingStatus: 'SETTLED', 
    };

    await expect(
      service.disposition(encounterId, branchId, dispositionData as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyDispositionDTO, actor, {} as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyMetadata),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === 'EMERGENCY_BILLING_CLOSURE_REQUIRED';
    });
  });
});
