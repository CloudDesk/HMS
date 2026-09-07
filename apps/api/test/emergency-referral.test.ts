import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { createObjectId } from './factories.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import type { EmergencyMetadata, EmergencyReferralDTO } from '../src/modules/emergency/emergency.types.js';
import { emergencyReferralSchema } from '../src/modules/emergency/emergency.schemas.js';

test('Emergency Referral Doctor Derivation & Schema Tests', async (t) => {
  await setupTestDatabase();

  const branchId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();
  const encounterId = createObjectId();
  const patientId = createObjectId();
  const targetDeptId = createObjectId();
  const targetDoctorId = createObjectId();

  const metadata: EmergencyMetadata = {
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

  await t.test('emergencyReferralSchema accepts empty target doctor and empty clinical notes', () => {
    const parsed1 = emergencyReferralSchema.parse({
      target_department_id: targetDeptId,
      target_doctor_id: '',
      priority: 'EMERGENCY',
      reason: 'Specialist Emergency Consultation',
      clinical_notes: '',
    });
    assert.equal(parsed1.target_department_id, targetDeptId);
    assert.equal(parsed1.target_doctor_id, undefined);
    assert.equal(parsed1.clinical_notes, 'Emergency clinical referral dispatched.');

    const parsed2 = emergencyReferralSchema.parse({
      target_department_id: targetDeptId,
      target_doctor_id: targetDoctorId,
      priority: 'URGENT',
      reason: 'Cardiology Bedside Consult',
      clinical_notes: 'Urgent bedside ECG and review needed',
    });
    assert.equal(parsed2.target_department_id, targetDeptId);
    assert.equal(parsed2.target_doctor_id, targetDoctorId);
    assert.equal(parsed2.clinical_notes, 'Urgent bedside ECG and review needed');
  });

  await t.test('submitReferral derives referring doctor from authenticated actor doctor when encounter doctor was not set', async () => {
    const mockSession = await mongoose.startSession();
    let capturedSave: unknown;

    const mockEncounter = {
      _id: encounterId,
      branchId,
      patientId,
      departmentId: createObjectId(),
      status: 'IN_CONSULTATION',
      assignedDoctorId: null,
      assignedDoctorName: null,
      referral: null,
    };

    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => true),
      getRecord: mock.fn(async () => mockEncounter),
      doctorByUserId: mock.fn(async () => ({ _id: doctorId, userId: doctorUserId, displayName: 'Dr. Anderson James' })),
      department: mock.fn(async () => ({ _id: targetDeptId, name: 'Cardiology' })),
      doctor: mock.fn(async () => null),
      saveReferral: mock.fn(async (id: string, bId: string, data: EmergencyReferralDTO, deptName: string, docName: string | null, actor: string, _session: unknown, assignedDoctorId?: Types.ObjectId, assignedDoctorName?: string) => {
        capturedSave = { id, bId, data, deptName, docName, actor, assignedDoctorId, assignedDoctorName };
        return {
          id,
          source_type: 'EMERGENCY_ENCOUNTER',
          source_id: id,
          encounter_number: 'ER-001',
          branch_id: bId,
          patient_id: patientId,
          referring_doctor_id: doctorId.toString(),
          referring_doctor_name: 'Dr. Anderson James',
          target_department_id: data.target_department_id,
          target_department_name: deptName,
          target_doctor_id: data.target_doctor_id ?? null,
          target_doctor_name: docName,
          priority: data.priority,
          reason: data.reason,
          clinical_notes: data.clinical_notes || 'Emergency clinical referral dispatched.',
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
          submitted_by: actor,
          appointment_id: null,
          appointment_number: null,
        };
      }),
      audit: mock.fn(async () => ({})),
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[5],
    );

    const result = await service.submitReferral(
      encounterId,
      branchId,
      {
        target_department_id: targetDeptId,
        priority: 'EMERGENCY',
        reason: 'Specialist Emergency Consultation',
      },
      doctorUserId,
      metadata,
    );

    assert.ok(result);
    assert.equal(result.target_department_name, 'Cardiology');
    assert.equal(result.referring_doctor_id, doctorId.toString());
    assert.equal(result.referring_doctor_name, 'Dr. Anderson James');
    assert.ok(capturedSave);
  });

  await t.test('submitReferral succeeds with valid target doctor', async () => {
    const mockSession = await mongoose.startSession();

    const mockEncounter = {
      _id: encounterId,
      branchId,
      patientId,
      departmentId: createObjectId(),
      status: 'IN_TREATMENT',
      assignedDoctorId: doctorId,
      assignedDoctorName: 'Dr. Anderson James',
      referral: null,
    };

    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => true),
      getRecord: mock.fn(async () => mockEncounter),
      doctorByUserId: mock.fn(async () => ({ _id: doctorId, userId: doctorUserId, displayName: 'Dr. Anderson James' })),
      department: mock.fn(async () => ({ _id: targetDeptId, name: 'Cardiology' })),
      doctor: mock.fn(async () => ({ _id: targetDoctorId, displayName: 'Dr. Heart Specialist' })),
      saveReferral: mock.fn(async () => ({
        id: encounterId,
        source_type: 'EMERGENCY_ENCOUNTER',
        source_id: encounterId,
        encounter_number: 'ER-001',
        branch_id: branchId,
        patient_id: patientId,
        referring_doctor_id: doctorId.toString(),
        referring_doctor_name: 'Dr. Anderson James',
        target_department_id: targetDeptId,
        target_department_name: 'Cardiology',
        target_doctor_id: targetDoctorId,
        target_doctor_name: 'Dr. Heart Specialist',
        priority: 'URGENT',
        reason: 'Cardiology Referral',
        clinical_notes: 'Urgent consult',
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString(),
        submitted_by: doctorUserId,
        appointment_id: null,
        appointment_number: null,
      })),
      audit: mock.fn(async () => ({})),
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[5],
    );

    const result = await service.submitReferral(
      encounterId,
      branchId,
      {
        target_department_id: targetDeptId,
        target_doctor_id: targetDoctorId,
        priority: 'URGENT',
        reason: 'Cardiology Referral',
        clinical_notes: 'Urgent consult',
      },
      doctorUserId,
      metadata,
    );

    assert.ok(result);
    assert.equal(result.target_doctor_name, 'Dr. Heart Specialist');
  });
});
