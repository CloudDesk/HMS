import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { buildApp } from '../src/app.js';
import { seedDatabase } from '../src/database/seed.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { OpdVisitModel } from '../src/modules/opd/opd-visit.model.js';
import { DentalTreatmentEpisodeModel } from '../src/modules/opd/dental-episode.model.js';
import { AppointmentModel } from '../src/modules/appointments/appointment.model.js';
import { DentalTreatmentStageModel } from '../src/modules/opd/dental-stage.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Dental Stage Appointment Scheduling - Phase 2 Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const patientId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();

  let episodeTooth12Id: string;
  let stageTooth12Id: string;
  let doctorToken: string;

  const planItemTooth12Id = new Types.ObjectId().toString();

  const doctorAvailability = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((day) => ({
    _id: new Types.ObjectId(),
    dayOfWeek: day,
    isAvailable: true,
    workingBlocks: [
      {
        _id: new Types.ObjectId(),
        startTime: '09:00',
        endTime: '17:00',
        slotDurationMinutes: 30,
        maxPatientsPerSlot: 1,
      },
    ],
  }));

  beforeAll(async () => {
    await setupTestDatabase();

    await BranchModel.create([
      { _id: new Types.ObjectId(branchId), name: 'Main Dental Branch', code: 'MB01', status: 'ACTIVE' },
      { _id: new Types.ObjectId(createObjectId()), name: 'Secondary Branch', code: 'SB01', status: 'ACTIVE' },
    ]);

    await seedDatabase();

    await DepartmentModel.create([
      {
        _id: new Types.ObjectId(dentalDeptId),
        name: 'Dental Department',
        code: 'DENT',
        branchIds: [new Types.ObjectId(branchId)],
        status: 'ACTIVE',
        isClinical: true,
      },
    ]);

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    if (!doctorRole) throw new Error('DOCTOR role not seeded');
    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' }).lean();

    const passwordHash = await hashPassword('DoctorPass123!');

    await UserModel.create([
      {
        _id: new Types.ObjectId(doctorUserId),
        username: 'dr_anderson_james',
        email: 'anderson.james@dental.local',
        passwordHash,
        fullName: 'Dr. Anderson James',
        roleIds: superAdminRole ? [doctorRole._id, superAdminRole._id] : [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
    ]);

    await DoctorModel.create([
      {
        _id: new Types.ObjectId(doctorId),
        userId: new Types.ObjectId(doctorUserId),
        doctorNumber: 'DOC-AJ-001',
        firstName: 'Anderson',
        lastName: 'James',
        displayName: 'Dr. Anderson James',
        specialization: 'Restorative Dentistry',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: doctorAvailability,
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-0012',
      firstName: 'John',
      lastName: 'Smith',
      gender: 'MALE',
      dateOfBirth: new Date('1990-01-01'),
      primaryContactNumber: '+919876543210',
      branchId: new Types.ObjectId(branchId),
      bloodGroup: 'O+',
    });

    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-DENT-0012',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-0012',
      patientName: 'John Smith',
      patientGender: 'MALE',
      patientDateOfBirth: new Date('1990-01-01'),
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Anderson James',
      doctorSpecialization: 'Restorative Dentistry',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Department',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'D-12',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-23'),
      checkInTime: new Date('2026-09-23T09:00:00Z'),
    });

    const episodeTooth12 = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-2026-00012',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-0012',
      patientName: 'John Smith',
      originatingVisitId: new Types.ObjectId(visit._id),
      originatingVisitNumber: 'VIS-DENT-0012',
      primaryDoctorId: new Types.ObjectId(doctorId),
      primaryDoctorName: 'Dr. Anderson James',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 12,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visit._id)],
      chiefComplaint: 'Tooth 12 composite restoration needed',
      clinicalSummary: 'Class II cavity on tooth 12',
      treatmentPlanSummary: 'Composite Restoration',
    });
    episodeTooth12Id = episodeTooth12._id.toString();

    const stageTooth12 = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeTooth12Id),
      planItemId: planItemTooth12Id,
      stageName: 'Composite Restoration',
      sequence: 1,
      assignedDoctorId: new Types.ObjectId(doctorId),
      assignedDoctorName: 'Dr. Anderson James',
      status: 'PLANNED',
      toothNumber: 12,
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patientId),
    });
    stageTooth12Id = stageTooth12._id.toString();

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    doctorToken = signJwt(
      { sub: doctorUserId, username: 'dr_anderson_james' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  it('1. Rejects request when unexpected "reason" property is passed to strict backend schema', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageTooth12Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-24',
        start_time: '11:30',
        duration_minutes: 60,
        reason: 'Tooth 12 cavity restoration', // Unexpected property
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error?.message).toMatch(/Unrecognized key/i);
  });

  it('2. Rejects request with missing required fields (e.g. missing appointment_date)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageTooth12Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        start_time: '11:30',
        duration_minutes: 60,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBeTruthy();
  });

  it('3. Rejects invalid slot outside doctor working hours', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageTooth12Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-24',
        start_time: '05:00', // outside 09:00 - 17:00
        duration_minutes: 60,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('4. Successfully schedules appointment for Tooth #12 Stage 1 (Composite Restoration -> Dr. Anderson James -> 24-09-2026 11:30-12:30)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageTooth12Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-24',
        start_time: '11:30',
        duration_minutes: 60,
        notes: 'Tooth #12 Composite Restoration - first visit',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.stage.status).toBe('SCHEDULED');
    expect(body.data.stage.appointment_id).toBeTruthy();
    expect(body.data.appointment).toBeTruthy();
    expect(body.data.appointment.doctor_id).toBe(doctorId);
    expect(body.data.appointment.appointment_date).toContain('2026-09-24');
    expect(body.data.appointment.start_time).toBe('11:30');
    expect(body.data.appointment.duration_minutes).toBe(60);
    expect(body.data.appointment.visit_type).toBe('PROCEDURE');

    const appointmentId = body.data.appointment.id;

    // Verify appointment in MongoDB has dental_context with treatmentStageId, episode, planItem, and toothNumber
    const apptDoc = await AppointmentModel.findById(appointmentId).lean();
    expect(apptDoc).toBeTruthy();
    expect(apptDoc?.patientId.toString()).toBe(patientId);
    expect(apptDoc?.doctorId.toString()).toBe(doctorId);
    expect(apptDoc?.dentalContext?.treatmentStageId?.toString()).toBe(stageTooth12Id);
    expect(apptDoc?.dentalContext?.treatmentEpisodeId?.toString()).toBe(episodeTooth12Id);
    expect(apptDoc?.dentalContext?.treatmentPlanItemId).toBe(planItemTooth12Id);
    expect(apptDoc?.dentalContext?.toothNumber).toBe(12);
    expect(apptDoc?.dentalContext?.stageName).toBe('Composite Restoration');
    expect(apptDoc?.dentalContext?.stageSequence).toBe(1);
    expect(apptDoc?.notes).toBe('Tooth #12 Composite Restoration - first visit');
    expect(apptDoc?.reason).toBe('Dental Stage: Composite Restoration (Tooth 12)');

    // Verify stage in DB has updated appointmentId and status SCHEDULED
    const stageDoc = await DentalTreatmentStageModel.findById(stageTooth12Id).lean();
    expect(stageDoc?.status).toBe('SCHEDULED');
    expect(stageDoc?.appointmentId?.toString()).toBe(appointmentId);
  });
});
