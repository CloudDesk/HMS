import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { DocumentsApi } from '../documents/documents-api';
import { patientPortalOverviewSchema } from './contracts';
import { resolveProfilePhoto } from './resolve-profile-photo';

const overview = patientPortalOverviewSchema.parse({
  patient: {
    id: 'patient-1', patient_number: 'TEST-1', first_name: 'Test', last_name: 'Patient',
    date_of_birth: '1990-01-01', gender: 'MALE', status: 'ACTIVE',
    created_at: '2026-01-01', profile_photo_url: null,
  },
  summary: {},
});

function setup(pages: unknown[]) {
  const authenticatedRequest = vi.fn();
  for (const page of pages) authenticatedRequest.mockResolvedValueOnce(page);
  const api = new DocumentsApi({ authenticatedRequest } as unknown as SessionManager);
  return { api, authenticatedRequest };
}

const document = {
  id: 'photo-1', patient_id: 'patient-1', document_type: 'OTHER', title: 'Profile photo',
  file_name: 'photo.jpg', mime_type: 'image/jpeg', file_size_bytes: 100,
  created_at: '2026-01-01', consent_kind: 'PROFILE_PHOTO',
};

describe('MyCare profile photo retrieval', () => {
  it('maps an existing portal photo document when the overview URL is null', async () => {
    const { api, authenticatedRequest } = setup([
      { data: [document], meta: { page: 1, limit: 100, total: 1 } },
    ]);
    const result = await resolveProfilePhoto(overview, api);
    expect(result.patient.profile_photo_url).toBe('/api/patient-portal/patients/patient-1/documents/photo-1/download');
    expect(authenticatedRequest).toHaveBeenCalledWith('/patient-portal/documents', expect.anything(), {
      query: { patient_id: 'patient-1', page: '1', limit: '100' },
    });
    expect(overview.patient.profile_photo_url).toBeNull();
  });

  it('preserves an existing URL without a document request', async () => {
    const { api, authenticatedRequest } = setup([]);
    const existing = { ...overview, patient: { ...overview.patient, profile_photo_url: '/api/photo' } };
    expect(await resolveProfilePhoto(existing, api)).toBe(existing);
    expect(authenticatedRequest).not.toHaveBeenCalled();
  });

  it('handles an omitted URL and follows document pagination', async () => {
    const { api, authenticatedRequest } = setup([
      { data: [{ ...document, consent_kind: null }], meta: { page: 1, limit: 1, total: 2 } },
      { data: [document], meta: { page: 2, limit: 1, total: 2 } },
    ]);
    const result = await resolveProfilePhoto({ ...overview, patient: { ...overview.patient, profile_photo_url: undefined } }, api);
    expect(result.patient.profile_photo_url).toContain('/documents/photo-1/download');
    expect(authenticatedRequest).toHaveBeenCalledTimes(2);
  });

  it('keeps initials when there is no profile photo document', async () => {
    const { api } = setup([
      { data: [{ ...document, consent_kind: null }], meta: { page: 1, limit: 100, total: 1 } },
    ]);
    expect(await resolveProfilePhoto(overview, api)).toBe(overview);
  });

  it('propagates retrieval failures to the existing profile retry state', async () => {
    const { api, authenticatedRequest } = setup([]);
    authenticatedRequest.mockRejectedValue(new Error('Unauthorized'));
    await expect(resolveProfilePhoto(overview, api)).rejects.toThrow('Unauthorized');
  });
});
