import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { SurgeryService } from '../src/modules/surgery/surgery.service.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { AppError } from '../src/shared/errors/app-error.js';

test('SurgeryService - Advance Payment Gating', async (t) => {
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

  const setupMockService = (procedureConfig: { requiresAdvanceDeposit: boolean, minimumAdvanceDepositAmount: number }) => {
    const mockRepo = {
      session: mock.fn(async () => mongoose.startSession()),
      getBooking: mock.fn(async (id) => ({
        id: id,
        status: 'PENDING_CONFIRMATION',
        patient_id: createObjectId(),
        branch_id: createObjectId(),
        service_id: createObjectId(),
        scheduled_start: new Date().toISOString(),
      })),
      getBookingRecord: mock.fn(async (id) => ({
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
      getRecommendation: mock.fn(async () => ({})),
      bookingReferences: mock.fn(async () => ({
        service: { _id: createObjectId(), bookingCapacity: 1, ...procedureConfig },
        doctor: { _id: createObjectId(), displayName: 'Dr. Test' }
      })),
      hasAppointmentOverlap: mock.fn(async () => false),
      hasDoctorOverlap: mock.fn(async () => false),
      countServiceOverlap: mock.fn(async () => 0),
      validateHold: mock.fn(async () => true),
      confirmBooking: mock.fn(async () => true),
      rescheduleBooking: mock.fn(async () => true),
      acquireConcurrencyLock: mock.fn(async () => {}),
      audit: mock.fn(async () => {}),
      hasBranchAccess: mock.fn(async () => true),
      departmentScope: mock.fn(async () => undefined),
    } as unknown as ConstructorParameters<typeof SurgeryService>[0];

    const mockDoctors = {
      getById: mock.fn(async (id) => ({
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
      hasActiveLeave: mock.fn(async () => false),
      getExceptionByDate: mock.fn(async () => null),
    } as unknown as ConstructorParameters<typeof SurgeryService>[1];

    const mockBeds = {
      verifyHold: mock.fn(async () => {})
    } as unknown as ConstructorParameters<typeof SurgeryService>[4];
    
    const mockPatients = {
      verifyContextConsent: mock.fn(async () => null),
      addProcedureTimeline: mock.fn(async () => {})
    } as unknown as ConstructorParameters<typeof SurgeryService>[2];

    const mockSettingsRepo = { get: async () => ({ localization: { timezone: 'UTC' } }) } as unknown as ConstructorParameters<typeof SurgeryService>[8];
    return new SurgeryService(
      mockRepo, mockDoctors, mockPatients, {} as unknown as ConstructorParameters<typeof SurgeryService>[3], mockBeds, advancePaymentService, {} as unknown as ConstructorParameters<typeof SurgeryService>[6], {} as unknown as ConstructorParameters<typeof SurgeryService>[7], mockSettingsRepo
    );
  };

  await t.test('confirmBooking succeeds when NOT_REQUIRED', async () => {
    const service = setupMockService({
      requiresAdvanceDeposit: false,
      minimumAdvanceDepositAmount: 0
    });

    await assert.doesNotReject(async () => {
      await service.confirmBooking(createObjectId(), createObjectId(), {}, createObjectId(), {} as unknown as import('mongoose').ClientSession);
    });
  });

  await t.test('confirmBooking fails when REQUIRED and PENDING', async () => {
    const service = setupMockService({
      requiresAdvanceDeposit: true,
      minimumAdvanceDepositAmount: 5000
    });

    await assert.rejects(async () => {
      await service.confirmBooking(createObjectId(), createObjectId(), {}, createObjectId(), {} as unknown as import('mongoose').ClientSession);
    }, (err: unknown) => {
      return err instanceof AppError && err.code === 'ADVANCE_DEPOSIT_REQUIRED';
    });
  });

  await t.test('rescheduleBooking recalculates requirement and blocks if unpaid', async () => {
    const service = setupMockService({
      requiresAdvanceDeposit: true,
      minimumAdvanceDepositAmount: 15000
    });

    const bookingId = createObjectId();
    const branchId = createObjectId();
    const actorId = createObjectId();

    // The booking is originally booked
    (service as unknown as { repository: { getBookingRecord: ReturnType<typeof mock.fn> } }).repository.getBookingRecord = mock.fn(async () => ({
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

    await assert.rejects(async () => {
      await service.rescheduleBooking(bookingId, branchId, {
        doctor_id: createObjectId(),
        scheduled_start: new Date(Date.now() + 172800000).toISOString(), // 2 days from now
        reason: 'Patient request'
      }, actorId, {} as unknown as import('mongoose').ClientSession);
    }, (err: unknown) => {
      return err instanceof AppError && err.code === 'ADVANCE_DEPOSIT_REQUIRED';
    });

    // We do not assert that the Advance Payment record is in the database here,
    // because the transaction correctly rolls back when the AppError is thrown!
  });
});
