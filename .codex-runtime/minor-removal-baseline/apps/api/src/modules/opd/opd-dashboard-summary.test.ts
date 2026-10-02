import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpdVisitModel } from './opd-visit.model.js';
import { OpdVisitRepository } from './opd-visit.repository.js';

describe('OpdVisitRepository dashboard summary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns authoritative nursing, reception, and doctor workload totals', async () => {
    vi.spyOn(OpdVisitModel, 'aggregate').mockResolvedValue([{
      total: 10,
      statuses: [
        { _id: 'CHECKED_IN', count: 2 },
        { _id: 'WAITING_FOR_VITALS', count: 3 },
        { _id: 'READY_FOR_CONSULTATION', count: 2 },
        { _id: 'IN_CONSULTATION', count: 1 },
      ],
      followUps: 2,
      walkIns: 4,
      urgent: 1,
    }]);

    const result = await new OpdVisitRepository().dashboardSummary({}, undefined);

    expect(result.total).toBe(10);
    expect(result.by_status.CHECKED_IN + result.by_status.WAITING_FOR_VITALS).toBe(5);
    expect(result.by_status.READY_FOR_CONSULTATION).toBe(2);
    expect(result.follow_ups).toBe(2);
    expect(result.walk_ins).toBe(4);
    expect(result.urgent).toBe(1);
  });
});
