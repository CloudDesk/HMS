import Fastify from 'fastify';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { saveOphthalmologyOpticalPrescriptionDraftBodySchema } from './ophthalmology.schemas.js';
import { OphthalmologyOpticalPrescriptionModel } from './ophthalmology-review.model.js';

const draft = {
  expected_version: 0, lens_type: 'SINGLE_VISION', material: 'CR39', coating_codes: [],
  usage_instructions: 'Review before dispensing', valid_until: '2099-01-01T00:00:00Z',
};

describe('optional optical draft sections', () => {
  it('accepts omitted sections and partially entered PD, while rejecting invalid entered powers', async () => {
    const app = Fastify();
    app.put('/draft', { schema: { body: saveOphthalmologyOpticalPrescriptionDraftBodySchema } }, async () => ({ saved: true }));
    try {
      for (const fields of [{}, { prescription_type: null, power: {}, pupillary_distance: {} },
        { pupillary_distance: { format: 'MONOCULAR', OD: 31 } }]) {
        expect((await app.inject({ method: 'PUT', url: '/draft', payload: { ...draft, ...fields } })).statusCode).toBe(200);
      }
      for (const fields of [{ power: { OD: { sphere: 41 } } }, { pupillary_distance: { binocular: 29 } },
        { prescription_type: 'UNKNOWN' }]) {
        expect((await app.inject({ method: 'PUT', url: '/draft', payload: { ...draft, ...fields } })).statusCode).toBe(400);
      }
    } finally { await app.close(); }
  });

  it('validates a stored draft with no classification, eye power or PD without filling in clinical values', async () => {
    const id = new Types.ObjectId();
    const record = new OphthalmologyOpticalPrescriptionModel({ contextId: id, visitId: id, patientId: id,
      branchId: id, departmentId: id, currentClinicalVersion: 1, status: 'DRAFT', version: 1,
      createdBy: id, updatedBy: id, versions: [{ clinicalVersion: 1, status: 'DRAFT', prescriptionType: null,
        power: {}, pupillaryDistance: {}, lensType: draft.lens_type, material: draft.material, coatingCodes: [],
        usageInstructions: draft.usage_instructions, validUntil: new Date(draft.valid_until), createdBy: id, createdAt: new Date() }] });
    await expect(record.validate()).resolves.toBeUndefined();
    expect(record.versions[0]?.prescriptionType).toBeNull();
    expect(record.versions[0]?.power.OD).toBeNull();
    expect(record.versions[0]?.pupillaryDistance.binocular).toBeNull();
  });
});
