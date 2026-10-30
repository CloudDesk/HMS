import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { OphthalmologyFollowUpSchedulingSection } from './OphthalmologyFollowUpSchedulingSection';

function props(): ComponentProps<typeof OphthalmologyFollowUpSchedulingSection> {
  return { followUp: null, followUpDate: '', setFollowUpDate: vi.fn(), followUpDoctorId: '', setFollowUpDoctorId: vi.fn(), followUpStartTime: '09:00', setFollowUpStartTime: vi.fn(), followUpDurationMinutes: '30', setFollowUpDurationMinutes: vi.fn(), followUpReason: '', setFollowUpReason: vi.fn(), followUpNotes: '', setFollowUpNotes: vi.fn(), doctors: [{ id: 'qa-doctor', display_name: 'QA Doctor' }], isVisitCompleted: false, updating: '', saveConsultationDraft: vi.fn(), scheduleFollowUp: vi.fn(), completeConsultation: vi.fn() };
}
describe('follow-up presentation preserves scheduling actions', () => {
  it('shows actual selections and preserves draft, date, time and completion callbacks', async () => {
    const p = props(); const container = document.createElement('div'); const root = createRoot(container);
    try {
      await act(async () => root.render(<OphthalmologyFollowUpSchedulingSection {...p} />));
      expect(container.textContent).not.toContain('Dr. Aravind');
      expect(container.textContent).toContain('Not selected');
      const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)?.click());
      await click('.oph-calendar-day-cell.current-month'); expect(p.setFollowUpDate).toHaveBeenCalledOnce();
      await click('.oph-time-slot-btn'); expect(p.setFollowUpStartTime).toHaveBeenCalledWith('09:00');
      await click('.oph-duration-btn'); expect(p.setFollowUpDurationMinutes).toHaveBeenCalledWith('15');
      await click('.oph-btn-save-draft'); expect(p.saveConsultationDraft).toHaveBeenCalledOnce();
      expect(container.querySelector<HTMLButtonElement>('.oph-btn-complete-consultation')?.disabled).toBe(true);
      await act(async () => root.render(<OphthalmologyFollowUpSchedulingSection {...p} followUpDate="2026-10-29" followUpDoctorId="qa-doctor" />));
      await click('.oph-btn-complete-consultation'); expect(p.completeConsultation).toHaveBeenCalledOnce();
    } finally { await act(async () => root.unmount()); }
  });
  it('retains scheduled read-only controls', async () => {
    const p = props(); const container = document.createElement('div'); const root = createRoot(container);
    try {
      await act(async () => root.render(<OphthalmologyFollowUpSchedulingSection {...p} followUp={{ status: 'SCHEDULED' }} />));
      expect(container.querySelector<HTMLButtonElement>('.oph-calendar-day-cell')?.disabled).toBe(true);
      expect(container.querySelector<HTMLSelectElement>('#oph-fu-doctor')?.disabled).toBe(true);
      expect(container.textContent).toContain('Follow-up Scheduled');
    } finally { await act(async () => root.unmount()); }
  });
});
