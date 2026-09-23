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
import { OpdDentalExaminationModel } from '../src/modules/opd/opd-dental-examination.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Dental Treatment Staging Procedure Validation & Isolation Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const patientId = createObjectId();

  const doctorUserId = createObjectId();
  const doctorId = createObjectId();

  let visitId: string;
  let episodeTooth12Id: string;
  let episodeTooth24Id: string;
  let doctorToken: string;

  const planItemTooth12Id = new Types.ObjectId().toString();
  const planItemTooth24Id = new Types.ObjectId().toString();

  beforeAll(async () => {
    await setupTestDatabase();

    await BranchModel.create([
      { _id: new Types.ObjectId(branchId), name: 'Main Branch', code: 'MB01', status: 'ACTIVE' },
      { _id: new Types.ObjectId(createObjectId()), name: 'Secondary Branch', code: 'SB01', status: 'ACTIVE' },
    ]);

    await seedDatabase();

    await DepartmentModel.create([
      {
        _id: new Types.ObjectId(dentalDeptId),
        name: 'Dental Surgery',
        code: 'DENT',
        branchIds: [new Types.ObjectId(branchId)],
        status: 'ACTIVE',
        isClinical: true,
      },
    ]);

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    if (!doctorRole) {
      throw new Error('DOCTOR role not seeded');
    }
    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' }).lean();

    const passwordHash = await hashPassword('DoctorPass123!');

    const doctorAvailability = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((day) => ({
      _id: new Types.ObjectId(),
      dayOfWeek: day,
      isAvailable: true,
      workingBlocks: [
        {
          _id: new Types.ObjectId(),
          startTime: '08:00',
          endTime: '18:00',
          slotDurationMinutes: 30,
          maxPatientsPerSlot: 1,
        },
      ],
    }));

    await UserModel.create([
      {
        _id: new Types.ObjectId(doctorUserId),
        username: 'dr_anderson_james',
        email: 'dr.anderson.james@dental.local',
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
        doctorNumber: 'DOC-AND-01',
        firstName: 'Anderson',
        lastName: 'James',
        displayName: 'Dr. Anderson James',
        specialization: 'General Dentistry',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: doctorAvailability,
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-1001',
      firstName: 'John',
      lastName: 'Doe',
      gender: 'MALE',
      dateOfBirth: new Date('1985-05-15'),
      primaryContactNumber: '+919999900012',
      branchId: new Types.ObjectId(branchId),
      bloodGroup: 'A+',
    });

    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-DENT-1001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-1001',
      patientName: 'John Doe',
      patientGender: 'MALE',
      patientDateOfBirth: new Date('1985-05-15'),
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Anderson James',
      doctorSpecialization: 'General Dentistry',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'D-12',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-23'),
      checkInTime: new Date('2026-09-23T09:00:00Z'),
    });
    visitId = visit._id.toString();

    // Create Episode for Tooth #12 (Composite Restoration)
    const episode12 = await DentalTreatmentEpisodeModel.create({
      episodeNumber: '2026-00001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-1001',
      patientName: 'John Doe',
      originatingVisitId: new Types.ObjectId(visitId),
      originatingVisitNumber: 'VIS-DENT-1001',
      primaryDoctorId: new Types.ObjectId(doctorId),
      primaryDoctorName: 'Dr. Anderson James',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 12,
      diagnosisName: 'Composite Restoration',
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visitId)],
    });
    episodeTooth12Id = episode12._id.toString();

    // Create Episode for Tooth #24 (Root Canal Treatment)
    const episode24 = await DentalTreatmentEpisodeModel.create({
      episodeNumber: '2026-00002',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-1001',
      patientName: 'John Doe',
      originatingVisitId: new Types.ObjectId(visitId),
      originatingVisitNumber: 'VIS-DENT-1001',
      primaryDoctorId: new Types.ObjectId(doctorId),
      primaryDoctorName: 'Dr. Anderson James',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 24,
      diagnosisName: 'Root Canal Treatment',
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visitId)],
    });
    episodeTooth24Id = episode24._id.toString();

    // Examination with both Tooth #12 and Tooth #24 treatment plan items
    await OpdDentalExaminationModel.create({
      visitId: new Types.ObjectId(visitId),
      episodeId: episode12._id,
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-1001',
      patientName: 'John Doe',
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Anderson James',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'DRAFT',
      teeth: [],
      treatmentPlanItems: [
        {
          _id: new Types.ObjectId(planItemTooth12Id),
          procedureName: 'Composite Restoration',
          toothNumber: 12,
          quantity: 1,
          unitPrice: 250,
          estimatedCost: 250,
          status: 'ACCEPTED',
        },
        {
          _id: new Types.ObjectId(planItemTooth24Id),
          procedureName: 'Root Canal Treatment',
          toothNumber: 24,
          quantity: 1,
          unitPrice: 750,
          estimatedCost: 750,
          status: 'ACCEPTED',
        },
      ],
    });

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

  it('1. Successfully adds Stage 1 for Tooth #12 Composite Restoration to Tooth #12 Episode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeTooth12Id}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemTooth12Id,
        stage_name: 'Composite / GIC Restoration & Curing',
        assigned_doctor_id: doctorId,
        tooth_number: 12,
        notes: 'Tooth #12 mesial composite restoration under Dr. Anderson James',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.plan_item_id).toBe(planItemTooth12Id);
    expect(body.tooth_number).toBe(12);
    expect(body.episode_id).toBe(episodeTooth12Id);
    expect(body.stage_name).toBe('Composite / GIC Restoration & Curing');
    expect(body.assigned_doctor_name).toBe('Dr. Anderson James');
    expect(body.status).toBe('PLANNED');
    expect(body.sequence).toBe(1);
  });

  it('2. Successfully adds Stage 1 for Tooth #24 Root Canal Treatment to Tooth #24 Episode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeTooth24Id}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemTooth24Id,
        stage_name: 'Canal Instrumentation & Shaping',
        assigned_doctor_id: doctorId,
        tooth_number: 24,
        notes: 'Tooth #24 canal prep',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.plan_item_id).toBe(planItemTooth24Id);
    expect(body.tooth_number).toBe(24);
    expect(body.episode_id).toBe(episodeTooth24Id);
    expect(body.stage_name).toBe('Canal Instrumentation & Shaping');
    expect(body.sequence).toBe(1);
  });

  it('3. Rejects adding Tooth #12 plan procedure to Tooth #24 Episode with EPISODE_TOOTH_MISMATCH', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeTooth24Id}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemTooth12Id,
        stage_name: 'Composite / GIC Restoration & Curing',
        assigned_doctor_id: doctorId,
        tooth_number: 12,
      },
    });

    expect(res.statusCode).toBe(400);
    const err = res.json();
    expect(err.code || err.error?.code).toBe('EPISODE_TOOTH_MISMATCH');
    expect(err.message || err.error?.message).toContain('Treatment plan procedure for tooth #12 does not belong to episode #2026-00002 (Tooth #24)');
  });

  it('4. Rejects adding Tooth #24 plan procedure to Tooth #12 Episode with EPISODE_TOOTH_MISMATCH', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeTooth12Id}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemTooth24Id,
        stage_name: 'Canal Instrumentation & Shaping',
        assigned_doctor_id: doctorId,
        tooth_number: 24,
      },
    });

    expect(res.statusCode).toBe(400);
    const err = res.json();
    expect(err.code || err.error?.code).toBe('EPISODE_TOOTH_MISMATCH');
    expect(err.message || err.error?.message).toContain('Treatment plan procedure for tooth #24 does not belong to episode #2026-00001 (Tooth #12)');
  });

  it('5. Queries listStages for Tooth #12 episode and verifies Tooth #24 stages are not included', async () => {
    const res12 = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/episodes/${episodeTooth12Id}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res12.statusCode).toBe(200);
    const stages12 = res12.json().data;
    expect(stages12.length).toBe(1);
    expect(stages12[0].tooth_number).toBe(12);
    expect(stages12[0].plan_item_id).toBe(planItemTooth12Id);

    const res24 = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/episodes/${episodeTooth24Id}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res24.statusCode).toBe(200);
    const stages24 = res24.json().data;
    expect(stages24.length).toBe(1);
    expect(stages24[0].tooth_number).toBe(24);
    expect(stages24[0].plan_item_id).toBe(planItemTooth24Id);
  });
});
