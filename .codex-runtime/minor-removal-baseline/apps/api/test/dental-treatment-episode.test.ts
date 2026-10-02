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
import { OpdDentalExaminationModel } from '../src/modules/opd/opd-dental-examination.model.js';
import { DentalTreatmentEpisodeModel } from '../src/modules/opd/dental-episode.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Dental Treatment Episode & Cumulative Odontogram Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const cardioDeptId = createObjectId();
  const patientId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorDocId = createObjectId();
  const otherDoctorUserId = createObjectId();
  const otherDoctorDocId = createObjectId();
  const cardioDoctorUserId = createObjectId();
  const cardioDoctorDocId = createObjectId();

  let visit1Id: string;
  let visit2Id: string;
  let visit3Id: string;
  let doctorToken: string;
  let otherDoctorToken: string;
  let cardioDoctorToken: string;

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
      {
        _id: new Types.ObjectId(cardioDeptId),
        name: 'Cardiology',
        code: 'CARD',
        branchIds: [new Types.ObjectId(branchId)],
        status: 'ACTIVE',
        isClinical: true,
      },
    ]);

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    const defaultPasswordHash = await hashPassword('Password123!');

    await UserModel.create([
      {
        _id: new Types.ObjectId(doctorUserId),
        username: 'dentist_primary',
        email: 'dentist@example.com',
        fullName: 'Dr. Primary Dentist',
        passwordHash: defaultPasswordHash,
        roleIds: [doctorRole!._id],
        status: 'active',
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
      },
      {
        _id: new Types.ObjectId(otherDoctorUserId),
        username: 'dentist_secondary',
        email: 'dentist2@example.com',
        fullName: 'Dr. Second Dentist',
        passwordHash: defaultPasswordHash,
        roleIds: [doctorRole!._id],
        status: 'active',
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
      },
      {
        _id: new Types.ObjectId(cardioDoctorUserId),
        username: 'cardio_doctor',
        email: 'cardio@example.com',
        fullName: 'Dr. Cardio Specialist',
        passwordHash: defaultPasswordHash,
        roleIds: [doctorRole!._id],
        status: 'active',
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(cardioDeptId)],
      },
    ]);

    await DoctorModel.create([
      {
        _id: new Types.ObjectId(doctorDocId),
        userId: new Types.ObjectId(doctorUserId),
        doctorNumber: 'DOC-DENT-001',
        firstName: 'Primary',
        lastName: 'Dentist',
        displayName: 'Dr. Primary Dentist',
        departmentId: new Types.ObjectId(dentalDeptId),
        branchId: new Types.ObjectId(branchId),
        branchIds: [new Types.ObjectId(branchId)],
        specialization: 'Endodontist',
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(otherDoctorDocId),
        userId: new Types.ObjectId(otherDoctorUserId),
        doctorNumber: 'DOC-DENT-002',
        firstName: 'Secondary',
        lastName: 'Dentist',
        displayName: 'Dr. Second Dentist',
        departmentId: new Types.ObjectId(dentalDeptId),
        branchId: new Types.ObjectId(branchId),
        branchIds: [new Types.ObjectId(branchId)],
        specialization: 'Prosthodontist',
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(cardioDoctorDocId),
        userId: new Types.ObjectId(cardioDoctorUserId),
        doctorNumber: 'DOC-CARD-001',
        firstName: 'Cardio',
        lastName: 'Doctor',
        displayName: 'Dr. Cardio Specialist',
        departmentId: new Types.ObjectId(cardioDeptId),
        branchId: new Types.ObjectId(branchId),
        branchIds: [new Types.ObjectId(branchId)],
        specialization: 'Cardiology',
        status: 'ACTIVE',
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'P-TEST-001',
      firstName: 'John',
      lastName: 'Patient',
      gender: 'MALE',
      dateOfBirth: new Date('1990-01-01'),
      branchId: new Types.ObjectId(branchId),
      status: 'ACTIVE',
    });

    // Create 3 visits for this patient
    const v1 = await OpdVisitModel.create({
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-TEST-001',
      patientName: 'John Patient',
      doctorId: new Types.ObjectId(doctorDocId),
      doctorName: 'Dr. Primary Dentist',
      doctorSpecialization: 'Endodontist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      visitNumber: 'VIS-TEST-01',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-18'),
      checkInTime: new Date('2026-09-18T09:00:00Z'),
    });
    visit1Id = v1._id.toString();

    const v2 = await OpdVisitModel.create({
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-TEST-001',
      patientName: 'John Patient',
      doctorId: new Types.ObjectId(otherDoctorDocId),
      doctorName: 'Dr. Second Dentist',
      doctorSpecialization: 'Prosthodontist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      visitNumber: 'VIS-TEST-02',
      visitType: 'FOLLOW_UP',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-25'),
      checkInTime: new Date('2026-09-25T09:00:00Z'),
    });
    visit2Id = v2._id.toString();

    const v3 = await OpdVisitModel.create({
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-TEST-001',
      patientName: 'John Patient',
      doctorId: new Types.ObjectId(doctorDocId),
      doctorName: 'Dr. Primary Dentist',
      doctorSpecialization: 'Endodontist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      visitNumber: 'VIS-TEST-03',
      visitType: 'FOLLOW_UP',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-10-02'),
      checkInTime: new Date('2026-10-02T09:00:00Z'),
    });
    visit3Id = v3._id.toString();

    const accessTokenFor = async (username: string) => {
      const user = await UserModel.findOne({ username }).lean();
      if (!user) throw new Error(`Expected user ${username}`);
      return signJwt(
        { sub: user._id.toString(), username: user.username },
        env.auth.accessTokenSecret,
        env.auth.accessTokenTtlSeconds,
      );
    };

    doctorToken = await accessTokenFor('dentist_primary');
    otherDoctorToken = await accessTokenFor('dentist_secondary');
    cardioDoctorToken = await accessTokenFor('cardio_doctor');

    const appInstance = await buildApp();
    app = appInstance.app;
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  it('1. Successfully creates a Dental Treatment Episode with auto-generated sequence number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/episodes',
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        patient_id: patientId,
        originating_visit_id: visit1Id,
        primary_tooth_number: 16,
        diagnosis_code: 'K04.0',
        diagnosis_name: 'Irreversible Pulpitis',
        treatment_plan_summary: 'Root Canal Treatment followed by PFM Crown',
        notes: 'Severe night pain in maxillary right first molar',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body).toHaveProperty('id');
    expect(body.episode_number).toMatch(/^DTE-\d{4}-\d{5}$/);
    expect(body.patient_id).toBe(patientId);
    expect(body.originating_visit_id).toBe(visit1Id);
    expect(body.primary_tooth_number).toBe(16);
    expect(body.status).toBe('ACTIVE');
    expect(body.visit_ids).toContain(visit1Id);
  });

  it('2. Enforces active episode uniqueness (cannot create second ACTIVE episode for same patient)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/episodes',
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        patient_id: patientId,
        originating_visit_id: visit2Id,
        primary_tooth_number: 26,
        diagnosis_name: 'Another Pulpitis',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('ACTIVE_EPISODE_EXISTS');
  });

  it('3. Successfully links subsequent visit to the active episode', async () => {
    // Get the active episode
    const episodesRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/patients/${patientId}/episodes`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
    });

    expect(episodesRes.statusCode).toBe(200);
    const episodes = episodesRes.json().data;
    expect(episodes.length).toBe(1);
    const activeEpisode = episodes[0];

    // Link visit2 to this episode
    const linkRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${activeEpisode.id}/link-visit`,
      headers: {
        authorization: `Bearer ${otherDoctorToken}`, // Multi-doctor support!
      },
      payload: {
        visit_id: visit2Id,
      },
    });

    expect(linkRes.statusCode).toBe(200);
    const updated = linkRes.json().data;
    expect(updated.visit_ids).toContain(visit1Id);
    expect(updated.visit_ids).toContain(visit2Id);
  });

  it('4. Preserves 1:1 visit-examination isolation while linking to episode', async () => {
    const episodes = await DentalTreatmentEpisodeModel.find({ patientId });
    const episodeId = episodes[0]._id.toString();

    // Visit 1 records Tooth 16 Carious & Pulpitic and Completes
    const exam1Res = await app.inject({
      method: 'PUT',
      url: `/api/opd/visits/${visit1Id}/dental-examination`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        episode_id: episodeId,
        dental_history: {
          chief_complaint: 'Severe pain in upper right tooth',
          pain_scale: 8,
        },
        teeth: [
          {
            tooth_number: 16,
            dentition: 'PERMANENT',
            status: 'PRESENT',
            surfaces: ['OCCLUSAL', 'MESIAL'],
            conditions: ['CARIOUS', 'PULPITIC'],
            notes: 'Deep caries approaching pulp chamber',
          },
        ],
        treatment_plan_items: [
          {
            tooth_number: 16,
            procedure_name: 'Root Canal Treatment (Molar)',
            priority: 'URGENT',
            status: 'PROPOSED',
          },
        ],
      },
    });
    expect(exam1Res.statusCode).toBe(200);

    // Complete Visit 1 examination
    const complete1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/visits/${visit1Id}/dental-examination/complete`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        episode_id: episodeId,
        teeth: [
          {
            tooth_number: 16,
            dentition: 'PERMANENT',
            status: 'PRESENT',
            surfaces: ['OCCLUSAL', 'MESIAL'],
            conditions: ['CARIOUS', 'PULPITIC'],
          },
        ],
      },
    });
    expect(complete1Res.statusCode).toBe(200);

    // Visit 2 records Tooth 16 Filled and Tooth 17 Healthy
    const exam2Res = await app.inject({
      method: 'PUT',
      url: `/api/opd/visits/${visit2Id}/dental-examination`,
      headers: {
        authorization: `Bearer ${otherDoctorToken}`,
      },
      payload: {
        episode_id: episodeId,
        teeth: [
          {
            tooth_number: 16,
            dentition: 'PERMANENT',
            status: 'PRESENT',
            surfaces: ['OCCLUSAL'],
            conditions: ['FILLED'],
            notes: 'Obturation completed',
          },
          {
            tooth_number: 17,
            dentition: 'PERMANENT',
            status: 'PRESENT',
            surfaces: [],
            conditions: [],
            notes: 'Healthy',
          },
        ],
      },
    });
    expect(exam2Res.statusCode).toBe(200);

    // Verify Visit 1 exam remains intact, completed, and separate from Visit 2 exam
    const check1 = await OpdDentalExaminationModel.findOne({ visitId: visit1Id });
    const check2 = await OpdDentalExaminationModel.findOne({ visitId: visit2Id });

    expect(check1).not.toBeNull();
    expect(check2).not.toBeNull();
    expect(check1?._id.toString()).not.toBe(check2?._id.toString());
    expect(check1?.status).toBe('COMPLETED');
    expect(check2?.status).toBe('DRAFT');
    expect(check1?.teeth[0]?.conditions).toContain('CARIOUS');
    expect(check2?.teeth[0]?.conditions).toContain('FILLED');
  });

  it('5. Returns cross-visit cumulative tooth history excluding current visit', async () => {
    // Calling tooth-history for visit 2 should show findings from visit 1
    const historyRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/patients/${patientId}/tooth-history?exclude_visit_id=${visit2Id}`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
    });

    expect(historyRes.statusCode).toBe(200);
    const history = historyRes.json().data;
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(1);
    expect(history[0].tooth_number).toBe(16);
    expect(history[0].conditions).toContain('CARIOUS');
    expect(history[0].visit_id).toBe(visit1Id);
    expect(history[0]).toHaveProperty('doctor_name');
    expect(history[0]).toHaveProperty('recorded_at');
  });

  it('6. Supports episode status lifecycle transitions', async () => {
    const episodes = await DentalTreatmentEpisodeModel.find({ patientId });
    const episodeId = episodes[0]._id.toString();

    // 1. ACTIVE -> ON_HOLD
    const holdRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/episodes/${episodeId}/status`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        status: 'ON_HOLD',
        notes: 'Patient travelling for 2 weeks',
      },
    });
    expect(holdRes.statusCode).toBe(200);
    expect(holdRes.json().data.status).toBe('ON_HOLD');

    // 2. ON_HOLD -> ACTIVE
    const resumeRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/episodes/${episodeId}/status`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        status: 'ACTIVE',
      },
    });
    expect(resumeRes.statusCode).toBe(200);
    expect(resumeRes.json().data.status).toBe('ACTIVE');

    // 3. ACTIVE -> COMPLETED
    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/episodes/${episodeId}/status`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        status: 'COMPLETED',
        notes: 'Full treatment successfully completed',
      },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().data.status).toBe('COMPLETED');

    // 4. Invalid transition from COMPLETED -> ON_HOLD is rejected with 400
    const invalidRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/episodes/${episodeId}/status`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        status: 'ON_HOLD',
      },
    });
    expect(invalidRes.statusCode).toBe(400);
    expect(invalidRes.json().error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('7. Rejects non-dental clinician from accessing dental episodes with DEPARTMENT_ACCESS_DENIED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/episodes',
      headers: {
        authorization: `Bearer ${cardioDoctorToken}`,
      },
      payload: {
        patient_id: patientId,
        originating_visit_id: visit3Id,
        primary_tooth_number: 11,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('DEPARTMENT_ACCESS_DENIED');
  });
});
