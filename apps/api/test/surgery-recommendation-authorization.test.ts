import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { SurgeryService } from '../src/modules/surgery/surgery.service.js';
import { SurgeryRepository } from '../src/modules/surgery/surgery.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { createRecommendationSchema } from '../src/modules/surgery/surgery.schemas.js';
import type { CreateProcedureRecommendationDTO, SurgeryMetadata } from '../src/modules/surgery/surgery.types.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';

test('Surgery Recommendation - Cross-Department & Doctor Derivation Tests', async (t) => {
  await setupTestDatabase();

  const branchId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();
  const patientId = createObjectId();
  const dentalDeptId = createObjectId();
  const cardioDeptId = createObjectId();
  const cardioServiceId = createObjectId();

  const metadata: SurgeryMetadata = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  await t.test('createRecommendationSchema allows optional recommending_doctor_id', () => {
    const parsed = createRecommendationSchema.parse({
      branch_id: branchId,
      patient_id: patientId,
      department_id: cardioDeptId,
      service_id: cardioServiceId,
      clinical_reason: 'Coronary artery disease evaluation',
    });
    assert.equal(parsed.department_id, cardioDeptId);
    assert.equal(parsed.recommending_doctor_id, undefined);
    assert.equal(parsed.clinical_reason, 'Coronary artery disease evaluation');
  });

  await t.test('SurgeryRepository.departmentScope returns undefined for DOCTOR / CLINICIAN_DOCTOR roles', async () => {
    const repo = new SurgeryRepository();
    
    const doctorRole = await RoleModel.create({
      code: 'CLINICIAN_DOCTOR',
      name: 'Doctor',
      permissions: ['surgery.read', 'surgery.create'],
      isSystem: true,
      status: 'active',
    });

    await UserModel.create({
      _id: doctorUserId,
      username: 'dr_anderson',
      fullName: 'Dr. Anderson James',
      email: 'anderson@example.com',
      passwordHash: 'dummy',
      firstName: 'Anderson',
      lastName: 'James',
      roleIds: [doctorRole._id],
      branchIds: [new mongoose.Types.ObjectId(branchId)],
      departmentIds: [new mongoose.Types.ObjectId(dentalDeptId)],
      status: 'active',
    });

    const scope = await repo.departmentScope(doctorUserId);
    assert.equal(scope, undefined, 'Doctors should have unrestricted department scope within authorized branches');
  });

  await t.test('SurgeryRepository.departmentScope returns department list for non-doctor scoped roles', async () => {
    const repo = new SurgeryRepository();
    const nurseUserId = createObjectId();
    
    const nurseRole = await RoleModel.create({
      code: 'CLINICIAN_NURSE',
      name: 'Nurse',
      permissions: ['surgery.read'],
      isSystem: true,
      status: 'active',
    });

    await UserModel.create({
      _id: nurseUserId,
      username: 'nurse_joy',
      fullName: 'Nurse Joy',
      email: 'joy@example.com',
      passwordHash: 'dummy',
      firstName: 'Joy',
      lastName: 'Nurse',
      roleIds: [nurseRole._id],
      branchIds: [new mongoose.Types.ObjectId(branchId)],
      departmentIds: [new mongoose.Types.ObjectId(dentalDeptId)],
      status: 'active',
    });

    const scope = await repo.departmentScope(nurseUserId);
    assert.ok(scope);
    assert.deepEqual(scope, [dentalDeptId]);
  });

  await t.test('createRecommendation derives recommending doctor and allows doctor in Dental to recommend Cardiology procedure', async () => {
    const mockSession = await mongoose.startSession();
    let capturedRecommendation: unknown;

    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => true),
      departmentScope: mock.fn(async () => undefined), // Doctor is unrestricted across departments in branch
      doctorByUserId: mock.fn(async () => ({ _id: doctorId, userId: doctorUserId, displayName: 'Dr. Anderson James' })),
      recommendationReferences: mock.fn(async () => ({
        patient: { patientNumber: 'PAT-100', firstName: 'John', lastName: 'Doe' },
        doctor: { displayName: 'Dr. Anderson James' },
        department: { name: 'Cardiology' },
        service: { name: 'Coronary Angioplasty' },
        encounter: null,
      })),
      createRecommendation: mock.fn(async (data: CreateProcedureRecommendationDTO, resolved: { patientNumber: string; patientName: string; doctorName: string; departmentName: string; serviceName: string }, actor: string) => {
        capturedRecommendation = { data, resolved, actor };
        return {
          id: createObjectId(),
          recommendation_number: 'REC-001',
          branch_id: data.branch_id,
          patient_id: data.patient_id,
          patient_number: resolved.patientNumber,
          patient_name: resolved.patientName,
          encounter_id: null,
          recommending_doctor_id: data.recommending_doctor_id,
          recommending_doctor_name: resolved.doctorName,
          department_id: data.department_id,
          department_name: resolved.departmentName,
          service_id: data.service_id,
          service_name: resolved.serviceName,
          priority: data.priority,
          clinical_reason: data.clinical_reason,
          proposed_timeframe: null,
          preoperative_instructions: null,
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
          created_by: actor,
          booking_id: null,
        };
      }),
      audit: mock.fn(async () => ({})),
    };

    const mockPatients = {
      addProcedureTimeline: mock.fn(async () => ({})),
    };

    const service = new SurgeryService(
      mockRepo as unknown as ConstructorParameters<typeof SurgeryService>[0],
      {} as unknown as ConstructorParameters<typeof SurgeryService>[1],
      mockPatients as unknown as ConstructorParameters<typeof SurgeryService>[2],
      {} as unknown as ConstructorParameters<typeof SurgeryService>[3],
      {} as unknown as ConstructorParameters<typeof SurgeryService>[4],
      {} as unknown as ConstructorParameters<typeof SurgeryService>[5],
      {} as unknown as ConstructorParameters<typeof SurgeryService>[6],
      {} as unknown as ConstructorParameters<typeof SurgeryService>[7],
      {} as unknown as ConstructorParameters<typeof SurgeryService>[8],
    );

    const result = await service.createRecommendation(
      {
        branch_id: branchId,
        patient_id: patientId,
        department_id: cardioDeptId,
        service_id: cardioServiceId,
        clinical_reason: 'Coronary artery disease evaluation',
      },
      doctorUserId,
      metadata,
    );

    assert.ok(result);
    assert.equal(result.recommending_doctor_name, 'Dr. Anderson James');
    assert.equal(result.recommending_doctor_id, doctorId);
    assert.equal(result.department_name, 'Cardiology');
    assert.equal(result.service_name, 'Coronary Angioplasty');
    assert.ok(capturedRecommendation);
  });
});
