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
import {
  registerDentalProcedureDependencyRule,
  clearDentalProcedureDependencyRules,
} from '../src/modules/opd/dental-procedure-dependency.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Generic Dental Treatment Procedure Dependency Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const patientId = createObjectId();

  const doctorUserId = createObjectId();
  const doctorId = createObjectId();

  let visitId: string;
  let episodeId: string;
  let doctorToken: string;

  // Generic procedure IDs on Tooth #22
  const procAItemId = new Types.ObjectId().toString(); // Generic_Procedure_Alpha (Prerequisite)
  const procBItemId = new Types.ObjectId().toString(); // Generic_Procedure_Beta (Dependent on Alpha)
  const procCItemId = new Types.ObjectId().toString(); // Generic_Procedure_Gamma (Independent)

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
    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' }).lean();
    if (!doctorRole) throw new Error('DOCTOR role not seeded');

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

    await UserModel.create({
      _id: new Types.ObjectId(doctorUserId),
      username: 'doctor_dan',
      email: 'doctor.dan@dental.local',
      passwordHash,
      fullName: 'Dr. Dan Specialist',
      roleIds: superAdminRole ? [doctorRole._id, superAdminRole._id] : [doctorRole._id],
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [new Types.ObjectId(dentalDeptId)],
      status: 'active',
    });

    await DoctorModel.create({
      _id: new Types.ObjectId(doctorId),
      userId: new Types.ObjectId(doctorUserId),
      doctorNumber: 'DOC-DEP-01',
      firstName: 'Dan',
      lastName: 'Specialist',
      displayName: 'Dr. Dan Specialist',
      specialization: 'Dental Specialist',
      departmentId: new Types.ObjectId(dentalDeptId),
      branchId: new Types.ObjectId(branchId),
      status: 'ACTIVE',
      availability: doctorAvailability,
    });

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'P-DEP-001',
      firstName: 'Alice',
      lastName: 'Wonderland',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'FEMALE',
      contact: { phone: '+254700999888' },
      branchId: new Types.ObjectId(branchId),
      status: 'ACTIVE',
    });

    const visit = await OpdVisitModel.create({
      visitNumber: 'V-DEP-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-DEP-001',
      patientName: 'Alice Wonderland',
      patientGender: 'FEMALE',
      patientDateOfBirth: new Date('1990-05-15'),
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Dan Specialist',
      doctorSpecialization: 'Dental Specialist',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'D-01',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-21'),
      checkInTime: new Date('2026-09-21T08:00:00Z'),
    });
    visitId = visit._id.toString();

    const episode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DE-DEP-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-DEP-001',
      patientName: 'Alice Wonderland',
      originatingVisitId: new Types.ObjectId(visitId),
      originatingVisitNumber: 'V-DEP-001',
      primaryDoctorId: new Types.ObjectId(doctorId),
      primaryDoctorName: 'Dr. Dan Specialist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'ACTIVE',
      leadDoctorId: new Types.ObjectId(doctorId),
      primaryToothNumber: 22,
      treatmentPlanSummary: 'Generic Multi-Procedure Dental Treatment',
      visitIds: [new Types.ObjectId(visitId)],
    });
    episodeId = episode._id.toString();

    // Dental examination record with 3 generic procedures on Tooth #22
    await OpdDentalExaminationModel.create({
      visitId: new Types.ObjectId(visitId),
      episodeId: new Types.ObjectId(episodeId),
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-DEP-001',
      patientName: 'Alice Wonderland',
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Dan Specialist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'DRAFT',
      teeth: [
        {
          toothNumber: 22,
          dentition: 'PERMANENT',
          status: 'PRESENT',
          conditions: ['CARIOUS'],
          surfaces: ['OCCLUSAL'],
        },
      ],
      treatmentPlanItems: [
        {
          _id: new Types.ObjectId(procAItemId),
          toothNumber: 22,
          procedureName: 'Generic_Procedure_Alpha',
          status: 'ACCEPTED',
          priority: 'ROUTINE',
          estimatedCost: 1500,
        },
        {
          _id: new Types.ObjectId(procBItemId),
          toothNumber: 22,
          procedureName: 'Generic_Procedure_Beta',
          status: 'ACCEPTED',
          priority: 'ROUTINE',
          estimatedCost: 3500,
          dependsOnPlanItemId: procAItemId, // Explicit dependency on Procedure Alpha
        },
        {
          _id: new Types.ObjectId(procCItemId),
          toothNumber: 22,
          procedureName: 'Generic_Procedure_Gamma',
          status: 'ACCEPTED',
          priority: 'ROUTINE',
          estimatedCost: 800,
          // Independent (no prerequisite)
        },
      ],
    });

    const built = await buildApp();
    app = built.app;
    await app.ready();

    doctorToken = signJwt(
      { sub: doctorUserId, username: 'doctor_dan' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    clearDentalProcedureDependencyRules();
    if (app) await app.close();
    await teardownTestDatabase();
  });

  it('1. Independent procedure with no dependencies can be scheduled and executed normally', async () => {
    // Create stage for Procedure Gamma (Independent)
    const createStageRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: procCItemId,
        stage_name: 'Gamma Step 1',
        assigned_doctor_id: doctorId,
        tooth_number: 22,
        sequence: 1,
      },
    });
    expect(createStageRes.statusCode).toBe(200);
    const stageC1 = createStageRes.json().data;
    expect(stageC1.status).toBe('PLANNED');

    // Schedule stage for Procedure Gamma -> succeeds
    const schedRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageC1.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-25',
        start_time: '09:00',
        duration_minutes: 30,
      },
    });
    expect(schedRes.statusCode).toBe(200);
    expect(schedRes.json().data.stage.status).toBe('SCHEDULED');

    // Transition to IN_PROGRESS and then COMPLETED -> succeeds
    const inProgRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageC1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(inProgRes.statusCode).toBe(200);

    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageC1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().data.status).toBe('COMPLETED');
  });

  it('2. Dependent procedure (Procedure Beta) is blocked while its prerequisite (Procedure Alpha) is incomplete', async () => {
    await DentalTreatmentEpisodeModel.updateOne(
      { _id: new Types.ObjectId(episodeId) },
      { $set: { status: 'ACTIVE' } },
    );

    // Create stages for Procedure Alpha (Prerequisite) and Procedure Beta (Dependent)
    const createStageARes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: procAItemId,
        stage_name: 'Alpha Step 1 Preparation',
        assigned_doctor_id: doctorId,
        tooth_number: 22,
        sequence: 1,
      },
    });
    expect(createStageARes.statusCode).toBe(200);

    const createStageBRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: procBItemId,
        stage_name: 'Beta Step 1 Execution',
        assigned_doctor_id: doctorId,
        tooth_number: 22,
        sequence: 1,
      },
    });
    expect(createStageBRes.statusCode).toBe(200);
    const stageB1 = createStageBRes.json().data;

    // Procedure Alpha is currently PLANNED (not completed).
    // Attempting to schedule Procedure Beta stage 1 must fail with PREREQUISITE_PROCEDURE_INCOMPLETE!
    const schedBRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageB1.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-26',
        start_time: '10:00',
        duration_minutes: 45,
      },
    });

    expect(schedBRes.statusCode).toBe(400);
    const schedBErr = schedBRes.json();
    expect(schedBErr.error?.code || schedBErr.code).toBe('PREREQUISITE_PROCEDURE_INCOMPLETE');
    expect(schedBErr.error?.message || schedBErr.message).toContain('Waiting for "Generic_Procedure_Alpha" to be completed');

    // Attempting to transition stageB1 directly to IN_PROGRESS or COMPLETED must also be blocked
    const patchBRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageB1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(patchBRes.statusCode).toBe(400);
  });

  it('3. Dependent procedure (Procedure Beta) becomes executable after prerequisite (Procedure Alpha) reaches COMPLETED', async () => {
    // Get stage A1 and stage B1
    const stagesRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    const allStages = stagesRes.json().data;
    const stageA1 = allStages.find((s: { plan_item_id: string }) => s.plan_item_id === procAItemId);
    const stageB1 = allStages.find((s: { plan_item_id: string }) => s.plan_item_id === procBItemId);

    // Schedule and complete Procedure Alpha Stage 1
    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageA1.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-26',
        start_time: '08:30',
        duration_minutes: 30,
      },
    });

    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageA1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });

    const completeARes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageA1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(completeARes.statusCode).toBe(200);

    // Now Procedure Alpha is COMPLETED.
    // Scheduling Procedure Beta Stage 1 must now succeed!
    const schedBRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageB1.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-27',
        start_time: '11:00',
        duration_minutes: 45,
      },
    });
    expect(schedBRes.statusCode).toBe(200);
    expect(schedBRes.json().data.stage.status).toBe('SCHEDULED');

    // Procedure Beta Stage 1 can progress to IN_PROGRESS and COMPLETED
    const inProgBRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageB1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(inProgBRes.statusCode).toBe(200);

    const completeBRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageB1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(completeBRes.statusCode).toBe(200);
    expect(completeBRes.json().data.status).toBe('COMPLETED');
  });

  it('4. Stage sequencing continues to work across multiple stages of a dependent procedure', async () => {
    await DentalTreatmentEpisodeModel.updateOne(
      { _id: new Types.ObjectId(episodeId) },
      { $set: { status: 'ACTIVE' } },
    );

    // Add Stage 2 to Procedure Beta
    const createB2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: procBItemId,
        stage_name: 'Beta Step 2 Polishing',
        assigned_doctor_id: doctorId,
        tooth_number: 22,
        sequence: 2,
      },
    });
    expect(createB2Res.statusCode).toBe(200);
    const stageB2 = createB2Res.json().data;
    expect(stageB2.sequence).toBe(2);

    // Since Stage 1 of Procedure Beta was completed in test 3, Stage 2 can be scheduled
    const schedB2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageB2.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-28',
        start_time: '14:00',
        duration_minutes: 30,
      },
    });
    expect(schedB2Res.statusCode).toBe(200);
    expect(schedB2Res.json().data.stage.status).toBe('SCHEDULED');
  });

  it('5. Configured generic dependency rules work with arbitrary procedure names', async () => {
    await DentalTreatmentEpisodeModel.updateOne(
      { _id: new Types.ObjectId(episodeId) },
      { $set: { status: 'ACTIVE' } },
    );

    // Register a generic dependency rule: Test_Prerequisite_X -> Test_Dependent_Y
    registerDentalProcedureDependencyRule({
      prerequisiteProcedureName: 'Test_Prerequisite_X',
      dependentProcedureName: 'Test_Dependent_Y',
    });

    const procXId = new Types.ObjectId().toString();
    const procYId = new Types.ObjectId().toString();

    // Update examination with procedures X and Y
    await OpdDentalExaminationModel.updateOne(
      { visitId: new Types.ObjectId(visitId) },
      {
        $push: {
          treatmentPlanItems: [
            {
              _id: new Types.ObjectId(procXId),
              toothNumber: 22,
              procedureName: 'Test_Prerequisite_X',
              status: 'ACCEPTED',
              priority: 'ROUTINE',
              estimatedCost: 1000,
            },
            {
              _id: new Types.ObjectId(procYId),
              toothNumber: 22,
              procedureName: 'Test_Dependent_Y',
              status: 'ACCEPTED',
              priority: 'ROUTINE',
              estimatedCost: 2000,
            },
          ],
        },
      },
    );

    // Create stage for procedure Y (Dependent)
    const createYRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: procYId,
        stage_name: 'Y Step 1',
        assigned_doctor_id: doctorId,
        tooth_number: 22,
        sequence: 1,
      },
    });
    expect(createYRes.statusCode).toBe(200);
    const stageY1 = createYRes.json().data;

    // Scheduling procedure Y must fail because procedure X is not completed
    const schedYRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageY1.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-29',
        start_time: '15:00',
        duration_minutes: 30,
      },
    });
    expect(schedYRes.statusCode).toBe(400);
    const schedYErr = schedYRes.json();
    expect(schedYErr.error?.code || schedYErr.code).toBe('PREREQUISITE_PROCEDURE_INCOMPLETE');
    expect(schedYErr.error?.message || schedYErr.message).toContain('Waiting for "Test_Prerequisite_X" to be completed');

    // Mark Procedure X as COMPLETED in examination
    await OpdDentalExaminationModel.updateOne(
      { 'treatmentPlanItems._id': new Types.ObjectId(procXId) },
      { $set: { 'treatmentPlanItems.$.status': 'COMPLETED' } },
    );

    // Now scheduling procedure Y succeeds!
    const schedY2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageY1.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-29',
        start_time: '15:00',
        duration_minutes: 30,
      },
    });
    expect(schedY2Res.statusCode).toBe(200);
    expect(schedY2Res.json().data.stage.status).toBe('SCHEDULED');
  });
});
