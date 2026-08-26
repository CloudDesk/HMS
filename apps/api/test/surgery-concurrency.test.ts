import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
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

test('Surgery Concurrency Double-Booking Prevention', async (t) => {
  await setupTestDatabase();

  const sequenceService = new SequenceService();
  const repository = new SurgeryRepository(sequenceService);
  
  // Use a minimal mock for services that aren't the database
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

  const mockPatients = {
    addProcedureTimeline: mock.fn(async () => {})
  } as unknown as ConstructorParameters<typeof SurgeryService>[2];
  
  const mockBeds = {} as unknown as ConstructorParameters<typeof SurgeryService>[4];
  const mockAdvancePayment = {} as unknown as ConstructorParameters<typeof SurgeryService>[5];
  const mockBilling = {} as unknown as ConstructorParameters<typeof SurgeryService>[3];
  const mockClinicalOrders = {} as unknown as ConstructorParameters<typeof SurgeryService>[7];
  const mockPrescriptions = {} as unknown as ConstructorParameters<typeof SurgeryService>[6];

  const mockSettingsRepo = { get: async () => ({ localization: { timezone: 'UTC' } }) } as unknown as ConstructorParameters<typeof SurgeryService>[8];
  const service = new SurgeryService(
    repository, mockDoctors, mockPatients, mockBilling, mockBeds, mockAdvancePayment, mockPrescriptions, mockClinicalOrders, mockSettingsRepo
  );

  let branchId: string;
  let departmentId: string;
  let doctorId: string;

  let actorId: string;
  let serviceId: string;

  t.beforeEach(async () => {
    // We must mock authorization so the test can run
    mock.method(repository, 'hasBranchAccess', async () => true);
    mock.method(repository, 'departmentScope', async () => undefined);
    mock.method(repository, 'audit', async () => {});

    branchId = createObjectId();
    departmentId = createObjectId();
    doctorId = createObjectId();
    actorId = createObjectId();
    serviceId = createObjectId();
    
    // Seed required master data for actual database lookups
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

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  await t.test('Concurrent bookings for the same doctor and exact overlapping time result in exactly one success and one conflict', async () => {
    // 1. Setup a single doctor and procedure service with capacity 1
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

    // 2. We need TWO different recommendations (from two different patients) for the same doctor/service
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

    // 3. Fire genuine concurrent requests!
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

    // 4. Validate one success and one conflict
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    assert.equal(successes.length, 1, 'Exactly one concurrent booking should succeed');
    assert.equal(failures.length, 1, 'Exactly one concurrent booking should fail due to conflict');

    const failure = failures[0] as PromiseRejectedResult;
    assert.ok(failure.reason instanceof AppError, 'Failure should be an AppError');
    assert.equal(
      ['DOCTOR_PROCEDURE_CONFLICT', 'PROCEDURE_CAPACITY_CONFLICT'].includes(failure.reason.code), 
      true, 
      `Conflict code should be overlap or capacity conflict, got ${failure.reason.code}`
    );

    // 5. Verify database state
    const bookings = await ProcedureBookingModel.find({ doctorId: doctorId, status: { $in: ['PENDING_CONFIRMATION', 'BOOKED'] } });
    assert.equal(bookings.length, 1, 'Database should contain exactly one booking for the slot');
  });
  
  await t.test('Genuine Concurrent Service Capacity Test: capacity = 2, 3 requests -> 2 success, 1 conflict', async () => {
    // 1. Service with capacity = 2 (e.g. 2 Operating Rooms)
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
    
    // We need 3 DIFFERENT doctors, so there's no doctor overlap, only service overlap
    const doc2 = createObjectId();
    const doc3 = createObjectId();
    
    await DoctorModel.create({ _id: doc2, branchId: branchId, departmentId: departmentId, doctorNumber: 'DOC-2', firstName: 'A', lastName: 'B', displayName: 'Doc2', specialization: 'Gen', status: 'ACTIVE' });
    await DoctorModel.create({ _id: doc3, branchId: branchId, departmentId: departmentId, doctorNumber: 'DOC-3', firstName: 'C', lastName: 'D', displayName: 'Doc3', specialization: 'Gen', status: 'ACTIVE' });

    // We need 3 recommendations
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

    // 2. Fire 3 genuine concurrent requests
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

    // 3. Validate two successes and one conflict
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    if (successes.length !== 2) {
      console.log('Capacity test failed. Failure reasons:', failures.map(f => (f.reason as Error).message ?? f.reason));
    }

    assert.equal(successes.length, 2, 'Exactly 2 bookings should succeed because capacity is 2');
    assert.equal(failures.length, 1, 'Exactly 1 booking should fail because capacity is exceeded');

    const failure = failures[0] as PromiseRejectedResult;
    assert.ok(failure.reason instanceof AppError);
    assert.equal(failure.reason.code, 'PROCEDURE_CAPACITY_CONFLICT');

    // 4. Verify database state
    const bookings = await ProcedureBookingModel.find({ serviceId: serviceId, status: { $in: ['PENDING_CONFIRMATION', 'BOOKED'] } });
    assert.equal(bookings.length, 2, 'Database should contain exactly two bookings for the service');
  });
});
