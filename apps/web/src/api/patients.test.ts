import { beforeEach, describe, expect, it, vi } from 'vitest';
import { patientsApi } from './patients';
import { tokenStorage } from '../auth/token-storage';

describe('patient document multipart uploads', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tokenStorage.setTokens({ accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 900 });
  });

  it('places all consent metadata before the file part', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'document-1' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const file = new File(['consent'], 'consent.pdf', { type: 'application/pdf' });

    await patientsApi.uploadDocument('patient-1', {
      document_type: 'CONSENT',
      title: 'Treatment consent',
      consent_status: 'ATTACHED',
      consent_template_id: 'template-1',
      consent_category: 'Treatment',
      consent_version: 1,
      branch_id: 'branch-1',
      context_type: 'PATIENT',
      context_id: 'patient-1',
      signed_at: '2026-09-27',
      valid_until: '2027-09-27',
      signed_by_name: 'Mark P',
      file,
    });

    const body = fetchSpy.mock.calls[0]?.[1]?.body as FormData;
    const keys = [...body.keys()];
    expect(keys.at(-1)).toBe('file');
    expect(keys.slice(0, -1)).toEqual(expect.arrayContaining([
      'document_type',
      'title',
      'consent_template_id',
      'context_type',
      'context_id',
      'signed_at',
      'valid_until',
    ]));
  });
});
