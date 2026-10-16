import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiClient: { request } }));
import { contextSchema, ophthalmologyApi, testFormSchema } from './ophthalmology';
import { initialIntake } from '../hooks/ophthalmology/intake-form';
const id = '111111111111111111111111';
describe('ophthalmology API requests', () => {
  beforeEach(() => request.mockReset());
  it('rejects invalid encounter IDs before sending requests', async () => {
    await expect(ophthalmologyApi.context('../another-visit')).rejects.toThrow(); expect(request).not.toHaveBeenCalled();
  });
  it('updates only supported context fields with the original expected version', async () => {
    request.mockResolvedValue({ id, visit_id: id, patient_id: id, branch_id: id, department_id: id, doctor_id: id, visit_subtype: 'FOLLOW_UP', affected_eye: 'OS', workflow_status: 'CHECKED_IN', configuration_version_id: id, workflow_profile_version_id: id, version: 3 });
    await ophthalmologyApi.updateContext(id, { expected_version: 2, affected_eye: 'OS' });
    expect(request).toHaveBeenCalledWith(`/opd/visits/${id}/ophthalmology/context`, { method: 'PATCH', body: { expected_version: 2, affected_eye: 'OS' } });
    request.mockClear(); await expect(ophthalmologyApi.updateContext(id, { expected_version: 2 })).rejects.toThrow(); expect(request).not.toHaveBeenCalled();
  });
  it('sends explicit task pagination and validates the list response', async () => {
    request.mockResolvedValue({ data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } });
    await ophthalmologyApi.tasks(id, 2);
    expect(request.mock.calls[0]?.[0]).toBe(`/ophthalmology/test-tasks?visit_id=${id}&page=2&limit=20`);
  });
  it('keeps alert routing versions in the body and excludes acknowledgement-only notes', async () => {
    request.mockResolvedValue({ id, visit_id: id, patient_id: id, branch_id: id, department_id: id, type: 'EMERGENCY_SCREENING', status: 'ACTIVE', reason: 'QA criterion', version: 2, triggered_by: id, triggered_at: '2026-10-16T00:00:00Z', acknowledged_by: null, acknowledged_at: null, acknowledgement_note: null });
    await ophthalmologyApi.alert(id, id, 'route', { expected_version: 1, expected_status: 'ACTIVE', note: 'not sent' });
    expect(request).toHaveBeenCalledWith(`/opd/visits/${id}/ophthalmology/alerts/${id}/route`, { method: 'POST', body: { expected_version: 1, expected_status: 'ACTIVE' } });
  });
  it('recognises all 21 backend form types without enabling unbuilt screens', () => { expect(testFormSchema.options).toHaveLength(21); expect(testFormSchema.parse('PAEDIATRIC_VISION')).toBe('PAEDIATRIC_VISION'); });
  it('accepts completion intake/alert response envelopes and server audit metadata', async () => {
    const context = contextSchema.parse({ id, visit_id: id, patient_id: id, branch_id: id, department_id: id, doctor_id: id, visit_subtype: 'NEW_CONSULTATION', affected_eye: 'OD', workflow_status: 'CHECKED_IN', configuration_version_id: id, workflow_profile_version_id: id, version: 0 });
    const body = { ...initialIntake(context, null), complaint_configuration_version_id: id, emergency_configuration_version_id: id, complaint_codes: ['QA'], duration_value: 1, duration_unit: 'DAY', onset: 'SUDDEN', shared_medical_history_reviewed: true, shared_allergy_reviewed: true };
    const record = { ...Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'expected_version')), id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id, status: 'COMPLETED', version: 1, completed_by: id, completed_at: '2026-10-16T00:00:00Z', created_at: '2026-10-16T00:00:00Z', updated_at: '2026-10-16T00:00:00Z' };
    request.mockResolvedValue({ intake: record, alert: null });
    expect(await ophthalmologyApi.completeIntake(id, { expected_version: 0, expected_status: 'DRAFT', expected_context_version: 0 })).toMatchObject({ intake: { id, status: 'COMPLETED', version: 1 }, alert: null });
    expect(request).toHaveBeenCalledWith(`/opd/visits/${id}/ophthalmology/intake/complete`, { method: 'POST', body: { expected_version: 0, expected_status: 'DRAFT', expected_context_version: 0 } });
  });
  it('uploads multipart metadata before the file and retains the supplied idempotency key', async () => {
    request.mockResolvedValue({ id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id, task_id: id, result_id: null, patient_document_id: id, test_code: 'QA', laterality: 'OD', device_code: null, acquired_at: '2026-10-16T00:00:00Z', provenance: 'MANUAL_UPLOAD', checksum_sha256: 'a'.repeat(64), mime_type: 'application/pdf', file_size_bytes: 2, original_file_name: 'qa.pdf', review_state: 'PENDING', publication_state: 'INTERNAL', uploaded_by: id });
    const file = new File(['QA'], 'qa.pdf', { type: 'application/pdf' });
    const input = { task_id: id, result_id: null, title: 'QA report', acquired_at: '2026-10-16T00:00:00Z', file, key: 'qa-stable-upload-key' };
    await ophthalmologyApi.uploadAttachment(input);
    expect(request.mock.calls[0]?.[0]).toBe('/ophthalmology/attachments');
    expect(request.mock.calls[0]?.[1]?.headers).toEqual({ 'Idempotency-Key': 'qa-stable-upload-key' });
    const body: unknown = request.mock.calls[0]?.[1]?.body;
    if (!(body instanceof FormData)) throw new Error('Expected multipart body');
    expect([...body.keys()]).toEqual(['task_id', 'title', 'acquired_at', 'provenance', 'file']); expect(body.get('provenance')).toBe('MANUAL_UPLOAD');
  });
  it('requires a completed version and correction reason before an amendment request', async () => {
    await expect(ophthalmologyApi.amendResult(id, { expected_task_status: 'COMPLETED', expected_task_version: 1, expected_result_version: 1, form_type: 'LENSOMETRY', form_schema_version: 'QA', form_profile_version_id: id, performed_at: '2026-10-16T00:00:00Z', source_type: 'MANUAL_CORRECTION', reliability: 'GOOD', reliability_reason: null, comments: null, document_ids: [], payload: {}, reason: '' })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
