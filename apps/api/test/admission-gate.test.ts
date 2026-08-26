import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { AppError } from '../src/shared/errors/app-error.js';

test('InpatientAdmissionService - Advance Payment Gating', async (t) => {
  await setupTestDatabase();
  
  const advancePaymentRepository = new AdvancePaymentRepository();
  const advancePaymentService = new AdvancePaymentService(advancePaymentRepository);

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  const setupMockService = (policy: { admission_advance_deposit_required: boolean, admission_minimum_deposit_amount: number }) => {
    const mockRepo = {
      session: mock.fn(async () => mongoose.startSession()),
      getRequest: mock.fn(async () => ({
        id: createObjectId(),
        status: 'READY_FOR_CONFIRMATION',
        patient_id: createObjectId(),
        patient_number: 'MRN-123',
        patient_name: 'Test',
        recommending_doctor_id: createObjectId(),
        recommending_doctor_name: 'Dr. Test',
        department_id: createObjectId(),
        department_name: 'Test Dept',
        source_type: 'DIRECT',
        source_id: null,
      })),
      hasActiveAdmission: mock.fn(async () => false),
      validateRequest: mock.fn(async () => true),
      references: mock.fn(async () => ({
        patient: {}, doctor: {}, department: {}, ward: {}
      })),
      create: mock.fn(async () => ({ id: createObjectId(), admission_number: 'ADM-123' })),
      getRecord: mock.fn(async () => ({})),
      confirmRequest: mock.fn(async () => true),
      audit: mock.fn(async () => {}),
      hasBranchAccess: mock.fn(async () => true),
      departmentScope: mock.fn(async () => undefined),
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[0];

    const mockBeds = {
      getPolicyForConfirmation: mock.fn(async () => policy),
      allotAdmission: mock.fn(async () => {}),
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[1];

    const mockPatients = {
      verifyContextConsent: mock.fn(async () => null),
      addAdmissionTimeline: mock.fn(async () => {})
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[2];

    return new InpatientAdmissionService(
      mockRepo, mockBeds, mockPatients, {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[3], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[4], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[5], advancePaymentService, {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[7], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[8]
    );
  };

  await t.test('confirmRequest succeeds when NOT_REQUIRED', async () => {
    const service = setupMockService({
      admission_advance_deposit_required: false,
      admission_minimum_deposit_amount: 0
    });

    await assert.doesNotReject(async () => {
      await service.confirmRequest(createObjectId(), createObjectId(), {
        ward_id: createObjectId(),
        bed_id: createObjectId(),
        admission_date: new Date().toISOString()
      }, createObjectId(), {} as unknown as import('../src/modules/inpatient-admissions/inpatient-admission.types.js').AdmissionRequestMetadata);
    });
  });

  await t.test('confirmRequest fails when REQUIRED and PENDING', async () => {
    const service = setupMockService({
      admission_advance_deposit_required: true,
      admission_minimum_deposit_amount: 10000
    });

    await assert.rejects(async () => {
      await service.confirmRequest(createObjectId(), createObjectId(), {
        ward_id: createObjectId(),
        bed_id: createObjectId(),
        admission_date: new Date().toISOString()
      }, createObjectId(), {} as unknown as import('../src/modules/inpatient-admissions/inpatient-admission.types.js').AdmissionRequestMetadata);
    }, (err: unknown) => {
      return err instanceof AppError && err.code === 'ADVANCE_DEPOSIT_REQUIRED';
    });
  });

  await t.test('confirmRequest succeeds when REQUIRED and PAID', async () => {
    const service = setupMockService({
      admission_advance_deposit_required: true,
      admission_minimum_deposit_amount: 10000
    });

    // Mock getRequest to return a specific ID so we can pay it first
    const requestId = createObjectId();
    const branchId = createObjectId();
    const patientId = createObjectId();
    const actorId = createObjectId();

    (service as unknown as { repository: { getRequest: typeof mock.fn } }).repository.getRequest = mock.fn(async () => ({
      id: requestId,
      status: 'READY_FOR_CONFIRMATION',
      patient_id: patientId,
      patient_number: 'MRN-123',
      patient_name: 'Test',
      recommending_doctor_id: createObjectId(),
      recommending_doctor_name: 'Dr. Test',
      department_id: createObjectId(),
      department_name: 'Test Dept',
      source_type: 'DIRECT',
      source_id: null,
    }));

    // First pre-pay the requirement
    await advancePaymentService.syncRequirement({
      patient_id: patientId,
      branch_id: branchId,
      source_type: 'ADMISSION_REQUEST',
      source_id: requestId,
      required_amount: 10000,
      requirement_status: 'REQUIRED'
    }, actorId);

    await advancePaymentService.processPayment('ADMISSION_REQUEST', requestId, 10000, actorId);

    await assert.doesNotReject(async () => {
      await service.confirmRequest(requestId, branchId, {
        ward_id: createObjectId(),
        bed_id: createObjectId(),
        admission_date: new Date().toISOString()
      }, actorId, {} as unknown as import('../src/modules/inpatient-admissions/inpatient-admission.types.js').AdmissionRequestMetadata);
    });
  });
});
