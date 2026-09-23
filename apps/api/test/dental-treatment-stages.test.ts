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
import { DentalTreatmentStageModel } from '../src/modules/opd/dental-stage.model.js';
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
  const extractionPlanItemId = new Types.ObjectId().toString();

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

    // Create User & Doctor A
    await UserModel.create([
      {
        _id: new Types.ObjectId(docAUserId),
        username: 'doctor_alice',
        email: 'doctor.a@dental.local',
        passwordHash,
        fullName: 'Dr. Alice Endo',
        roleIds: superAdminRole ? [doctorRole._id, superAdminRole._id] : [doctorRole._id],
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
        availability: doctorAvailability,
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
        availability: doctorAvailability,
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
        availability: doctorAvailability,
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
      primaryToothNumber: null,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visitId)],
    });
    episodeId = episode._id.toString();

    await OpdDentalExaminationModel.create({
      visitId: new Types.ObjectId(visitId),
      episodeId: episode._id,
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-STAGES-001',
      patientName: 'Dental MultiStagePatient',
      doctorId: new Types.ObjectId(docADocId),
      doctorName: 'Dr. Alice Endo',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'DRAFT',
      teeth: [],
      treatmentPlanItems: [
        {
          _id: new Types.ObjectId(planItemId),
          procedureName: 'Root Canal Treatment',
          toothNumber: 16,
          quantity: 1,
          unitPrice: 850,
          estimatedCost: 850,
          status: 'ACCEPTED',
        },
        {
          _id: new Types.ObjectId(extractionPlanItemId),
          procedureName: 'Tooth Extraction',
          toothNumber: 22,
          quantity: 1,
          unitPrice: 300,
          estimatedCost: 300,
          status: 'ACCEPTED',
        },
      ],
    });

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

    // Stage 2: Canal Instrumentation & Shaping by Dr. Bob Prostho (sequence auto-incremented to 2)
    const stage2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Canal Instrumentation & Shaping',
        assigned_doctor_id: docBDocId,
        tooth_number: 16,
        notes: 'Working length 21mm, rotary shaping',
      },
    });

    expect(stage2Res.statusCode).toBe(200);
    const stage2 = stage2Res.json().data;
    expect(stage2.stage_name).toBe('Canal Instrumentation & Shaping');
    expect(stage2.sequence).toBe(2);
    expect(stage2.status).toBe('PLANNED');
    expect(stage2.assigned_doctor_name).toBe('Dr. Bob Prostho');
    stage2Id = stage2.id;

    // Stage 3: Canal Obturation & Sealing by Dr. Charlie Dentist (sequence auto-incremented to 3)
    const stage3Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Canal Obturation & Sealing',
        assigned_doctor_id: docCDocId,
        tooth_number: 16,
      },
    });

    expect(stage3Res.statusCode).toBe(200);
    const stage3 = stage3Res.json().data;
    expect(stage3.stage_name).toBe('Canal Obturation & Sealing');
    expect(stage3.sequence).toBe(3);
    expect(stage3.assigned_doctor_name).toBe('Dr. Charlie Dentist');
    stage3Id = stage3.id;
  });

  it('2. Enforces stage lifecycle constraints & clinical consistency', async () => {
    // Attempt to directly transition PLANNED -> IN_PROGRESS without appointment
    const invalidPlannedToInProgress = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(invalidPlannedToInProgress.statusCode).toBe(400);

    // Attempt to directly transition PLANNED -> COMPLETED
    const invalidPlannedToCompleted = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(invalidPlannedToCompleted.statusCode).toBe(400);

    // Attempt to create clinically incompatible stage (Endodontic/Crown stage on Extraction procedure)
    const incompatibleStageRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: extractionPlanItemId,
        stage_name: 'Root Canal Treatment',
        assigned_doctor_id: docADocId,
        tooth_number: 22,
      },
    });
    expect(incompatibleStageRes.statusCode).toBe(400);
    const incompErr = incompatibleStageRes.json();
    expect(incompErr.code || incompErr.error?.code).toBe('CLINICAL_MISMATCH');

    // Compatible extraction stage creation succeeds
    const compatibleStageRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: extractionPlanItemId,
        stage_name: 'Tooth Extraction & Socket Debridement',
        assigned_doctor_id: docADocId,
        tooth_number: 22,
      },
    });
    expect(compatibleStageRes.statusCode).toBe(200);

    // Attempt to start Stage 2 while Stage 1 is still PLANNED (sequential prerequisite)
    const invalidStartRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage2Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-15',
        start_time: '10:00',
      },
    });

    expect(invalidStartRes.statusCode).toBe(400);
    const err = invalidStartRes.json();
    expect(err.code || err.error?.code).toBe('PREREQUISITE_STAGE_INCOMPLETE');
  });

  it('3. Allows progressive sequential execution across stages and doctors via appointment scheduling', async () => {
    // 1. Schedule Stage 1 (RCT by Dr. Alice Endo)
    const sched1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage1Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-15',
        start_time: '09:00',
        duration_minutes: 60,
      },
    });
    expect(sched1Res.statusCode).toBe(200);
    expect(sched1Res.json().data.stage.status).toBe('SCHEDULED');

    // Attempt SCHEDULED -> COMPLETED directly (should fail)
    const invalidSchedToComplete = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(invalidSchedToComplete.statusCode).toBe(400);

    // Start Stage 1 (SCHEDULED -> IN_PROGRESS)
    const start1Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(start1Res.statusCode).toBe(200);
    expect(start1Res.json().data.status).toBe('IN_PROGRESS');

    // Complete Stage 1 (IN_PROGRESS -> COMPLETED)
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

    // 2. Stage 2 (Crown Measurement by Dr. Bob Prostho) is now unblocked for scheduling!
    const sched2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage2Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-16',
        start_time: '10:00',
        duration_minutes: 60,
      },
    });
    expect(sched2Res.statusCode).toBe(200);
    expect(sched2Res.json().data.stage.status).toBe('SCHEDULED');

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
    const sched3Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage3Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-17',
        start_time: '11:00',
        duration_minutes: 60,
      },
    });
    expect(sched3Res.statusCode).toBe(200);

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

  it('8. Normalizes legacy IN_PROGRESS stages without appointments to PLANNED on retrieval and updates DB', async () => {
    // Insert a legacy stage directly into MongoDB with IN_PROGRESS and null appointmentId
    const legacyDoc = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      patientId: new Types.ObjectId(patientId),
      departmentId: new Types.ObjectId(dentalDeptId),
      planItemId: new Types.ObjectId(planItemId),
      stageName: 'Legacy In Progress Stage',
      assignedDoctorId: new Types.ObjectId(docADocId),
      assignedDoctorName: 'Dr. Alice Endo',
      status: 'IN_PROGRESS',
      appointmentId: null,
      sequence: 99,
      branchId: new Types.ObjectId(branchId),
    });

    // Query via endpoint
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/stages/${legacyDoc._id.toString()}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(getRes.statusCode).toBe(200);
    const stageData = getRes.json().data;
    expect(stageData.status).toBe('PLANNED');
    expect(stageData.appointment_id).toBeNull();

    // Verify DB update happened or check MongoDB directly
    await new Promise((resolve) => setTimeout(resolve, 100));
    const updatedDbDoc = await DentalTreatmentStageModel.findById(legacyDoc._id);
    expect(updatedDbDoc?.status).toBe('PLANNED');
  });

  it('9. Correctly calculates and auto-increments sequence across multiple stages (Step 1 -> 2 -> 3) for Tooth Extraction', async () => {
    await DentalTreatmentEpisodeModel.updateOne({ _id: new Types.ObjectId(episodeId) }, { $set: { status: 'ACTIVE' } });

    const newExtractionPlanItemId = new Types.ObjectId().toString();

    // Add to examination treatment plan items so procedure name is Tooth Extraction
    await OpdDentalExaminationModel.updateOne(
      { episodeId: new Types.ObjectId(episodeId) },
      {
        $push: {
          treatmentPlanItems: {
            _id: new Types.ObjectId(newExtractionPlanItemId),
            procedureName: 'Tooth Extraction',
            toothNumber: 24,
            quantity: 1,
            unitPrice: 300,
            estimatedCost: 300,
            status: 'ACCEPTED',
          },
        },
      },
    );

    // Stage 1 for Extraction procedure
    const stage1 = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: newExtractionPlanItemId,
        stage_name: 'Pre-Extraction Assessment & Local Anesthesia',
        assigned_doctor_id: docADocId,
        tooth_number: 24,
      },
    });
    expect(stage1.statusCode).toBe(200);
    expect(stage1.json().data.sequence).toBe(1);
    expect(stage1.json().data.status).toBe('PLANNED');

    // Stage 2 for Extraction procedure
    const stage2 = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: newExtractionPlanItemId,
        stage_name: 'Tooth Extraction & Socket Debridement',
        assigned_doctor_id: docADocId,
        tooth_number: 24,
      },
    });
    expect(stage2.statusCode).toBe(200);
    expect(stage2.json().data.sequence).toBe(2);
    expect(stage2.json().data.status).toBe('PLANNED');

    // Stage 3 for Extraction procedure
    const stage3 = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: newExtractionPlanItemId,
        stage_name: 'Hemostasis & Suture Placement',
        assigned_doctor_id: docADocId,
        tooth_number: 24,
      },
    });
    expect(stage3.statusCode).toBe(200);
    expect(stage3.json().data.sequence).toBe(3);
    expect(stage3.json().data.status).toBe('PLANNED');
  });

  it('10. Prevents duplicate unique constraint errors when previous stages are soft-deleted', async () => {
    await DentalTreatmentEpisodeModel.updateOne({ _id: new Types.ObjectId(episodeId) }, { $set: { status: 'ACTIVE' } });

    // Create a new unique plan item
    const customPlanItemId = new Types.ObjectId().toString();

    // Create Stage 1 (sequence 1)
    const s1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: customPlanItemId,
        stage_name: 'Initial Stage',
        assigned_doctor_id: docADocId,
      },
    });
    expect(s1Res.statusCode).toBe(200);
    const s1Id = s1Res.json().data.id;
    expect(s1Res.json().data.sequence).toBe(1);

    // Delete Stage 1 (soft delete)
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/opd/dental/stages/${s1Id}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(delRes.statusCode).toBe(200);

    // Create next stage - should assign sequence 2 and NOT collide with soft-deleted sequence 1
    const s2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: customPlanItemId,
        stage_name: 'Next Stage After Deletion',
        assigned_doctor_id: docADocId,
      },
    });
    expect(s2Res.statusCode).toBe(200);
    expect(s2Res.json().data.sequence).toBe(2);
    expect(s2Res.json().data.status).toBe('PLANNED');
  });

  it('11. Returns meaningful error message when explicit sequence conflicts', async () => {
    await DentalTreatmentEpisodeModel.updateOne({ _id: new Types.ObjectId(episodeId) }, { $set: { status: 'ACTIVE' } });

    const duplicateRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: extractionPlanItemId,
        stage_name: 'Conflicting Sequence 1',
        assigned_doctor_id: docADocId,
        sequence: 1,
      },
    });

    expect(duplicateRes.statusCode).toBe(409);
    const errBody = duplicateRes.json();
    expect(errBody.code || errBody.error?.code).toBe('STAGE_SEQUENCE_CONFLICT');
    expect(errBody.message || errBody.error?.message).toContain('A treatment stage with this sequence already exists');
  });

  it('12. Enforces strict clinical procedure-to-stage compatibility (CLINICAL_MISMATCH)', async () => {
    await DentalTreatmentEpisodeModel.updateOne({ _id: new Types.ObjectId(episodeId) }, { $set: { status: 'ACTIVE' } });

    const extractionItem = new Types.ObjectId().toString();
    const rctItem = new Types.ObjectId().toString();
    const crownItem = new Types.ObjectId().toString();

    await OpdDentalExaminationModel.updateOne(
      { episodeId: new Types.ObjectId(episodeId) },
      {
        $push: {
          treatmentPlanItems: [
            {
              _id: new Types.ObjectId(extractionItem),
              procedureName: 'Tooth Extraction',
              toothNumber: 22,
              quantity: 1,
              unitPrice: 150,
              estimatedCost: 150,
              status: 'ACCEPTED',
            },
            {
              _id: new Types.ObjectId(rctItem),
              procedureName: 'Root Canal Treatment',
              toothNumber: 23,
              quantity: 1,
              unitPrice: 350,
              estimatedCost: 350,
              status: 'ACCEPTED',
            },
            {
              _id: new Types.ObjectId(crownItem),
              procedureName: 'Porcelain Crown Fitting',
              toothNumber: 23,
              quantity: 1,
              unitPrice: 500,
              estimatedCost: 500,
              status: 'ACCEPTED',
            },
          ],
        },
      },
    );

    // Attempt 1: Add Root Canal stage to Tooth Extraction procedure -> Must fail
    const mismatch1 = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: extractionItem,
        stage_name: 'Root Canal Treatment / Pulpectomy',
        assigned_doctor_id: docADocId,
      },
    });
    expect(mismatch1.statusCode).toBe(400);
    expect(mismatch1.json().code || mismatch1.json().error?.code).toBe('CLINICAL_MISMATCH');

    // Attempt 2: Add Crown Impression stage to Tooth Extraction procedure -> Must fail
    const mismatch2 = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: extractionItem,
        stage_name: 'Crown Measurement & Impression',
        assigned_doctor_id: docBDocId,
      },
    });
    expect(mismatch2.statusCode).toBe(400);
    expect(mismatch2.json().code || mismatch2.json().error?.code).toBe('CLINICAL_MISMATCH');

    // Attempt 3: Add Extraction stage to Root Canal procedure -> Must fail
    const mismatch3 = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: rctItem,
        stage_name: 'Tooth Extraction & Socket Debridement',
        assigned_doctor_id: docADocId,
      },
    });
    expect(mismatch3.statusCode).toBe(400);
    expect(mismatch3.json().code || mismatch3.json().error?.code).toBe('CLINICAL_MISMATCH');

    // Attempt 4: Add valid stage to Root Canal procedure -> Must succeed
    const validRctStage = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: rctItem,
        stage_name: 'Canal Instrumentation & Shaping',
        assigned_doctor_id: docADocId,
      },
    });
    expect(validRctStage.statusCode).toBe(200);
    expect(validRctStage.json().data.stage_name).toBe('Canal Instrumentation & Shaping');
  });

  it('13. Does not deadlock valid clinical stages when legacy incompatible stages exist', async () => {
    await DentalTreatmentEpisodeModel.updateOne({ _id: new Types.ObjectId(episodeId) }, { $set: { status: 'ACTIVE' } });

    const mixedItemId = new Types.ObjectId().toString();

    await OpdDentalExaminationModel.updateOne(
      { episodeId: new Types.ObjectId(episodeId) },
      {
        $push: {
          treatmentPlanItems: {
            _id: new Types.ObjectId(mixedItemId),
            procedureName: 'Tooth Extraction',
            toothNumber: 22,
            quantity: 1,
            unitPrice: 150,
            estimatedCost: 150,
            status: 'ACCEPTED',
          },
        },
      },
    );

    // Insert a legacy incompatible stage (Root Canal Treatment) directly as sequence 1 (PLANNED)
    await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      patientId: new Types.ObjectId(patientId),
      departmentId: new Types.ObjectId(dentalDeptId),
      branchId: new Types.ObjectId(branchId),
      planItemId: mixedItemId,
      stageName: 'Root Canal Treatment',
      assignedDoctorId: new Types.ObjectId(docADocId),
      assignedDoctorName: 'Dr. Alice Endo',
      status: 'PLANNED',
      sequence: 1,
    });

    // Create a valid Stage 2 for Tooth Extraction: Pre-Extraction Assessment
    const stage2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: mixedItemId,
        stage_name: 'Pre-Extraction Assessment & Local Anesthesia',
        assigned_doctor_id: docADocId,
        sequence: 2,
      },
    });
    expect(stage2Res.statusCode).toBe(200);
    const stage2Id = stage2Res.json().data.id;

    // Schedule Stage 2: It should NOT be blocked by the legacy incompatible Stage 1
    const scheduleRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage2Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-15',
        start_time: '11:00',
        duration_minutes: 30,
      },
    });
    expect(scheduleRes.statusCode).toBe(200);
    expect(scheduleRes.json().data.stage.status).toBe('SCHEDULED');
  });
});


