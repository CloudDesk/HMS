// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpdFollowUpTab, type OpdFollowUpTabProps } from './OpdFollowUpTab';

describe('OpdFollowUpTab', () => {
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
  });

  const renderTab = async (overrides: Partial<OpdFollowUpTabProps> = {}) => {
    const props: OpdFollowUpTabProps = {
      followUp: null,
      followUpDate: '',
      setFollowUpDate: vi.fn(),
      followUpDoctorId: '',
      setFollowUpDoctorId: vi.fn(),
      followUpStartTime: '09:00',
      setFollowUpStartTime: vi.fn(),
      followUpDurationMinutes: '30',
      setFollowUpDurationMinutes: vi.fn(),
      doctors: [],
      isVisitCompleted: false,
      updating: '',
      saveConsultationDraft: vi.fn(),
      scheduleFollowUp: vi.fn(),
      completeConsultation: vi.fn(),
      ...overrides,
    };
    await act(async () => root.render(<OpdFollowUpTab {...props} />));
    return props;
  };

  it('allows consultation completion without forcing a follow-up appointment', async () => {
    const props = await renderTab();
    const button = Array.from(container.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Complete Consultation'),
    );

    expect(button).toBeDefined();
    expect(button?.disabled).toBe(false);
    await act(async () => button?.click());
    expect(props.completeConsultation).toHaveBeenCalledOnce();
    expect(props.scheduleFollowUp).not.toHaveBeenCalled();
  });

  it('requires a date and doctor when scheduling follow-up for a completed visit', async () => {
    await renderTab({ isVisitCompleted: true });
    const button = Array.from(container.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Schedule Follow-up'),
    );

    expect(button).toBeDefined();
    expect(button?.disabled).toBe(true);
  });
});
