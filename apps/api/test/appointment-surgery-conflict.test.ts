import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { Types } from 'mongoose';
import { AppError } from '../src/shared/errors/app-error.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { AppointmentRepository } from '../src/modules/appointments/appointment.repository.js';
import { AppointmentService } from '../src/modules/appointments/appointment.service.js';
import { AppointmentModel } from '../src/modules/appointments/appointment.model.js';
import { ProcedureBookingModel, ProcedureRecommendationModel } from '../src/modules/surgery/surgery.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';
import { ServiceModel } from '../src/modules/services/service.model.js';

describe('Appointment & Surgery Cross-Module Conflict Validation', () => {
  let repository: AppointmentRepository;
  let service: AppointmentService;

  let branchId: string;
  let departmentId: string;
  let doctorId: string;
  let doctor2Id: string;
  let patientId: string;
  let serviceId: string;
  let actorId: string;

  const mockPatientRepo = {
    getById: vi.fn(async (id: string) => ({
      id,
      patient_number: 'P-001',
      first_name: 'John',
      last_name: 'Doe',
      status: 'ACTIVE',
      phone: '+919876543210',
    })),
    addTimelineEvent: vi.fn(async () => {}),
  } as unknown as ConstructorParameters<typeof AppointmentService>[1];

  const mockDoctorRepo = {
    getById: vi.fn(async (id: string) => {
      if (id === doctorId) {
        return {
          id: doctorId,
          doctor_number: 'DOC-1',
          displayName: 'Dr. Surgeon',
          display_name: 'Dr. Surgeon',
          branch_id: branchId,
          department_id: departmentId,
          specialization: 'General Surgery',
          status: 'ACTIVE',
          availability: [
            {
              day_of_week: 'TUESDAY',
              is_available: true,
              working_blocks: [{ start_time: '08:00', end_time: '18:00', slot_duration_minutes: 30 }],
            },
          ],
        };
      }
      return {
        id: doctor2Id,
        doctor_number: 'DOC-2',
        displayName: 'Dr. Other',
        display_name: 'Dr. Other',
        branch_id: branchId,
        department_id: departmentId,
        specialization: 'Cardiology',
        status: 'ACTIVE',
        availability: [
          {
            day_of_week: 'TUESDAY',
            is_available: true,
            working_blocks: [{ start_time: '08:00', end_time: '18:00', slot_duration_minutes: 30 }],
          },
        ],
      };
    }),
    hasActiveLeave: vi.fn(async () => false),
    getExceptionByDate: vi.fn(async () => null),
  } as unknown as ConstructorParameters<typeof AppointmentService>[2];

  const mockOpdVisitRepo = {} as unknown as ConstructorParameters<typeof AppointmentService>[3];
  const mockSettingsRepo = {
    get: vi.fn(async () => ({
      localization: { timezone: 'UTC' },
    })),
  } as unknown as ConstructorParameters<typeof AppointmentService>[4];

  beforeAll(async () => {
    await setupTestDatabase();
    repository = new AppointmentRepository();
    const sequenceService = new SequenceService();
    service = new AppointmentService(
      repository,
      mockPatientRepo,
      mockDoctorRepo,
      mockOpdVisitRepo,
      mockSettingsRepo,
      sequenceService,
    );
  }, 30000);

  beforeEach(async () => {
    branchId = createObjectId();
    departmentId = createObjectId();
    doctorId = createObjectId();
    doctor2Id = createObjectId();
    patientId = createObjectId();
    serviceId = createObjectId();
    actorId = createObjectId();

    await BranchModel.create({ _id: branchId, name: 'Main Branch', code: 'MAIN', status: 'ACTIVE' });
    await DepartmentModel.create({ _id: departmentId, name: 'General', code: 'GEN', branchIds: [branchId], status: 'ACTIVE' });
    await ServiceModel.create({
      _id: serviceId,
      name: 'Procedure Service',
      code: 'PROC',
      departmentId,
      serviceType: 'PROCEDURE',
      standardPrice: 1000,
      defaultDurationMinutes: 60,
      bookingCapacity: 1,
      status: 'ACTIVE',
    });

    await DoctorModel.create([
      {
        _id: doctorId,
        branchId,
        departmentId,
        doctorNumber: 'DOC-1',
        firstName: 'Dr.',
        lastName: 'Surgeon',
        displayName: 'Dr. Surgeon',
        specialization: 'General Surgery',
        status: 'ACTIVE',
      },
      {
        _id: doctor2Id,
        branchId,
        departmentId,
        doctorNumber: 'DOC-2',
        firstName: 'Dr.',
        lastName: 'Other',
        displayName: 'Dr. Other',
        specialization: 'Cardiology',
        status: 'ACTIVE',
      },
    ]);

    await PatientModel.create({
      _id: patientId,
      patientNumber: 'P-001',
      firstName: 'John',
      lastName: 'Doe',
      gender: 'MALE',
      dateOfBirth: new Date('1990-01-01'),
      status: 'ACTIVE',
      phone: '+919876543210',
    });

    vi.spyOn(repository, 'resolveBranchScope').mockImplementation(async () => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  const setupSurgeryBooking = async (
    docId: string,
    scheduledStart: Date,
    durationMinutes = 60,
    status = 'BOOKED',
    targetPatientId = createObjectId(),
  ) => {
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60000);
    const rec = await ProcedureRecommendationModel.create({
      recommendationNumber: 'REC-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      patientId: targetPatientId,
      patientNumber: 'P-999',
      patientName: 'Surgery Patient',
      branchId,
      departmentId,
      departmentName: 'General',
      recommendingDoctorId: docId,
      recommendingDoctorName: 'Dr. Test',
      serviceId,
      serviceName: 'Procedure Service',
      clinicalReason: 'Reason',
      status: 'BOOKED',
      createdBy: actorId,
      updatedBy: actorId,
    });

    return ProcedureBookingModel.create({
      bookingNumber: 'PB-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      recommendationId: rec._id,
      patientId: rec.patientId,
      patientNumber: rec.patientNumber,
      patientName: rec.patientName,
      branchId,
      departmentId,
      departmentName: 'General',
      serviceId,
      serviceName: 'Procedure Service',
      doctorId: docId,
      doctorName: 'Dr. Test',
      scheduledStart,
      scheduledEnd,
      durationMinutes,
      status,
      createdBy: actorId,
      updatedBy: actorId,
    });
  };

  it('1. Rejects appointment creation when doctor has an overlapping active surgery booking', async () => {
    // 2026-11-10 is a Tuesday (matches mock availability)
    const surgeryStart = new Date('2026-11-10T10:00:00.000Z');
    await setupSurgeryBooking(doctorId, surgeryStart, 60, 'BOOKED'); // 10:00 to 11:00

    // Attempt appointment 10:00 - 10:30 (exact overlap)
    await expect(
      service.create(
        {
          patient_id: patientId,
          doctor_id: doctorId,
          department_id: departmentId,
          appointment_date: '2026-11-10',
          start_time: '10:00',
          duration_minutes: 30,
          appointment_type: 'CONSULTATION',
          visit_type: 'NEW_CONSULTATION',
          reason: 'General checkup',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      code: 'DOCTOR_PROCEDURE_CONFLICT',
    });

    // Attempt appointment 10:30 - 11:00 (mid-overlap)
    await expect(
      service.create(
        {
          patient_id: patientId,
          doctor_id: doctorId,
          department_id: departmentId,
          appointment_date: '2026-11-10',
          start_time: '10:30',
          duration_minutes: 30,
          appointment_type: 'CONSULTATION',
          visit_type: 'NEW_CONSULTATION',
          reason: 'General checkup',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      code: 'DOCTOR_PROCEDURE_CONFLICT',
    });
  });

  it('2. Accepts appointment when appointment is before or after the surgery schedule', async () => {
    const surgeryStart = new Date('2026-11-10T10:00:00.000Z');
    await setupSurgeryBooking(doctorId, surgeryStart, 60, 'BOOKED'); // 10:00 to 11:00

    // Before surgery: 09:00 - 09:30
    const beforeResult = await service.create(
      {
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '09:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'Before surgery',
      },
      actorId,
    );
    expect(beforeResult.id).toBeDefined();

    // After surgery: 11:00 - 11:30
    const afterResult = await service.create(
      {
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '11:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'After surgery',
      },
      actorId,
    );
    expect(afterResult.id).toBeDefined();
  });

  it('3. Cancelled or inactive surgery bookings do not block appointment scheduling', async () => {
    const surgeryStart = new Date('2026-11-10T10:00:00.000Z');
    await setupSurgeryBooking(doctorId, surgeryStart, 60, 'CANCELLED');

    const result = await service.create(
      {
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '10:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'During cancelled surgery',
      },
      actorId,
    );

    expect(result.id).toBeDefined();
    expect(result.status).toBe('SCHEDULED');
  });

  it('4. Surgery booking for Doctor A does not block appointment for Doctor B', async () => {
    const surgeryStart = new Date('2026-11-10T10:00:00.000Z');
    await setupSurgeryBooking(doctorId, surgeryStart, 60, 'BOOKED'); // Doctor 1 in surgery

    // Appointment for Doctor 2 at the same time
    const result = await service.create(
      {
        patient_id: patientId,
        doctor_id: doctor2Id,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '10:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'Doctor 2 appointment',
      },
      actorId,
    );

    expect(result.id).toBeDefined();
    expect(result.doctor_id).toBe(doctor2Id);
  });

  it('5. Appointment rescheduling enforces surgery conflict check', async () => {
    const surgeryStart = new Date('2026-11-10T14:00:00.000Z');
    await setupSurgeryBooking(doctorId, surgeryStart, 60, 'BOOKED'); // Surgery 14:00 - 15:00

    // Create an initial appointment at 09:00
    const appt = await service.create(
      {
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '09:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'Initial morning slot',
      },
      actorId,
    );

    // Rescheduling into surgery window 14:00 - 14:30 is rejected
    await expect(
      service.update(
        appt.id,
        {
          appointment_date: '2026-11-10',
          start_time: '14:00',
          reschedule_reason: 'Shift to afternoon',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      code: 'DOCTOR_PROCEDURE_CONFLICT',
    });

    // Rescheduling into clear slot 15:00 - 15:30 succeeds
    const rescheduled = await service.update(
      appt.id,
      {
        appointment_date: '2026-11-10',
        start_time: '15:00',
        reschedule_reason: 'Shift to after surgery',
      },
      actorId,
    );

    expect(rescheduled.start_time).toBe('15:00');
  });

  it('6. Existing appointment-to-appointment conflict check continues to work alongside surgery check', async () => {
    // Create first appointment at 09:00 - 09:30
    await service.create(
      {
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '09:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'First appointment',
      },
      actorId,
    );

    // Attempt duplicate appointment at exact slot for same doctor
    await expect(
      service.create(
        {
          patient_id: patientId,
          doctor_id: doctorId,
          department_id: departmentId,
          appointment_date: '2026-11-10',
          start_time: '09:00',
          duration_minutes: 30,
          appointment_type: 'CONSULTATION',
          visit_type: 'NEW_CONSULTATION',
          reason: 'Conflicting appointment',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      code: 'APPOINTMENT_SLOT_CONFLICT',
    });
  });

  it('7. Lock acquisition failure prevents appointment write and leaves state clean', async () => {
    const lockSpy = vi.spyOn(repository, 'acquireConcurrencyLock').mockRejectedValueOnce(
      new Error('Simulated write conflict on doctor lock document'),
    );

    await expect(
      service.create(
        {
          patient_id: patientId,
          doctor_id: doctorId,
          department_id: departmentId,
          appointment_date: '2026-11-10',
          start_time: '16:00',
          duration_minutes: 30,
          appointment_type: 'CONSULTATION',
          visit_type: 'NEW_CONSULTATION',
          reason: 'Test lock failure',
        },
        actorId,
      ),
    ).rejects.toThrow('Simulated write conflict on doctor lock document');

    expect(lockSpy).toHaveBeenCalledWith(doctorId, expect.anything(), patientId);

    const appts = await AppointmentModel.find({
      doctorId,
      appointmentDate: new Date('2026-11-10'),
      startTime: '16:00',
    });
    expect(appts.length).toBe(0);
  });

  it('8. Surgery detects overlapping existing appointment symmetrically', async () => {
    // Create appointment at 11:30 - 12:00
    await service.create(
      {
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '11:30',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'OPD consult',
      },
      actorId,
    );

    // Overlapping surgery booking attempted at 11:00 - 12:00
    const { SurgeryRepository } = await import('../src/modules/surgery/surgery.repository.js');
    const surgeryRepo = new SurgeryRepository(new SequenceService());
    const hasOverlap = await surgeryRepo.hasAppointmentOverlap(
      doctorId,
      new Date('2026-11-10'),
      '11:00',
      '12:00',
    );
    expect(hasOverlap).toBe(true);

    // Non-overlapping surgery booking at 12:00 - 13:00 has no conflict
    const hasNoOverlap = await surgeryRepo.hasAppointmentOverlap(
      doctorId,
      new Date('2026-11-10'),
      '12:00',
      '13:00',
    );
    expect(hasNoOverlap).toBe(false);
  });

  it('9. Two concurrent appointment requests for the same patient with different doctors cannot both succeed', async () => {
    // Both Doctor 1 and Doctor 2 are available at 10:00 on Tuesday
    const results = await Promise.allSettled([
      service.create(
        {
          patient_id: patientId,
          doctor_id: doctorId,
          department_id: departmentId,
          appointment_date: '2026-11-10',
          start_time: '10:00',
          duration_minutes: 30,
          appointment_type: 'CONSULTATION',
          visit_type: 'NEW_CONSULTATION',
          reason: 'Doctor 1 consult',
        },
        actorId,
      ),
      service.create(
        {
          patient_id: patientId,
          doctor_id: doctor2Id,
          department_id: departmentId,
          appointment_date: '2026-11-10',
          start_time: '10:00',
          duration_minutes: 30,
          appointment_type: 'CONSULTATION',
          visit_type: 'NEW_CONSULTATION',
          reason: 'Doctor 2 consult',
        },
        actorId,
      ),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const failure = failures[0] as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(AppError);
    expect(failure.reason.code).toBe('PATIENT_APPOINTMENT_CONFLICT');

    const appts = await AppointmentModel.find({
      patientId,
      appointmentDate: new Date('2026-11-10'),
      startTime: '10:00',
      status: { $in: ['SCHEDULED', 'CONFIRMED'] },
    });
    expect(appts.length).toBe(1);
  });

  it('10. Appointment is rejected when patient has an overlapping surgery with another doctor', async () => {
    // Surgery for patient with doctor 2: 13:00 - 14:00
    const surgeryStart = new Date('2026-11-10T13:00:00.000Z');
    await setupSurgeryBooking(doctor2Id, surgeryStart, 60, 'BOOKED', patientId);

    // Attempt appointment with doctor 1 at 13:00 - 13:30 for the same patient
    await expect(
      service.create(
        {
          patient_id: patientId,
          doctor_id: doctorId,
          department_id: departmentId,
          appointment_date: '2026-11-10',
          start_time: '13:00',
          duration_minutes: 30,
          appointment_type: 'CONSULTATION',
          visit_type: 'NEW_CONSULTATION',
          reason: 'Conflict with surgery',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      code: 'PATIENT_PROCEDURE_CONFLICT',
    });
  });

  it('11. Surgery detects overlapping existing patient appointment symmetrically', async () => {
    // Appointment with doctor 1: 15:00 - 15:30
    await service.create(
      {
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '15:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'OPD visit',
      },
      actorId,
    );

    const { SurgeryRepository } = await import('../src/modules/surgery/surgery.repository.js');
    const surgeryRepo = new SurgeryRepository(new SequenceService());

    // Patient has appointment overlap between 15:00 and 16:00
    const hasOverlap = await surgeryRepo.hasPatientAppointmentOverlap(
      patientId,
      new Date('2026-11-10'),
      '15:00',
      '16:00',
    );
    expect(hasOverlap).toBe(true);

    // Non-overlapping time at 16:00 - 17:00
    const hasNoOverlap = await surgeryRepo.hasPatientAppointmentOverlap(
      patientId,
      new Date('2026-11-10'),
      '16:00',
      '17:00',
    );
    expect(hasNoOverlap).toBe(false);
  });

  it('12. Rescheduling appointment rejects if patient has overlapping surgery with another doctor', async () => {
    // Initial appointment with Doctor 1 at 09:00
    const appt = await service.create(
      {
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '09:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'Morning checkup',
      },
      actorId,
    );

    // Doctor 2 performs surgery on this patient at 14:00 - 15:00
    const surgeryStart = new Date('2026-11-10T14:00:00.000Z');
    await setupSurgeryBooking(doctor2Id, surgeryStart, 60, 'BOOKED', patientId);

    // Rescheduling to 14:00 is rejected with PATIENT_PROCEDURE_CONFLICT
    await expect(
      service.update(
        appt.id,
        {
          appointment_date: '2026-11-10',
          start_time: '14:00',
          reschedule_reason: 'Try to reschedule into surgery',
        },
        actorId,
      ),
    ).rejects.toMatchObject({
      code: 'PATIENT_PROCEDURE_CONFLICT',
    });
  });

  it('13. Non-overlapping bookings and bookings for different patients succeed independently', async () => {
    const patient2Id = createObjectId();
    await PatientModel.create({
      _id: patient2Id,
      patientNumber: 'P-002',
      firstName: 'Jane',
      lastName: 'Smith',
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-02-02'),
      status: 'ACTIVE',
      phone: '+919876543211',
    });

    // Patient 1 with Doctor 1 at 17:00
    const appt1 = await service.create(
      {
        patient_id: patientId,
        doctor_id: doctorId,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '17:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'Patient 1 consult',
      },
      actorId,
    );
    expect(appt1.id).toBeDefined();

    // Patient 2 with Doctor 2 at 17:00 (exact same time, different patient & doctor)
    const appt2 = await service.create(
      {
        patient_id: patient2Id,
        doctor_id: doctor2Id,
        department_id: departmentId,
        appointment_date: '2026-11-10',
        start_time: '17:00',
        duration_minutes: 30,
        appointment_type: 'CONSULTATION',
        visit_type: 'NEW_CONSULTATION',
        reason: 'Patient 2 consult',
      },
      actorId,
    );
    expect(appt2.id).toBeDefined();
  });
});
