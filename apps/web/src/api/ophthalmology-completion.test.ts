import { beforeEach, describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiClient: { request } }));
import { deferralWriteSchema, finalizationSchema, ophthalmologyCompletionApi, overrideWriteSchema, readinessSchema } from './ophthalmology-completion';
const id = '111111111111111111111111'; const instant = '2026-10-16T00:00:00Z';
const head = () => ({ id, context_id: id, visit_id: id, patient_id: id, branch_id: id, department_id: id, status: 'OPEN', version: 2, deferrals: [], overrides: [], completions: [], amendment_episodes: [], created_at: instant, updated_at: instant });
describe('B5 completion metadata and controlled exceptions', () => {
  beforeEach(() => { request.mockReset(); });
  it('keeps a successful null history distinct from a failed history read', async () => {
    request.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Unavailable'));
    expect(await ophthalmologyCompletionApi.history(id)).toBeNull();
    await expect(ophthalmologyCompletionApi.history(id)).rejects.toThrow('Unavailable');
    expect(request).toHaveBeenCalledWith(`/opd/visits/${id}/ophthalmology/completion-history`, { signal: undefined });
  });
  it('requires a consistent typed readiness projection without inventing extra requirements', () => {
    const value = { ready: false, context_version: 1, consultation_version: 1, clinical_review_version: null, optical_prescription_version: null, configuration_version_id: id, configuration_revision: 1, requirements: [{ code: 'ALL_RESULTS_RESOLVED', satisfied: false, details: 'Review results', resource_ids: [id] }] };
    expect(readinessSchema.safeParse(value).success).toBe(true);
    expect(readinessSchema.safeParse({ ...value, ready: true }).success).toBe(false);
    expect(readinessSchema.safeParse({ ...value, requirements: [...value.requirements, ...value.requirements] }).success).toBe(false);
    expect(readinessSchema.safeParse({ ...value, requirements: [{ ...value.requirements[0], code: 'INVENTED_CHECK' }] }).success).toBe(false);
  });
  it('requires a plan or future date, valid doctor/source and a nonblank deferral reason', () => {
    const body = { expected_version: 2, source_type: 'TEST_TASK', source_id: id, responsible_doctor_id: id, reason: 'QA reason' };
    expect(deferralWriteSchema.safeParse(body).success).toBe(false);
    expect(deferralWriteSchema.safeParse({ ...body, review_plan: 'Review next visit' }).success).toBe(true);
    expect(deferralWriteSchema.safeParse({ ...body, due_at: '2000-01-01T00:00:00Z' }).success).toBe(false);
    expect(deferralWriteSchema.safeParse({ ...body, review_plan: 'Review', reason: '  ' }).success).toBe(false);
  });
  it('sends the original finalization version and source references unchanged', async () => {
    const body = { expected_version: 2, source_type: 'TEST_TASK' as const, source_id: id, responsible_doctor_id: id, reason: 'QA reason', review_plan: 'QA plan', due_at: null };
    request.mockResolvedValue(head()); await ophthalmologyCompletionApi.defer(id, body);
    expect(request).toHaveBeenCalledWith(`/opd/visits/${id}/ophthalmology/result-deferrals`, { method: 'POST', body });
  });
  it('requires a unique nonempty full unmet-code body and a reason for override', async () => {
    expect(overrideWriteSchema.safeParse({ expected_version: 2, expected_unmet_codes: [], reason: 'Reason' }).success).toBe(false);
    expect(overrideWriteSchema.safeParse({ expected_version: 2, expected_unmet_codes: ['ALL_RESULTS_RESOLVED', 'ALL_RESULTS_RESOLVED'], reason: 'Reason' }).success).toBe(false);
    const body = { expected_version: 2, expected_unmet_codes: ['ALL_RESULTS_RESOLVED' as const], reason: 'QA exception' };
    request.mockResolvedValue(head()); await ophthalmologyCompletionApi.override(id, body);
    expect(request).toHaveBeenCalledWith(`/opd/visits/${id}/ophthalmology/completion-overrides`, { method: 'POST', body });
  });
  it('excludes broad clinical/config snapshots and replay material from cached completion metadata', () => {
    const completion = { clinical_version: 1, configuration_version_id: id, configuration_revision: 1, consultation_version: 1, clinical_review_version: 1, optical_prescription_version: null, requirement_snapshot: [], approver_user_id: id, approver_doctor_id: id, approved_at: instant, supersedes_clinical_version: null, summary_snapshot: { previous_results: ['unfiltered history'] }, configuration_snapshot: { internal: 'unused' }, idempotency_key: 'do-not-retain', request_fingerprint: 'do-not-retain' };
    const parsed = finalizationSchema.parse({ ...head(), completions: [completion] });
    expect(parsed.completions[0]).not.toHaveProperty('summary_snapshot'); expect(parsed.completions[0]).not.toHaveProperty('configuration_snapshot'); expect(parsed.completions[0]).not.toHaveProperty('idempotency_key'); expect(parsed.completions[0]).not.toHaveProperty('request_fingerprint');
  });
  it('has no completion, reopening or untyped amendment writer while their safety contracts are incomplete', () => {
    expect(ophthalmologyCompletionApi).not.toHaveProperty('complete'); expect(ophthalmologyCompletionApi).not.toHaveProperty('reopen'); expect(ophthalmologyCompletionApi).not.toHaveProperty('amend'); expect(request).not.toHaveBeenCalled();
  });
});
