import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { RecordsApi } from './records-api';

describe('RecordsApi', () => {
  const sampleRecordsResponse = {
    laboratory_results: [
      {
        id: 'lab-01',
        result_items: [
          {
            serviceName: 'Serum Creatinine',
            value: '0.9',
            unit: 'mg/dL',
            referenceRange: '0.6 - 1.2',
            comments: null,
          },
        ],
        remarks: 'Normal renal function',
        entered_at: '2026-09-22T08:00:00.000Z',
        verified_at: '2026-09-22T09:30:00.000Z',
      },
    ],
    imaging_reports: [
      {
        id: 'img-01',
        findings: 'No focal consolidation. Normal cardiac size.',
        impression: 'Unremarkable chest radiograph.',
        recommendations: null,
        entered_at: '2026-09-22T10:00:00.000Z',
        verified_at: '2026-09-22T11:00:00.000Z',
      },
    ],
  };

  it('getRecords calls /patient-portal/overview without query when patientId is omitted', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleRecordsResponse),
    } as unknown as SessionManager;

    const api = new RecordsApi(mockSessionManager);
    const result = await api.getRecords();

    expect(result).toEqual(sampleRecordsResponse);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/overview',
      expect.anything(),
      undefined
    );
  });

  it('getRecords calls /patient-portal/overview with query patient_id when provided', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleRecordsResponse),
    } as unknown as SessionManager;

    const api = new RecordsApi(mockSessionManager);
    const result = await api.getRecords('dep-999');

    expect(result).toEqual(sampleRecordsResponse);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/patient-portal/overview',
      expect.anything(),
      { query: { patient_id: 'dep-999' } }
    );
  });

  it('throws when the server response does not match the schema', async () => {
    const invalidResponse = {
      laboratory_results: [{ id: 'lab-01' }], // missing required fields
      imaging_reports: [],
    };

    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(invalidResponse),
    } as unknown as SessionManager;

    const api = new RecordsApi(mockSessionManager);
    await expect(api.getRecords('pat-1')).rejects.toThrow();
  });
});
