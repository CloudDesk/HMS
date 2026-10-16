import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServiceRegistry } from '../../shared/services/service-registry.js';
import { OphthalmologyAttachmentModel, OphthalmologyPublicationModel } from './ophthalmology-phase10.model.js';
import { OphthalmologyTestResultModel } from './ophthalmology-test-result.model.js';
import { OphthalmologyTestTaskModel } from './ophthalmology-test-task.model.js';
import {
  OphthalmologyConfigurationModel,
  OphthalmologyContextModel,
  OphthalmologyStationModel,
  OphthalmologyWorkflowProfileModel,
} from './ophthalmology.model.js';

const permissionSpies = vi.hoisted(() => ({
  requirePermission: vi.fn((...args: [unknown, string, string, string]) => {
    void args;
    return [];
  }),
  requireAnyPermission: vi.fn((...args: [unknown, Array<{
    moduleName: string;
    screen: string;
    action: string;
  }>]) => {
    void args;
    return [];
  }),
}));

vi.mock('../../middleware/require-permission.js', () => permissionSpies);

import { registerOphthalmologyRoutes } from './ophthalmology.routes.js';

const indexSignatures = (indexes: ReturnType<typeof OphthalmologyContextModel.schema.indexes>) =>
  indexes.map(([fields, options]) => ({ fields, options }));

describe('Ophthalmology Phase 11 release hardening', () => {
  afterEach(() => vi.clearAllMocks());

  it('uses the dedicated optical-prescription permission boundary', async () => {
    const app = Fastify();
    const services = createServiceRegistry();
    await registerOphthalmologyRoutes(app, services);

    expect(permissionSpies.requirePermission).toHaveBeenCalledWith(
      services,
      'OPD',
      'Ophthalmology Optical Prescription',
      'View',
    );
    expect(permissionSpies.requireAnyPermission).toHaveBeenCalledWith(services, [
      { moduleName: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Create' },
      { moduleName: 'OPD', screen: 'Ophthalmology Optical Prescription', action: 'Edit' },
    ]);
    expect(permissionSpies.requirePermission).toHaveBeenCalledWith(
      services,
      'OPD',
      'Ophthalmology Optical Prescription',
      'Approve',
    );
    await app.close();
  });

  it('retains the release-critical uniqueness and scoped-query indexes', () => {
    expect(indexSignatures(OphthalmologyContextModel.schema.indexes())).toEqual(expect.arrayContaining([
      expect.objectContaining({ fields: { visitId: 1 }, options: expect.objectContaining({ unique: true }) }),
      expect.objectContaining({ fields: { branchId: 1, workflowStatus: 1, updatedAt: -1 } }),
    ]));
    expect(indexSignatures(OphthalmologyConfigurationModel.schema.indexes())).toEqual(expect.arrayContaining([
      expect.objectContaining({ fields: { branchId: 1, type: 1, code: 1 }, options: expect.objectContaining({ unique: true }) }),
    ]));
    expect(indexSignatures(OphthalmologyWorkflowProfileModel.schema.indexes())).toEqual(expect.arrayContaining([
      expect.objectContaining({ fields: { branchId: 1, visitSubtype: 1 }, options: expect.objectContaining({ unique: true }) }),
    ]));
    expect(indexSignatures(OphthalmologyStationModel.schema.indexes())).toEqual(expect.arrayContaining([
      expect.objectContaining({ fields: { branchId: 1, code: 1 }, options: expect.objectContaining({ unique: true }) }),
      expect.objectContaining({ fields: { branchId: 1, supportedTestTypes: 1, status: 1 } }),
    ]));
    expect(indexSignatures(OphthalmologyTestTaskModel.schema.indexes())).toEqual(expect.arrayContaining([
      expect.objectContaining({ fields: { contextId: 1, idempotencyKey: 1 }, options: expect.objectContaining({ unique: true }) }),
      expect.objectContaining({ fields: { branchId: 1, stationId: 1, status: 1, priority: 1, waitingSince: 1 } }),
    ]));
    expect(indexSignatures(OphthalmologyTestResultModel.schema.indexes())).toEqual(expect.arrayContaining([
      expect.objectContaining({ fields: { taskId: 1 }, options: expect.objectContaining({ unique: true }) }),
      expect.objectContaining({ fields: { branchId: 1, status: 1, updatedAt: -1 } }),
    ]));
    expect(indexSignatures(OphthalmologyAttachmentModel.schema.indexes())).toEqual(expect.arrayContaining([
      expect.objectContaining({ fields: { branchId: 1, idempotencyKey: 1 }, options: expect.objectContaining({ unique: true }) }),
      expect.objectContaining({ fields: { patientId: 1, visitId: 1, acquiredAt: -1 } }),
    ]));
    expect(indexSignatures(OphthalmologyPublicationModel.schema.indexes())).toEqual(expect.arrayContaining([
      expect.objectContaining({ fields: { branchId: 1, idempotencyKey: 1 }, options: expect.objectContaining({ unique: true }) }),
      expect.objectContaining({ fields: { sourceType: 1, sourceId: 1, sourceVersion: 1 }, options: expect.objectContaining({ unique: true }) }),
    ]));
  });
});
