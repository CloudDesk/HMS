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
import { OpdConsultationModel } from '../src/modules/opd/opd-consultation.model.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { DentalTreatmentEpisodeModel } from '../src/modules/opd/dental-episode.model.js';
import { DentalTreatmentStageModel } from '../src/modules/opd/dental-stage.model.js';
import { OpdClinicalOrderModel } from '../src/modules/opd/opd-clinical-order.model.js';
import { ImagingReportModel } from '../src/modules/imaging/imaging-report.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Phase 4A: Dental Imaging Foundation Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const radiologyDeptId = createObjectId();
  const generalDeptId = createObjectId();
  const patientId = createObjectId();

  const dentistUserId = createObjectId();
  const dentistDocId = createObjectId();

  const generalDoctorUserId = createObjectId();
  const generalDoctorDocId = createObjectId();

  const radiologistUserId = createObjectId();
  const radiologistDocId = createObjectId();

  const unauthorizedUserId = createObjectId();

  let dentistToken: string;
  let generalDoctorToken: string;
  let radiologistToken: string;
  let unauthorizedToken: string;

  let dentalVisitId: string;
  let generalVisitId: string;
  let episodeId: string;
  let stageId: string;
  let imagingServiceId: string;

  beforeAll(async () => {
    await setupTestDatabase();

    const branch2Id = createObjectId();
    await BranchModel.create([
      {
        _id: new Types.ObjectId(branchId),
        name: 'Main Dental & General Hospital',
        code: 'MB01',
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(branch2Id),
        name: 'Secondary Branch',
        code: 'SB01',
        status: 'ACTIVE',
      },
    ]);

    await DepartmentModel.create([
      {
        _id: new Types.ObjectId(dentalDeptId),
        name: 'Dental Surgery',
        code: 'DENT',
        branchIds: [new Types.ObjectId(branchId)],
        isClinical: true,
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(radiologyDeptId),
        name: 'Radiology / Imaging',
        code: 'RAD',
        branchIds: [new Types.ObjectId(branchId)],
        isClinical: true,
        status: 'ACTIVE',
      },
      {
        _id: new Types.ObjectId(generalDeptId),
        name: 'General Medicine',
        code: 'GEN',
        branchIds: [new Types.ObjectId(branchId)],
        isClinical: true,
        status: 'ACTIVE',
      },
    ]);

    await seedDatabase();

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    if (!doctorRole) throw new Error('DOCTOR role not found');
    const imagingRole = await RoleModel.findOne({ code: 'IMAGING_USER' }).lean();
    if (!imagingRole) throw new Error('IMAGING_USER role not found');
    const unauthorizedRole = await RoleModel.findOne({ code: 'PATIENT' }).lean();
    if (!unauthorizedRole) throw new Error('PATIENT role not found');

    const passwordHash = await hashPassword('Password123!');

    await UserModel.create([
      {
        _id: new Types.ObjectId(dentistUserId),
        email: 'dentist.imaging@example.com',
        username: 'dentist_imaging',
        passwordHash,
        fullName: 'Dental Specialist',
        firstName: 'Dental',
        lastName: 'Specialist',
        roleId: doctorRole._id,
        roleIds: [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(generalDoctorUserId),
        email: 'general.doc@example.com',
        username: 'general_doc',
        passwordHash,
        fullName: 'Dr. General Doctor',
        firstName: 'General',
        lastName: 'Doctor',
        roleId: doctorRole._id,
        roleIds: [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(generalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(radiologistUserId),
        email: 'radiologist@example.com',
        username: 'radiologist_user',
        passwordHash,
        fullName: 'Radio Logist',
        firstName: 'Radio',
        lastName: 'Logist',
        roleId: imagingRole._id,
        roleIds: [imagingRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(radiologyDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(unauthorizedUserId),
        email: 'unauth.user@example.com',
        username: 'unauth_user',
        passwordHash,
        fullName: 'No Access',
        firstName: 'No',
        lastName: 'Access',
        roleId: unauthorizedRole._id,
        roleIds: [unauthorizedRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [],
        status: 'active',
      },
    ]);

    await DoctorModel.create([
      {
        _id: new Types.ObjectId(dentistDocId),
        userId: new Types.ObjectId(dentistUserId),
        doctorNumber: 'DOC-DENT-01',
        firstName: 'Dental',
        lastName: 'Specialist',
        displayName: 'Dr. Dental Specialist',
        departmentId: new Types.ObjectId(dentalDeptId),
        branchId: new Types.ObjectId(branchId),
        specialization: 'General Dentistry',
        consultationFee: 100,
        status: 'ACTIVE',
        availability: [],
      },
      {
        _id: new Types.ObjectId(generalDoctorDocId),
        userId: new Types.ObjectId(generalDoctorUserId),
        doctorNumber: 'DOC-GEN-03',
        firstName: 'General',
        lastName: 'Doctor',
        displayName: 'Dr. General Doctor',
        departmentId: new Types.ObjectId(generalDeptId),
        branchId: new Types.ObjectId(branchId),
        specialization: 'Internal Medicine',
        consultationFee: 120,
        status: 'ACTIVE',
        availability: [],
      },
      {
        _id: new Types.ObjectId(radiologistDocId),
        userId: new Types.ObjectId(radiologistUserId),
        doctorNumber: 'DOC-RAD-02',
        firstName: 'Radio',
        lastName: 'Logist',
        displayName: 'Dr. Radio Logist',
        departmentId: new Types.ObjectId(radiologyDeptId),
        branchId: new Types.ObjectId(branchId),
        specialization: 'Radiology',
        consultationFee: 150,
        status: 'ACTIVE',
        availability: [],
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'P-IMG-001',
      firstName: 'Alice',
      lastName: 'Imaging',
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-04-10'),
      contactNumber: '+254700999888',
      address: {
        city: 'Nairobi',
        country: 'Kenya',
        postalCode: '00100',
        state: 'Nairobi',
        street: 'Main Road',
      },
      emergencyContact: {
        name: 'Bob Imaging',
        relationship: 'Spouse',
        contactNumber: '+254700999889',
      },
      registrationBranchId: new Types.ObjectId(branchId),
      status: 'ACTIVE',
    });

    const imgService = await ServiceModel.create({
      _id: new Types.ObjectId(createObjectId()),
      code: 'RAD-CBCT-001',
      name: 'Dental Cone Beam CT',
      category: 'Dental Imaging',
      serviceType: 'IMAGING_SERVICE',
      departmentId: new Types.ObjectId(radiologyDeptId),
      standardPrice: 180,
      status: 'ACTIVE',
    });
    imagingServiceId = imgService._id.toString();

    const dentalVisit = await OpdVisitModel.create({
      visitNumber: 'OPD-IMG-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-IMG-001',
      patientName: 'Alice Imaging',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery',
      doctorId: new Types.ObjectId(dentistDocId),
      doctorName: 'Dr. Dental Specialist',
      doctorSpecialization: 'General Dentistry',
      branchId: new Types.ObjectId(branchId),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      visitDate: new Date(),
      checkInTime: new Date(),
      status: 'IN_CONSULTATION',
    });
    dentalVisitId = dentalVisit._id.toString();

    const generalVisit = await OpdVisitModel.create({
      visitNumber: 'OPD-IMG-002',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-IMG-001',
      patientName: 'Alice Imaging',
      departmentId: new Types.ObjectId(generalDeptId),
      departmentName: 'General Medicine',
      doctorId: new Types.ObjectId(generalDoctorDocId),
      doctorName: 'Dr. General Doctor',
      doctorSpecialization: 'Internal Medicine',
      branchId: new Types.ObjectId(branchId),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      visitDate: new Date(),
      checkInTime: new Date(),
      status: 'IN_CONSULTATION',
    });
    generalVisitId = generalVisit._id.toString();

    await OpdConsultationModel.create([
      {
        visitId: new Types.ObjectId(dentalVisitId),
        patientId: new Types.ObjectId(patientId),
        patientNumber: 'P-IMG-001',
        patientName: 'Alice Imaging',
        doctorId: new Types.ObjectId(dentistDocId),
        doctorName: 'Dr. Dental Specialist',
        status: 'DRAFT',
      },
      {
        visitId: new Types.ObjectId(generalVisitId),
        patientId: new Types.ObjectId(patientId),
        patientNumber: 'P-IMG-001',
        patientName: 'Alice Imaging',
        doctorId: new Types.ObjectId(generalDoctorDocId),
        doctorName: 'Dr. General Doctor',
        status: 'DRAFT',
      },
    ]);

    const episode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-IMG-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-IMG-001',
      patientName: 'Alice Imaging',
      originatingVisitId: new Types.ObjectId(dentalVisitId),
      originatingVisitNumber: 'OPD-IMG-001',
      primaryDoctorId: new Types.ObjectId(dentistDocId),
      primaryDoctorName: 'Dr. Dental Specialist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 16,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(dentalVisitId)],
    });
    episodeId = episode._id.toString();

    const stage = await DentalTreatmentStageModel.create({
      episodeId: new Types.ObjectId(episodeId),
      patientId: new Types.ObjectId(patientId),
      planItemId: createObjectId(),
      stageName: 'Stage 1 - Diagnostic CBCT & Endodontics',
      sequence: 1,
      toothNumber: 16,
      assignedDoctorId: new Types.ObjectId(dentistDocId),
      assignedDoctorName: 'Dr. Dental Specialist',
      status: 'PLANNED',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
    });
    stageId = stage._id.toString();

    dentistToken = signJwt(
      { sub: dentistUserId, username: 'dentist_imaging' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    generalDoctorToken = signJwt(
      { sub: generalDoctorUserId, username: 'general_doc' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    radiologistToken = signJwt(
      { sub: radiologistUserId, username: 'radiologist_user' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    unauthorizedToken = signJwt(
      { sub: unauthorizedUserId, username: 'unauth_user' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await teardownTestDatabase();
  });

  let createdDentalOrderId: string;

  // Test 1: Dental imaging order can be created
  it('Test 1: Dental imaging order can be created with dental context', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/opd/visits/${dentalVisitId}/clinical-orders/IMAGING`,
      headers: { authorization: `Bearer ${dentistToken}` },
      payload: {
        priority: 'ROUTINE',
        items: [
          {
            service_id: imagingServiceId,
            investigation_name: 'Dental Cone Beam CT',
            category: 'Dental Imaging',
            tooth_number: 16,
          },
        ],
        dental_context: {
          treatment_episode_id: episodeId,
          treatment_stage_id: stageId,
          tooth_number: 16,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.order_type).toBe('IMAGING');
    expect(body.status).toBe('DRAFT');
    expect(body.items).toHaveLength(1);
    expect(body.items[0].tooth_number).toBe(16);
    expect(body.dental_context).toBeDefined();
    expect(body.dental_context.treatment_episode_id).toBe(episodeId);
    expect(body.dental_context.treatment_stage_id).toBe(stageId);
    expect(body.dental_context.tooth_number).toBe(16);

    createdDentalOrderId = body.id;
  });

  // Test 2: Imaging order retains Dental Episode context
  it('Test 2: Imaging order retains Dental Episode context after submit', async () => {
    // Complete consultation before submit as required by OPD lifecycle
    await OpdConsultationModel.updateOne(
      { visitId: new Types.ObjectId(dentalVisitId) },
      { status: 'COMPLETED', completedAt: new Date() },
    );

    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/opd/visits/${dentalVisitId}/clinical-orders/IMAGING/submit`,
      headers: { authorization: `Bearer ${dentistToken}` },
      payload: {
        priority: 'ROUTINE',
        items: [
          {
            service_id: imagingServiceId,
            investigation_name: 'Dental Cone Beam CT',
            category: 'Dental Imaging',
            tooth_number: 16,
          },
        ],
        dental_context: {
          treatment_episode_id: episodeId,
          treatment_stage_id: stageId,
          tooth_number: 16,
        },
      },
    });

    expect(submitRes.statusCode).toBe(200);
    const order = submitRes.json().data;
    expect(order.status).toBe('SUBMITTED');
    expect(order.dental_context).toBeDefined();
    expect(order.dental_context.treatment_episode_id).toBe(episodeId);
    expect(order.dental_context.treatment_stage_id).toBe(stageId);

    // Verify directly in DB
    const dbOrder = await OpdClinicalOrderModel.findById(order.id).lean();
    expect(dbOrder?.dentalContext?.treatmentEpisodeId?.toString()).toBe(episodeId);
    expect(dbOrder?.dentalContext?.treatmentStageId?.toString()).toBe(stageId);
    expect(dbOrder?.dentalContext?.toothNumber).toBe(16);
  });

  // Test 3: Tooth number is preserved when supplied
  it('Test 3: Tooth number is preserved on order item and dental context', async () => {
    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/opd/visits/${dentalVisitId}/clinical-orders/IMAGING`,
      headers: { authorization: `Bearer ${dentistToken}` },
    });

    expect(fetchRes.statusCode).toBe(200);
    const body = fetchRes.json().data;
    expect(body.items[0].tooth_number).toBe(16);
    expect(body.dental_context.tooth_number).toBe(16);
  });

  // Test 4: Imaging result can reference an actual attachment/file
  it('Test 4: Imaging result can reference actual attachment metadata and copy dental context to report', async () => {
    const receivedRes = await app.inject({
      method: 'PATCH',
      url: `/api/imaging/orders/${createdDentalOrderId}/status`,
      headers: { authorization: `Bearer ${radiologistToken}` },
      payload: { status: 'RECEIVED' },
    });
    expect(receivedRes.statusCode).toBe(200);

    const inProgressRes = await app.inject({
      method: 'PATCH',
      url: `/api/imaging/orders/${createdDentalOrderId}/status`,
      headers: { authorization: `Bearer ${radiologistToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(inProgressRes.statusCode).toBe(200);

    const reportRes = await app.inject({
      method: 'POST',
      url: `/api/imaging/orders/${createdDentalOrderId}/report`,
      headers: { authorization: `Bearer ${radiologistToken}` },
      payload: {
        findings: '3D CBCT reveals distinct radiolucency around the apex of Tooth 16 MB root.',
        impression: 'Chronic periapical periodontitis with apical lesion Tooth #16.',
        recommendations: 'Proceed with endodontic treatment or surgical intervention.',
        attachments: [
          {
            file_name: 'tooth16-cbct-axial.png',
            file_size_bytes: 2048576,
            mime_type: 'image/png',
            storage_key: 'patients/test-patient/documents/tooth16-cbct-axial.png',
            file_url: null,
          },
        ],
      },
    });

    expect(reportRes.statusCode).toBe(201);
    const report = reportRes.json().data;
    expect(report.findings).toContain('Tooth 16 MB root');
    expect(report.attachments).toHaveLength(1);
    expect(report.attachments[0].file_name).toBe('tooth16-cbct-axial.png');
    expect(report.attachments[0].file_size_bytes).toBe(2048576);
    expect(report.attachments[0].mime_type).toBe('image/png');
    expect(report.attachments[0].storage_key).toBe('patients/test-patient/documents/tooth16-cbct-axial.png');
    expect(report.dental_context?.treatment_episode_id).toBe(episodeId);
    expect(report.dental_context?.treatment_stage_id).toBe(stageId);
    expect(report.dental_context?.tooth_number).toBe(16);

    const dbReport = await ImagingReportModel.findOne({ orderId: new Types.ObjectId(createdDentalOrderId) }).lean();
    expect(dbReport?.attachments).toHaveLength(1);
    expect(dbReport?.dentalContext?.treatmentEpisodeId?.toString()).toBe(episodeId);
  });

  // Test 5: Dental examination can retrieve its imaging orders/results
  it('Test 5: Dental examination can retrieve its imaging orders and report via episode API', async () => {
    const episodeOrdersRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/episodes/${episodeId}/imaging-orders`,
      headers: { authorization: `Bearer ${dentistToken}` },
    });

    expect(episodeOrdersRes.statusCode).toBe(200);
    const orders = episodeOrdersRes.json().data;
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThanOrEqual(1);

    const match = orders.find((o: { id: string }) => o.id === createdDentalOrderId);
    expect(match).toBeDefined();
    expect(match.status).toBe('REPORT_ENTERED');
    expect(match.items[0].tooth_number).toBe(16);
    expect(match.dental_context?.treatment_episode_id).toBe(episodeId);

    const viewReportRes = await app.inject({
      method: 'GET',
      url: `/api/imaging/orders/${createdDentalOrderId}/report`,
      headers: { authorization: `Bearer ${dentistToken}` },
    });

    expect(viewReportRes.statusCode).toBe(200);
    const reportData = viewReportRes.json().data;
    expect(reportData.findings).toContain('Tooth 16 MB root');
    expect(reportData.attachments).toHaveLength(1);
    expect(reportData.attachments[0].file_name).toBe('tooth16-cbct-axial.png');
  });

  // Test 6: Existing generic imaging behavior remains unaffected
  it('Test 6: Existing generic imaging behavior remains unaffected for non-dental orders', async () => {
    const draftRes = await app.inject({
      method: 'PUT',
      url: `/api/opd/visits/${generalVisitId}/clinical-orders/IMAGING`,
      headers: { authorization: `Bearer ${generalDoctorToken}` },
      payload: {
        priority: 'ROUTINE',
        items: [
          {
            service_id: imagingServiceId,
            investigation_name: 'Standard Chest X-Ray',
            category: 'Imaging',
          },
        ],
      },
    });

    expect(draftRes.statusCode).toBe(200);
    const genericOrder = draftRes.json().data;
    expect(genericOrder.order_type).toBe('IMAGING');
    expect(genericOrder.dental_context).toBeNull();
    expect(genericOrder.items[0].tooth_number).toBeNull();

    await OpdConsultationModel.updateOne(
      { visitId: new Types.ObjectId(generalVisitId) },
      { status: 'COMPLETED', completedAt: new Date() },
    );

    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/opd/visits/${generalVisitId}/clinical-orders/IMAGING/submit`,
      headers: { authorization: `Bearer ${generalDoctorToken}` },
      payload: {
        priority: 'ROUTINE',
        items: [
          {
            service_id: imagingServiceId,
            investigation_name: 'Standard Chest X-Ray',
            category: 'Imaging',
          },
        ],
      },
    });
    expect(submitRes.statusCode).toBe(200);
    const genericSubmitted = submitRes.json().data;
    expect(genericSubmitted.status).toBe('SUBMITTED');
    expect(genericSubmitted.dental_context).toBeNull();
  });

  // Test 7: Existing RBAC restrictions are respected
  it('Test 7: Existing RBAC restrictions are strictly enforced', async () => {
    const enterRes = await app.inject({
      method: 'POST',
      url: `/api/imaging/orders/${createdDentalOrderId}/report`,
      headers: { authorization: `Bearer ${unauthorizedToken}` },
      payload: {
        findings: 'Illegal report entry attempt',
        impression: 'Illegal',
      },
    });
    expect(enterRes.statusCode).toBe(403);

    const viewRes = await app.inject({
      method: 'GET',
      url: `/api/imaging/orders/${createdDentalOrderId}/report`,
      headers: { authorization: `Bearer ${unauthorizedToken}` },
    });
    expect(viewRes.statusCode).toBe(403);

    const unauthRes = await app.inject({
      method: 'GET',
      url: `/api/imaging/orders/${createdDentalOrderId}/report`,
    });
    expect(unauthRes.statusCode).toBe(401);
  });
});
