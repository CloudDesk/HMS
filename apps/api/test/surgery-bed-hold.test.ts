import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { SurgeryService } from '../src/modules/surgery/surgery.service.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { SurgeryRepository } from '../src/modules/surgery/surgery.repository.js';
import { ProcedureRecommendationModel, ProcedureBookingModel } from '../src/modules/surgery/surgery.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { Types } from 'mongoose';
import { AppError } from '../src/shared/errors/app-error.js';

test('Surgery Bed-Hold Lifecycle', async (t) => {
  await setupTestDatabase();

  const sequenceService = new SequenceService();
  const repository = new SurgeryRepository(sequenceService);
  const branchId = createObjectId();
  const departmentId = createObjectId();
  const doctorId = createObjectId();
  const serviceId = createObjectId();
  const actorId = createObjectId();
  const patientId = createObjectId();

  const mockBeds = {
    releaseHoldSafe: mock.fn(async () => true),
    cancelAdmissionRequestHold: mock.fn(async () => { throw new AppError('Active bed hold not found', 409, 'BED_HOLD_CONFLICT') }),
    validateHold: mock.fn(async () => true),
  } as unknown as ConstructorParameters<typeof SurgeryService>[4];

  const mockDoctors = {
    getById: mock.fn(async (id) => ({
      id: id.toString(),
      status: 'ACTIVE',
      availability: [
        { day_of_week: 'SUNDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59', slot_duration_minutes: 60 }] },
        { day_of_week: 'MONDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59', slot_duration_minutes: 60 }] },
        { day_of_week: 'TUESDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59', slot_duration_minutes: 60 }] },
        { day_of_week: 'WEDNESDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59', slot_duration_minutes: 60 }] },
        { day_of_week: 'THURSDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59', slot_duration_minutes: 60 }] },
        { day_of_week: 'FRIDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59', slot_duration_minutes: 60 }] },
        { day_of_week: 'SATURDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59', slot_duration_minutes: 60 }] }
      ]
    })),
    hasActiveLeave: mock.fn(async () => false),
    getExceptionByDate: mock.fn(async () => null),
  } as unknown as ConstructorParameters<typeof SurgeryService>[1];
  const mockPatients = { addProcedureTimeline: mock.fn(async () => {}), verifyContextConsent: mock.fn(async () => null) } as unknown as ConstructorParameters<typeof SurgeryService>[2];
  const mockAdvancePayment = { syncRequirement: mock.fn(async () => ({ requirement_status: 'NOT_REQUIRED', paid_amount: 0 })) } as unknown as ConstructorParameters<typeof SurgeryService>[5];

  const mockSettingsRepo = { get: async () => ({ localization: { timezone: 'UTC' } }) } as unknown as ConstructorParameters<typeof SurgeryService>[8];
  const service = new SurgeryService(
    repository, mockDoctors, mockPatients, {} as unknown as ConstructorParameters<typeof SurgeryService>[3], mockBeds, mockAdvancePayment, {} as unknown as ConstructorParameters<typeof SurgeryService>[6], {} as unknown as ConstructorParameters<typeof SurgeryService>[7], mockSettingsRepo
  );

  t.beforeEach(async () => {
    mock.method(repository, 'hasBranchAccess', async () => true);
    mock.method(repository, 'departmentScope', async () => undefined);
    mock.method(repository, 'audit', async () => {});
    mock.method(repository, 'acquireConcurrencyLock', async () => {});
    mock.method(repository, 'validateHold', async () => true);
    mockBeds.releaseHoldSafe.mock.resetCalls();

    await BranchModel.create({ _id: branchId, name: 'Main', code: 'MAIN', status: 'ACTIVE' });
    await DepartmentModel.create({ _id: departmentId, name: 'Surgery', code: 'SURG', branchIds: [branchId], status: 'ACTIVE' });
    
    await DoctorModel.create({
      _id: doctorId, branchId, departmentId, doctorNumber: 'DOC-1', firstName: 'Dr.', lastName: 'Surgeon', displayName: 'Dr. Surgeon', specialization: 'General', status: 'ACTIVE'
    });

    await ServiceModel.create({
      _id: serviceId, name: 'Appendectomy', code: 'APP', departmentId, serviceType: 'PROCEDURE', defaultDurationMinutes: 60, bookingCapacity: 1, status: 'ACTIVE', requiresBed: true, requiresConsent: false, requiresAdvanceDeposit: false, standardPrice: 100
    });
  });

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  const setupBooking = async (status: string, holdId: string | null = null, scheduledStart = new Date(Date.now() - 3600000)) => {
    const rec = await ProcedureRecommendationModel.create({
      recommendationNumber: 'REC-1', patientId, patientNumber: 'P-1', patientName: 'P', branchId, departmentId, departmentName: 'Surgery', recommendingDoctorId: doctorId, recommendingDoctorName: 'Dr', serviceId, serviceName: 'App', encounterType: 'OPD_VISIT', encounterId: createObjectId(), clinicalReason: 'R', status: 'BOOKED', createdBy: actorId, updatedBy: actorId
    });
    const booking = await ProcedureBookingModel.create({
      bookingNumber: 'B-1', recommendationId: rec._id, patientId, patientNumber: 'P-1', patientName: 'P', branchId, departmentId, departmentName: 'Surgery', doctorId, doctorName: 'Dr', serviceId, serviceName: 'App', scheduledStart, scheduledEnd: new Date(scheduledStart.getTime() + 3600000), durationMinutes: 60, status, createdBy: actorId, updatedBy: actorId, holdId: holdId ? new Types.ObjectId(holdId) : null
    });
    return booking;
  };

  await t.test('Rescheduling drops the old hold when a new hold is provided', async () => {
    const oldHoldId = createObjectId();
    const booking = await setupBooking('BOOKED', oldHoldId);
    
    const newHoldId = createObjectId();
    await service.rescheduleBooking(booking._id.toString(), branchId, {
      scheduled_start: new Date(Date.now() + 186400000).toISOString(),
      reason: 'Patient requested',
      hold_id: newHoldId
    }, actorId, {} as unknown as import('mongoose').ClientSession);

    assert.equal(mockBeds.releaseHoldSafe.mock.calls.length, 1);
    assert.equal(mockBeds.releaseHoldSafe.mock.calls[0].arguments[0], oldHoldId);
  });

  await t.test('Rescheduling keeps the old hold if hold_id is unchanged/omitted', async () => {
    const oldHoldId = createObjectId();
    const booking = await setupBooking('BOOKED', oldHoldId);
    
    await service.rescheduleBooking(booking._id.toString(), branchId, {
      scheduled_start: new Date(Date.now() + 186400000).toISOString(),
      reason: 'Patient requested',
    }, actorId, {} as unknown as import('mongoose').ClientSession);

    assert.equal(mockBeds.releaseHoldSafe.mock.calls.length, 0, 'Should not release the old hold if new hold is not provided (re-using old hold)');
  });

  await t.test('Complete Booking releases the hold safely', async () => {
    const holdId = createObjectId();
    const booking = await setupBooking('BOOKED', holdId);
    
    await service.completeBooking(booking._id.toString(), branchId, actorId, {} as unknown as import('mongoose').ClientSession);

    assert.equal(mockBeds.releaseHoldSafe.mock.calls.length, 1);
    assert.equal(mockBeds.releaseHoldSafe.mock.calls[0].arguments[0], holdId);
  });

  await t.test('Cancel Booking uses releaseHoldSafe instead of cancelAdmissionRequestHold', async () => {
    const holdId = createObjectId();
    const booking = await setupBooking('PENDING_CONFIRMATION', holdId);
    
    await service.cancelBooking(booking._id.toString(), branchId, { reason: 'No longer needed' }, actorId, {} as unknown as import('mongoose').ClientSession);

    assert.equal(mockBeds.releaseHoldSafe.mock.calls.length, 1, 'releaseHoldSafe should have been called');
    assert.equal(mockBeds.releaseHoldSafe.mock.calls[0].arguments[0], holdId);
    assert.equal(mockBeds.cancelAdmissionRequestHold.mock.calls.length, 0, 'Old cancel method should not have been called');
  });

  await t.test('Cancel Booking succeeds even if releaseHoldSafe naturally returns true on an expired hold', async () => {
    // We already mocked releaseHoldSafe to just return true without throwing.
    // If it was still using cancelAdmissionRequestHold, it would have thrown BED_HOLD_CONFLICT.
    const holdId = createObjectId();
    const booking = await setupBooking('PENDING_CONFIRMATION', holdId);
    
    await assert.doesNotReject(async () => {
      await service.cancelBooking(booking._id.toString(), branchId, { reason: 'No longer needed' }, actorId, {} as unknown as import('mongoose').ClientSession);
    });
  });
});
