// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InpatientPatientDetailModal } from './InpatientPatientDetailModal';
import type { InpatientAdmission } from '../../api/inpatient-admissions';

const mockAdmission: InpatientAdmission = {
  id: 'adm-001',
  admission_number: 'IP-2026-000025',
  patient_id: 'pat-001',
  patient_number: 'HMS-2026-000025',
  patient_name: 'Ben Patient',
  branch_id: 'branch-1',
  ward_id: 'ward-1',
  ward_name: 'G101',
  bed_id: 'bed-002',
  bed_number: 'B02',
  admitting_doctor_id: 'doc-001',
  admitting_doctor_name: 'Dr. Anderson James',
  department_id: 'dept-001',
  department_name: 'General Medicine',
  admission_date: '2026-09-05T08:00:00.000Z',
  admission_type: 'INPATIENT',
  reason: 'Acute bacterial pneumonia',
  notes: null,
  status: 'ADMITTED',
  request_id: 'req-001',
  source_type: 'OPD_VISIT',
  source_id: 'visit-001',
  created_at: '2026-09-05T08:00:00.000Z',
  updated_at: '2026-09-05T08:00:00.000Z',
  discharge_summary: {
    hemodynamic_stability_24h: true,
    post_op_recovery_cleared: true,
    home_oral_med_converted: true,
    summary_finalized: false,
    notes: 'Patient stable for recovery',
    saved_at: '2026-09-06T10:00:00.000Z',
    saved_by: 'doc-001',
    saved_by_name: 'Dr. Anderson James',
  },
  discharged_at: null,
  discharged_by: null,
  discharged_by_name: null,
};

vi.mock('../../hooks/billing/useBilling', () => ({
  useBillingInvoices: () => ({
    data: { data: [] },
    isLoading: false,
  }),
}));

describe('InpatientPatientDetailModal role-based discharge visibility', () => {
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

  it('renders ONLY Discharge Readiness Checklist for DOCTOR / CLINICIAN_DOCTOR (Operational Discharge Clearance is absent from DOM)', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <InpatientPatientDetailModal
            open={true}
            onClose={vi.fn()}
            admission={mockAdmission}
            activeTab="discharge"
            setActiveTab={vi.fn()}
            calculateLOS={() => '1 day'}
            loading={{}}
            errors={{}}
            recommendations={[]}
            bookings={[]}
            roundNotes={[]}
            vitals={[]}
            diagnosticOrders={[]}
            onOpenScheduleSurgery={vi.fn()}
            onOpenAddRoundNote={vi.fn()}
            onOpenRecordVitals={vi.fn()}
            onOpenAddOrder={vi.fn()}
            showDischargeChecklist={true}
            showOperationalClearance={false}
            canSaveDischargeSummary={true}
            canFinalizeDischarge={false}
          />
        </QueryClientProvider>
      );
    });

    // Doctor view expectations
    expect(document.body.textContent).toContain('Discharge Readiness Checklist');
    expect(document.body.textContent).toContain('Clinical hemodynamic stability');
    expect(document.body.textContent).toContain('Save Discharge Summary');
    // Operational clearance must NOT be in DOM
    expect(document.body.textContent).not.toContain('Operational Discharge Clearance');
    expect(document.body.textContent).not.toContain('Finalize Discharge');
  });

  it('renders ONLY Operational Discharge Clearance for RECEPTIONIST (Discharge Readiness Checklist is absent from DOM)', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <InpatientPatientDetailModal
            open={true}
            onClose={vi.fn()}
            admission={mockAdmission}
            activeTab="discharge"
            setActiveTab={vi.fn()}
            calculateLOS={() => '1 day'}
            loading={{}}
            errors={{}}
            recommendations={[]}
            bookings={[]}
            roundNotes={[]}
            vitals={[]}
            diagnosticOrders={[]}
            onOpenScheduleSurgery={vi.fn()}
            onOpenAddRoundNote={vi.fn()}
            onOpenRecordVitals={vi.fn()}
            onOpenAddOrder={vi.fn()}
            showDischargeChecklist={false}
            showOperationalClearance={true}
            canSaveDischargeSummary={false}
            canFinalizeDischarge={true}
          />
        </QueryClientProvider>
      );
    });

    // Receptionist view expectations
    expect(document.body.textContent).toContain('Operational Discharge Clearance');
    expect(document.body.textContent).toContain('Clinical Readiness');
    expect(document.body.textContent).toContain('Finalize Discharge');
    // Doctor readiness checklist must NOT be in DOM
    expect(document.body.textContent).not.toContain('Discharge Readiness Checklist');
    expect(document.body.textContent).not.toContain('Save Discharge Summary');
    expect(document.body.textContent).not.toContain('Attending Doctor Notes / Summary');
  });

  it('renders BOTH sections for ADMINISTRATOR / SUPER_ADMIN', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <InpatientPatientDetailModal
            open={true}
            onClose={vi.fn()}
            admission={mockAdmission}
            activeTab="discharge"
            setActiveTab={vi.fn()}
            calculateLOS={() => '1 day'}
            loading={{}}
            errors={{}}
            recommendations={[]}
            bookings={[]}
            roundNotes={[]}
            vitals={[]}
            diagnosticOrders={[]}
            onOpenScheduleSurgery={vi.fn()}
            onOpenAddRoundNote={vi.fn()}
            onOpenRecordVitals={vi.fn()}
            onOpenAddOrder={vi.fn()}
            showDischargeChecklist={true}
            showOperationalClearance={true}
            canSaveDischargeSummary={true}
            canFinalizeDischarge={true}
          />
        </QueryClientProvider>
      );
    });

    expect(document.body.textContent).toContain('Discharge Readiness Checklist');
    expect(document.body.textContent).toContain('Operational Discharge Clearance');
  });
});
