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
import { DentalTreatmentStageModel } from '../src/modules/opd/dental-stage.model.js';
import { DentalProstheticLabOrderModel } from '../src/modules/opd/dental-lab-order.model.js';
import { NotificationModel } from '../src/modules/notifications/notification.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Phase 5A: Dental Prosthetic Lab Order Foundation Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const patientId = createObjectId();

  // Doctor (Prosthodontist)
  const docUserId = createObjectId();
  const docId = createObjectId();

  // Unauthorized User (e.g. Receptionist with no OPD Consultation Edit permission)
  const unauthUserId = createObjectId();

  // Patient User
  const patientUserId = createObjectId();

  let visitId: string;
  let episodeId: string;
  let stageId: string;
  let doctorToken: string;
  let unauthToken: string;
  let patientToken: string;

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
        name: 'Dental Surgery & Prosthodontics',
        code: 'DENT_PROSTH',
        branchIds: [new Types.ObjectId(branchId)],
        status: 'ACTIVE',
        isClinical: true,
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'PAT-LAB-001',
      firstName: 'LabOrder',
      lastName: 'Patient',
      gender: 'MALE',
      dateOfBirth: new Date('1990-05-15'),
      primaryBranchId: new Types.ObjectId(branchId),
      registeredBranchId: new Types.ObjectId(branchId),
      phone: '9876543210',
      status: 'ACTIVE',
    });

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    const staffRole = await RoleModel.findOne({ code: 'RECEPTIONIST' }).lean();
    const patientRole = await RoleModel.findOne({ code: 'PATIENT' }).lean();

    const passwordHash = await hashPassword('Doctor@123');

    await UserModel.create([
      {
        _id: new Types.ObjectId(docUserId),
        username: 'dr_marcus_crown',
        email: 'prosthodontist@hospital.test',
        passwordHash,
        fullName: 'Dr. Marcus Crown',
        roleIds: [doctorRole!._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(unauthUserId),
        username: 'receptionist_front',
        email: 'unauth@hospital.test',
        passwordHash,
        fullName: 'Front Desk',
        roleIds: [staffRole!._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(patientUserId),
        username: 'patient_alice_notif',
        email: 'patient.alice@hospital.test',
        passwordHash,
        fullName: 'LabOrder Patient',
        patientId: new Types.ObjectId(patientId),
        roleIds: patientRole ? [patientRole._id] : [],
        branchIds: [new Types.ObjectId(branchId)],
        status: 'active',
      },
    ]);

    await DoctorModel.create({
      _id: new Types.ObjectId(docId),
      userId: new Types.ObjectId(docUserId),
      doctorNumber: 'DOC-PROSTH-01',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      firstName: 'Marcus',
      lastName: 'Crown',
      displayName: 'Dr. Marcus Crown',
      qualification: 'BDS, MDS (Prosthodontics)',
      specialization: 'Prosthodontics',
      status: 'ACTIVE',
      availability: [],
    });

    const appInstance = await buildApp();
    app = appInstance.app;

    doctorToken = signJwt(
      { sub: docUserId, username: 'dr_marcus_crown' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    unauthToken = signJwt(
      { sub: unauthUserId, username: 'receptionist_front' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    patientToken = signJwt(
      { sub: patientUserId, username: 'patient_alice_notif' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    // Create originating visit
    const visit = await OpdVisitModel.create({
      visitNumber: 'OPD-PROSTH-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-LAB-001',
      patientName: 'LabOrder Patient',
      patientGender: 'MALE',
      patientDateOfBirth: new Date('1990-05-15'),
      doctorId: new Types.ObjectId(docId),
      doctorName: 'Dr. Marcus Crown',
      doctorSpecialization: 'Prosthodontics',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery & Prosthodontics',
      branchId: new Types.ObjectId(branchId),
      visitType: 'NEW_CONSULTATION',
      visitDate: new Date(),
      checkInTime: new Date(),
      status: 'IN_CONSULTATION',
      priority: 'ROUTINE',
    });
    visitId = visit._id.toString();

    // Create Episode
    const ep = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-2026-00001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-LAB-001',
      patientName: 'LabOrder Patient',
      originatingVisitId: new Types.ObjectId(visitId),
      originatingVisitNumber: 'OPD-PROSTH-001',
      primaryDoctorId: new Types.ObjectId(docId),
      primaryDoctorName: 'Dr. Marcus Crown',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 16,
      diagnosisName: 'Crown preparation required',
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visitId)],
    });
    episodeId = ep._id.toString();

    // Create Stage: Crown Measurement
    const stg = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      planItemId,
      toothNumber: 16,
      stageName: 'Crown Measurement',
      sequence: 1,
      assignedDoctorId: new Types.ObjectId(docId),
      assignedDoctorName: 'Dr. Marcus Crown',
      status: 'IN_PROGRESS',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patientId),
    });
    stageId = stg._id.toString();
  });

  afterAll(async () => {
    await app.close();
    await teardownTestDatabase();
  });

  it('1. Creates a Dental Prosthetic Lab Order with valid dental context', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stageId,
        treatment_plan_item_id: planItemId,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Zirconia full contour crown for tooth 16, shade A2',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.id).toBeDefined();
    expect(body.order_number).toMatch(/^DPL-\d{4}-\d{5}$/);
    expect(body.patient_id).toBe(patientId);
    expect(body.treatment_episode_id).toBe(episodeId);
    expect(body.treatment_stage_id).toBe(stageId);
    expect(body.treatment_plan_item_id).toBe(planItemId);
    expect(body.tooth_number).toBe(16);
    expect(body.prosthetic_type).toBe('CROWN');
    expect(body.description).toBe('Zirconia full contour crown for tooth 16, shade A2');
    expect(body.status).toBe('ORDERED');
    expect(body.requested_by).toBe(docUserId);
    expect(body.requested_by_name).toBe('Dr. Marcus Crown');
  });

  it('2. Generates a unique sequence order number on subsequent orders', async () => {
    // Create second stage
    const stage2 = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      planItemId: new Types.ObjectId().toString(),
      toothNumber: 26,
      stageName: 'Bridge Preparation',
      sequence: 2,
      assignedDoctorId: new Types.ObjectId(docId),
      assignedDoctorName: 'Dr. Marcus Crown',
      status: 'PLANNED',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patientId),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stage2._id.toString(),
        tooth_number: 26,
        prosthetic_type: 'BRIDGE',
        description: '3-unit PFM bridge (25-27)',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.order_number).toMatch(/^DPL-\d{4}-\d{5}$/);
    expect(body.prosthetic_type).toBe('BRIDGE');
  });

  it('3. Correctly links Episode -> Stage -> Lab Order in Stage document', async () => {
    const updatedStage = await DentalTreatmentStageModel.findById(stageId).lean();
    expect(updatedStage).not.toBeNull();
    expect(updatedStage!.prostheticLabOrderId).toBeDefined();
    expect(updatedStage!.prostheticLabOrderId).not.toBeNull();

    // Verify stage API response returns prosthetic_lab_order_id
    const stageRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/stages/${stageId}`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
    });
    expect(stageRes.statusCode).toBe(200);
    const stageBody = stageRes.json().data;
    expect(stageBody.prosthetic_lab_order_id).toBe(updatedStage!.prostheticLabOrderId!.toString());
  });

  it('4. Preserves tooth number or falls back to stage tooth number', async () => {
    // Create stage with tooth 14
    const stage3 = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      planItemId: new Types.ObjectId().toString(),
      toothNumber: 14,
      stageName: 'Inlay Measurement',
      sequence: 3,
      assignedDoctorId: new Types.ObjectId(docId),
      assignedDoctorName: 'Dr. Marcus Crown',
      status: 'PLANNED',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patientId),
    });

    // Create lab order omitting explicit tooth_number -> should inherit stage's tooth number
    const res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stage3._id.toString(),
        prosthetic_type: 'OTHER',
        description: 'Ceramic onlay',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.tooth_number).toBe(14);
  });

  it('5. Rejects an invalid/mismatched Episode and Stage', async () => {
    const foreignEpisodeId = createObjectId();

    const res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
      payload: {
        patient_id: patientId,
        treatment_episode_id: foreignEpisodeId,
        treatment_stage_id: stageId,
        prosthetic_type: 'CROWN',
        description: 'Mismatched episode test',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('6. Rejects unauthorized creation by user without OPD Consultation Edit permission', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: {
        authorization: `Bearer ${unauthToken}`,
      },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stageId,
        prosthetic_type: 'CROWN',
        description: 'Unauthorized creation attempt',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('7. Retrieves a lab order by ID', async () => {
    const order = await DentalProstheticLabOrderModel.findOne({ treatmentStageId: new Types.ObjectId(stageId) }).lean();
    expect(order).not.toBeNull();

    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/lab-orders/${order!._id.toString()}`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.id).toBe(order!._id.toString());
    expect(body.order_number).toBe(order!.orderNumber);
    expect(body.prosthetic_type).toBe('CROWN');
    expect(body.status).toBe('ORDERED');
  });

  it('8. Retrieves lab orders for a Dental Episode', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/episodes/${episodeId}/lab-orders`,
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body.every((o: { treatment_episode_id: string }) => o.treatment_episode_id === episodeId)).toBe(true);
  });

  it('9. Existing non-Dental Laboratory endpoints and workflows remain unaffected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/laboratory/orders',
      headers: {
        authorization: `Bearer ${doctorToken}`,
      },
    });

    // Should respond with valid laboratory orders status
    expect([200, 403, 404]).toContain(res.statusCode);
  });

  it('10. Progresses order through full manufacturing lifecycle: ORDERED -> RECEIVED -> IN_PROGRESS -> QUALITY_CHECK -> READY', async () => {
    // Create a new fresh lab order in ORDERED state
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stageId,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'E-max crown for lifecycle test',
      },
    });
    expect(orderRes.statusCode).toBe(200);
    const orderId = orderRes.json().data.id;

    // Step 1: ORDERED -> RECEIVED
    const resReceived = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED', remarks: 'Impression received at lab' },
    });
    expect(resReceived.statusCode).toBe(200);
    const bodyReceived = resReceived.json().data;
    expect(bodyReceived.status).toBe('RECEIVED');
    expect(bodyReceived.received_at).toBeDefined();
    expect(bodyReceived.status_remarks).toBe('Impression received at lab');

    // Step 2: RECEIVED -> IN_PROGRESS
    const resInProgress = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS', remarks: 'Milling and sintering started' },
    });
    expect(resInProgress.statusCode).toBe(200);
    const bodyInProgress = resInProgress.json().data;
    expect(bodyInProgress.status).toBe('IN_PROGRESS');
    expect(bodyInProgress.in_progress_at).toBeDefined();
    expect(bodyInProgress.status_remarks).toBe('Milling and sintering started');

    // Step 3: IN_PROGRESS -> QUALITY_CHECK
    const resQc = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'QUALITY_CHECK', remarks: 'Margin fit and shade verification' },
    });
    expect(resQc.statusCode).toBe(200);
    const bodyQc = resQc.json().data;
    expect(bodyQc.status).toBe('QUALITY_CHECK');
    expect(bodyQc.quality_check_at).toBeDefined();

    // Step 4: QUALITY_CHECK -> READY
    const resReady = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'READY', remarks: 'Crown glazed, sterilized, and packaged' },
    });
    expect(resReady.statusCode).toBe(200);
    const bodyReady = resReady.json().data;
    expect(bodyReady.status).toBe('READY');
    expect(bodyReady.ready_at).toBeDefined();
    expect(bodyReady.status_remarks).toBe('Crown glazed, sterilized, and packaged');
  });

  it('11. Allows cancellation from active processing status with required cancellation reason', async () => {
    // Create new order
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stageId,
        prosthetic_type: 'CROWN',
        description: 'Crown to be cancelled',
      },
    });
    const orderId = orderRes.json().data.id;

    // Move to IN_PROGRESS
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });

    // Attempt cancellation WITHOUT reason -> rejected
    const resNoReason = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'CANCELLED' },
    });
    expect(resNoReason.statusCode).toBe(400);

    // Cancel WITH reason
    const resCancel = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        status: 'CANCELLED',
        cancellation_reason: 'Patient changed treatment plan to extraction',
        remarks: 'Aborted milling',
      },
    });
    expect(resCancel.statusCode).toBe(200);
    const body = resCancel.json().data;
    expect(body.status).toBe('CANCELLED');
    expect(body.cancellation_reason).toBe('Patient changed treatment plan to extraction');
    expect(body.cancelled_at).toBeDefined();
  });

  it('12. Rejects invalid status transitions (e.g. READY -> IN_PROGRESS, QUALITY_CHECK -> RECEIVED)', async () => {
    // Create and move order to READY
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stageId,
        prosthetic_type: 'CROWN',
        description: 'Crown for invalid transition testing',
      },
    });
    const orderId = orderRes.json().data.id;

    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'QUALITY_CHECK' },
    });

    // Invalid transition: QUALITY_CHECK -> RECEIVED
    const resInvalid1 = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED' },
    });
    expect(resInvalid1.statusCode).toBe(400);
    expect(resInvalid1.json().error.code).toBe('INVALID_STATUS_TRANSITION');

    // Move to READY
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'READY' },
    });

    // Invalid transition from terminal state: READY -> IN_PROGRESS
    const resInvalid2 = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(resInvalid2.statusCode).toBe(400);
    expect(resInvalid2.json().error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('13. Rejects modification of CANCELLED lab orders (terminal state)', async () => {
    // Create order and cancel it
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stageId,
        prosthetic_type: 'CROWN',
        description: 'Order to be cancelled',
      },
    });
    const orderId = orderRes.json().data.id;

    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'CANCELLED', cancellation_reason: 'Cancelled test' },
    });

    // Attempt CANCELLED -> RECEIVED
    const resRevive = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED' },
    });
    expect(resRevive.statusCode).toBe(400);
    expect(resRevive.json().error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('14. Rejects unauthorized status update', async () => {
    const order = await DentalProstheticLabOrderModel.findOne().lean();
    expect(order).not.toBeNull();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${order!._id.toString()}/status`,
      headers: { authorization: `Bearer ${unauthToken}` },
      payload: { status: 'RECEIVED' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('15. Guards stage completion when linked lab order is pending (ORDERED / IN_PROGRESS / QUALITY_CHECK)', async () => {
    // Create new stage
    const testStage = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      planItemId: new Types.ObjectId().toString(),
      toothNumber: 16,
      stageName: 'Crown Cementation Test Stage',
      sequence: 10,
      assignedDoctorId: new Types.ObjectId(docId),
      assignedDoctorName: 'Dr. Marcus Crown',
      status: 'IN_PROGRESS',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patientId),
    });
    const testStageId = testStage._id.toString();

    // Create linked lab order in ORDERED state
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: testStageId,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Testing stage completion guard',
      },
    });
    expect(orderRes.statusCode).toBe(200);
    const orderId = orderRes.json().data.id;

    // Attempt to mark stage COMPLETED while lab order is in ORDERED state -> must be rejected
    const resBlockedOrdered = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${testStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(resBlockedOrdered.statusCode).toBe(400);
    expect(resBlockedOrdered.json().code || resBlockedOrdered.json().error?.code).toBe('LAB_ORDER_NOT_READY');

    // Progress lab order to IN_PROGRESS
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });

    // Attempt to complete stage while IN_PROGRESS -> must be rejected
    const resBlockedProgress = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${testStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(resBlockedProgress.statusCode).toBe(400);
    expect(resBlockedProgress.json().code || resBlockedProgress.json().error?.code).toBe('LAB_ORDER_NOT_READY');

    // Progress lab order to QUALITY_CHECK -> still rejected
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'QUALITY_CHECK' },
    });

    const resBlockedQc = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${testStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(resBlockedQc.statusCode).toBe(400);
    expect(resBlockedQc.json().code || resBlockedQc.json().error?.code).toBe('LAB_ORDER_NOT_READY');
  });

  it('16. Unblocks clinical stage completion when linked lab order reaches READY', async () => {
    // Create new stage
    const testStage = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      planItemId: new Types.ObjectId().toString(),
      toothNumber: 16,
      stageName: 'Crown Fitting Test Stage',
      sequence: 11,
      assignedDoctorId: new Types.ObjectId(docId),
      assignedDoctorName: 'Dr. Marcus Crown',
      status: 'IN_PROGRESS',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patientId),
    });
    const testStageId = testStage._id.toString();

    // Create linked lab order
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: testStageId,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Testing stage completion on READY',
      },
    });
    const orderId = orderRes.json().data.id;

    // Move to READY
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'QUALITY_CHECK' },
    });
    const readyRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'READY' },
    });
    expect(readyRes.statusCode).toBe(200);

    // Verify stage is NOT automatically completed (doctor must complete it)
    const stageCheck = await DentalTreatmentStageModel.findById(testStageId).lean();
    expect(stageCheck!.status).toBe('IN_PROGRESS');

    // Doctor completes the stage -> succeeds now that lab order is READY
    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${testStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().data.status).toBe('COMPLETED');
  });

  it('17. Allows stage completion when linked lab order was CANCELLED', async () => {
    // Create new stage
    const testStage = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      planItemId: new Types.ObjectId().toString(),
      toothNumber: 16,
      stageName: 'Cancelled Lab Order Stage',
      sequence: 12,
      assignedDoctorId: new Types.ObjectId(docId),
      assignedDoctorName: 'Dr. Marcus Crown',
      status: 'IN_PROGRESS',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patientId),
    });
    const testStageId = testStage._id.toString();

    // Create linked lab order and cancel it
    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: testStageId,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Cancelled order test',
      },
    });
    const orderId = orderRes.json().data.id;

    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'CANCELLED', cancellation_reason: 'Alternative direct restoration selected' },
    });

    // Complete stage -> succeeds because cancelled lab order does not block completion
    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${testStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().data.status).toBe('COMPLETED');
  });

  it('18. Phase 6A & 6B: Creates DENTAL_LAB_READY notifications for both clinician and patient when lab order reaches READY', async () => {
    // Clear notifications for test isolation
    await NotificationModel.deleteMany({});

    // Create a new stage and lab order
    const notifStage = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      planItemId: new Types.ObjectId().toString(),
      toothNumber: 24,
      stageName: 'Crown Fitting Notification Stage',
      sequence: 15,
      assignedDoctorId: new Types.ObjectId(docId),
      assignedDoctorName: 'Dr. Marcus Crown',
      status: 'IN_PROGRESS',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patientId),
    });

    const createOrderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: notifStage._id.toString(),
        tooth_number: 24,
        prosthetic_type: 'CROWN',
        description: 'Ceramic Crown Tooth 24 for Notification Test',
      },
    });
    expect(createOrderRes.statusCode).toBe(200);
    const labOrder = createOrderRes.json().data;
    const orderId = labOrder.id;

    // Progress: ORDERED -> RECEIVED -> IN_PROGRESS -> QUALITY_CHECK
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'QUALITY_CHECK' },
    });

    // Verify no DENTAL_LAB_READY notification created yet during intermediate states
    const interimNotifCount = await NotificationModel.countDocuments({ type: 'DENTAL_LAB_READY' });
    expect(interimNotifCount).toBe(0);

    // Transition: QUALITY_CHECK -> READY
    const readyRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${orderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'READY', remarks: 'Sterilized and packaged' },
    });
    expect(readyRes.statusCode).toBe(200);

    // Verify exactly TWO notifications created in database: 1 clinician + 1 patient
    const notifs = await NotificationModel.find({
      type: 'DENTAL_LAB_READY',
      relatedEntityId: new Types.ObjectId(orderId),
    }).lean();

    expect(notifs).toHaveLength(2);

    // 1. Verify Clinician Notification
    const clinicianNotif = notifs.find((n) => n.recipientUserId?.toString() === docUserId);
    expect(clinicianNotif).toBeDefined();
    expect(clinicianNotif!.title).toBe('Dental Prosthetic Ready');
    expect(clinicianNotif!.message).toContain(labOrder.order_number);
    expect(clinicianNotif!.message).toContain('CROWN');
    expect(clinicianNotif!.message).toContain('Tooth #24');
    expect(clinicianNotif!.recipientBranchId?.toString()).toBe(branchId);
    expect(clinicianNotif!.isRead).toBe(false);

    // 2. Verify Patient Notification
    const patientNotif = notifs.find((n) => n.recipientUserId?.toString() === patientUserId);
    expect(patientNotif).toBeDefined();
    expect(patientNotif!.title).toBe('Dental Prosthetic Ready');
    expect(patientNotif!.message).toContain('Your dental prosthetic (CROWN (Tooth #24)) is ready');
    expect(patientNotif!.message).toContain('Please contact the hospital or check your upcoming appointment for the next step');
    expect(patientNotif!.recipientBranchId?.toString()).toBe(branchId);
    expect(patientNotif!.isRead).toBe(false);

    // 3. Verify Clinician fetches clinician notification via /api/notifications/me
    const docMeRes = await app.inject({
      method: 'GET',
      url: '/api/notifications/me',
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(docMeRes.statusCode).toBe(200);
    const docNotifs = docMeRes.json().data.data;
    const docFound = docNotifs.find((n: { id: string }) => n.id === clinicianNotif!._id.toString());
    expect(docFound).toBeDefined();
    expect(docFound.title).toBe('Dental Prosthetic Ready');

    // 4. Verify Patient fetches patient notification via /api/notifications/me and cannot see clinician's
    const patientMeRes = await app.inject({
      method: 'GET',
      url: '/api/notifications/me',
      headers: { authorization: `Bearer ${patientToken}` },
    });
    expect(patientMeRes.statusCode).toBe(200);
    const patNotifs = patientMeRes.json().data.data;
    const patFound = patNotifs.find((n: { id: string }) => n.id === patientNotif!._id.toString());
    expect(patFound).toBeDefined();
    expect(patFound.title).toBe('Dental Prosthetic Ready');
    expect(patFound.message).toContain('Your dental prosthetic');
    // Ensure patient does NOT receive the clinician's internal notification
    const docInPatView = patNotifs.find((n: { id: string }) => n.id === clinicianNotif!._id.toString());
    expect(docInPatView).toBeUndefined();
  });

  it('19. Phase 6A & 6B: Does not create duplicate notifications on idempotent status calls', async () => {
    // Find existing READY lab order
    const readyOrder = await DentalProstheticLabOrderModel.findOne({ status: 'READY' })
      .sort({ createdAt: -1 })
      .lean();
    expect(readyOrder).not.toBeNull();

    const notifCountBefore = await NotificationModel.countDocuments({
      type: 'DENTAL_LAB_READY',
      relatedEntityId: readyOrder!._id,
    });
    expect(notifCountBefore).toBe(2);

    // Repeated call with status: READY (already in READY)
    const duplicateRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${readyOrder!._id.toString()}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'READY' },
    });
    expect(duplicateRes.statusCode).toBe(200);

    const notifCountAfter = await NotificationModel.countDocuments({
      type: 'DENTAL_LAB_READY',
      relatedEntityId: readyOrder!._id,
    });
    expect(notifCountAfter).toBe(2);
  });

  it('20. Phase 6A & 6B: Non-READY transitions (e.g. CANCELLED) do not create DENTAL_LAB_READY notifications for clinician or patient', async () => {
    // Create new lab order and cancel it
    const cancelStage = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      planItemId: new Types.ObjectId().toString(),
      stageName: 'Cancellation Non-Notif Stage',
      sequence: 16,
      assignedDoctorId: new Types.ObjectId(docId),
      assignedDoctorName: 'Dr. Marcus Crown',
      status: 'IN_PROGRESS',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patientId),
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: cancelStage._id.toString(),
        prosthetic_type: 'OTHER',
        description: 'Prosthetic to be cancelled without ready notification',
      },
    });
    const cancelOrderId = createRes.json().data.id;

    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${cancelOrderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'CANCELLED', cancellation_reason: 'Not required' },
    });

    const cancelNotifs = await NotificationModel.find({
      relatedEntityId: new Types.ObjectId(cancelOrderId),
    }).lean();
    expect(cancelNotifs).toHaveLength(0);
  });

  it('21. Phase 6C: Multiple Dental Lab Orders maintain strict notification isolation across patients, clinicians, orders, and branches', async () => {
    // 1. Setup Patient B and Doctor B
    const patient2Id = createObjectId();
    const patient2UserId = createObjectId();
    const doc2UserId = createObjectId();
    const doc2Id = createObjectId();
    const branch2Id = createObjectId();

    await BranchModel.create({
      _id: new Types.ObjectId(branch2Id),
      name: 'Branch Two',
      code: 'BR2',
      status: 'ACTIVE',
    });

    await PatientModel.create({
      _id: new Types.ObjectId(patient2Id),
      patientNumber: 'PAT-LAB-002',
      firstName: 'Bob',
      lastName: 'Patient',
      gender: 'MALE',
      dateOfBirth: new Date('1985-08-20'),
      primaryBranchId: new Types.ObjectId(branch2Id),
      registeredBranchId: new Types.ObjectId(branch2Id),
      phone: '9876543211',
      status: 'ACTIVE',
    });

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    const patientRole = await RoleModel.findOne({ code: 'PATIENT' }).lean();
    const passwordHash = await hashPassword('Pass@1234');

    await UserModel.create([
      {
        _id: new Types.ObjectId(doc2UserId),
        username: 'dr_sarah_prostho',
        email: 'dr.sarah@hospital.test',
        passwordHash,
        fullName: 'Dr. Sarah Prostho',
        roleIds: [doctorRole!._id],
        branchIds: [new Types.ObjectId(branch2Id)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(patient2UserId),
        username: 'patient_bob_notif',
        email: 'bob@patient.test',
        passwordHash,
        fullName: 'Bob Patient',
        patientId: new Types.ObjectId(patient2Id),
        roleIds: patientRole ? [patientRole._id] : [],
        branchIds: [new Types.ObjectId(branch2Id)],
        status: 'active',
      },
    ]);

    await DoctorModel.create({
      _id: new Types.ObjectId(doc2Id),
      userId: new Types.ObjectId(doc2UserId),
      doctorNumber: 'DOC-PROSTH-02',
      branchId: new Types.ObjectId(branch2Id),
      departmentId: new Types.ObjectId(dentalDeptId),
      firstName: 'Sarah',
      lastName: 'Prostho',
      displayName: 'Dr. Sarah Prostho',
      qualification: 'BDS, MDS',
      specialization: 'Prosthodontics',
      status: 'ACTIVE',
      availability: [],
    });

    const doctor2Token = signJwt(
      { sub: doc2UserId, username: 'dr_sarah_prostho' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    const patient2Token = signJwt(
      { sub: patient2UserId, username: 'patient_bob_notif' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    // Create Patient 2 visit, episode, stage
    const visit2 = await OpdVisitModel.create({
      visitNumber: 'OPD-PROSTH-002',
      patientId: new Types.ObjectId(patient2Id),
      patientNumber: 'PAT-LAB-002',
      patientName: 'Bob Patient',
      patientGender: 'MALE',
      patientDateOfBirth: new Date('1985-08-20'),
      doctorId: new Types.ObjectId(doc2Id),
      doctorName: 'Dr. Sarah Prostho',
      doctorSpecialization: 'Prosthodontics',
      branchId: new Types.ObjectId(branch2Id),
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery & Prosthodontics',
      visitDate: new Date(),
      checkInTime: new Date(),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
    });

    const episode2 = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-2026-00002',
      patientId: new Types.ObjectId(patient2Id),
      patientNumber: 'PAT-LAB-002',
      patientName: 'Bob Patient',
      originatingVisitId: visit2._id,
      originatingVisitNumber: 'OPD-PROSTH-002',
      primaryDoctorId: new Types.ObjectId(doc2Id),
      primaryDoctorName: 'Dr. Sarah Prostho',
      branchId: new Types.ObjectId(branch2Id),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 26,
      diagnosisName: 'Upper left molar bridge replacement',
      status: 'ACTIVE',
      visitIds: [visit2._id],
    });

    const stageOrder2 = await DentalTreatmentStageModel.create({
      episodeId: episode2._id,
      planItemId: new Types.ObjectId().toString(),
      toothNumber: 26,
      stageName: 'Bridge Fabrication Stage',
      sequence: 1,
      assignedDoctorId: new Types.ObjectId(doc2Id),
      assignedDoctorName: 'Dr. Sarah Prostho',
      status: 'IN_PROGRESS',
      branchId: new Types.ObjectId(branch2Id),
      departmentId: new Types.ObjectId(dentalDeptId),
      patientId: new Types.ObjectId(patient2Id),
    });

    // Create Dental Lab Order 2 for Patient B / Tooth 26
    const createOrder2Res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctor2Token}` },
      payload: {
        patient_id: patient2Id,
        treatment_episode_id: episode2._id.toString(),
        treatment_stage_id: stageOrder2._id.toString(),
        tooth_number: 26,
        prosthetic_type: 'BRIDGE',
        description: 'Zirconia 3-unit bridge for tooth 26',
      },
    });
    expect(createOrder2Res.statusCode).toBe(200);
    const labOrder2 = createOrder2Res.json().data;

    // Advance Order 2 to READY
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder2.id}/status`,
      headers: { authorization: `Bearer ${doctor2Token}` },
      payload: { status: 'RECEIVED' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder2.id}/status`,
      headers: { authorization: `Bearer ${doctor2Token}` },
      payload: { status: 'IN_PROGRESS' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder2.id}/status`,
      headers: { authorization: `Bearer ${doctor2Token}` },
      payload: { status: 'QUALITY_CHECK' },
    });
    const ready2Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder2.id}/status`,
      headers: { authorization: `Bearer ${doctor2Token}` },
      payload: { status: 'READY', remarks: 'Bridge finished and polished' },
    });
    expect(ready2Res.statusCode).toBe(200);

    // 2. Query notifications for Patient 1 vs Patient 2
    const pat1MeRes = await app.inject({
      method: 'GET',
      url: '/api/notifications/me',
      headers: { authorization: `Bearer ${patientToken}` },
    });
    const pat1Items = pat1MeRes.json().data.data;
    // Patient 1 must see only their Tooth 24/Crown notification, and NOT Patient 2's Tooth 26/Bridge
    expect(pat1Items.every((n: { message: string }) => !n.message.includes('Tooth #26') && !n.message.includes('BRIDGE'))).toBe(true);
    expect(pat1Items.some((n: { message: string }) => n.message.includes('Tooth #24'))).toBe(true);

    const pat2MeRes = await app.inject({
      method: 'GET',
      url: '/api/notifications/me',
      headers: { authorization: `Bearer ${patient2Token}` },
    });
    const pat2Items = pat2MeRes.json().data.data;
    // Patient 2 must see only their Tooth 26/Bridge notification, and NOT Patient 1's Tooth 24/Crown
    expect(pat2Items.every((n: { message: string }) => !n.message.includes('Tooth #24'))).toBe(true);
    expect(pat2Items.some((n: { message: string }) => n.message.includes('Tooth #26') && n.message.includes('BRIDGE'))).toBe(true);

    // 3. Query notifications for Doctor 1 vs Doctor 2
    const doc1MeRes = await app.inject({
      method: 'GET',
      url: '/api/notifications/me',
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    const doc1Items = doc1MeRes.json().data.data;
    expect(doc1Items.every((n: { message: string }) => !n.message.includes(labOrder2.order_number))).toBe(true);

    const doc2MeRes = await app.inject({
      method: 'GET',
      url: '/api/notifications/me',
      headers: { authorization: `Bearer ${doctor2Token}` },
    });
    const doc2Items = doc2MeRes.json().data.data;
    expect(doc2Items.some((n: { message: string }) => n.message.includes(labOrder2.order_number))).toBe(true);
    expect(doc2Items.every((n: { message: string }) => !n.message.includes('Tooth #24'))).toBe(true);

    // 4. Test read receipt authorization isolation
    const pat2Notif = pat2Items.find((n: { type: string }) => n.type === 'DENTAL_LAB_READY');
    expect(pat2Notif).toBeDefined();

    // Patient 1 cannot mark Patient 2's notification as read
    const crossReadRes = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${pat2Notif.id}/read`,
      headers: { authorization: `Bearer ${patientToken}` },
    });
    expect(crossReadRes.statusCode).toBe(404);

    // Patient 2 marks their own notification as read -> 200
    const ownReadRes = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${pat2Notif.id}/read`,
      headers: { authorization: `Bearer ${patient2Token}` },
    });
    expect(ownReadRes.statusCode).toBe(200);
    expect(ownReadRes.json().data.is_read).toBe(true);
  });

  it('22. Phase 7A: Creates a clinical fitting stage in PLANNED status linked to prosthetic lab order context', async () => {
    // 1. Create a dedicated Stage 1 (Measurement) and Lab Order
    const stage1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-fitting-001',
        stage_name: 'Crown Measurement & Impression',
        assigned_doctor_id: docId,
        tooth_number: 16,
        sequence: 1,
      },
    });
    expect(stage1Res.statusCode).toBe(200);
    const stage1 = stage1Res.json().data;

    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stage1.id,
        treatment_plan_item_id: 'plan-fitting-001',
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'E-max monolithic crown for tooth 16',
      },
    });
    expect(orderRes.statusCode).toBe(200);
    const labOrder = orderRes.json().data;

    // 2. Create Stage 2 (Fitting & Cementation)
    const stage2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-fitting-001',
        stage_name: 'Crown Fitting & Cementation',
        assigned_doctor_id: docId,
        tooth_number: 16,
        sequence: 2,
        prosthetic_lab_order_id: labOrder.id,
      },
    });
    expect(stage2Res.statusCode).toBe(200);
    const stage2 = stage2Res.json().data;

    // Invariants:
    expect(stage2.status).toBe('PLANNED');
    expect(stage2.sequence).toBe(2);
    expect(stage2.prosthetic_lab_order_id).toBe(labOrder.id);
    expect(stage2.appointment_id).toBeNull();
  });

  it('23. Phase 7A: Non-READY lab order prevents fitting stage progression (start/complete/schedule) with LAB_ORDER_NOT_READY', async () => {
    // 1. Create Stage 1 and Lab Order in ORDERED status
    const stage1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-fitting-002',
        stage_name: 'Crown Measurement Stage',
        assigned_doctor_id: docId,
        tooth_number: 16,
        sequence: 1,
      },
    });
    const stage1 = stage1Res.json().data;

    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stage1.id,
        treatment_plan_item_id: 'plan-fitting-002',
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Ceramic Crown',
      },
    });
    const labOrder = orderRes.json().data;

    // Create Stage 2 (Fitting)
    const stage2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-fitting-002',
        stage_name: 'Crown Fitting & Cementation',
        assigned_doctor_id: docId,
        tooth_number: 16,
        sequence: 2,
        prosthetic_lab_order_id: labOrder.id,
      },
    });
    const stage2 = stage2Res.json().data;

    // Advance Stage 1 to COMPLETED when lab order is CANCELLED or cancelled lab on stage 1
    // But for this test, lab order is pending on plan-fitting-002.
    // Try to transition Stage 2 to IN_PROGRESS while lab order is ORDERED
    const startStage2Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage2.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(startStage2Res.statusCode).toBe(400);
    const errCode = startStage2Res.json().code || startStage2Res.json().error?.code;
    expect(
      errCode === 'LAB_ORDER_NOT_READY' ||
      errCode === 'PREREQUISITE_STAGE_INCOMPLETE'
    ).toBe(true);

    // Try to schedule Stage 2 while lab order is not ready
    const scheduleRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage2.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-15',
        start_time: '14:00',
        duration_minutes: 45,
      },
    });
    expect(scheduleRes.statusCode).toBe(400);
  });

  it('24. Phase 7A: Transitioning lab order to READY unblocks fitting stage for clinical progression', async () => {
    // 1. Create Stage 1 and Lab Order
    const stage1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-fitting-003',
        stage_name: 'Crown Measurement',
        assigned_doctor_id: docId,
        tooth_number: 16,
        sequence: 1,
      },
    });
    const stage1 = stage1Res.json().data;

    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stage1.id,
        treatment_plan_item_id: 'plan-fitting-003',
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'PFM Crown',
      },
    });
    const labOrder = orderRes.json().data;

    // Create Stage 2 (Fitting)
    const stage2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-fitting-003',
        stage_name: 'Crown Fitting & Cementation',
        assigned_doctor_id: docId,
        tooth_number: 16,
        sequence: 2,
        prosthetic_lab_order_id: labOrder.id,
      },
    });
    const stage2 = stage2Res.json().data;

    // 2. Advance lab order to READY
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'QUALITY_CHECK' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'READY' },
    });

    // 3. Move Stage 1 to IN_PROGRESS then COMPLETED (now allowed because lab order is READY)
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    const completeStage1Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(completeStage1Res.statusCode).toBe(200);

    // 4. Now Stage 2 is unblocked and can transition to IN_PROGRESS and COMPLETED
    const startStage2Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage2.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(startStage2Res.statusCode).toBe(200);
    expect(startStage2Res.json().data.status).toBe('IN_PROGRESS');

    const completeStage2Res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage2.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(completeStage2Res.statusCode).toBe(200);
    expect(completeStage2Res.json().data.status).toBe('COMPLETED');
  });

  it('25. Phase 7A: Invariants - Fitting stage remains PLANNED when lab order becomes READY (no auto-completion or auto-scheduling)', async () => {
    // 1. Create Stage 1 & Stage 2 with Lab Order
    const stage1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-fitting-004',
        stage_name: 'Crown Measurement Stage',
        assigned_doctor_id: docId,
        tooth_number: 16,
        sequence: 1,
      },
    });
    const stage1 = stage1Res.json().data;

    const orderRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stage1.id,
        treatment_plan_item_id: 'plan-fitting-004',
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Ceramic Crown',
      },
    });
    const labOrder = orderRes.json().data;

    const stage2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-fitting-004',
        stage_name: 'Crown Fitting & Cementation',
        assigned_doctor_id: docId,
        tooth_number: 16,
        sequence: 2,
        prosthetic_lab_order_id: labOrder.id,
      },
    });
    const stage2 = stage2Res.json().data;

    // Move lab order to READY
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'QUALITY_CHECK' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${labOrder.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'READY' },
    });

    // Check Stage 2 status directly: must remain PLANNED
    const checkStage2Res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/stages/${stage2.id}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(checkStage2Res.statusCode).toBe(200);
    expect(checkStage2Res.json().data.status).toBe('PLANNED');
    expect(checkStage2Res.json().data.appointment_id).toBeNull();
  });

});
