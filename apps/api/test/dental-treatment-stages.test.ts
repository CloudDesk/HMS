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
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Dental Treatment Stages & Multi-Doctor Workflow Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const patientId = createObjectId();

  // Doctor A (Endodontist)
  const docAUserId = createObjectId();
  const docADocId = createObjectId();

  // Doctor B (Prosthodontist)
  const docBUserId = createObjectId();
  const docBDocId = createObjectId();

  // Doctor C (General Dentist)
  const docCUserId = createObjectId();
  const docCDocId = createObjectId();

  let visitId: string;
  let episodeId: string;
  let doctorToken: string;

  const planItemId = new Types.ObjectId().toString();

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

    const passwordHash = await hashPassword('DoctorPass123!');

    // Create User & Doctor A
    await UserModel.create([
      {
        _id: new Types.ObjectId(docAUserId),
        username: 'doctor_alice',
        email: 'doctor.a@dental.local',
        passwordHash,
        fullName: 'Dr. Alice Endo',
        roleIds: [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(docBUserId),
        username: 'doctor_bob',
        email: 'doctor.b@dental.local',
        passwordHash,
        fullName: 'Dr. Bob Prostho',
        roleIds: [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(docCUserId),
        username: 'doctor_charlie',
        email: 'doctor.c@dental.local',
        passwordHash,
        fullName: 'Dr. Charlie Dentist',
        roleIds: [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
    ]);

    await DoctorModel.create([
      {
        _id: new Types.ObjectId(docADocId),
        userId: new Types.ObjectId(docAUserId),
        doctorNumber: 'DOC-ENDO-01',
        firstName: 'Alice',
        lastName: 'Endo',
        displayName: 'Dr. Alice Endo',
        specialization: 'Endodontics',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: [],
      },
      {
        _id: new Types.ObjectId(docBDocId),
        userId: new Types.ObjectId(docBUserId),
        doctorNumber: 'DOC-PROS-02',
        firstName: 'Bob',
        lastName: 'Prostho',
        displayName: 'Dr. Bob Prostho',
        specialization: 'Prosthodontics',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: [],
      },
      {
        _id: new Types.ObjectId(docCDocId),
        userId: new Types.ObjectId(docCUserId),
        doctorNumber: 'DOC-GEN-03',
        firstName: 'Charlie',
        lastName: 'Dentist',
        displayName: 'Dr. Charlie Dentist',
        specialization: 'General Dentistry',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: [],
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'PAT-STAGES-001',
      firstName: 'Dental',
      lastName: 'MultiStagePatient',
      gender: 'MALE',
      dateOfBirth: new Date('1990-01-01'),
      primaryContactNumber: '+919999900001',
      branchId: new Types.ObjectId(branchId),
      bloodGroup: 'O+',
    });

    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-STAGES-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-STAGES-001',
      patientName: 'Dental MultiStagePatient',
      patientGender: 'MALE',
      patientDateOfBirth: new Date('1990-01-01'),
      doctorId: new Types.ObjectId(docADocId),
      doctorName: 'Dr. Alice Endo',
      doctorSpecialization: 'Endodontics',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'D-01',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-18'),
      checkInTime: new Date('2026-09-18T09:00:00Z'),
    });
    visitId = visit._id.toString();

    // Create Active Episode
    const episode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-STAGES-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-STAGES-001',
      patientName: 'Dental MultiStagePatient',
      originatingVisitId: new Types.ObjectId(visitId),
      originatingVisitNumber: 'VIS-STAGES-001',
      primaryDoctorId: new Types.ObjectId(docADocId),
      primaryDoctorName: 'Dr. Alice Endo',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 16,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visitId)],
    });
    episodeId = episode._id.toString();

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    doctorToken = signJwt(
      { sub: docAUserId, username: 'doctor_alice' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  let stage1Id: string;
  let stage2Id: string;
  let stage3Id: string;

  it('1. Creates multi-doctor treatment stages in ordered sequence', async () => {
    // Stage 1: Root Canal Treatment by Dr. Alice Endo (sequence 1)
    const stage1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Root Canal Treatment',
        assigned_doctor_id: docADocId,
        tooth_number: 16,
        sequence: 1,
        notes: '3 canals instrumented, obturated with gutta percha',
      },
    });

    expect(stage1Res.statusCode).toBe(200);
    const stage1 = stage1Res.json().data;
    expect(stage1.stage_name).toBe('Root Canal Treatment');
    expect(stage1.sequence).toBe(1);
    expect(stage1.status).toBe('PLANNED');
    expect(stage1.assigned_doctor_name).toBe('Dr. Alice Endo');
    stage1Id = stage1.id;

    // Stage 2: Crown Measurement & Impression by Dr. Bob Prostho (sequence auto-incremented to 2)
    const stage2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Crown Measurement & Impression',
        assigned_doctor_id: docBDocId,
        tooth_number: 16,
        notes: 'Polyvinyl siloxane impression, shade A2',
      },
    });

    expect(stage2Res.statusCode).toBe(200);
    const stage2 = stage2Res.json().data;
    expect(stage2.stage_name).toBe('Crown Measurement & Impression');
    expect(stage2.sequence).toBe(2);
    expect(stage2.status).toBe('PLANNED');
    expect(stage2.assigned_doctor_name).toBe('Dr. Bob Prostho');
    stage2Id = stage2.id;

    // Stage 3: Crown Delivery & Cementation by Dr. Charlie Dentist (sequence auto-incremented to 3)
    const stage3Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Crown Delivery & Cementation',
        assigned_doctor_id: docCDocId,
        tooth_number: 16,
      },
    });

    expect(stage3Res.statusCode).toBe(200);
    const stage3 = stage3Res.json().data;
    expect(stage3.stage_name).toBe('Crown Delivery & Cementation');
    expect(stage3.sequence).toBe(3);
    expect(stage3.assigned_doctor_name).toBe('Dr. Charlie Dentist');
    stage3Id = stage3.id;
  });

  it('2. Enforces sequential dependency: cannot start/complete Stage 2 before Stage 1 is completed', async () => {
    // Attempt to start Stage 2 while Stage 1 is still PLANNED
    const invalidStartRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage2Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });

    expect(invalidStartRes.statusCode).toBe(400);
    const err = invalidStartRes.json();
    expect(err.code || err.error?.code).toBe('PREREQUISITE_STAGE_INCOMPLETE');

    // Attempt to start Stage 3 while Stage 1 is still PLANNED
    const invalidStage3Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage3Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });

    expect(invalidStage3Res.statusCode).toBe(400);
    expect(invalidStage3Res.json().code || invalidStage3Res.json().error?.code).toBe('PREREQUISITE_STAGE_INCOMPLETE');
  });

  it('3. Allows progressive sequential execution across stages and doctors', async () => {
    // 1. Start and Complete Stage 1 (RCT by Dr. Alice Endo)
    const start1Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(start1Res.statusCode).toBe(200);
    expect(start1Res.json().data.status).toBe('IN_PROGRESS');

    const complete1Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(complete1Res.statusCode).toBe(200);
    const completed1 = complete1Res.json().data;
    expect(completed1.status).toBe('COMPLETED');
    expect(completed1.completed_at).toBeDefined();
    expect(completed1.completed_by_doctor_name).toBe('Dr. Alice Endo');

    // 2. Stage 2 (Crown Measurement by Dr. Bob Prostho) is now unblocked!
    const start2Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage2Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(start2Res.statusCode).toBe(200);

    const complete2Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage2Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(complete2Res.statusCode).toBe(200);
    expect(complete2Res.json().data.status).toBe('COMPLETED');

    // 3. Stage 3 (Crown Delivery by Dr. Charlie Dentist) is now unblocked!
    const start3Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage3Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(start3Res.statusCode).toBe(200);

    const complete3Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage3Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(complete3Res.statusCode).toBe(200);
    expect(complete3Res.json().data.status).toBe('COMPLETED');
  });

  it('4. Allows doctor reassignment on PLANNED stage, rejects on COMPLETED stage', async () => {
    // Ensure episode is active (test 3 completed all stages which auto-completed the episode)
    await DentalTreatmentEpisodeModel.updateOne({ _id: new Types.ObjectId(episodeId) }, { $set: { status: 'ACTIVE' } });

    // Create new planned stage
    const stage4Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Post-Op Followup Examination',
        assigned_doctor_id: docADocId,
      },
    });
    expect(stage4Res.statusCode).toBe(200);
    const stage4 = stage4Res.json().data;
    expect(stage4.assigned_doctor_name).toBe('Dr. Alice Endo');

    // Reassign to Dr. Charlie Dentist
    const reassignRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage4.id}/doctor`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        doctor_id: docCDocId,
        notes: 'Handover to General Dentist for final check',
      },
    });
    expect(reassignRes.statusCode).toBe(200);
    expect(reassignRes.json().data.assigned_doctor_name).toBe('Dr. Charlie Dentist');

    // Attempt reassign on already COMPLETED Stage 1
    const invalidReassign = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/doctor`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { doctor_id: docBDocId },
    });
    expect(invalidReassign.statusCode).toBe(400);
    expect(invalidReassign.json().code || invalidReassign.json().error?.code).toBe('INVALID_STAGE_STATE');
  });

  it('5. Enforces terminal states: COMPLETED stages cannot be reverted', async () => {
    const revertRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'PLANNED' },
    });

    expect(revertRes.statusCode).toBe(400);
    expect(revertRes.json().code || revertRes.json().error?.code).toBe('TERMINAL_STATUS');
  });

  it('6. Enforces unique sequence numbering per treatment plan item', async () => {
    await DentalTreatmentEpisodeModel.updateOne({ _id: new Types.ObjectId(episodeId) }, { $set: { status: 'ACTIVE' } });

    // Attempt to add another stage with sequence 1 for the same plan item
    const conflictRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Conflicting Stage',
        assigned_doctor_id: docADocId,
        sequence: 1,
      },
    });

    expect(conflictRes.statusCode).toBe(409);
    expect(conflictRes.json().code || conflictRes.json().error?.code).toBe('STAGE_SEQUENCE_CONFLICT');
  });

  it('7. Enforces stage deletion rules: cannot delete completed stage', async () => {
    const deleteCompletedRes = await app.inject({
      method: 'DELETE',
      url: `/api/opd/dental/stages/${stage1Id}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(deleteCompletedRes.statusCode).toBe(400);
    expect(deleteCompletedRes.json().code || deleteCompletedRes.json().error?.code).toBe('STAGE_NOT_DELETABLE');
  });
});
