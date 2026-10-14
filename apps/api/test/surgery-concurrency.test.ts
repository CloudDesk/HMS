import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { SurgeryService } from '../src/modules/surgery/surgery.service.js';
import { SurgeryRepository } from '../src/modules/surgery/surgery.repository.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { ProcedureRecommendationModel, ProcedureBookingModel } from '../src/modules/surgery/surgery.model.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';

describe('Surgery Concurrency Double-Booking Prevention', () => {
  let repository: SurgeryRepository;
  let service: SurgeryService;

  const mockDoctors = {
    getById: vi.fn(async (id) => ({
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
    hasActiveLeave: vi.fn(async () => false),
    getExceptionByDate: vi.fn(async () => null),
  } as unknown as ConstructorParameters<typeof SurgeryService>[1];

  const mockPatients = {
    addProcedureTimeline: vi.fn(async () => {}),
    verifyContextConsent: vi.fn(async () => null)
  } as unknown as ConstructorParameters<typeof SurgeryService>[2];
  
  const mockBeds = {
    validateHold: vi.fn(async () => true),
    releaseHoldSafe: vi.fn(async () => true)
  } as unknown as ConstructorParameters<typeof SurgeryService>[4];
  const mockAdvancePayment = {} as unknown as ConstructorParameters<typeof SurgeryService>[5];
  const mockBilling = {
    createProcedureBookingInvoice: vi.fn(async () => null),
    verifyProcedureDeposit: vi.fn(async () => ({ satisfied: true }))
  } as unknown as ConstructorParameters<typeof SurgeryService>[3];
  const mockClinicalOrders = {} as unknown as ConstructorParameters<typeof SurgeryService>[7];
  const mockPrescriptions = {} as unknown as ConstructorParameters<typeof SurgeryService>[6];

  const mockSettingsRepo = { get: async () => ({ localization: { timezone: 'UTC' } }) } as unknown as ConstructorParameters<typeof SurgeryService>[8];

  let branchId: string;
  let departmentId: string;
  let doctorId: string;

  let actorId: string;
  let serviceId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    const sequenceService = new SequenceService();
    repository = new SurgeryRepository(sequenceService);
    service = new SurgeryService(
      repository, mockDoctors, mockPatients, mockBilling, mockBeds, mockAdvancePayment, mockPrescriptions, mockClinicalOrders, mockSettingsRepo
    );
  }, 30000);

  beforeEach(async () => {
    vi.spyOn(repository, 'hasBranchAccess').mockImplementation(async () => true);
    vi.spyOn(repository, 'departmentScope').mockImplementation(async () => undefined);
    vi.spyOn(repository, 'audit').mockImplementation(async () => {});

    branchId = createObjectId();
    departmentId = createObjectId();
    doctorId = createObjectId();
    actorId = createObjectId();
    serviceId = createObjectId();
    
    await BranchModel.create({ _id: branchId, name: 'Main', code: 'MAIN', status: 'ACTIVE' });
    await DepartmentModel.create({ _id: departmentId, name: 'Surgery', code: 'SURG', branchIds: [branchId], status: 'ACTIVE' });
    
    await DoctorModel.create({
      _id: doctorId,
      branchId: branchId,
      departmentId: departmentId,
      doctorNumber: 'DOC-1',
      firstName: 'Dr.',
      lastName: 'Surgeon',
      displayName: 'Dr. Surgeon',
      specialization: 'General',
      status: 'ACTIVE'
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('Concurrent bookings for the same doctor and exact overlapping time result in exactly one success and one conflict', async () => {
    await ServiceModel.create({
      _id: serviceId,
      name: 'Appendectomy',
      code: 'APP',
      departmentId: departmentId,
      serviceType: 'PROCEDURE',
      standardPrice: 1000,
      defaultDurationMinutes: 60,
      bookingCapacity: 1, // Only 1 can be booked at a time
      status: 'ACTIVE'
    });

    const patient1Id = createObjectId();
    const patient2Id = createObjectId();
    
    const rec1 = await ProcedureRecommendationModel.create({
      recommendationNumber: 'REC-001',
      patientId: patient1Id,
      patientNumber: 'P-001',
      patientName: 'Patient One',
      branchId: branchId,
      departmentId: departmentId,
      departmentName: 'Surgery',
      recommendingDoctorId: doctorId,
      recommendingDoctorName: 'Dr. Surgeon',
      serviceId: serviceId,
      serviceName: 'Appendectomy',
      encounterType: 'OPD_VISIT',
      encounterId: createObjectId(),
      clinicalReason: 'Reason 1',
      status: 'ACTIVE',
      createdBy: actorId,
      updatedBy: actorId
    });

    const rec2 = await ProcedureRecommendationModel.create({
      recommendationNumber: 'REC-002',
      patientId: patient2Id,
      patientNumber: 'P-002',
      patientName: 'Patient Two',
      branchId: branchId,
      departmentId: departmentId,
      departmentName: 'Surgery',
      recommendingDoctorId: doctorId,
      recommendingDoctorName: 'Dr. Surgeon',
      serviceId: serviceId,
      serviceName: 'Appendectomy',
      encounterType: 'OPD_VISIT',
      encounterId: createObjectId(),
      clinicalReason: 'Reason 2',
      status: 'ACTIVE',
      createdBy: actorId,
      updatedBy: actorId
    });

    const startTime = new Date(Date.now() + 86400000).toISOString(); // tomorrow

    const results = await Promise.allSettled([
      service.createBooking({
        recommendation_id: rec1._id.toString(),
        branch_id: branchId,
        department_id: departmentId,
        doctor_id: doctorId,
        scheduled_start: startTime
      }, actorId, {} as unknown as import('mongoose').ClientSession),
      service.createBooking({
        recommendation_id: rec2._id.toString(),
        branch_id: branchId,
        department_id: departmentId,
        doctor_id: doctorId,
        scheduled_start: startTime
      }, actorId, {} as unknown as import('mongoose').ClientSession)
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const failure = failures[0] as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(AppError);
    expect(['DOCTOR_PROCEDURE_CONFLICT', 'PROCEDURE_CAPACITY_CONFLICT']).toContain(failure.reason.code);

    const bookings = await ProcedureBookingModel.find({ doctorId: doctorId, status: { $in: ['PENDING_CONFIRMATION', 'BOOKED'] } });
    expect(bookings.length).toBe(1);
  });
  
  it('Genuine Concurrent Service Capacity Test: capacity = 2, 3 requests -> 2 success, 1 conflict', async () => {
    await ServiceModel.create({
      _id: serviceId,
      name: 'MRI',
      code: 'MRI',
      departmentId: departmentId,
      serviceType: 'PROCEDURE',
      standardPrice: 2000,
      defaultDurationMinutes: 60,
      bookingCapacity: 2, // Capacity is 2
      status: 'ACTIVE'
    });
    
    const doc2 = createObjectId();
    const doc3 = createObjectId();
    
    await DoctorModel.create({ _id: doc2, branchId: branchId, departmentId: departmentId, doctorNumber: 'DOC-2', firstName: 'A', lastName: 'B', displayName: 'Doc2', specialization: 'Gen', status: 'ACTIVE' });
    await DoctorModel.create({ _id: doc3, branchId: branchId, departmentId: departmentId, doctorNumber: 'DOC-3', firstName: 'C', lastName: 'D', displayName: 'Doc3', specialization: 'Gen', status: 'ACTIVE' });

    const recs = [];
    for(let i=0; i<3; i++) {
       recs.push(await ProcedureRecommendationModel.create({
        recommendationNumber: 'REC-' + i,
        patientId: createObjectId(),
        patientNumber: 'P-' + i,
        patientName: 'Patient ' + i,
        branchId: branchId,
        departmentId: departmentId,
        departmentName: 'Surgery',
        recommendingDoctorId: [doctorId, doc2, doc3][i],
        recommendingDoctorName: 'Doc',
        serviceId: serviceId,
        serviceName: 'MRI',
        encounterType: 'OPD_VISIT',
        encounterId: createObjectId(),
        clinicalReason: 'R',
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId
      }));
    }

    const startTime = new Date(Date.now() + 86400000).toISOString(); // tomorrow

    const results = await Promise.allSettled([
      service.createBooking({
        recommendation_id: recs[0]._id.toString(),
        branch_id: branchId,
        department_id: departmentId,
        doctor_id: doctorId, // Doc 1
        scheduled_start: startTime
      }, actorId, {} as unknown as import('mongoose').ClientSession),
      service.createBooking({
        recommendation_id: recs[1]._id.toString(),
        branch_id: branchId,
        department_id: departmentId,
        doctor_id: doc2, // Doc 2
        scheduled_start: startTime
      }, actorId, {} as unknown as import('mongoose').ClientSession),
      service.createBooking({
        recommendation_id: recs[2]._id.toString(),
        branch_id: branchId,
        department_id: departmentId,
        doctor_id: doc3, // Doc 3
        scheduled_start: startTime
      }, actorId, {} as unknown as import('mongoose').ClientSession)
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    expect(successes.length).toBe(2);
    expect(failures.length).toBe(1);

    const failure = failures[0] as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(AppError);
    expect(failure.reason.code).toBe('PROCEDURE_CAPACITY_CONFLICT');

    const bookings = await ProcedureBookingModel.find({ serviceId: serviceId, status: { $in: ['PENDING_CONFIRMATION', 'BOOKED'] } });
    expect(bookings.length).toBe(2);
  });

  describe('Surgery Rescheduling Concurrency & Validation', () => {
    const setupBooking = async (
      status = 'BOOKED',
      scheduledStart = new Date(Date.now() + 86400000),
      docId = doctorId,
      servId = serviceId,
    ) => {
      const patientId = createObjectId();
      const rec = await ProcedureRecommendationModel.create({
        recommendationNumber: 'REC-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        patientId,
        patientNumber: 'P-1',
        patientName: 'Patient Test',
        branchId,
        departmentId,
        departmentName: 'Surgery',
        recommendingDoctorId: docId,
        recommendingDoctorName: 'Dr. Surgeon',
        serviceId: servId,
        serviceName: 'Appendectomy',
        encounterType: 'OPD_VISIT',
        encounterId: createObjectId(),
        clinicalReason: 'Clinical Reason',
        status: 'BOOKED',
        createdBy: actorId,
        updatedBy: actorId,
      });
      const duration = 60;
      const booking = await ProcedureBookingModel.create({
        bookingNumber: 'B-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        recommendationId: rec._id,
        patientId,
        patientNumber: 'P-1',
        patientName: 'Patient Test',
        branchId,
        departmentId,
        departmentName: 'Surgery',
        doctorId: docId,
        doctorName: 'Dr. Surgeon',
        serviceId: servId,
        serviceName: 'Appendectomy',
        scheduledStart,
        scheduledEnd: new Date(scheduledStart.getTime() + duration * 60000),
        durationMinutes: duration,
        status,
        createdBy: actorId,
        updatedBy: actorId,
      });
      return booking;
    };

    beforeEach(async () => {
      await ServiceModel.create({
        _id: serviceId,
        name: 'Appendectomy',
        code: 'APP',
        departmentId: departmentId,
        serviceType: 'PROCEDURE',
        standardPrice: 1000,
        defaultDurationMinutes: 60,
        bookingCapacity: 1,
        status: 'ACTIVE',
      });
    });

    it('A valid reschedule succeeds and updates booking time and history', async () => {
      const initialStart = new Date(Date.now() + 86400000);
      initialStart.setSeconds(0, 0);
      const booking = await setupBooking('BOOKED', initialStart);
      const newStart = new Date(Date.now() + 2 * 86400000);
      newStart.setSeconds(0, 0);

      const result = await service.rescheduleBooking(
        booking._id.toString(),
        branchId,
        {
          scheduled_start: newStart.toISOString(),
          reason: 'Patient requested new date',
        },
        actorId,
        {} as unknown as import('mongoose').ClientSession,
      );

      expect(result).toBeDefined();
      expect(new Date(result.scheduled_start).toISOString()).toBe(newStart.toISOString());
      expect(result.schedule_history.length).toBe(1);
      expect(result.schedule_history[0].reason).toBe('Patient requested new date');

      const persisted = await ProcedureBookingModel.findById(booking._id);
      expect(persisted!.scheduledStart.toISOString()).toBe(newStart.toISOString());
    });

    it('A conflicting reschedule is rejected with DOCTOR_PROCEDURE_CONFLICT', async () => {
      const slotTime = new Date(Date.now() + 86400000);
      slotTime.setSeconds(0, 0);
      await setupBooking('BOOKED', slotTime);

      const otherTime = new Date(Date.now() + 2 * 86400000);
      otherTime.setSeconds(0, 0);
      const bookingToReschedule = await setupBooking('BOOKED', otherTime);

      await expect(
        service.rescheduleBooking(
          bookingToReschedule._id.toString(),
          branchId,
          {
            scheduled_start: slotTime.toISOString(),
            reason: 'Attempt conflict',
          },
          actorId,
          {} as unknown as import('mongoose').ClientSession,
        ),
      ).rejects.toThrow(AppError);

      const persisted = await ProcedureBookingModel.findById(bookingToReschedule._id);
      expect(persisted!.scheduledStart.toISOString()).toBe(otherTime.toISOString());
    });

    it('Concurrent rescheduling attempts cannot both claim the same slot', async () => {
      const targetTime = new Date(Date.now() + 3 * 86400000);
      targetTime.setSeconds(0, 0);

      const startA = new Date(Date.now() + 86400000);
      startA.setSeconds(0, 0);
      const startB = new Date(Date.now() + 2 * 86400000);
      startB.setSeconds(0, 0);

      const bookingA = await setupBooking('BOOKED', startA);
      const bookingB = await setupBooking('BOOKED', startB);

      const results = await Promise.allSettled([
        service.rescheduleBooking(
          bookingA._id.toString(),
          branchId,
          {
            scheduled_start: targetTime.toISOString(),
            reason: 'Booking A moves to target',
          },
          actorId,
          {} as unknown as import('mongoose').ClientSession,
        ),
        service.rescheduleBooking(
          bookingB._id.toString(),
          branchId,
          {
            scheduled_start: targetTime.toISOString(),
            reason: 'Booking B moves to target',
          },
          actorId,
          {} as unknown as import('mongoose').ClientSession,
        ),
      ]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      const failure = failures[0] as PromiseRejectedResult;
      expect(failure.reason).toBeInstanceOf(AppError);
      expect(['DOCTOR_PROCEDURE_CONFLICT', 'PROCEDURE_CAPACITY_CONFLICT']).toContain(failure.reason.code);

      const bookedAtTarget = await ProcedureBookingModel.find({
        doctorId,
        scheduledStart: targetTime,
        status: { $in: ['PENDING_CONFIRMATION', 'BOOKED'] },
      });
      expect(bookedAtTarget.length).toBe(1);
    });

    it('Lock acquisition failure prevents reschedule from proceeding and leaves state intact', async () => {
      const initialStart = new Date(Date.now() + 86400000);
      initialStart.setSeconds(0, 0);
      const booking = await setupBooking('BOOKED', initialStart);
      const targetTime = new Date(Date.now() + 2 * 86400000);
      targetTime.setSeconds(0, 0);

      const lockSpy = vi.spyOn(repository, 'acquireConcurrencyLock').mockRejectedValueOnce(
        new Error('Database write conflict simulation'),
      );

      await expect(
        service.rescheduleBooking(
          booking._id.toString(),
          branchId,
          {
            scheduled_start: targetTime.toISOString(),
            reason: 'Attempt with broken lock',
          },
          actorId,
          {} as unknown as import('mongoose').ClientSession,
        ),
      ).rejects.toThrow('Database write conflict simulation');

      expect(lockSpy).toHaveBeenCalledWith(doctorId, serviceId, expect.anything(), booking.patientId.toString());

      const persisted = await ProcedureBookingModel.findById(booking._id);
      expect(persisted!.scheduledStart.toISOString()).toBe(booking.scheduledStart.toISOString());
    });

    it('Validation failure rolls back and subsequent valid reschedule succeeds without deadlock', async () => {
      const start1 = new Date(Date.now() + 86400000);
      start1.setSeconds(0, 0);
      const existing = await setupBooking('BOOKED', start1);

      const start2 = new Date(Date.now() + 2 * 86400000);
      start2.setSeconds(0, 0);
      const booking = await setupBooking('BOOKED', start2);

      await expect(
        service.rescheduleBooking(
          booking._id.toString(),
          branchId,
          {
            scheduled_start: existing.scheduledStart.toISOString(),
            reason: 'Fails validation',
          },
          actorId,
          {} as unknown as import('mongoose').ClientSession,
        ),
      ).rejects.toThrow(AppError);

      const validTime = new Date(Date.now() + 4 * 86400000);
      validTime.setSeconds(0, 0);
      const successResult = await service.rescheduleBooking(
        booking._id.toString(),
        branchId,
        {
          scheduled_start: validTime.toISOString(),
          reason: 'Valid new slot',
        },
        actorId,
        {} as unknown as import('mongoose').ClientSession,
      );

      expect(successResult).toBeDefined();
      expect(new Date(successResult.scheduled_start).toISOString()).toBe(validTime.toISOString());
    });

    it('Two concurrent surgery bookings for the same patient with different doctors cannot both succeed', async () => {
      const doc2 = createObjectId();
      await DoctorModel.create({
        _id: doc2,
        branchId,
        departmentId,
        doctorNumber: 'DOC-99',
        firstName: 'Second',
        lastName: 'Surgeon',
        displayName: 'Dr. Second',
        specialization: 'General',
        status: 'ACTIVE',
      });

      const service2Id = createObjectId();
      await ServiceModel.create({
        _id: service2Id,
        name: 'Biopsy',
        code: 'BIO',
        departmentId,
        serviceType: 'PROCEDURE',
        standardPrice: 1500,
        defaultDurationMinutes: 60,
        bookingCapacity: 1,
        status: 'ACTIVE',
      });

      const commonPatientId = createObjectId();
      await PatientModel.create({
        _id: commonPatientId,
        patientNumber: 'P-SHARED',
        firstName: 'Shared',
        lastName: 'Patient',
        gender: 'OTHER',
        dateOfBirth: new Date('1990-01-01'),
        status: 'ACTIVE',
      });
      const rec1 = await ProcedureRecommendationModel.create({
        recommendationNumber: 'REC-P1',
        patientId: commonPatientId,
        patientNumber: 'P-SHARED',
        patientName: 'Shared Patient',
        branchId,
        departmentId,
        departmentName: 'Surgery',
        recommendingDoctorId: doctorId,
        recommendingDoctorName: 'Dr. Surgeon',
        serviceId,
        serviceName: 'Appendectomy',
        encounterType: 'OPD_VISIT',
        encounterId: createObjectId(),
        clinicalReason: 'Reason 1',
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      });

      const rec2 = await ProcedureRecommendationModel.create({
        recommendationNumber: 'REC-P2',
        patientId: commonPatientId,
        patientNumber: 'P-SHARED',
        patientName: 'Shared Patient',
        branchId,
        departmentId,
        departmentName: 'Surgery',
        recommendingDoctorId: doc2,
        recommendingDoctorName: 'Dr. Second',
        serviceId: service2Id,
        serviceName: 'Biopsy',
        encounterType: 'OPD_VISIT',
        encounterId: createObjectId(),
        clinicalReason: 'Reason 2',
        status: 'ACTIVE',
        createdBy: actorId,
        updatedBy: actorId,
      });

      const startTime = new Date(Date.now() + 5 * 86400000).toISOString();

      const results = await Promise.allSettled([
        service.createBooking(
          {
            recommendation_id: rec1._id.toString(),
            branch_id: branchId,
            department_id: departmentId,
            doctor_id: doctorId,
            scheduled_start: startTime,
          },
          actorId,
          {} as unknown as import('mongoose').ClientSession,
        ),
        service.createBooking(
          {
            recommendation_id: rec2._id.toString(),
            branch_id: branchId,
            department_id: departmentId,
            doctor_id: doc2,
            scheduled_start: startTime,
          },
          actorId,
          {} as unknown as import('mongoose').ClientSession,
        ),
      ]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      const failure = failures[0] as PromiseRejectedResult;
      expect(failure.reason).toBeInstanceOf(AppError);
      expect(failure.reason.code).toBe('PATIENT_PROCEDURE_CONFLICT');

      const bookings = await ProcedureBookingModel.find({
        patientId: commonPatientId,
        status: { $in: ['PENDING_CONFIRMATION', 'BOOKED'] },
      });
      expect(bookings.length).toBe(1);
    });
  });
});
