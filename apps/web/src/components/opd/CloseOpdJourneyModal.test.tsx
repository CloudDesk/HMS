// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloseOpdJourneyModal } from './CloseOpdJourneyModal';
import type { OpdVisitResponse } from '../../api/opd';

const sampleVisit: OpdVisitResponse = {
  id: 'visit-123',
  visit_number: 'OPD-2026-0099',
  queue_token_number: 5,
  appointment_id: 'appt-123',
  patient_id: 'pt-123',
  patient_number: 'P-123',
  patient_name: 'Jane Doe',
  doctor_id: 'doc-123',
  doctor_name: 'Dr. Retina',
  doctor_specialization: 'Ophthalmology',
  branch_id: 'branch-123',
  department_id: 'dept-123',
  visit_date: '2026-10-26T00:00:00.000Z',
  check_in_time: '2026-10-26T09:00:00.000Z',
  visit_type: 'NEW_CONSULTATION',
  priority: 'ROUTINE',
  status: 'CLINICALLY_COMPLETED',
  version: 2,
  reason: null,
  notes: null,
  created_by: 'user-1',
  updated_by: 'user-1',
  created_at: '2026-10-26T09:00:00.000Z',
  updated_at: '2026-10-26T10:00:00.000Z',
};

describe('CloseOpdJourneyModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders patient information, status, and confirmation copy when open', async () => {
    await act(async () => {
      root.render(
        <CloseOpdJourneyModal
          open={true}
          visit={sampleVisit}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    const bodyText = document.body.textContent ?? '';
    expect(bodyText).toContain('Close OPD Journey');
    expect(bodyText).toContain('Jane Doe');
    expect(bodyText).toContain('OPD-2026-0099');
    expect(bodyText).toContain('Clinically Completed');
    expect(bodyText).toContain('Doctor clinical sign-off has been recorded');
    expect(bodyText).toContain('billing settlement and medication dispensing checks');
    expect(bodyText).toContain('Confirm & Close Journey');
  });

  it('renders nothing when closed or visit is null', async () => {
    await act(async () => {
      root.render(
        <CloseOpdJourneyModal
          open={false}
          visit={sampleVisit}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(document.body.textContent ?? '').toBe('');

    await act(async () => {
      root.render(
        <CloseOpdJourneyModal
          open={true}
          visit={null}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );
    });

    expect(document.body.textContent ?? '').toBe('');
  });
});
