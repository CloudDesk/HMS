/**
 * Dental Treatment Stage — Procedure Prerequisite Validation Tests
 *
 * Tests the generic planItemId-based prerequisite mechanism without hard-coding any
 * specific procedure names (no "Root Canal", "Crown", "Extraction", "Implant").
 *
 * Scenarios:
 *  1. Procedure without prerequisite  → existing behavior unaffected.
 *  2. Procedure with incomplete prerequisite → IN_PROGRESS blocked (PREREQUISITE_PROCEDURE_INCOMPLETE).
 *  3. Procedure with completed prerequisite  → IN_PROGRESS allowed.
 *  4. Invalid / missing prerequisite reference → handled safely (no crash, no block).
 */

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

describe('Dental Stage — planItemId Prerequisite Validation', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const patientId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorDocId = createObjectId();

  // Plan items — use generic, non-procedure-specific names
  const prereqItemId = new Types.ObjectId().toString();  // Procedure A (prerequisite)
  const dependentItemId = new Types.ObjectId().toString(); // Procedure B (depends on A)
  const independentItemId = new Types.ObjectId().toString(); // Procedure C (no dependency)
  const orphanPrereqId = new Types.ObjectId().toString();   // Non-existent prerequisite ref

  let episodeId: string;
  let doctorToken: string;

  beforeAll(async () => {
    await setupTestDatabase();

    await BranchModel.create([
      { _id: new Types.ObjectId(branchId), name: 'Main Branch', code: 'MB01', status: 'ACTIVE' },
      { _id: new Types.ObjectId(createObjectId()), name: 'Secondary Branch', code: 'SB01', status: 'ACTIVE' },
    ]);

    await seedDatabase();

    await DepartmentModel.create({
      _id: new Types.ObjectId(dentalDeptId),
      name: 'Dental Department',
      code: 'DENT',
      branchIds: [new Types.ObjectId(branchId)],
      status: 'ACTIVE',
      isClinical: true,
    });

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    if (!doctorRole) throw new Error('DOCTOR role not seeded');
    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' }).lean();

    const passwordHash = await hashPassword('TestPass123!');

    const doctorAvailability = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map((day) => ({
      _id: new Types.ObjectId(),
      dayOfWeek: day,
      isAvailable: true,
      workingBlocks: [{ _id: new Types.ObjectId(), startTime: '08:00', endTime: '18:00', slotDurationMinutes: 30, maxPatientsPerSlot: 2 }],
    }));

    await UserModel.create({
      _id: new Types.ObjectId(doctorUserId),
      username: 'prereq_test_doc',
      email: 'prereq.doc@test.local',
      passwordHash,
      fullName: 'Dr. Test Prereq',
      roleIds: superAdminRole ? [doctorRole._id, superAdminRole._id] : [doctorRole._id],
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [new Types.ObjectId(dentalDeptId)],
      status: 'active',
    });

    await DoctorModel.create({
      _id: new Types.ObjectId(doctorDocId),
      userId: new Types.ObjectId(doctorUserId),
      doctorNumber: 'DOC-PREREQ-01',
      firstName: 'Test',
      lastName: 'Prereq',
      displayName: 'Dr. Test Prereq',
      specialization: 'General Dentistry',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'ACTIVE',
      availability: doctorAvailability,
    });

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'PAT-PREREQ-001',
      firstName: 'Prereq',
      lastName: 'TestPatient',
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-05-10'),
      primaryContactNumber: '+919000000001',
      branchId: new Types.ObjectId(branchId),
      bloodGroup: 'A+',
    });

    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-PREREQ-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-PREREQ-001',
      patientName: 'Prereq TestPatient',
      patientGender: 'FEMALE',
      patientDateOfBirth: new Date('1992-05-10'),
      doctorId: new Types.ObjectId(doctorDocId),
      doctorName: 'Dr. Test Prereq',
      doctorSpecialization: 'General Dentistry',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Department',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'P-01',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-21'),
      checkInTime: new Date('2026-09-21T09:00:00Z'),
    });

    const episode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-PREREQ-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-PREREQ-001',
      patientName: 'Prereq TestPatient',
      originatingVisitId: visit._id,
      originatingVisitNumber: 'VIS-PREREQ-001',
      primaryDoctorId: new Types.ObjectId(doctorDocId),
      primaryDoctorName: 'Dr. Test Prereq',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 11,
      status: 'ACTIVE',
      visitIds: [visit._id],
    });
    episodeId = episode._id.toString();

    // Seed the dental examination with:
    //   prereqItemId  = Procedure A (prerequisite)  — no dependency
    //   dependentItemId = Procedure B (depends on A)  — dependsOnPlanItemId = prereqItemId
    //   independentItemId = Procedure C (no dependency)
    //   orphan variant of B is set up inside individual tests
    await OpdDentalExaminationModel.create({
      visitId: visit._id,
      episodeId: episode._id,
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-PREREQ-001',
      patientName: 'Prereq TestPatient',
      doctorId: new Types.ObjectId(doctorDocId),
      doctorName: 'Dr. Test Prereq',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'DRAFT',
      teeth: [],
      treatmentPlanItems: [
        // Procedure A — prerequisite
        {
          _id: new Types.ObjectId(prereqItemId),
          procedureName: 'Procedure_Alpha',
          toothNumber: 11,
          estimatedCost: 500,
          status: 'ACCEPTED',
          dependsOnPlanItemId: null,
        },
        // Procedure B — depends on A
        {
          _id: new Types.ObjectId(dependentItemId),
          procedureName: 'Procedure_Beta',
          toothNumber: 11,
          estimatedCost: 700,
          status: 'ACCEPTED',
          dependsOnPlanItemId: prereqItemId,
        },
        // Procedure C — independent
        {
          _id: new Types.ObjectId(independentItemId),
          procedureName: 'Procedure_Gamma',
          toothNumber: 12,
          estimatedCost: 300,
          status: 'ACCEPTED',
          dependsOnPlanItemId: null,
        },
        // Procedure D — depends on a non-existent id (orphan)
        {
          _id: new Types.ObjectId(orphanPrereqId),
          procedureName: 'Procedure_Delta',
          toothNumber: 12,
          estimatedCost: 400,
          status: 'ACCEPTED',
          dependsOnPlanItemId: new Types.ObjectId().toString(), // does not exist
        },
      ],
    });

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    doctorToken = signJwt(
      { sub: doctorUserId, username: 'prereq_test_doc' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 1: Procedure without prerequisite → existing behavior unaffected
  // ─────────────────────────────────────────────────────────────────────────────
  it('1. Procedure C (no prerequisite) can be scheduled and moved to IN_PROGRESS normally', async () => {
    // Create stage for independent Procedure C
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: independentItemId,
        stage_name: 'Gamma Assessment Step',
        assigned_doctor_id: doctorDocId,
        tooth_number: 12,
        sequence: 1,
      },
    });
    expect(createRes.statusCode).toBe(200);
    const stageC1 = createRes.json().data;
    expect(stageC1.status).toBe('PLANNED');

    // Schedule the stage
    const schedRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageC1.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { appointment_date: '2026-10-01', start_time: '09:00', duration_minutes: 30 },
    });
    expect(schedRes.statusCode).toBe(200);
    expect(schedRes.json().data.stage.status).toBe('SCHEDULED');

    // Move to IN_PROGRESS — must succeed
    const startRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageC1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json().data.status).toBe('IN_PROGRESS');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 2: Procedure with incomplete prerequisite → IN_PROGRESS blocked
  // ─────────────────────────────────────────────────────────────────────────────
  it('2. Procedure B (depends on Procedure A, which is incomplete) is blocked when moving to IN_PROGRESS', async () => {
    // Create stage for Procedure A (the prerequisite) but do NOT complete it
    const createARes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: prereqItemId,
        stage_name: 'Alpha Primary Step',
        assigned_doctor_id: doctorDocId,
        tooth_number: 11,
        sequence: 1,
      },
    });
    expect(createARes.statusCode).toBe(200);

    // Create stage for dependent Procedure B
    const createBRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: dependentItemId,
        stage_name: 'Beta Primary Step',
        assigned_doctor_id: doctorDocId,
        tooth_number: 11,
        sequence: 1,
      },
    });
    expect(createBRes.statusCode).toBe(200);
    const stageBId = createBRes.json().data.id;

    // Attempt to schedule Procedure B — must be blocked by prerequisite check
    const schedBRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageBId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { appointment_date: '2026-10-03', start_time: '10:00', duration_minutes: 30 },
    });
    expect(schedBRes.statusCode).toBe(400);
    const schedBErr = schedBRes.json();
    expect(schedBErr.error?.code || schedBErr.code).toBe('PREREQUISITE_PROCEDURE_INCOMPLETE');
    expect(schedBErr.error?.message || schedBErr.message).toContain('Procedure_Alpha');

    // Note: a direct PATCH from PLANNED → IN_PROGRESS would be rejected by the state
    // machine (INVALID_STATE_TRANSITION) before the prerequisite check, since PLANNED
    // can only go to SCHEDULED, ON_HOLD, or CANCELLED. The scheduling endpoint is the
    // correct entry point and is verified above.
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 3: Procedure with completed prerequisite → IN_PROGRESS allowed
  // ─────────────────────────────────────────────────────────────────────────────
  it('3. Procedure B becomes executable once Procedure A is COMPLETED', async () => {
    await DentalTreatmentEpisodeModel.updateOne(
      { _id: new Types.ObjectId(episodeId) },
      { $set: { status: 'ACTIVE' } },
    );

    // Get Procedure A's stage and complete it
    const listARes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(listARes.statusCode).toBe(200);
    const allStages: Array<{ id: string; plan_item_id: string; status: string }> = listARes.json().data;

    const stageA = allStages.find((s) => s.plan_item_id === prereqItemId);
    expect(stageA).toBeDefined();

    // Schedule Procedure A
    const schedARes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageA!.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { appointment_date: '2026-10-05', start_time: '08:00', duration_minutes: 45 },
    });
    expect(schedARes.statusCode).toBe(200);

    // Start Procedure A
    const startARes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageA!.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(startARes.statusCode).toBe(200);

    // Complete Procedure A
    const completeARes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageA!.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(completeARes.statusCode).toBe(200);
    expect(completeARes.json().data.status).toBe('COMPLETED');

    // Reactivate episode (completing A may have triggered episode completion check)
    await DentalTreatmentEpisodeModel.updateOne(
      { _id: new Types.ObjectId(episodeId) },
      { $set: { status: 'ACTIVE' } },
    );

    // Now Procedure B stage should be schedulable
    const stageB = allStages.find((s) => s.plan_item_id === dependentItemId);
    expect(stageB).toBeDefined();

    const schedBRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageB!.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { appointment_date: '2026-10-06', start_time: '10:00', duration_minutes: 45 },
    });
    expect(schedBRes.statusCode).toBe(200);
    expect(schedBRes.json().data.stage.status).toBe('SCHEDULED');

    // Move B to IN_PROGRESS — must succeed
    const startBRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageB!.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(startBRes.statusCode).toBe(200);
    expect(startBRes.json().data.status).toBe('IN_PROGRESS');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 4: Invalid / missing prerequisite reference → handled safely
  // ─────────────────────────────────────────────────────────────────────────────
  it('4. Procedure with a missing (non-existent) prerequisite planItemId is handled safely and does not block', async () => {
    await DentalTreatmentEpisodeModel.updateOne(
      { _id: new Types.ObjectId(episodeId) },
      { $set: { status: 'ACTIVE' } },
    );

    // Create a stage for Procedure D (orphan prerequisite reference)
    const createDRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: orphanPrereqId,
        stage_name: 'Delta Assessment Step',
        assigned_doctor_id: doctorDocId,
        tooth_number: 12,
        sequence: 1,
      },
    });
    expect(createDRes.statusCode).toBe(200);
    const stageDId = createDRes.json().data.id;

    // Schedule D — should succeed (orphan ref resolves to no match → not blocked)
    const schedDRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stageDId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { appointment_date: '2026-10-08', start_time: '11:00', duration_minutes: 30 },
    });
    expect(schedDRes.statusCode).toBe(200);
    expect(schedDRes.json().data.stage.status).toBe('SCHEDULED');

    // Move D to IN_PROGRESS — must succeed without error or crash
    const startDRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stageDId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(startDRes.statusCode).toBe(200);
    expect(startDRes.json().data.status).toBe('IN_PROGRESS');
  });
});
