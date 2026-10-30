import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiClient: { request } }));
import { approveOpticalSchema, clinicalReviewSchema, clinicalReviewWriteSchema, ophthalmologyCareApi, opticalSchema, opticalWriteSchema, resultReviewWriteSchema } from './ophthalmology-care';
const id = '111111111111111111111111';
const optical = () => ({ expected_version: 7, prescription_type: 'DISTANCE' as const, power: { OD: { sphere: -2 } }, pupillary_distance: { format: 'BINOCULAR' as const, binocular: 62 }, lens_type: 'QA_LENS', material: 'QA_MATERIAL', coating_codes: [], usage_instructions: 'QA instructions', valid_until: '2099-10-16T00:00:00Z', review_date: null });
describe('ophthalmology B4 clinical and optical contracts', () => {
  beforeEach(() => { request.mockReset(); });
  it('reads explicit null records without manufacturing drafts', async () => {
    request.mockResolvedValue(null); expect(await ophthalmologyCareApi.clinical(id)).toBeNull(); expect(await ophthalmologyCareApi.optical(id)).toBeNull();
    expect(request.mock.calls.map((call) => call[0])).toEqual([`/opd/visits/${id}/ophthalmology/clinical-review`, `/opd/visits/${id}/ophthalmology/optical-prescription`]);
  });
  it('rejects malformed visits and result clinical version zero before requests', async () => {
    await expect(ophthalmologyCareApi.optical('bad')).rejects.toThrow();
    expect(resultReviewWriteSchema.safeParse({ expected_task_version: 0, expected_result_version: 0, expected_clinical_version: 0 }).success).toBe(false); expect(request).not.toHaveBeenCalled();
  });
  it('sends original versions and exact dedicated optical routes without promoting drafts', async () => {
    request.mockRejectedValue(new Error('Conflict'));
    await expect(ophthalmologyCareApi.saveOptical(id, optical())).rejects.toThrow('Conflict');
    expect(request).toHaveBeenCalledWith(`/opd/visits/${id}/ophthalmology/optical-prescription/draft`, { method: 'PUT', body: optical() });
    await expect(ophthalmologyCareApi.approveOptical(id, { expected_status: 'DRAFT', expected_version: 7 })).rejects.toThrow('Conflict');
    expect(request).toHaveBeenLastCalledWith(`/opd/visits/${id}/ophthalmology/optical-prescription/approve`, { method: 'POST', body: { expected_status: 'DRAFT', expected_version: 7 } });
  });
  it('allows omitted eye power in drafts while validating supplied powers', () => {
    expect(opticalWriteSchema.safeParse({ ...optical(), prescription_type: null, power: {}, pupillary_distance: {} }).success).toBe(true);
    expect(opticalWriteSchema.safeParse({ ...optical(), power: { OD: { sphere: -2, cylinder: 0 } } }).success).toBe(false);
    expect(opticalWriteSchema.safeParse({ ...optical(), power: { OD: { sphere: -2, cylinder: -1, axis: 180 } } }).success).toBe(true);
    expect(opticalWriteSchema.safeParse({ ...optical(), power: { OD: { sphere: 41 } } }).success).toBe(false);
  });
  it('allows incomplete PD and segment height in drafts without accepting out-of-range values', () => {
    expect(opticalWriteSchema.safeParse({ ...optical(), pupillary_distance: { format: 'MONOCULAR', OD: 31 } }).success).toBe(true);
    expect(opticalWriteSchema.safeParse({ ...optical(), prescription_type: 'PROGRESSIVE' }).success).toBe(true);
    expect(opticalWriteSchema.safeParse({ ...optical(), prescription_type: 'PROGRESSIVE', segment_height: { OD: 20 } }).success).toBe(true);
    expect(opticalWriteSchema.safeParse({ ...optical(), pupillary_distance: { format: 'BINOCULAR', binocular: 29 } }).success).toBe(false);
  });
  it('requires future validity and a review date no later than validity', () => {
    expect(opticalWriteSchema.safeParse({ ...optical(), valid_until: '2000-01-01T00:00:00Z' }).success).toBe(false);
    expect(opticalWriteSchema.safeParse({ ...optical(), review_date: '2100-01-01T00:00:00Z' }).success).toBe(false);
    expect(approveOpticalSchema.safeParse({ expected_version: 7, expected_status: 'APPROVED' }).success).toBe(false);
  });
  it('can read expired historical approved prescriptions without today’s write validation', () => {
    const { expected_version: _, ...values } = optical(); void _;
    const current = { ...values, valid_until: '2000-01-01T00:00:00Z', clinical_version: 1, status: 'APPROVED', approver_user_id: id, approver_doctor_id: id, approved_at: '1999-01-01T00:00:00Z', created_by: id, created_at: '1999-01-01T00:00:00Z' };
    expect(opticalSchema.safeParse({ id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id, current_clinical_version: 1, status: 'APPROVED', current, history: [current], version: 8, created_at: current.created_at, updated_at: current.approved_at }).success).toBe(true);
  });
  it('requires one explicit action with only its matching authoritative reference', () => {
    const base = { diagnosis_code: 'QA', diagnosis_laterality: 'OD', treatment: 'QA treatment', priority: 'ROUTINE', status: 'PLANNED' };
    const medication = { ...base, action_type: 'MEDICATION', medication_prescription_id: id };
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [medication] }).success).toBe(true);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...base, action_type: 'OPTICAL', optical_prescription_id: id }] }).success).toBe(true);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...base, action_type: 'INVESTIGATION', clinical_order_ids: [id] }] }).success).toBe(true);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...base, action_type: 'PROCEDURE', procedure_recommendation_id: id }] }).success).toBe(true);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...base, action_type: 'REFERRAL', referral_id: id }] }).success).toBe(true);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...base, action_type: 'FOLLOW_UP', follow_up_id: id }] }).success).toBe(true);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...base, action_type: 'OTHER' }] }).success).toBe(true);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...base, action_type: 'MEDICATION' }] }).success).toBe(false);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...medication, referral_id: id }] }).success).toBe(false);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...base, action_type: 'OTHER', clinical_order_ids: [id] }] }).success).toBe(false);
  });
  it('rejects duplicate action keys, duplicate orders and view-only fields', () => {
    const row = { diagnosis_code: 'QA', diagnosis_laterality: 'OD', treatment: 'QA treatment', action_type: 'INVESTIGATION', priority: 'ROUTINE', status: 'PLANNED', clinical_order_ids: [id] };
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [row, row] }).success).toBe(false);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...row, clinical_order_ids: [id, id] }] }).success).toBe(false);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [{ ...row, clinician_user_id: id }] }).success).toBe(false);
    expect(clinicalReviewWriteSchema.safeParse({ expected_version: 4, clinical_summary: 'QA', treatment_plans: [row] }).success).toBe(true);
  });
  it('reads a historical category without inventing an action classification', () => {
    const timestamp = '2026-10-16T00:00:00Z';
    const plan = { id, clinician_user_id: id, diagnosis_code: 'QA', diagnosis_laterality: 'OD', treatment: 'Historical observation',
      action_type: null, legacy_category: 'OBSERVATION', priority: 'ROUTINE', status: 'CANCELLED', medication_prescription_id: null,
      optical_prescription_id: null, clinical_order_ids: [], procedure_recommendation_id: null, referral_id: null, follow_up_id: null };
    const version = { clinical_version: 1, clinical_summary: 'Historical review', treatment_plans: [plan], follow_up_decision: null,
      patient_instructions: null, created_by: id, created_at: timestamp };
    const parsed = clinicalReviewSchema.parse({ id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id,
      current_clinical_version: 1, status: 'DRAFT', current: version, history: [version], version: 1, created_at: timestamp, updated_at: timestamp });
    expect(parsed.current.treatment_plans[0]).toMatchObject({ action_type: null, legacy_category: 'OBSERVATION' });
  });
  it('reviews the exact task/result/clinical versions through the separate review action', async () => {
    request.mockRejectedValue(new Error('Conflict')); const body = { expected_task_version: 3, expected_result_version: 5, expected_clinical_version: 2, comment: 'QA review' };
    await expect(ophthalmologyCareApi.reviewResult(id, body)).rejects.toThrow('Conflict');
    expect(request).toHaveBeenCalledWith(`/ophthalmology/test-tasks/${id}/result/review`, { method: 'POST', body });
  });
});
