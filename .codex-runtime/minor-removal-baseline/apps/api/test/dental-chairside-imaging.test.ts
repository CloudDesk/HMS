import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { DentalChairsideImageModel } from '../src/modules/opd/dental-chairside-image.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';

import { env } from '../src/config/env.js';
import { OpdConsultationModel } from '../src/modules/opd/opd-consultation.model.js';

import { Types } from 'mongoose';

describe('HMS Dental Flow – Phase 9A: Chairside Imaging Backend Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let services: Awaited<ReturnType<typeof buildApp>>['services'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const patientId = createObjectId();

  const dentistUserId = createObjectId();
  const dentistDocId = createObjectId();

  let dentistToken: string;

  let dentalVisitId: string;
  let episodeId: string;

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
        name: 'Dental Services',
        code: 'DENT',
        branchIds: [new Types.ObjectId(branchId)],
        isClinical: true,
        status: 'ACTIVE',
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-001',
      firstName: 'Mark',
      lastName: 'Patient',
      gender: 'MALE',
      dateOfBirth: new Date('1990-01-01'),
      contactNumber: '+254700000002',
      email: 'mark@patient.com',
      registrationBranchId: new Types.ObjectId(branchId),
      status: 'ACTIVE',
    });

    await seedDatabase();

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    if (!doctorRole) throw new Error('DOCTOR role not found');

    const passwordHash = await hashPassword('Password123!');

    await UserModel.create([
      {
        _id: new Types.ObjectId(dentistUserId),
        email: 'dentist.chairside@test.com',
        username: 'dentist_chairside',
        passwordHash,
        fullName: 'Dr. Anderson James',
        firstName: 'Anderson',
        lastName: 'James',
        roleId: doctorRole._id,
        roleIds: [doctorRole._id],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        branchIds: [new Types.ObjectId(branchId)],
        status: 'active',
      },
    ]);

    await DoctorModel.create({
      _id: new Types.ObjectId(dentistDocId),
      userId: new Types.ObjectId(dentistUserId),
      doctorNumber: 'DOC-DENT-01',
      firstName: 'Anderson',
      lastName: 'James',
      displayName: 'Dr. Anderson James',
      departmentId: new Types.ObjectId(dentalDeptId),
      branchId: new Types.ObjectId(branchId),
      specialization: 'General Dentistry',
      status: 'ACTIVE',
    });

    dentistToken = signJwt(
      {
        sub: dentistUserId,
        role: 'DOCTOR',
        roles: ['DOCTOR'],
        branchIds: [branchId],
        departmentIds: [dentalDeptId],
      },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    const visit = await OpdVisitModel.create({
      visitNumber: 'OPD-2026-000059',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-001',
      patientName: 'Mark Patient',
      doctorId: new Types.ObjectId(dentistDocId),
      doctorName: 'Dr. Anderson James',
      doctorSpecialization: 'General Dentistry',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Services',
      branchId: new Types.ObjectId(branchId),
      status: 'IN_CONSULTATION',
      priority: 'ROUTINE',
      paymentMode: 'CASH',
      visitType: 'NEW_CONSULTATION',
      visitDate: new Date(),
      checkInTime: new Date(),
    });
    dentalVisitId = visit._id.toString();

    await OpdConsultationModel.create({
      visitId: visit._id,
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-001',
      patientName: 'Mark Patient',
      doctorId: new Types.ObjectId(dentistDocId),
      doctorName: 'Dr. Anderson James',
      status: 'DRAFT',
    });

    const episode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-2026-00001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-DENT-001',
      patientName: 'Mark Patient',
      originatingVisitId: visit._id,
      originatingVisitNumber: 'OPD-2026-000059',
      primaryDoctorId: new Types.ObjectId(dentistDocId),
      primaryDoctorName: 'Dr. Anderson James',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 22,
      diagnosisName: 'Root Canal Treatment',
      status: 'ACTIVE',
      visitIds: [visit._id],
      createdBy: new Types.ObjectId(dentistUserId),
    });
    episodeId = episode._id.toString();

    const built = await buildApp();
    app = built.app;
    services = built.services;
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await teardownTestDatabase();
  });

  it('1. Uploads chairside image via service layer and immediately persists with context', async () => {
    const dummyImageBuffer = Buffer.from('fake-png-image-binary-data');

    const created = await services.dentalChairsideImages.uploadChairsideImage(
      dentalVisitId,
      {
        file_name: 'tooth-22-chairside.png',
        mime_type: 'image/png',
        file_size_bytes: dummyImageBuffer.length,
        data: dummyImageBuffer,
        tooth_number: 22,
        episode_id: episodeId,
        notes: 'Pre-op canal anatomy check',
      },
      dentistUserId.toString(),
    );

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.patient_id).toBe(patientId.toString());
    expect(created.visit_id).toBe(dentalVisitId);
    expect(created.episode_id).toBe(episodeId);
    expect(created.tooth_number).toBe(22);
    expect(created.file_name).toBe('tooth-22-chairside.png');
    expect(created.mime_type).toBe('image/png');
    expect(created.imaging_source).toBe('CHAIRSIDE');
    expect(created.notes).toBe('Pre-op canal anatomy check');

    // Verify persisted in DB
    const dbRecord = await DentalChairsideImageModel.findById(created.id);
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.imagingSource).toBe('CHAIRSIDE');
    expect(dbRecord?.toothNumber).toBe(22);
  });

  it('2. Lists chairside images by visit and tooth number immediately', async () => {
    const list = await services.dentalChairsideImages.listByVisit(
      dentalVisitId,
      { tooth_number: 22 },
      dentistUserId.toString(),
    );

    expect(list.length).toBeGreaterThan(0);
    expect(list[0].tooth_number).toBe(22);
    expect(list[0].file_name).toBe('tooth-22-chairside.png');
  });

  it('3. Downloads chairside image file and matches binary data', async () => {
    const list = await services.dentalChairsideImages.listByVisit(
      dentalVisitId,
      {},
      dentistUserId.toString(),
    );
    const target = list[0];

    const download = await services.dentalChairsideImages.downloadImage(
      target.id,
      dentistUserId.toString(),
    );

    expect(download).toBeDefined();
    expect(download.image.file_name).toBe('tooth-22-chairside.png');
    expect(download.contentType).toBe('image/png');
    expect(download.data.toString()).toBe('fake-png-image-binary-data');
  });

  it('4. GET /api/opd/visits/:visitId/dental-chairside-images endpoint returns images', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/visits/${dentalVisitId}/dental-chairside-images`,
      headers: {
        authorization: `Bearer ${dentistToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.data).toBeInstanceOf(Array);
    expect(payload.data.length).toBeGreaterThanOrEqual(1);
    expect(payload.data[0].imaging_source).toBe('CHAIRSIDE');
  });

  it('5. GET /api/opd/dental-episodes/:episodeId/dental-chairside-images endpoint returns episode images', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental-episodes/${episodeId}/dental-chairside-images`,
      headers: {
        authorization: `Bearer ${dentistToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.data).toBeInstanceOf(Array);
    expect(payload.data.length).toBeGreaterThanOrEqual(1);
    expect(payload.data[0].episode_id).toBe(episodeId);
  });

  it('6. Rejects unsupported image formats', async () => {
    await expect(
      services.dentalChairsideImages.uploadChairsideImage(
        dentalVisitId,
        {
          file_name: 'test.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 100,
          data: Buffer.from('pdf data'),
          tooth_number: 22,
        },
        dentistUserId.toString(),
      ),
    ).rejects.toThrow('Unsupported image format');
  });
});
