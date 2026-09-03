import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppointmentModel } from './appointment.model.js';
import { AppointmentRepository } from './appointment.repository.js';

describe('AppointmentRepository dashboard summary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns authoritative status, follow-up, and urgent totals', async () => {
    vi.spyOn(AppointmentModel, 'aggregate').mockResolvedValue([{
      total: 12,
      statuses: [{ _id: 'SCHEDULED', count: 5 }, { _id: 'COMPLETED', count: 4 }],
      followUps: 3,
      urgent: 2,
    }]);

    const result = await new AppointmentRepository().dashboardSummary({}, undefined);

    expect(result.total).toBe(12);
    expect(result.by_status.SCHEDULED).toBe(5);
    expect(result.by_status.COMPLETED).toBe(4);
    expect(result.by_status.CANCELLED).toBe(0);
    expect(result.follow_ups).toBe(3);
    expect(result.urgent).toBe(2);
  });
});
