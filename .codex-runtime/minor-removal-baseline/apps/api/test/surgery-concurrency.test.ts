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
});
