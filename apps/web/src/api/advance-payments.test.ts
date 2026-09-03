import { describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { advancePaymentApi } from './advance-payments';

describe('advancePaymentApi endpoints', () => {
  it('calls GET /advance-payments with query parameters', async () => {
    const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValueOnce({
      id: 'adv-1',
      patient_id: 'pat-1',
      source_type: 'ADMISSION_REQUEST',
      source_id: 'admission-1',
      branch_id: 'branch-1',
      required_amount: 5000,
      paid_amount: 2000,
      balance_amount: 3000,
      requirement_status: 'REQUIRED',
      payment_status: 'PARTIALLY_PAID',
      created_by: null,
      updated_by: null,
      created_at: '2026-09-02T00:00:00.000Z',
      updated_at: '2026-09-02T00:00:00.000Z',
    });

    await advancePaymentApi.get('ADMISSION_REQUEST', 'admission-1');

    expect(requestSpy).toHaveBeenCalledWith(
      '/advance-payments?source_type=ADMISSION_REQUEST&source_id=admission-1',
    );
  });

  it('calls POST /advance-payments/sync with payload', async () => {
    const requestSpy = vi.spyOn(apiClient, 'request').mockResolvedValueOnce({
      id: 'adv-1',
    });

    const payload = {
      patient_id: 'pat-1',
      source_type: 'ADMISSION_REQUEST' as const,
      source_id: 'admission-1',
      branch_id: 'branch-1',
      required_amount: 5000,
      requirement_status: 'REQUIRED' as const,
    };

    await advancePaymentApi.sync(payload);

    expect(requestSpy).toHaveBeenCalledWith('/advance-payments/sync', {
      method: 'POST',
      body: payload,
    });
  });
});
