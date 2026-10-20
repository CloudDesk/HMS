import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { saveOpdConsultationBodySchema } from './opd-consultation.schemas.js';
import { saveClinicalOrderBodySchema } from './opd-clinical-order.schemas.js';
describe('shared clinical expected state transport', () => {
  it('accepts version/status in the strict consultation body and rejects malformed versions', async () => {
    const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
    app.put('/consultation', { schema: { body: saveOpdConsultationBodySchema } }, async (request) => request.body);
    try {
      const body = { expected_version: 3, expected_status: 'DRAFT', diagnoses: [{ code: 'QA', display: 'QA', laterality: 'OD', status: 'CONFIRMED' }] };
      expect((await app.inject({ method: 'PUT', url: '/consultation', payload: body })).json()).toEqual(body);
      expect((await app.inject({ method: 'PUT', url: '/consultation', payload: { ...body, expected_version: -1 } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'PUT', url: '/consultation', payload: { ...body, unknown: true } })).statusCode).toBe(400);
    } finally { await app.close(); }
  });
  it('accepts order concurrency fields without moving them into path parameters', async () => {
    const app = Fastify(); app.put('/orders', { schema: { body: saveClinicalOrderBodySchema } }, async (request) => request.body);
    try { const payload = { expected_version: 7, expected_status: 'DRAFT' }; expect((await app.inject({ method: 'PUT', url: '/orders', payload })).json()).toEqual(payload); }
    finally { await app.close(); }
  });
});
