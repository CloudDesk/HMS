import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { InpatientAdmissionService } from '../src/modules/inpatient-admissions/inpatient-admission.service.js';
import { InpatientAdmissionRepository } from '../src/modules/inpatient-admissions/inpatient-admission.repository.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import type { AdmissionRequestMetadata, CreateAdmissionRequestDTO } from '../src/modules/inpatient-admissions/inpatient-admission.types.js';

test('Admission Request - Receptionist & Doctor Authorization Tests', async (t) => {
  await setupTestDatabase();

  const branchId = createObjectId();
  const receptionistUserId = createObjectId();
  const receptionDeptId = createObjectId();
  const cardioDeptId = createObjectId();
  const doctorId = createObjectId();
  const nurseUserId = createObjectId();
  const patientId = createObjectId();

  const metadata: AdmissionRequestMetadata = {
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

  await t.test('InpatientAdmissionRepository.departmentScope returns undefined for RECEPTIONIST role', async () => {
    const repo = new InpatientAdmissionRepository(new SequenceService());

    const recRole = await RoleModel.create({
      code: 'RECEPTIONIST',
      name: 'Receptionist',
      permissions: ['admissions.requests.create', 'admissions.requests.view'],
      isSystem: true,
      status: 'active',
    });

    await UserModel.create({
      _id: receptionistUserId,
      username: 'reception_desk',
      fullName: 'Reception User',
      email: 'rec@example.com',
      passwordHash: 'dummy',
      firstName: 'Reception',
      lastName: 'User',
      roleIds: [recRole._id],
      branchIds: [new mongoose.Types.ObjectId(branchId)],
      departmentIds: [new mongoose.Types.ObjectId(receptionDeptId)],
      status: 'active',
    });

    const scope = await repo.departmentScope(receptionistUserId);
    assert.equal(scope, undefined, 'Receptionist should have unrestricted department scope within authorized branches');
  });

  await t.test('InpatientAdmissionRepository.departmentScope returns department list for CLINICIAN_NURSE role', async () => {
    const repo = new InpatientAdmissionRepository(new SequenceService());

    const nurseRole = await RoleModel.create({
      code: 'CLINICIAN_NURSE',
      name: 'Nurse',
      permissions: ['admissions.requests.view'],
      isSystem: true,
      status: 'active',
    });

    await UserModel.create({
      _id: nurseUserId,
      username: 'nurse_ward',
      fullName: 'Ward Nurse',
      email: 'nurse@example.com',
      passwordHash: 'dummy',
      firstName: 'Ward',
      lastName: 'Nurse',
      roleIds: [nurseRole._id],
      branchIds: [new mongoose.Types.ObjectId(branchId)],
      departmentIds: [new mongoose.Types.ObjectId(receptionDeptId)],
      status: 'active',
    });

    const scope = await repo.departmentScope(nurseUserId);
    assert.ok(scope);
    assert.deepEqual(scope, [receptionDeptId]);
  });

  await t.test('Receptionist in Reception department can create Admission Request for Cardiology department', async () => {
    const mockSession = await mongoose.startSession();
    let capturedRequest: unknown;

    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => true),
      departmentScope: mock.fn(async () => undefined), // Receptionist is unrestricted across branch departments
      requestReferences: mock.fn(async () => ({
        patient: { patientNumber: 'PAT-100', firstName: 'Jane', lastName: 'Doe' },
        doctor: { displayName: 'Dr. Anderson James' },
        department: { name: 'Cardiology' },
      })),
      hasActiveAdmission: mock.fn(async () => false),
      hasActiveAdmissionRequest: mock.fn(async () => false),
      createRequest: mock.fn(async (data: CreateAdmissionRequestDTO, resolved: { patientNumber: string; patientName: string; doctorName: string; departmentName: string; sourceReference: string | null }, actor: string) => {
        capturedRequest = { data, resolved, actor };
        return {
          id: createObjectId(),
          request_number: 'REQ-001',
          branch_id: data.branch_id,
          patient_id: data.patient_id,
          patient_number: resolved.patientNumber,
          patient_name: resolved.patientName,
          department_id: data.department_id,
          department_name: resolved.departmentName,
          recommending_doctor_id: data.recommending_doctor_id,
          recommending_doctor_name: resolved.doctorName,
          source_type: data.source_type,
          source_id: data.source_id ?? null,
          source_reference: null,
          admission_type: data.admission_type,
          priority: data.priority,
          reason: data.reason,
          notes: data.notes ?? null,
          status: 'PENDING_VALIDATION',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }),
      audit: mock.fn(async () => ({})),
    };

    const mockPatients = {
      addAdmissionTimeline: mock.fn(async () => ({})),
    };

    const service = new InpatientAdmissionService(
      mockRepo as unknown as ConstructorParameters<typeof InpatientAdmissionService>[0],
      {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[1],
      mockPatients as unknown as ConstructorParameters<typeof InpatientAdmissionService>[2],
      {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[3],
      {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[4],
      {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[5],
      {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[6],
      {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[7],
      {} as unknown as ConstructorParameters<typeof InpatientAdmissionService>[8],
    );

    const result = await service.createRequest(
      {
        branch_id: branchId,
        patient_id: patientId,
        department_id: cardioDeptId,
        recommending_doctor_id: doctorId,
        source_type: 'DIRECT',
        admission_type: 'INPATIENT',
        priority: 'ROUTINE',
        reason: 'Coronary evaluation and observation',
      },
      receptionistUserId,
      metadata,
    );

    assert.ok(result);
    assert.equal(result.department_name, 'Cardiology');
    assert.equal(result.status, 'PENDING_VALIDATION');
    assert.ok(capturedRequest);
  });
});
