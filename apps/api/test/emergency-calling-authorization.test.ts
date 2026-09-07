import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { createObjectId } from './factories.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import type { EmergencyMetadata } from '../src/modules/emergency/emergency.types.js';

describe('Emergency Patient Calling Authorization & Workflow Tests', () => {
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

  beforeAll(async () => {
    await setupTestDatabase();
  }, 30000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('Doctor from another department can call a waiting patient without department access denial', async () => {
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
      session: vi.fn(async () => mockSession),
      hasBranchAccess: vi.fn(async () => true),
      getRecord: vi.fn(async () => mockEncounter),
      doctorByUserId: vi.fn(async () => ({ _id: doctorId, userId: doctorUserId, displayName: 'Dr. Smith' })),
      transition: vi.fn(async (id: string, bId: string, from: string[], to: string, action: string, actor: string, payload: Record<string, unknown>, reason: string | null, session: unknown, prevStatus?: string) => {
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
      audit: vi.fn(async (eventType: string, actor: string, meta: unknown, payload: unknown) => {
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

    expect(result.status).toBe('IN_CONSULTATION');
    expect((capturedTransition as { from: string[] }).from).toEqual(
      ['REGISTERED', 'WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR'],
    );
    expect((capturedTransition as { to: string }).to).toBe('IN_CONSULTATION');
    expect((capturedTransition as { prevStatus: string }).prevStatus).toBe('WAITING_FOR_DOCTOR');
    expect((capturedTransition as { action: string }).action).toBe('CALLED');
    expect((capturedTransition as { actor: string }).actor).toBe(doctorUserId);

    expect((capturedAudit as { eventType: string }).eventType).toBe('emergency.encounter.called');
    expect((capturedAudit as { actor: string }).actor).toBe(doctorUserId);
    expect((capturedAudit as { payload: { calledBy?: string } }).payload.calledBy).toBe(doctorUserId);
    expect((capturedAudit as { payload: { calledAt?: unknown } }).payload.calledAt).toBeDefined();
  });

  it('Emergency nurse can call a waiting patient from TRIAGED status', async () => {
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
      session: vi.fn(async () => mockSession),
      hasBranchAccess: vi.fn(async () => true),
      getRecord: vi.fn(async () => mockEncounter),
      doctorByUserId: vi.fn(async () => null), // Nurse is not a doctor
      transition: vi.fn(async (id: string, bId: string, from: string[], to: string, action: string, actor: string, payload: Record<string, unknown>, reason: string | null, session: unknown, prevStatus?: string) => {
        capturedTransition = { id, bId, from, to, action, actor, payload, reason, prevStatus };
        return {
          id,
          encounter_number: 'EID-102',
          branch_id: bId,
          patient_id: patientId,
          status: to,
        };
      }),
      audit: vi.fn(async (eventType: string, actor: string, meta: unknown, payload: unknown) => {
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

    expect(result.status).toBe('IN_CONSULTATION');
    expect((capturedTransition as { prevStatus: string }).prevStatus).toBe('TRIAGED');
    expect((capturedTransition as { action: string }).action).toBe('CALLED');
    expect((capturedAudit as { payload: { calledBy?: string } }).payload.calledBy).toBe(nurseUserId);
  });

  it('Calling a patient in non-actionable status throws 409 conflict error', async () => {
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
      session: vi.fn(async () => mockSession),
      hasBranchAccess: vi.fn(async () => true),
      getRecord: vi.fn(async () => mockEncounter),
      doctorByUserId: vi.fn(async () => ({ _id: doctorId, userId: doctorUserId })),
      transition: vi.fn(async () => null),
      audit: vi.fn(async () => {}),
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

    await expect(
      service.call(encounterId, branchId, doctorUserId, metadata),
    ).rejects.toSatisfy((err: Error & { statusCode?: number; code?: string }) => {
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('EMERGENCY_ENCOUNTER_NOT_ACTIONABLE');
      return true;
    });
  });

  it('User without branch access is rejected with 403 BRANCH_ACCESS_DENIED', async () => {
    const mockSession = await mongoose.startSession();
    const mockRepo = {
      session: vi.fn(async () => mockSession),
      hasBranchAccess: vi.fn(async () => false),
      getRecord: vi.fn(async () => null),
      transition: vi.fn(async () => null),
      audit: vi.fn(async () => {}),
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

    await expect(
      service.call(encounterId, branchId, doctorUserId, metadata),
    ).rejects.toSatisfy((err: Error & { statusCode?: number; code?: string }) => {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('BRANCH_ACCESS_DENIED');
      return true;
    });
  });
});
