import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OphthalmologyConsultationSummaryCard } from './OphthalmologyConsultationSummaryCard';

function feature(summary: Record<string, unknown>): ComponentProps<typeof OphthalmologyConsultationSummaryCard>['feature'] {
  return { summaryQuery: { data: { finalization: null, summary }, isLoading: false, isError: false, error: null, refetch: vi.fn() } };
}

describe('clinical summary source statuses', () => {
  it('shows pending source records without claiming scheduling, dispensing or journey completion', () => {
    const html = renderToStaticMarkup(<OphthalmologyConsultationSummaryCard feature={feature({
      medication_prescriptions: [{ id: 'rx', status: 'SUBMITTED' }],
      follow_ups: [{ id: 'follow-up', status: 'DRAFT', appointment_id: null }],
      referrals: [{ id: 'referral', status: 'SUBMITTED' }],
      procedure_recommendations: [{ id: 'procedure', status: 'ACTIVE' }],
    })} />);
    expect(html).toContain('Clinical Sign-off Status');
    expect(html).toContain('Clinical sign-off does not confirm downstream fulfillment');
    expect(html).toContain('Source status: DRAFT');
    expect(html).toContain('Source status: SUBMITTED');
    expect(html).toContain('Dispensing must be checked in Pharmacy');
    expect(html).not.toContain('Follow-up Scheduled');
    expect(html).not.toContain('patient journey completed');
    expect(html).toContain('Billing &amp; Invoicing');
    expect(html).toContain('no automated charge mapping is confirmed');
  });

  it('shows a validated source trace and the actual scheduling status without inferring care delivered', () => {
    const html = renderToStaticMarkup(<OphthalmologyConsultationSummaryCard feature={feature({
      emergency_source: { encounter_number: 'ER-001', emergency_encounter_id: 'er-id', appointment_id: 'appointment-id', visit_id: 'opd-id', patient_id: 'patient-id' },
      follow_ups: [{ id: 'follow-up', status: 'SCHEDULED', appointment_id: 'follow-up-appointment' }],
      medication_prescriptions: [{ id: 'rx', status: 'DISPENSED' }],
      procedure_recommendations: [{ id: 'procedure', status: 'BOOKED', booking_id: 'booking', booking_status: 'COMPLETED' }],
    })} />);
    expect(html).toContain('ER-001'); expect(html).toContain('opd-id');
    expect(html).toContain('Source status: SCHEDULED');
    expect(html).toContain('not proof of care delivered');
    expect(html).toContain('Source status: DISPENSED'); expect(html).toContain('Booking status: COMPLETED');
  });

  it('renders billing invoices table when real invoices are retrieved', () => {
    const html = renderToStaticMarkup(<OphthalmologyConsultationSummaryCard feature={feature({
      invoices: [{
        invoiceNumber: 'INV-OPHTH-2026-001',
        status: 'PAID',
        totalAmount: 1500,
        paidAmount: 1500,
        balanceAmount: 0,
        invoiceDate: '2026-10-22T08:00:00.000Z',
      }],
    })} />);
    expect(html).toContain('Billing &amp; Invoicing');
    expect(html).toContain('INV-OPHTH-2026-001');
    expect(html).toContain('PAID');
    expect(html).toContain('1500.00');
  });

  it('renders structured actions and labels historical classifications explicitly', () => {
    const html = renderToStaticMarkup(<OphthalmologyConsultationSummaryCard feature={feature({ clinical_review: { current: {
      clinical_summary: 'Reviewed', treatment_plans: [
        { diagnosis_code: 'QA', diagnosis_laterality: 'OD', treatment: 'Drops', action_type: 'MEDICATION', legacy_category: null, priority: 'ROUTINE', status: 'ACTIVE' },
        { diagnosis_code: 'QB', diagnosis_laterality: 'OS', treatment: 'Observe', action_type: null, legacy_category: 'OBSERVATION', priority: 'ROUTINE', status: 'CANCELLED' },
      ],
    } } })} />);
    expect(html).toContain('<th>Action</th>'); expect(html).toContain('MEDICATION'); expect(html).toContain('Legacy: OBSERVATION'); expect(html).not.toContain('<th>Category</th>');
  });

  it('hides stale source statuses on failure and retries the existing summary query', async () => {
    const f = feature({ follow_ups: [{ id: 'follow-up', status: 'SCHEDULED' }] });
    f.summaryQuery.isError = true;
    f.summaryQuery.error = new Error('Review conflicting Emergency source records');
    const container = document.createElement('div'); const root = createRoot(container);
    try {
      await act(async () => root.render(<OphthalmologyConsultationSummaryCard feature={f} />));
      expect(container.textContent).toContain('Failed to load');
      expect(container.textContent).toContain('Review conflicting Emergency source records');
      expect(container.textContent).not.toContain('SCHEDULED');
      await act(async () => container.querySelector('button')?.click());
      expect(f.summaryQuery.refetch).toHaveBeenCalledOnce();
    } finally { await act(async () => root.unmount()); }
  });
});
