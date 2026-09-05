import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { createObjectId } from './factories.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import type { EmergencyMetadata } from '../src/modules/emergency/emergency.types.js';

test('Emergency Patient Calling Authorization & Workflow Tests', async (t) => {
  await setupTestDatabase();

  const branchId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();
  const nurseUserId = createObjectId();
  const encounterId = createObjectId();
  const patientId = createObjectId();

  const metadata: EmergencyMetadata = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    correlationId: 'test-corr-id',
  };

  t.afterEach(async () => {
    mock.restoreAll();
    await clearTestDatabase();
  });

  t.after(async () => {
    await teardownTestDatabase();
  });

  await t.test('Doctor from another department can call a waiting patient without department access denial', async () => {
    let capturedTransition: unknown;
    let capturedAudit: unknown;
    const mockSession = await mongoose.startSession();

    const mockEncounter = {
      _id: encounterId,
      branchId,
      patientId,
      departmentId: createObjectId(), // Emergency department
      status: 'WAITING_FOR_DOCTOR',
      tokenNumber: 'E-101',
    };

    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => true),
      getRecord: mock.fn(async () => mockEncounter),
      doctorByUserId: mock.fn(async () => ({ _id: doctorId, userId: doctorUserId, displayName: 'Dr. Smith' })),
      transition: mock.fn(async (id: string, bId: string, from: string[], to: string, action: string, actor: string, payload: Record<string, unknown>, reason: string | null, session: unknown, prevStatus?: string) => {
        capturedTransition = { id, bId, from, to, action, actor, payload, reason, prevStatus };
        return {
          id,
          encounter_number: 'EID-101',
          branch_id: bId,
          patient_id: patientId,
          status: to,
          assigned_doctor_id: doctorId,
        };
      }),
      audit: mock.fn(async (eventType: string, actor: string, meta: unknown, payload: unknown) => {
        capturedAudit = { eventType, actor, meta, payload };
      }),
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[5],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[6],
    );

    const result = await service.call(encounterId, branchId, doctorUserId, metadata);

    assert.equal(result.status, 'IN_CONSULTATION');
    assert.deepEqual(
      (capturedTransition as { from: string[] }).from,
      ['REGISTERED', 'WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR'],
    );
    assert.equal((capturedTransition as { to: string }).to, 'IN_CONSULTATION');
    assert.equal((capturedTransition as { prevStatus: string }).prevStatus, 'WAITING_FOR_DOCTOR');
    assert.equal((capturedTransition as { action: string }).action, 'CALLED');
    assert.equal((capturedTransition as { actor: string }).actor, doctorUserId);

    assert.equal((capturedAudit as { eventType: string }).eventType, 'emergency.encounter.called');
    assert.equal((capturedAudit as { actor: string }).actor, doctorUserId);
    assert.equal((capturedAudit as { payload: { calledBy?: string } }).payload.calledBy, doctorUserId);
    assert.ok((capturedAudit as { payload: { calledAt?: unknown } }).payload.calledAt);
  });

  await t.test('Emergency nurse can call a waiting patient from TRIAGED status', async () => {
    let capturedTransition: unknown;
    let capturedAudit: unknown;
    const mockSession = await mongoose.startSession();

    const mockEncounter = {
      _id: encounterId,
      branchId,
      patientId,
      departmentId: createObjectId(),
      status: 'TRIAGED',
      tokenNumber: 'E-102',
    };

    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => true),
      getRecord: mock.fn(async () => mockEncounter),
      doctorByUserId: mock.fn(async () => null), // Nurse is not a doctor
      transition: mock.fn(async (id: string, bId: string, from: string[], to: string, action: string, actor: string, payload: Record<string, unknown>, reason: string | null, session: unknown, prevStatus?: string) => {
        capturedTransition = { id, bId, from, to, action, actor, payload, reason, prevStatus };
        return {
          id,
          encounter_number: 'EID-102',
          branch_id: bId,
          patient_id: patientId,
          status: to,
        };
      }),
      audit: mock.fn(async (eventType: string, actor: string, meta: unknown, payload: unknown) => {
        capturedAudit = { eventType, actor, meta, payload };
      }),
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[5],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[6],
    );

    const result = await service.call(encounterId, branchId, nurseUserId, metadata);

    assert.equal(result.status, 'IN_CONSULTATION');
    assert.equal((capturedTransition as { prevStatus: string }).prevStatus, 'TRIAGED');
    assert.equal((capturedTransition as { action: string }).action, 'CALLED');
    assert.equal((capturedAudit as { payload: { calledBy?: string } }).payload.calledBy, nurseUserId);
  });

  await t.test('Calling a patient in non-actionable status throws 409 conflict error', async () => {
    const mockSession = await mongoose.startSession();
    const mockEncounter = {
      _id: encounterId,
      branchId,
      patientId,
      departmentId: createObjectId(),
      status: 'DISCHARGED',
      tokenNumber: 'E-103',
    };

    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => true),
      getRecord: mock.fn(async () => mockEncounter),
      doctorByUserId: mock.fn(async () => ({ _id: doctorId, userId: doctorUserId })),
      transition: mock.fn(async () => null),
      audit: mock.fn(async () => {}),
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[5],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[6],
    );

    await assert.rejects(
      async () => service.call(encounterId, branchId, doctorUserId, metadata),
      (err: Error & { statusCode?: number; code?: string }) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'EMERGENCY_ENCOUNTER_NOT_ACTIONABLE');
        return true;
      },
    );
  });

  await t.test('User without branch access is rejected with 403 BRANCH_ACCESS_DENIED', async () => {
    const mockSession = await mongoose.startSession();
    const mockRepo = {
      session: mock.fn(async () => mockSession),
      hasBranchAccess: mock.fn(async () => false),
      getRecord: mock.fn(async () => null),
      transition: mock.fn(async () => null),
      audit: mock.fn(async () => {}),
    };

    const service = new EmergencyService(
      mockRepo as unknown as ConstructorParameters<typeof EmergencyService>[0],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[1],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[2],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[3],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[4],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[5],
      {} as unknown as ConstructorParameters<typeof EmergencyService>[6],
    );

    await assert.rejects(
      async () => service.call(encounterId, branchId, doctorUserId, metadata),
      (err: Error & { statusCode?: number; code?: string }) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'BRANCH_ACCESS_DENIED');
        return true;
      },
    );
  });
});
