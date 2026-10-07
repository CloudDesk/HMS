// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagnosticOrder } from '../../api/laboratory';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('../../routing/navigation', () => ({ navigate }));
vi.mock('../../api/useSettings', () => ({
  useTimezone: () => 'Asia/Kolkata',
  getGlobalDateFormat: () => 'YYYY-MM-DD',
}));

import { DiagnosticQueue } from './DiagnosticQueue';

const mockOrders: DiagnosticOrder[] = [
  {
    id: 'order-1',
    originating_order_id: 'orig-1',
    source_type: 'OPD',
    encounter_id: 'enc-1',
    admission_id: null,
    procedure_id: null,
    visit_id: 'vis-1',
    consultation_id: 'con-1',
    patient_id: 'pat-1',
    patient_number: 'MRN-001',
    patient_name: 'Zack Taylor',
    doctor_id: 'doc-1',
    doctor_name: 'Dr. John Watson',
    branch_id: 'branch-1',
    order_type: 'LABORATORY',
    status: 'SUBMITTED',
    priority: 'ROUTINE',
    destination: null,
    specimen_type: null,
    items: [{ id: 'item-1', service_id: 'srv-1', service_name: 'Complete Blood Count (CBC)', investigation_name: 'CBC', category: 'Hematology' }],
    clinical_notes: null,
    instructions: null,
    submitted_at: '2026-10-01T10:00:00Z',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  },
  {
    id: 'order-2',
    originating_order_id: 'orig-2',
    source_type: 'EMERGENCY',
    encounter_id: 'enc-2',
    admission_id: null,
    procedure_id: null,
    visit_id: 'vis-2',
    consultation_id: 'con-2',
    patient_id: 'pat-2',
    patient_number: 'MRN-002',
    patient_name: 'Alice Brown',
    doctor_id: 'doc-2',
    doctor_name: 'Dr. Anderson James',
    branch_id: 'branch-1',
    order_type: 'LABORATORY',
    status: 'IN_PROGRESS',
    priority: 'STAT',
    destination: null,
    specimen_type: null,
    items: [{ id: 'item-2', service_id: 'srv-2', service_name: 'Basic Metabolic Panel (BMP)', investigation_name: 'BMP', category: 'Biochemistry' }],
    clinical_notes: null,
    instructions: null,
    submitted_at: '2026-10-02T08:00:00Z',
    created_at: '2026-10-02T08:00:00Z',
    updated_at: '2026-10-02T08:00:00Z',
  },
  {
    id: 'order-3',
    originating_order_id: 'orig-3',
    source_type: 'IP_ADMISSION',
    encounter_id: 'enc-3',
    admission_id: 'adm-1',
    procedure_id: null,
    visit_id: 'vis-3',
    consultation_id: 'con-3',
    patient_id: 'pat-3',
    patient_number: 'MRN-003',
    patient_name: 'Charlie Davis',
    doctor_id: 'doc-3',
    doctor_name: 'Dr. Gregory House',
    branch_id: 'branch-1',
    order_type: 'LABORATORY',
    status: 'VERIFIED',
    priority: 'URGENT',
    destination: null,
    specimen_type: null,
    items: [{ id: 'item-3', service_id: 'srv-3', service_name: 'Lipid Profile', investigation_name: 'Lipid', category: 'Biochemistry' }],
    clinical_notes: null,
    instructions: null,
    submitted_at: '2026-10-02T09:00:00Z',
    created_at: '2026-10-02T09:00:00Z',
    updated_at: '2026-10-02T09:00:00Z',
  },
];

describe('DiagnosticQueue', () => {
  let container: HTMLDivElement;
  let root: Root;

  const defaultProps = {
    module: 'laboratory' as const,
    statuses: ['SUBMITTED', 'IN_PROGRESS', 'VERIFIED'],
    orders: mockOrders,
    meta: { page: 1, limit: 10, total: 3, totalPages: 1 },
    summary: { total: 3, by_status: { SUBMITTED: 1, IN_PROGRESS: 1, VERIFIED: 1 } },
    isLoading: false,
    isError: false,
    isSummaryLoading: false,
    branches: [{ id: 'branch-1', name: 'Main Clinic' }],
    filters: {
      selectedBranch: 'branch-1',
      search: '',
      status: '',
      priority: '',
      dateFrom: '',
      dateTo: '',
      page: 1,
      limit: 10,
    },
    updateFilters: vi.fn(),
    clearFilters: vi.fn(),
  };

  beforeEach(() => {
    navigate.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders all columns, badges, patient MRN, and source labels correctly', async () => {
    await act(async () => root.render(<DiagnosticQueue {...defaultProps} />));

    // Verify column headers
    const ths = Array.from(container.querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(ths[0]).toContain('Patient');
    expect(ths[1]).toContain('Source');
    expect(ths[2]).toContain('Services');
    expect(ths[3]).toContain('Doctor');
    expect(ths[4]).toContain('Submitted');
    expect(ths[5]).toContain('Priority');
    expect(ths[6]).toContain('Status');
    expect(ths[7]).toContain('Actions');

    // Verify patient details and MRN
    expect(container.textContent).toContain('Zack Taylor');
    expect(container.textContent).toContain('MRN-001');
    expect(container.textContent).toContain('Alice Brown');
    expect(container.textContent).toContain('MRN-002');

    // Verify source badges
    expect(container.textContent).toContain('OPD Consultation');
    expect(container.textContent).toContain('Emergency');
    expect(container.textContent).toContain('IP / Admission');

    // Verify priority badges
    expect(container.querySelector('.priority-routine')).not.toBeNull();
    expect(container.querySelector('.priority-stat')).not.toBeNull();
    expect(container.querySelector('.priority-urgent')).not.toBeNull();

    // Verify actions
    const workspaceBtns = container.querySelectorAll('button[title="Open workspace"]');
    expect(workspaceBtns.length).toBe(3);

    // Results buttons for IN_PROGRESS and VERIFIED
    const reportBtns = container.querySelectorAll('button[title="Open result/report"]');
    expect(reportBtns.length).toBe(2);

    await act(async () => (workspaceBtns[0] as HTMLButtonElement).click());
    expect(navigate).toHaveBeenCalledWith('/laboratory/workspace?id=order-1');
  });

  it('sorts orders ascending and descending when header is clicked', async () => {
    await act(async () => root.render(<DiagnosticQueue {...defaultProps} />));

    const patientTh = container.querySelector('.col-patient-th') as HTMLElement;
    expect(patientTh).not.toBeNull();

    // Click to sort ascending by patient name
    await act(async () => patientTh.click());
    let rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows[0]?.textContent).toContain('Alice Brown');
    expect(rows[1]?.textContent).toContain('Charlie Davis');
    expect(rows[2]?.textContent).toContain('Zack Taylor');

    // Click again to sort descending by patient name
    await act(async () => patientTh.click());
    rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows[0]?.textContent).toContain('Zack Taylor');
    expect(rows[1]?.textContent).toContain('Charlie Davis');
    expect(rows[2]?.textContent).toContain('Alice Brown');
  });

  it('sorts by priority rank correctly', async () => {
    await act(async () => root.render(<DiagnosticQueue {...defaultProps} />));

    const priorityTh = container.querySelector('.col-priority-th') as HTMLElement;
    expect(priorityTh).not.toBeNull();

    // Click to sort ascending (ROUTINE < URGENT < STAT)
    await act(async () => priorityTh.click());
    let rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows[0]?.textContent).toContain('ROUTINE');
    expect(rows[1]?.textContent).toContain('URGENT');
    expect(rows[2]?.textContent).toContain('STAT');

    // Click again to sort descending (STAT > URGENT > ROUTINE)
    await act(async () => priorityTh.click());
    rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows[0]?.textContent).toContain('STAT');
    expect(rows[1]?.textContent).toContain('URGENT');
    expect(rows[2]?.textContent).toContain('ROUTINE');
  });

  it('renders loading state with MedicalLoader', async () => {
    await act(async () => root.render(<DiagnosticQueue {...defaultProps} isLoading orders={[]} />));
    expect(container.textContent).toContain('Loading laboratory orders...');
  });

  it('renders empty state when orders list is empty', async () => {
    await act(async () => root.render(<DiagnosticQueue {...defaultProps} orders={[]} />));
    expect(container.textContent).toContain('No submitted orders match these filters.');
  });

  it('renders Imaging queue with OPD_VISIT, EMERGENCY_ENCOUNTER and navigates to imaging routes', async () => {
    const imagingOrders: DiagnosticOrder[] = [
      {
        ...mockOrders[0]!,
        id: 'img-1',
        order_type: 'IMAGING',
        source_type: 'OPD_VISIT',
        items: [{ id: 'it-1', service_id: 's-1', service_name: 'Dental IOPA X-Ray, OPG Dental X-Ray', investigation_name: 'OPG', category: 'Dental' }],
        status: 'REPORT_ENTERED',
      },
      {
        ...mockOrders[1]!,
        id: 'img-2',
        order_type: 'IMAGING',
        source_type: 'EMERGENCY_ENCOUNTER',
        items: [{ id: 'it-2', service_id: 's-2', service_name: 'B-Scan Ocular Ultrasound', investigation_name: 'B-Scan', category: 'Ultrasound' }],
        status: 'IN_PROGRESS',
      },
    ];

    await act(async () => root.render(
      <DiagnosticQueue
        {...defaultProps}
        module="imaging"
        orders={imagingOrders}
        statuses={['SUBMITTED', 'IN_PROGRESS', 'REPORT_ENTERED', 'VERIFIED', 'COMPLETED']}
      />
    ));

    expect(container.textContent).toContain('Imaging Queue');
    expect(container.textContent).toContain('OPD Visit');
    expect(container.textContent).toContain('Emergency Encounter');
    expect(container.textContent).toContain('Dental IOPA X-Ray, OPG Dental X-Ray');
    expect(container.textContent).toContain('B-Scan Ocular Ultrasound');
    expect(container.querySelector('.source-opd-visit')).not.toBeNull();
    expect(container.querySelector('.source-emergency-encounter')).not.toBeNull();

    // Verify Imaging navigation
    const reportBtns = container.querySelectorAll('button[title="Open result/report"]');
    expect(reportBtns.length).toBe(2);
    await act(async () => (reportBtns[0] as HTMLButtonElement).click());
    expect(navigate).toHaveBeenCalledWith('/imaging/reports?id=img-1');

    const workspaceBtns = container.querySelectorAll('button[title="Open workspace"]');
    await act(async () => (workspaceBtns[1] as HTMLButtonElement).click());
    expect(navigate).toHaveBeenCalledWith('/imaging/workspace?id=img-2');
  });

  it('renders balanced column widths totaling 100% and accessible action buttons', async () => {
    await act(async () => root.render(<DiagnosticQueue {...defaultProps} />));

    const patientCol = container.querySelector('col.col-patient');
    const sourceCol = container.querySelector('col.col-source');
    const servicesCol = container.querySelector('col.col-services');
    const doctorCol = container.querySelector('col.col-doctor');
    const submittedCol = container.querySelector('col.col-submitted');
    const priorityCol = container.querySelector('col.col-priority');
    const statusCol = container.querySelector('col.col-status');
    const actionsCol = container.querySelector('col.col-actions');

    expect(patientCol?.getAttribute('style')).toContain('width: 15%');
    expect(sourceCol?.getAttribute('style')).toContain('width: 11%');
    expect(servicesCol?.getAttribute('style')).toContain('width: 20%');
    expect(doctorCol?.getAttribute('style')).toContain('width: 13%');
    expect(submittedCol?.getAttribute('style')).toContain('width: 12%');
    expect(priorityCol?.getAttribute('style')).toContain('width: 8%');
    expect(statusCol?.getAttribute('style')).toContain('width: 11%');
    expect(actionsCol?.getAttribute('style')).toContain('width: 10%');

    const workspaceBtn = container.querySelector('.action-icon-workspace') as HTMLButtonElement;
    expect(workspaceBtn).not.toBeNull();
    expect(workspaceBtn.getAttribute('aria-label')).toBe('Open laboratory workspace');
    expect(workspaceBtn.getAttribute('title')).toBe('Open workspace');
  });
});
