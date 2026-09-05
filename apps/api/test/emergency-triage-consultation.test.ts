import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { requireAnyPermission } from '../src/middleware/require-permission.js';
import {
  emergencyTriageCompletionPermissions,
} from '../src/modules/emergency/emergency.routes.js';
import { triageSchema } from '../src/modules/emergency/emergency.schemas.js';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import type {
  EmergencyMetadata,
  EmergencyTriageDTO,
} from '../src/modules/emergency/emergency.types.js';
import type { ServiceRegistry } from '../src/shared/types/service-registry.js';
import { createObjectId } from './factories.js';

const metadata: EmergencyMetadata = {
  ipAddress: '127.0.0.1',
  userAgent: 'emergency-triage-test',
  correlationId: 'triage-to-consultation',
};

const triage: EmergencyTriageDTO = {
  level: 'LEVEL_2_HIGH',
  area: 'Resuscitation',
  pain_score: 7,
  vitals: {
    systolic_bp: 118,
    diastolic_bp: 74,
    pulse: 104,
    temperature_c: 37.8,
    spo2: 96,
    respiratory_rate: 22,
    gcs: 15,
  },
  abcde: {
    airway: 'Patent',
    breathing: 'Spontaneous',
    circulation: 'Stable',
    disability: 'Alert',
    exposure: 'No immediate concern',
  },
  notes: 'Triage completed.',
};

const serviceWith = (repository: Record<string, unknown>, patients: Record<string, unknown>) =>
  new EmergencyService(
    repository as unknown as ConstructorParameters<typeof EmergencyService>[0],
    patients as unknown as ConstructorParameters<typeof EmergencyService>[1],
    {} as ConstructorParameters<typeof EmergencyService>[2],
    {} as ConstructorParameters<typeof EmergencyService>[3],
    {} as ConstructorParameters<typeof EmergencyService>[4],
    {} as ConstructorParameters<typeof EmergencyService>[5],
    {} as ConstructorParameters<typeof EmergencyService>[6],
  );

test('Emergency triage completion persists triage and enters consultation atomically', async () => {
  const encounterId = createObjectId();
  const branchId = createObjectId();
  const actorId = createObjectId();
  const patientId = createObjectId();
  const transitions: Array<{ from: unknown; to: unknown; action: unknown; set: unknown; previous: unknown }> = [];
  const audits: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  let transactionCount = 0;
  let ended = false;
  const session = {
    withTransaction: async (callback: () => Promise<void>) => {
      transactionCount += 1;
      await callback();
    },
    endSession: async () => {
      ended = true;
    },
  };
  const repository = {
    hasBranchAccess: mock.fn(async () => true),
    session: mock.fn(async () => session),
    getRecord: mock.fn(async () => ({
      _id: encounterId,
      branchId,
      departmentId: createObjectId(),
      patientId,
      encounterNumber: 'ER-0001',
      status: 'WAITING_FOR_TRIAGE',
    })),
    transition: mock.fn(async (
      _id: string,
      _branchId: string,
      from: unknown,
      to: unknown,
      action: unknown,
      _actor: string,
      set: unknown,
      _reason: unknown,
      _session: unknown,
      previous: unknown,
    ) => {
      transitions.push({ from, to, action, set, previous });
      return { id: encounterId, branch_id: branchId, patient_id: patientId, status: to };
    }),
    audit: mock.fn(async (eventType: string, _actor: string, _metadata: unknown, payload: Record<string, unknown>) => {
      audits.push({ eventType, payload });
    }),
  };
  const patients = { addEmergencyTimeline: mock.fn(async () => undefined) };

  const result = await serviceWith(repository, patients).triage(
    encounterId,
    branchId,
    triage,
    actorId,
    metadata,
  );

  assert.equal(result?.status, 'IN_CONSULTATION');
  assert.equal(transactionCount, 1);
  assert.equal(ended, true);
  assert.equal(transitions.length, 2);
  assert.deepEqual(transitions[0]?.from, ['REGISTERED', 'WAITING_FOR_TRIAGE']);
  assert.equal(transitions[0]?.to, 'WAITING_FOR_DOCTOR');
  assert.equal(transitions[0]?.action, 'TRIAGED');
  assert.equal(transitions[0]?.previous, 'WAITING_FOR_TRIAGE');
  assert.deepEqual(
    (transitions[0]?.set as { triage?: { vitals?: unknown } }).triage?.vitals,
    triage.vitals,
  );
  assert.equal(transitions[1]?.from, 'WAITING_FOR_DOCTOR');
  assert.equal(transitions[1]?.to, 'IN_CONSULTATION');
  assert.equal(transitions[1]?.action, 'CALLED');
  assert.equal(transitions[1]?.previous, 'WAITING_FOR_DOCTOR');
  assert.deepEqual(audits.map((entry) => entry.eventType), [
    'emergency.triage.completed',
    'emergency.encounter.called',
  ]);
  assert.equal(audits[0]?.payload.previousStatus, 'WAITING_FOR_TRIAGE');
  assert.equal(audits[1]?.payload.previousStatus, 'WAITING_FOR_DOCTOR');
  assert.equal(patients.addEmergencyTimeline.mock.callCount(), 1);
});

test('Emergency triage completion resumes safely from the doctor-waiting state', async () => {
  const encounterId = createObjectId();
  const branchId = createObjectId();
  const actorId = createObjectId();
  const transitions: Array<{ from: unknown; to: unknown; action: unknown; set: unknown }> = [];
  const session = {
    withTransaction: async (callback: () => Promise<void>) => callback(),
    endSession: async () => undefined,
  };
  const repository = {
    hasBranchAccess: mock.fn(async () => true),
    session: mock.fn(async () => session),
    getRecord: mock.fn(async () => ({
      _id: encounterId,
      branchId,
      departmentId: createObjectId(),
      patientId: createObjectId(),
      encounterNumber: 'ER-RESUME-1',
      status: 'WAITING_FOR_DOCTOR',
      triage: { level: 'LEVEL_3_MEDIUM' },
    })),
    transition: mock.fn(async (
      _id: string,
      _branchId: string,
      from: unknown,
      to: unknown,
      action: unknown,
      _actor: string,
      set: unknown,
    ) => {
      transitions.push({ from, to, action, set });
      return { id: encounterId, branch_id: branchId, status: to };
    }),
    audit: mock.fn(async () => undefined),
  };
  const patients = { addEmergencyTimeline: mock.fn(async () => undefined) };

  const result = await serviceWith(repository, patients).triage(
    encounterId,
    branchId,
    triage,
    actorId,
    metadata,
  );

  assert.equal(result?.status, 'IN_CONSULTATION');
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0]?.from, 'WAITING_FOR_DOCTOR');
  assert.equal(transitions[0]?.to, 'IN_CONSULTATION');
  assert.equal(transitions[0]?.action, 'CALLED');
  assert.deepEqual(
    (transitions[0]?.set as { triage?: { painScore?: number } }).triage?.painScore,
    triage.pain_score,
  );
  assert.equal(patients.addEmergencyTimeline.mock.callCount(), 0);
});

test('Emergency triage completion rejects non-actionable encounters', async () => {
  const session = {
    withTransaction: async (callback: () => Promise<void>) => callback(),
    endSession: async () => undefined,
  };
  const repository = {
    hasBranchAccess: mock.fn(async () => true),
    session: mock.fn(async () => session),
    getRecord: mock.fn(async () => ({
      _id: createObjectId(),
      branchId: createObjectId(),
      departmentId: createObjectId(),
      patientId: null,
      encounterNumber: 'ER-0002',
      status: 'IN_CONSULTATION',
    })),
    transition: mock.fn(async () => null),
    audit: mock.fn(async () => undefined),
  };

  await assert.rejects(
    serviceWith(repository, { addEmergencyTimeline: mock.fn(async () => undefined) }).triage(
      createObjectId(),
      createObjectId(),
      triage,
      createObjectId(),
      metadata,
    ),
    (error: Error & { statusCode?: number; code?: string }) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'EMERGENCY_ENCOUNTER_NOT_ACTIONABLE');
      return true;
    },
  );
});

test('Emergency triage completion enforces branch access', async () => {
  const repository = {
    hasBranchAccess: mock.fn(async () => false),
  };

  await assert.rejects(
    serviceWith(repository, {}).triage(
      createObjectId(),
      createObjectId(),
      triage,
      createObjectId(),
      metadata,
    ),
    (error: Error & { statusCode?: number; code?: string }) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'BRANCH_ACCESS_DENIED');
      return true;
    },
  );
});

test('Emergency triage schema rejects invalid vital signs', () => {
  const parsed = triageSchema.safeParse({ ...triage, pain_score: 11, vitals: { ...triage.vitals, spo2: 101 } });
  assert.equal(parsed.success, false);
});

test('triage completion permits nurse, doctor, or encounter-editor permissions and rejects others', async () => {
  const allowedPermissions = [
    ['Triage', 'Assess'],
    ['Consultation', 'Edit'],
    ['Encounters', 'Edit'],
  ] as const;

  for (const [allowedScreen, allowedAction] of allowedPermissions) {
    const services = {
      permissions: {
        userHasPermission: mock.fn(async (_userId: string, _module: string, screen: string, action: string) =>
          screen === allowedScreen && action === allowedAction),
        auditDeniedAccess: mock.fn(async () => undefined),
      },
    };
    const handlers = requireAnyPermission(
      services as unknown as ServiceRegistry,
      emergencyTriageCompletionPermissions,
    );
    const authorize = handlers[1];
    assert.ok(authorize);
    await authorize(
      { user: { id: createObjectId() }, ip: '127.0.0.1', headers: {} } as never,
      {} as never,
    );
  }

  const auditDeniedAccess = mock.fn(async () => undefined);
  const deniedServices = {
    permissions: {
      userHasPermission: mock.fn(async () => false),
      auditDeniedAccess,
    },
  };
  const deniedHandlers = requireAnyPermission(
    deniedServices as unknown as ServiceRegistry,
    emergencyTriageCompletionPermissions,
  );
  const authorizeDenied = deniedHandlers[1];
  assert.ok(authorizeDenied);
  await assert.rejects(
    authorizeDenied(
      { user: { id: createObjectId() }, ip: '127.0.0.1', headers: {} } as never,
      {} as never,
    ),
    (error: Error & { statusCode?: number; code?: string }) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'PERMISSION_REQUIRED');
      return true;
    },
  );
  assert.equal(auditDeniedAccess.mock.callCount(), 1);
});
