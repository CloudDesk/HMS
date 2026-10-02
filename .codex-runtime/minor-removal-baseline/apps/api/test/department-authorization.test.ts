import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { AppError } from '../src/shared/errors/app-error.js';
import { SurgeryService } from '../src/modules/surgery/surgery.service.js';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { createObjectId } from './factories.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';

describe('Department-Level Authorization Boundary Tests', () => {
  const branchA = createObjectId();
  const cardiologyDept = createObjectId();
  const surgeryDept = createObjectId();
  const actor = createObjectId();

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

  it('Surgery - Same branch + different department -> DENIED', async () => {
    const mockRepo = {
      session: vi.fn(async () => mongoose.startSession()),
      getBookingRecord: vi.fn(async () => ({
        _id: createObjectId(),
        status: 'PENDING_CONFIRMATION',
        branchId: branchA,
        departmentId: surgeryDept, // The record belongs to Surgery
        patientId: createObjectId(),
      })),
      hasBranchAccess: vi.fn(async () => true),
      departmentScope: vi.fn(async () => [cardiologyDept]), // The user only has Cardiology
    } as unknown as ConstructorParameters<typeof SurgeryService>[0];

    const service = new SurgeryService(
      mockRepo, {} as unknown as ConstructorParameters<typeof SurgeryService>[1], {} as unknown as ConstructorParameters<typeof SurgeryService>[2], {} as unknown as ConstructorParameters<typeof SurgeryService>[3], {} as unknown as ConstructorParameters<typeof SurgeryService>[4], {} as unknown as ConstructorParameters<typeof SurgeryService>[5], {} as unknown as ConstructorParameters<typeof SurgeryService>[6], {} as unknown as ConstructorParameters<typeof SurgeryService>[7], { get: async () => ({ localization: { timezone: 'UTC' } }) } as unknown as ConstructorParameters<typeof SurgeryService>[8]
    );

    await expect(
      service.confirmBooking(createObjectId(), branchA, {} as unknown as import('../src/modules/surgery/surgery.types.js').ConfirmSurgeryBookingDTO, actor, {} as unknown as import('../src/modules/surgery/surgery.types.js').SurgeryMetadata),
    ).rejects.toSatisfy((err: unknown) => err instanceof AppError && err.code === 'DEPARTMENT_ACCESS_DENIED');
  });

  it('Surgery - Same branch + same department -> PASS (or proceeds to next validation)', async () => {
    const mockRepo = {
      session: vi.fn(async () => ({
        withTransaction: async (cb: () => Promise<void>) => cb(),
        endSession: async () => {},
      })),
      getBookingRecord: vi.fn(async () => ({
        _id: createObjectId(),
        status: 'PENDING_CONFIRMATION',
        branchId: branchA,
        departmentId: surgeryDept, // Record in Surgery
        patientId: createObjectId(),
        doctorId: createObjectId(),
        recommendationId: createObjectId(),
        serviceId: createObjectId(),
      })),
      getRecommendation: vi.fn(async () => null),
      bookingReferences: vi.fn(async () => ({})),
      hasBranchAccess: vi.fn(async () => true),
      departmentScope: vi.fn(async () => [surgeryDept]), // User has Surgery
    } as unknown as ConstructorParameters<typeof SurgeryService>[0];

    const service = new SurgeryService(
      mockRepo, {} as unknown as ConstructorParameters<typeof SurgeryService>[1], {} as unknown as ConstructorParameters<typeof SurgeryService>[2], {} as unknown as ConstructorParameters<typeof SurgeryService>[3], {} as unknown as ConstructorParameters<typeof SurgeryService>[4], {} as unknown as ConstructorParameters<typeof SurgeryService>[5], {} as unknown as ConstructorParameters<typeof SurgeryService>[6], {} as unknown as ConstructorParameters<typeof SurgeryService>[7], { get: async () => ({ localization: { timezone: 'UTC' } }) } as unknown as ConstructorParameters<typeof SurgeryService>[8]
    );

    await expect(
      service.confirmBooking(createObjectId(), branchA, {} as unknown as import('../src/modules/surgery/surgery.types.js').ConfirmSurgeryBookingDTO, actor, {} as unknown as import('../src/modules/surgery/surgery.types.js').SurgeryMetadata),
    ).rejects.toSatisfy((err: unknown) => err instanceof AppError && err.code !== 'DEPARTMENT_ACCESS_DENIED');
  });

  it('Emergency - Same branch + different department -> DENIED', async () => {
    const mockRepo = {
      session: vi.fn(async () => mongoose.startSession()),
      getRecord: vi.fn(async () => ({
        _id: createObjectId(),
        status: 'WAITING_FOR_TRIAGE',
        branchId: branchA,
        departmentId: surgeryDept, // Record in Surgery
      })),
      hasBranchAccess: vi.fn(async () => true),
      departmentScope: vi.fn(async () => [cardiologyDept]), // User in Cardiology
    } as unknown as ConstructorParameters<typeof EmergencyService>[0];

    const service = new EmergencyService(mockRepo, {} as unknown as ConstructorParameters<typeof EmergencyService>[1], {} as unknown as ConstructorParameters<typeof EmergencyService>[2], {} as unknown as ConstructorParameters<typeof EmergencyService>[3], {} as unknown as ConstructorParameters<typeof EmergencyService>[4], {} as unknown as ConstructorParameters<typeof EmergencyService>[5], {} as unknown as ConstructorParameters<typeof EmergencyService>[6]);

    await expect(
      service.triage(createObjectId(), branchA, {} as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyTriageDTO, actor, {} as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyMetadata),
    ).rejects.toSatisfy((err: unknown) => err instanceof AppError && err.code === 'DEPARTMENT_ACCESS_DENIED');
  });

  it('Emergency - Client department manipulation -> DENIED', async () => {
    const mockRepo = {
      session: vi.fn(async () => mongoose.startSession()),
      getRecord: vi.fn(async () => ({
        _id: createObjectId(),
        status: 'WAITING_FOR_TRIAGE',
        branchId: branchA,
        departmentId: surgeryDept, // Persisted as Surgery
      })),
      hasBranchAccess: vi.fn(async () => true),
      departmentScope: vi.fn(async () => [cardiologyDept]), // User only has Cardiology
    } as unknown as ConstructorParameters<typeof EmergencyService>[0];

    const service = new EmergencyService(mockRepo, {} as unknown as ConstructorParameters<typeof EmergencyService>[1], {} as unknown as ConstructorParameters<typeof EmergencyService>[2], {} as unknown as ConstructorParameters<typeof EmergencyService>[3], {} as unknown as ConstructorParameters<typeof EmergencyService>[4], {} as unknown as ConstructorParameters<typeof EmergencyService>[5], {} as unknown as ConstructorParameters<typeof EmergencyService>[6]);

    // The user passes a cardiology ID in the body but the record is surgery.
    await expect(
      service.triage(createObjectId(), branchA, { department_id: cardiologyDept } as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyTriageDTO, actor, {} as unknown as import('../src/modules/emergency/emergency.types.js').EmergencyMetadata),
    ).rejects.toSatisfy((err: unknown) => err instanceof AppError && err.code === 'DEPARTMENT_ACCESS_DENIED');
  });

  it('Inpatient Admissions - Same branch + different department -> DENIED', async () => {
    const mockRepo = {
      session: vi.fn(async () => mongoose.startSession()),
      getRequest: vi.fn(async () => ({
        id: createObjectId(),
        status: 'PENDING_VALIDATION',
        branch_id: branchA,
        department_id: surgeryDept, // Request in Surgery
        patient_id: createObjectId(),
      })),
      hasActiveAdmission: vi.fn(async () => false),
      hasBranchAccess: vi.fn(async () => true),
      departmentScope: vi.fn(async () => [cardiologyDept]), // User in Cardiology
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[0];

    const service = new InpatientAdmissionService(
      mockRepo, {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[1], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[2], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[3], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[4], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[5], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[6], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[7], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[8]
    );

    await expect(
      service.validateRequest(createObjectId(), branchA, {} as unknown as import('../src/modules/inpatient-admissions/inpatient-admission.types.js').ValidateAdmissionRequestDTO, actor, {} as unknown as import('../src/modules/inpatient-admissions/inpatient-admission.types.js').AdmissionRequestMetadata),
    ).rejects.toSatisfy((err: unknown) => err instanceof AppError && err.code === 'DEPARTMENT_ACCESS_DENIED');
  });
});
