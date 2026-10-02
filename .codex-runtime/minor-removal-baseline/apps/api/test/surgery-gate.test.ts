import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { SurgeryService } from '../src/modules/surgery/surgery.service.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { AppError } from '../src/shared/errors/app-error.js';

describe('SurgeryService - Advance Payment Gating', () => {
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

  const setupMockService = (procedureConfig: { requiresAdvanceDeposit: boolean, minimumAdvanceDepositAmount: number }) => {
    const mockRepo = {
      session: vi.fn(async () => mongoose.startSession()),
      getBooking: vi.fn(async (id) => ({
        id: id,
        status: 'PENDING_CONFIRMATION',
        patient_id: createObjectId(),
        branch_id: createObjectId(),
        service_id: createObjectId(),
        scheduled_start: new Date().toISOString(),
      })),
      getBookingRecord: vi.fn(async (id) => ({
        _id: id,
        status: 'PENDING_CONFIRMATION',
        patientId: createObjectId(),
        patientNumber: 'MRN-123',
        patientName: 'Test Patient',
        branchId: createObjectId(),
        departmentId: createObjectId(),
        departmentName: 'Test Dept',
        serviceId: createObjectId(),
        serviceName: 'Test Service',
        doctorId: createObjectId(),
        doctorName: 'Dr. Test',
        recommendationId: createObjectId(),
        scheduledStart: new Date(Date.now() + 86400000), // tomorrow
        scheduledEnd: new Date(Date.now() + 86400000 + 3600000),
        durationMinutes: 60,
      })),
      getRecommendation: vi.fn(async () => ({})),
      bookingReferences: vi.fn(async () => ({
        service: { _id: createObjectId(), bookingCapacity: 1, ...procedureConfig },
        doctor: { _id: createObjectId(), displayName: 'Dr. Test' }
      })),
      hasAppointmentOverlap: vi.fn(async () => false),
      hasDoctorOverlap: vi.fn(async () => false),
      countServiceOverlap: vi.fn(async () => 0),
      validateHold: vi.fn(async () => true),
      confirmBooking: vi.fn(async () => true),
      rescheduleBooking: vi.fn(async () => true),
      acquireConcurrencyLock: vi.fn(async () => {}),
      audit: vi.fn(async () => {}),
      hasBranchAccess: vi.fn(async () => true),
      departmentScope: vi.fn(async () => undefined),
    } as unknown as ConstructorParameters<typeof SurgeryService>[0];

    const mockDoctors = {
      getById: vi.fn(async (id) => ({
        id,
        status: 'ACTIVE',
        availability: [
          { day_of_week: 'SUNDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59' }] },
          { day_of_week: 'MONDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59' }] },
          { day_of_week: 'TUESDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59' }] },
          { day_of_week: 'WEDNESDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59' }] },
          { day_of_week: 'THURSDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59' }] },
          { day_of_week: 'FRIDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59' }] },
          { day_of_week: 'SATURDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59' }] }
        ]
      })),
      hasActiveLeave: vi.fn(async () => false),
      getExceptionByDate: vi.fn(async () => null),
    } as unknown as ConstructorParameters<typeof SurgeryService>[1];

    const mockBeds = {
      verifyHold: vi.fn(async () => {})
    } as unknown as ConstructorParameters<typeof SurgeryService>[4];
    
    const mockPatients = {
      verifyContextConsent: vi.fn(async () => null),
      addProcedureTimeline: vi.fn(async () => {})
    } as unknown as ConstructorParameters<typeof SurgeryService>[2];

    const mockBilling = {
      verifyProcedureDeposit: vi.fn(async (_patientId: string, _branchId: string, _bookingId: string, invoiceId: string | null, requiredAmount: number) => {
        if (!requiredAmount) return { required_amount: 0, paid_amount: 0, remaining_amount: 0, satisfied: true, invoice_id: null, payment_ids: [], verified_at: new Date() };
        if (!invoiceId) return { required_amount: requiredAmount, paid_amount: 0, remaining_amount: requiredAmount, satisfied: false, invoice_id: null, payment_ids: [], verified_at: new Date() };
        return { required_amount: requiredAmount, paid_amount: requiredAmount, remaining_amount: 0, satisfied: true, invoice_id: invoiceId, payment_ids: [], verified_at: new Date() };
      }),
    } as unknown as ConstructorParameters<typeof SurgeryService>[3];

    const mockSettingsRepo = { get: async () => ({ localization: { timezone: 'UTC' } }) } as unknown as ConstructorParameters<typeof SurgeryService>[8];
    return new SurgeryService(
      mockRepo, mockDoctors, mockPatients, mockBilling, mockBeds, advancePaymentService, {} as unknown as ConstructorParameters<typeof SurgeryService>[6], {} as unknown as ConstructorParameters<typeof SurgeryService>[7], mockSettingsRepo
    );
  };

  it('confirmBooking succeeds when NOT_REQUIRED', async () => {
    const service = setupMockService({
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: 0
    });

    await expect(
      service.confirmBooking(createObjectId(), createObjectId(), {} as unknown as import('../src/modules/surgery/surgery.types.js').ConfirmSurgeryBookingDTO, createObjectId(), {} as unknown as import('../src/modules/surgery/surgery.types.js').SurgeryMetadata)
    ).resolves.toBeDefined();
  });

  it('confirmBooking fails when REQUIRED and PENDING', async () => {
    const service = setupMockService({
      requiresAdvanceDeposit: true,
      minimumAdvanceDepositAmount: 5000
    });

    await expect(
      service.confirmBooking(createObjectId(), createObjectId(), {} as unknown as import('../src/modules/surgery/surgery.types.js').ConfirmSurgeryBookingDTO, createObjectId(), {} as unknown as import('../src/modules/surgery/surgery.types.js').SurgeryMetadata)
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === 'ADVANCE_DEPOSIT_REQUIRED';
    });
  });

  it('rescheduleBooking recalculates requirement and blocks if unpaid', async () => {
    const service = setupMockService({
      requiresAdvanceDeposit: true,
      minimumAdvanceDepositAmount: 15000
    });

    const bookingId = createObjectId();
    const branchId = createObjectId();
    const actorId = createObjectId();

    // The booking is originally booked
    (service as unknown as { repository: { getBookingRecord: ReturnType<typeof vi.fn> } }).repository.getBookingRecord = vi.fn(async () => ({
      _id: bookingId,
      status: 'BOOKED',
      patientId: createObjectId(),
      branchId: branchId,
      departmentId: createObjectId(),
      serviceId: createObjectId(),
      doctorId: createObjectId(),
      recommendationId: createObjectId(),
      scheduledStart: new Date(Date.now() + 86400000),
      durationMinutes: 60,
    }));

    await expect(
      service.rescheduleBooking(bookingId, branchId, {
        doctor_id: createObjectId(),
        scheduled_start: new Date(Date.now() + 172800000).toISOString(), // 2 days from now
        reason: 'Patient request'
      }, actorId, {} as unknown as import('../src/modules/surgery/surgery.types.js').SurgeryMetadata)
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AppError && err.code === 'ADVANCE_DEPOSIT_REQUIRED';
    });
  });
});
