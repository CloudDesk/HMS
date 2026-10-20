import { describe, expect, it } from 'vitest';
import { ophthalmologyPublicationSchema, ophthalmologyPublicPayloadSchema } from './ophthalmology-publications.schemas';
describe('approved ophthalmology patient payload parsing', () => {
  it('strips clinician notes and unknown nested fields even from legacy server payloads', () => {
    const parsed = ophthalmologyPublicPayloadSchema.parse({ kind: 'CONSULTATION_SUMMARY', clinical_version: 1, clinical_review: { patient_instructions: 'Review as advised', doctor_notes: 'SECRET', previous_results: ['SECRET'] }, consultation: { assessment: 'Approved', doctor_notes: 'SECRET' }, idempotency_key: 'SECRET' });
    expect(JSON.stringify(parsed)).not.toContain('SECRET'); expect(parsed.kind).toBe('CONSULTATION_SUMMARY');
  });
  it('retains actual zero optical values and excludes audit data', () => { const parsed = ophthalmologyPublicPayloadSchema.parse({ kind: 'OPTICAL_PRESCRIPTION', clinical_version: 1, power: { OD: { sphere: 0, internal: 'SECRET' } } }); expect(parsed).toMatchObject({ power: { OD: { sphere: 0 } } }); expect(JSON.stringify(parsed)).not.toContain('SECRET'); });
  it('keeps publication metadata while safely declining unsupported content', () => { const parsed = ophthalmologyPublicationSchema.parse({ id: 'qa', source_type: 'TEST_RESULT', source_id: 'result', source_version: 1, published_at: '2026-10-18T00:00:00Z', payload: { unknown: 'SECRET' } }); expect(parsed.payload).toBeNull(); });
});
