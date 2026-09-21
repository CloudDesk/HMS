import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpdPatientTimelineModal } from './OpdPatientTimelineModal';
import { patientsApi } from '../../api/patients';

vi.mock('../../api/patients', () => ({
  patientsApi: {
    timeline: vi.fn(),
  },
}));

describe('OpdPatientTimelineModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
    // Clean up any portalled modal elements left in body
    document.querySelectorAll('.modal-overlay').forEach((el) => el.remove());
  });

  it('renders patient context, event cards, and has no bottom navigation/footer action bar', async () => {
    vi.mocked(patientsApi.timeline).mockResolvedValue({
      data: [
        {
          id: 'event-1',
          patient_id: 'pat-1',
          event_type: 'OPD_CONSULTATION_COMPLETED',
          title: 'Dental examination completed',
          description: 'OPD-2026-000058: Dental examination completed by Dr. Anderson James.',
          occurred_at: '2026-09-17T12:07:00Z',
          created_by: 'user-1',
          created_by_name: 'Anderson Anderson',
          created_at: '2026-09-17T12:07:00Z',
        },
        {
          id: 'event-2',
          patient_id: 'pat-1',
          event_type: 'OPD_VISIT_STATUS_UPDATED',
          title: 'OPD visit status updated',
          description: 'OPD-2026-000058 moved to in consultation.',
          occurred_at: '2026-09-17T11:51:00Z',
          created_by: 'user-1',
          created_by_name: 'Anderson Anderson',
          created_at: '2026-09-17T11:51:00Z',
        },
        {
          id: 'event-3', patient_id: 'pat-1', event_type: 'VITALS_RECORDED',
          title: 'Vitals recorded', description: 'BP 120/80', occurred_at: '2026-09-17T11:50:00Z',
          created_by: 'user-2', created_by_name: 'Nurse User', created_at: '2026-09-17T11:50:00Z',
        },
        {
          id: 'event-4', patient_id: 'pat-1', event_type: 'OPD_FOLLOW_UP_SCHEDULED',
          title: 'OPD follow-up scheduled', description: 'Review healing in seven days.', occurred_at: '2026-09-17T12:08:00Z',
          created_by: 'user-1', created_by_name: 'Anderson Anderson', created_at: '2026-09-17T12:08:00Z',
        },
      ],
      meta: { page: 1, limit: 100, total: 4, totalPages: 1 },
    });

    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <OpdPatientTimelineModal
            onClose={onClose}
            open={true}
            patientId="pat-1"
            patientName="Max Patient"
            patientNumber="HMS-2026-000022"
          />
        </QueryClientProvider>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(patientsApi.timeline).toHaveBeenCalledWith(
      'pat-1',
      { clinical_only: true, limit: 100 },
    );

    // Verify modal title and patient identity
    const modalBox = document.querySelector('.modal-box');
    expect(modalBox).not.toBeNull();
    expect(modalBox?.textContent).toContain('Doctor Clinical Timeline & Care Plan');
    expect(modalBox?.textContent).toContain('Max Patient');
    expect(modalBox?.textContent).toContain('HMS-2026-000022');

    // Verify timeline events rendered
    expect(modalBox?.textContent).toContain('Dental examination completed');
    expect(modalBox?.textContent).toContain('OPD follow-up scheduled');
    expect(modalBox?.textContent).toContain('Review healing in seven days.');
    expect(modalBox?.textContent).not.toContain('OPD visit status updated');
    expect(modalBox?.textContent).not.toContain('Vitals recorded');

    // Verify bottom action bar buttons are REMOVED:
    expect(modalBox?.querySelector('.modal-footer')).toBeNull();
    expect(modalBox?.textContent).not.toContain('Open Full EMR Timeline Page');
    // Ensure no bottom "Close" button (modal-close in header is acceptable)
    const buttons = Array.from(modalBox?.querySelectorAll('button') ?? []);
    const bottomCloseButton = buttons.find(
      (b) => b.textContent?.trim() === 'Close' && !b.classList.contains('modal-close'),
    );
    expect(bottomCloseButton).toBeUndefined();

    // Verify top-right X dismiss button is present and functional
    const topCloseBtn = modalBox?.querySelector('.modal-close') as HTMLButtonElement | null;
    expect(topCloseBtn).not.toBeNull();

    await act(async () => {
      topCloseBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
