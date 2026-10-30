import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OphthalmologyFollowUpSchedulingSection } from './OphthalmologyFollowUpSchedulingSection';

function props(): ComponentProps<typeof OphthalmologyFollowUpSchedulingSection> {
  return { followUp: null, followUpDate: '', setFollowUpDate: vi.fn(), followUpDoctorId: '', setFollowUpDoctorId: vi.fn(), followUpStartTime: '09:00', setFollowUpStartTime: vi.fn(), followUpDurationMinutes: '30', setFollowUpDurationMinutes: vi.fn(), followUpReason: '', setFollowUpReason: vi.fn(), followUpNotes: '', setFollowUpNotes: vi.fn(), doctors: [{ id: 'qa-doctor', display_name: 'QA Doctor' }], isVisitCompleted: false, updating: '', saveConsultationDraft: vi.fn(), scheduleFollowUp: vi.fn(), completeConsultation: vi.fn() };
}
describe('follow-up presentation preserves scheduling actions', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime(new Date('2026-10-30T06:15:00Z')); });
  afterEach(() => vi.useRealTimers());
  it('shows actual selections and preserves draft, date, time and completion callbacks', async () => {
    const p = props(); const container = document.createElement('div'); const root = createRoot(container);
    try {
      await act(async () => root.render(<OphthalmologyFollowUpSchedulingSection {...p} />));
      expect(container.textContent).not.toContain('Dr. Aravind');
      expect(container.textContent).toContain('Not selected');
      const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)?.click());
      await click('.oph-calendar-day-cell.current-month:not(:disabled)'); expect(p.setFollowUpDate).toHaveBeenCalledOnce();
      await act(async () => root.render(<OphthalmologyFollowUpSchedulingSection {...p} timezone="Africa/Nairobi" followUpDate="2026-10-31" />));
      await click('.oph-time-slot-btn'); expect(p.setFollowUpStartTime).toHaveBeenCalledWith('09:00');
      await click('.oph-duration-btn'); expect(p.setFollowUpDurationMinutes).toHaveBeenCalledWith('15');
      await click('.oph-btn-save-draft'); expect(p.saveConsultationDraft).toHaveBeenCalledOnce();
      expect(container.querySelector<HTMLButtonElement>('.oph-btn-complete-consultation')?.disabled).toBe(true);
      await act(async () => root.render(<OphthalmologyFollowUpSchedulingSection {...p} timezone="Africa/Nairobi" followUpDate="2026-10-31" followUpDoctorId="qa-doctor" />));
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
  it('disables past days and elapsed slots today, including when a slot expires while open', async () => {
    const p = props(); const container = document.createElement('div'); const root = createRoot(container);
    try {
      await act(async () => root.render(<OphthalmologyFollowUpSchedulingSection {...p} timezone="Africa/Nairobi" followUpDate="2026-10-30" followUpStartTime="09:30" followUpDoctorId="qa-doctor" />));
      const day = (date: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${date}"]`);
      const slot = (time: string) => [...container.querySelectorAll<HTMLButtonElement>('.oph-time-slot-btn')].find((button) => button.textContent === time);
      expect(day('2026-10-29')?.disabled).toBe(true);
      expect(day('2026-10-30')?.disabled).toBe(false);
      expect(slot('09:00')?.disabled).toBe(true);
      expect(slot('09:30')?.disabled).toBe(false);
      await act(async () => slot('09:00')?.click());
      expect(p.setFollowUpStartTime).not.toHaveBeenCalled();
      expect(container.querySelector<HTMLButtonElement>('.oph-btn-complete-consultation')?.disabled).toBe(false);
      await act(async () => vi.advanceTimersByTime(15 * 60 * 1000));
      expect(slot('09:30')?.disabled).toBe(true);
      expect(container.querySelector<HTMLButtonElement>('.oph-btn-complete-consultation')?.disabled).toBe(true);
    } finally { await act(async () => root.unmount()); }
  });
  it('uses the hospital date at a timezone day boundary', async () => {
    vi.setSystemTime(new Date('2026-10-30T22:15:00Z'));
    const container = document.createElement('div'); const root = createRoot(container);
    try {
      await act(async () => root.render(<OphthalmologyFollowUpSchedulingSection {...props()} timezone="Africa/Nairobi" followUpDate="2026-10-31" />));
      expect(container.querySelector<HTMLButtonElement>('[aria-label="2026-10-30"]')?.disabled).toBe(true);
      expect(container.querySelector<HTMLButtonElement>('[aria-label="2026-10-31"]')?.disabled).toBe(false);
    } finally { await act(async () => root.unmount()); }
  });
});
