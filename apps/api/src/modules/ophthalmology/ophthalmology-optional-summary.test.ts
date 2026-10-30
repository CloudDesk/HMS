import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { saveOphthalmologyClinicalReviewDraftBodySchema } from './ophthalmology.schemas.js';

describe('optional clinical summary request contract', () => {
  it('accepts omitted and empty summary text while retaining the length limit', async () => {
    const app = Fastify();
    app.post('/review', { schema: { body: saveOphthalmologyClinicalReviewDraftBodySchema } }, async () => ({ saved: true }));
    try {
      for (const payload of [
        { expected_version: 0, treatment_plans: [] },
        { expected_version: 0, treatment_plans: [], clinical_summary: '' },
      ]) {
        expect((await app.inject({ method: 'POST', url: '/review', payload })).statusCode).toBe(200);
      }
      expect((await app.inject({ method: 'POST', url: '/review', payload: {
        expected_version: 0, treatment_plans: [], clinical_summary: 'x'.repeat(10001),
      } })).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
