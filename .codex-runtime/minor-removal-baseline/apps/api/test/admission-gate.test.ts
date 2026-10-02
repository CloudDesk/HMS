import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { AppError } from '../src/shared/errors/app-error.js';

describe('InpatientAdmissionService - Advance Payment Gating', () => {
  let advancePaymentRepository: AdvancePaymentRepository;
  let advancePaymentService: AdvancePaymentService;

  beforeAll(async () => {
    await setupTestDatabase();
    advancePaymentRepository = new AdvancePaymentRepository();
    advancePaymentService = new AdvancePaymentService(advancePaymentRepository);
  }, 30000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  const setupMockService = (policy: { admission_advance_deposit_required: boolean; admission_minimum_deposit_amount: number }) => {
    const mockRepo = {
      session: vi.fn(async () => mongoose.startSession()),
      getRequest: vi.fn(async () => ({
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
      hasActiveAdmission: vi.fn(async () => false),
      validateRequest: vi.fn(async () => true),
      references: vi.fn(async () => ({
        patient: {}, doctor: {}, department: {}, ward: {}
      })),
      create: vi.fn(async () => ({ id: createObjectId(), admission_number: 'ADM-123' })),
      getRecord: vi.fn(async () => ({})),
      confirmRequest: vi.fn(async () => true),
      audit: vi.fn(async () => {}),
      hasBranchAccess: vi.fn(async () => true),
      departmentScope: vi.fn(async () => undefined),
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[0];

    const mockBeds = {
      getPolicyForConfirmation: vi.fn(async () => policy),
      allotAdmission: vi.fn(async () => {}),
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[1];

    const mockPatients = {
      verifyContextConsent: vi.fn(async () => null),
      addAdmissionTimeline: vi.fn(async () => {})
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[2];

    const mockBilling = {
      verifyAdmissionDeposit: vi.fn(async (_patientId: string, _branchId: string, requestId: string, _invoiceId: string | null, requiredAmount: number) => {
        const record = await advancePaymentRepository.findBySource('ADMISSION_REQUEST', requestId);
        const paid = record?.paid_amount ?? 0;
        return {
          required_amount: requiredAmount,
          paid_amount: paid,
          remaining_amount: Math.max(0, requiredAmount - paid),
          satisfied: paid >= requiredAmount,
          invoice_id: 'inv-1',
          payment_ids: ['pay-1'],
          verified_at: new Date(),
        };
      }),
    } as unknown as ConstructorParameters<typeof InpatientAdmissionService>[3];

    return new InpatientAdmissionService(
      mockRepo, mockBeds, mockPatients, mockBilling, {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[4], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[5], advancePaymentService, {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[7], {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[8]
    );
  };

  it('confirmRequest succeeds when NOT_REQUIRED', async () => {
    const service = setupMockService({
      admission_advance_deposit_required: false,
      admission_minimum_deposit_amount: 0
    });

    await expect(
      service.confirmRequest(createObjectId(), createObjectId(), {
        ward_id: createObjectId(),
        bed_id: createObjectId(),
        admission_date: new Date().toISOString()
      }, createObjectId(), {} as unknown as import('../src/modules/inpatient-admissions/inpatient-admission.types.js').AdmissionRequestMetadata)
    ).resolves.toBeDefined();
  });

  it('confirmRequest fails when REQUIRED and PENDING', async () => {
    const service = setupMockService({
      admission_advance_deposit_required: true,
      admission_minimum_deposit_amount: 10000
    });

    await expect(
      service.confirmRequest(createObjectId(), createObjectId(), {
        ward_id: createObjectId(),
        bed_id: createObjectId(),
        admission_date: new Date().toISOString()
      }, createObjectId(), {} as unknown as import('../src/modules/inpatient-admissions/inpatient-admission.types.js').AdmissionRequestMetadata)
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === 'ADVANCE_DEPOSIT_REQUIRED';
    });
  });

  it('confirmRequest succeeds when REQUIRED and PAID', async () => {
    const service = setupMockService({
      admission_advance_deposit_required: true,
      admission_minimum_deposit_amount: 10000
    });

    // Mock getRequest to return a specific ID so we can pay it first
    const requestId = createObjectId();
    const branchId = createObjectId();
    const patientId = createObjectId();
    const actorId = createObjectId();

    (service as unknown as { repository: { getRequest: ReturnType<typeof vi.fn> } }).repository.getRequest = vi.fn(async () => ({
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

    await expect(
      service.confirmRequest(requestId, branchId, {
        ward_id: createObjectId(),
        bed_id: createObjectId(),
        admission_date: new Date().toISOString()
      }, actorId, {} as unknown as import('../src/modules/inpatient-admissions/inpatient-admission.types.js').AdmissionRequestMetadata)
    ).resolves.toBeDefined();
  });
});
