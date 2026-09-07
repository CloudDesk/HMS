import { describe, it, expect, vi } from 'vitest';
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

describe('Emergency Triage Consultation Tests', () => {
  it('Emergency triage completion persists triage and enters consultation atomically', async () => {
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
      hasBranchAccess: vi.fn(async () => true),
      session: vi.fn(async () => session),
      getRecord: vi.fn(async () => ({
        _id: encounterId,
        branchId,
        departmentId: createObjectId(),
        patientId,
        encounterNumber: 'ER-0001',
        status: 'WAITING_FOR_TRIAGE',
      })),
      transition: vi.fn(async (
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
      audit: vi.fn(async (eventType: string, _actor: string, _metadata: unknown, payload: Record<string, unknown>) => {
        audits.push({ eventType, payload });
      }),
    };
    const patients = { addEmergencyTimeline: vi.fn(async () => undefined) };

    const result = await serviceWith(repository, patients).triage(
      encounterId,
      branchId,
      triage,
      actorId,
      metadata,
    );

    expect(result?.status).toBe('IN_CONSULTATION');
    expect(transactionCount).toBe(1);
    expect(ended).toBe(true);
    expect(transitions.length).toBe(2);
    expect(transitions[0]?.from).toEqual(['REGISTERED', 'WAITING_FOR_TRIAGE']);
    expect(transitions[0]?.to).toBe('WAITING_FOR_DOCTOR');
    expect(transitions[0]?.action).toBe('TRIAGED');
    expect(transitions[0]?.previous).toBe('WAITING_FOR_TRIAGE');
    expect(
      (transitions[0]?.set as { triage?: { vitals?: unknown } }).triage?.vitals,
    ).toEqual(triage.vitals);
    expect(transitions[1]?.from).toBe('WAITING_FOR_DOCTOR');
    expect(transitions[1]?.to).toBe('IN_CONSULTATION');
    expect(transitions[1]?.action).toBe('CALLED');
    expect(transitions[1]?.previous).toBe('WAITING_FOR_DOCTOR');
    expect(audits.map((entry) => entry.eventType)).toEqual([
      'emergency.triage.completed',
      'emergency.encounter.called',
    ]);
    expect(audits[0]?.payload.previousStatus).toBe('WAITING_FOR_TRIAGE');
    expect(audits[1]?.payload.previousStatus).toBe('WAITING_FOR_DOCTOR');
    expect(patients.addEmergencyTimeline).toHaveBeenCalledTimes(1);
  });

  it('Emergency triage completion resumes safely from the doctor-waiting state', async () => {
    const encounterId = createObjectId();
    const branchId = createObjectId();
    const actorId = createObjectId();
    const transitions: Array<{ from: unknown; to: unknown; action: unknown; set: unknown }> = [];
    const session = {
      withTransaction: async (callback: () => Promise<void>) => callback(),
      endSession: async () => undefined,
    };
    const repository = {
      hasBranchAccess: vi.fn(async () => true),
      session: vi.fn(async () => session),
      getRecord: vi.fn(async () => ({
        _id: encounterId,
        branchId,
        departmentId: createObjectId(),
        patientId: createObjectId(),
        encounterNumber: 'ER-RESUME-1',
        status: 'WAITING_FOR_DOCTOR',
        triage: { level: 'LEVEL_3_MEDIUM' },
      })),
      transition: vi.fn(async (
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
      audit: vi.fn(async () => undefined),
    };
    const patients = { addEmergencyTimeline: vi.fn(async () => undefined) };

    const result = await serviceWith(repository, patients).triage(
      encounterId,
      branchId,
      triage,
      actorId,
      metadata,
    );

    expect(result?.status).toBe('IN_CONSULTATION');
    expect(transitions.length).toBe(1);
    expect(transitions[0]?.from).toBe('WAITING_FOR_DOCTOR');
    expect(transitions[0]?.to).toBe('IN_CONSULTATION');
    expect(transitions[0]?.action).toBe('CALLED');
    expect(
      (transitions[0]?.set as { triage?: { painScore?: number } }).triage?.painScore,
    ).toEqual(triage.pain_score);
    expect(patients.addEmergencyTimeline).not.toHaveBeenCalled();
  });

  it('Emergency triage completion rejects non-actionable encounters', async () => {
    const session = {
      withTransaction: async (callback: () => Promise<void>) => callback(),
      endSession: async () => undefined,
    };
    const repository = {
      hasBranchAccess: vi.fn(async () => true),
      session: vi.fn(async () => session),
      getRecord: vi.fn(async () => ({
        _id: createObjectId(),
        branchId: createObjectId(),
        departmentId: createObjectId(),
        patientId: null,
        encounterNumber: 'ER-0002',
        status: 'IN_CONSULTATION',
      })),
      transition: vi.fn(async () => null),
      audit: vi.fn(async () => undefined),
    };

    await expect(
      serviceWith(repository, { addEmergencyTimeline: vi.fn(async () => undefined) }).triage(
        createObjectId(),
        createObjectId(),
        triage,
        createObjectId(),
        metadata,
      ),
    ).rejects.toSatisfy((error: Error & { statusCode?: number; code?: string }) => {
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('EMERGENCY_ENCOUNTER_NOT_ACTIONABLE');
      return true;
    });
  });

  it('Emergency triage completion enforces branch access', async () => {
    const repository = {
      hasBranchAccess: vi.fn(async () => false),
    };

    await expect(
      serviceWith(repository, {}).triage(
        createObjectId(),
        createObjectId(),
        triage,
        createObjectId(),
        metadata,
      ),
    ).rejects.toSatisfy((error: Error & { statusCode?: number; code?: string }) => {
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('BRANCH_ACCESS_DENIED');
      return true;
    });
  });

  it('Emergency triage schema rejects invalid vital signs', () => {
    const parsed = triageSchema.safeParse({ ...triage, pain_score: 11, vitals: { ...triage.vitals, spo2: 101 } });
    expect(parsed.success).toBe(false);
  });

  it('triage completion permits nurse, doctor, or encounter-editor permissions and rejects others', async () => {
    const allowedPermissions = [
      ['Triage', 'Assess'],
      ['Consultation', 'Edit'],
      ['Encounters', 'Edit'],
    ] as const;

    for (const [allowedScreen, allowedAction] of allowedPermissions) {
      const services = {
        permissions: {
          userHasPermission: vi.fn(async (_userId: string, _module: string, screen: string, action: string) =>
            screen === allowedScreen && action === allowedAction),
          auditDeniedAccess: vi.fn(async () => undefined),
        },
      };
      const handlers = requireAnyPermission(
        services as unknown as ServiceRegistry,
        emergencyTriageCompletionPermissions,
      );
      const authorize = handlers[1];
      expect(authorize).toBeDefined();
      await authorize(
        { user: { id: createObjectId() }, ip: '127.0.0.1', headers: {} } as never,
        {} as never,
      );
    }

    const auditDeniedAccess = vi.fn(async () => undefined);
    const deniedServices = {
      permissions: {
        userHasPermission: vi.fn(async () => false),
        auditDeniedAccess,
      },
    };
    const deniedHandlers = requireAnyPermission(
      deniedServices as unknown as ServiceRegistry,
      emergencyTriageCompletionPermissions,
    );
    const authorizeDenied = deniedHandlers[1];
    expect(authorizeDenied).toBeDefined();
    await expect(
      authorizeDenied(
        { user: { id: createObjectId() }, ip: '127.0.0.1', headers: {} } as never,
        {} as never,
      ),
    ).rejects.toSatisfy((error: Error & { statusCode?: number; code?: string }) => {
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('PERMISSION_REQUIRED');
      return true;
    });
    expect(auditDeniedAccess).toHaveBeenCalledTimes(1);
  });
});
