import { describe, expect, it } from 'vitest';
import { publicOphthalmologyPayload } from './ophthalmology-public-payload.js';
describe('patient-safe ophthalmology publication projection', () => {
  it('retains intended summary/instructions while stripping nested clinician notes, raw history and audit material', () => {
    const payload = publicOphthalmologyPayload('CONSULTATION_SUMMARY', { clinical_version: 2, approved_at: '2026-10-18T00:00:00Z',
      consultation: { chiefComplaint: 'Blur', assessment: 'Reviewed', doctorNotes: 'SECRET', clinicalHistory: ['SECRET'] },
      diagnoses: [{ code: 'QA', display: 'QA', laterality: 'OS', status: 'CONFIRMED', notes: 'SECRET' }],
      clinical_review: { current: { clinical_summary: 'Approved summary', patient_instructions: 'Review as advised', internal_notes: 'SECRET', treatment_plans: [
        { treatment: 'Reviewed plan', action_type: 'OTHER', clinician_user_id: 'SECRET' },
        { treatment: 'Historical plan', category: 'OBSERVATION', clinician_user_id: 'SECRET' },
      ] }, history: ['SECRET'] },
      optical_prescription: { current: { power: { OD: { sphere: 1, internal_notes: 'SECRET' } }, internal_notes: 'SECRET' }, history: ['SECRET'] },
      procedure_recommendations: [{ serviceName: 'Approved procedure', notes: 'SECRET' }], referrals: [{ reason: 'Referral', clinicalSummary: 'SECRET' }],
      follow_ups: [{ nextVisitDate: '2026-10-20', notes: 'SECRET' }], previous_results: ['SECRET'], idempotency_key: 'SECRET' });
    expect(payload.clinical_review).toMatchObject({ clinical_summary: 'Approved summary', patient_instructions: 'Review as advised', treatment_plans: [
      { treatment: 'Reviewed plan', action_type: 'OTHER' }, { treatment: 'Historical plan', legacy_category: 'OBSERVATION' },
    ] });
    expect(payload.consultation).toMatchObject({ chief_complaint: 'Blur' }); expect(JSON.stringify(payload)).not.toContain('SECRET');
  });
  it('does not leak raw measurements/comments through result or optical publications', () => {
    expect(JSON.stringify(publicOphthalmologyPayload('TEST_RESULT', { clinical_version: 1, test_code: 'QA', comments: 'SECRET', payload: { internal: 'SECRET' }, report_document_ids: ['111111111111111111111111', 'invalid'] }))).not.toContain('SECRET');
    const optical = publicOphthalmologyPayload('OPTICAL_PRESCRIPTION', { clinical_version: 1, prescription_type: 'DISTANCE', power: { OS: { sphere: 0, secret: 'SECRET' } }, approver_user_id: 'SECRET' });
    expect(optical.power).toMatchObject({ OS: { sphere: 0 } }); expect(JSON.stringify(optical)).not.toContain('SECRET');
  });
  it('sanitizes legacy snapshots on read without mutating their immutable originals', () => {
    const stored = { clinical_version: 1, clinical_review: { current: { patient_instructions: 'Approved', doctor_notes: 'SECRET' } } };
    const once = publicOphthalmologyPayload('CONSULTATION_SUMMARY', stored); const twice = publicOphthalmologyPayload('CONSULTATION_SUMMARY', once);
    expect(twice).toEqual(once); expect(stored.clinical_review.current.doctor_notes).toBe('SECRET');
  });
});
