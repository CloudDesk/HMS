import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { AppError } from '../src/shared/errors/app-error.js';
import { SurgeryService } from '../src/modules/surgery/surgery.service.js';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { createObjectId } from './factories.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';

test('Department-Level Authorization Boundary Tests', async (t) => {
  await setupTestDatabase();
  
  const branchA = createObjectId();
  const cardiologyDept = createObjectId();
  const surgeryDept = createObjectId();
  const actor = createObjectId();

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  await t.test('Surgery - Same branch + different department -> DENIED', async () => {
    const mockRepo = {
      session: mock.fn(async () => mongoose.startSession()),
      getBookingRecord: mock.fn(async () => ({
        _id: createObjectId(),
        status: 'PENDING_CONFIRMATION',
        branchId: branchA,
        departmentId: surgeryDept, // The record belongs to Surgery
        patientId: createObjectId(),
      })),
      hasBranchAccess: mock.fn(async () => true),
      departmentScope: mock.fn(async () => [cardiologyDept]), // The user only has Cardiology
    } as any;

    const service = new SurgeryService(
      mockRepo, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, { get: async () => ({ localization: { timezone: 'UTC' } }) } as any
    );

    await assert.rejects(
      async () => {
        await service.confirmBooking(createObjectId(), branchA, {} as any, actor, {} as any);
      },
      (err: any) => err instanceof AppError && err.code === 'DEPARTMENT_ACCESS_DENIED'
    );
  });

  await t.test('Surgery - Same branch + same department -> PASS (or proceeds to next validation)', async () => {
    const mockRepo = {
      session: mock.fn(async () => ({
        withTransaction: async (cb: any) => cb(),
        endSession: async () => {},
      })),
      getBookingRecord: mock.fn(async () => ({
        _id: createObjectId(),
        status: 'PENDING_CONFIRMATION',
        branchId: branchA,
        departmentId: surgeryDept, // Record in Surgery
        patientId: createObjectId(),
        doctorId: createObjectId(),
        recommendationId: createObjectId(),
        serviceId: createObjectId(),
      })),
      getRecommendation: mock.fn(async () => null),
      bookingReferences: mock.fn(async () => ({})),
      hasBranchAccess: mock.fn(async () => true),
      departmentScope: mock.fn(async () => [surgeryDept]), // User has Surgery
    } as any;

    const service = new SurgeryService(
      mockRepo, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, { get: async () => ({ localization: { timezone: 'UTC' } }) } as any
    );

    await assert.rejects(
      async () => {
        await service.confirmBooking(createObjectId(), branchA, {} as any, actor, {} as any);
      },
      (err: any) => err instanceof AppError && err.code !== 'DEPARTMENT_ACCESS_DENIED' // Should fail on business logic, not authorization
    );
  });

  await t.test('Emergency - Same branch + different department -> DENIED', async () => {
    const mockRepo = {
      session: mock.fn(async () => mongoose.startSession()),
      getRecord: mock.fn(async () => ({
        _id: createObjectId(),
        status: 'TRIAGE',
        branchId: branchA,
        departmentId: surgeryDept, // Record in Surgery
      })),
      hasBranchAccess: mock.fn(async () => true),
      departmentScope: mock.fn(async () => [cardiologyDept]), // User in Cardiology
    } as any;

    const service = new EmergencyService(mockRepo, {} as any, {} as any, {} as any, {} as any);

    await assert.rejects(
      async () => {
        await service.triage(createObjectId(), branchA, {} as any, actor, {} as any);
      },
      (err: any) => err instanceof AppError && err.code === 'DEPARTMENT_ACCESS_DENIED'
    );
  });

  await t.test('Emergency - Client department manipulation -> DENIED', async () => {
    const mockRepo = {
      session: mock.fn(async () => mongoose.startSession()),
      getRecord: mock.fn(async () => ({
        _id: createObjectId(),
        status: 'TRIAGE',
        branchId: branchA,
        departmentId: surgeryDept, // Persisted as Surgery
      })),
      hasBranchAccess: mock.fn(async () => true),
      departmentScope: mock.fn(async () => [cardiologyDept]), // User only has Cardiology
    } as any;

    const service = new EmergencyService(mockRepo, {} as any, {} as any, {} as any, {} as any);

    // The user passes a cardiology ID in the body but the record is surgery.
    await assert.rejects(
      async () => {
        await service.triage(createObjectId(), branchA, { department_id: cardiologyDept } as any, actor, {} as any);
      },
      (err: any) => err instanceof AppError && err.code === 'DEPARTMENT_ACCESS_DENIED'
    );
  });

  await t.test('Inpatient Admissions - Same branch + different department -> DENIED', async () => {
    const mockRepo = {
      session: mock.fn(async () => mongoose.startSession()),
      getRequest: mock.fn(async () => ({
        id: createObjectId(),
        status: 'PENDING_VALIDATION',
        branch_id: branchA,
        department_id: surgeryDept, // Request in Surgery
        patient_id: createObjectId(),
      })),
      hasBranchAccess: mock.fn(async () => true),
      departmentScope: mock.fn(async () => [cardiologyDept]), // User in Cardiology
    } as any;

    const service = new InpatientAdmissionService(
      mockRepo, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
    );

    await assert.rejects(
      async () => {
        await service.validateRequest(createObjectId(), branchA, {} as any, actor, {} as any);
      },
      (err: any) => err instanceof AppError && err.code === 'DEPARTMENT_ACCESS_DENIED'
    );
  });
});
