// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const encounter = {
  id: 'encounter-1',
  encounter_number: 'ER-0001',
  emergency_identifier: 'ER-ID-1',
  branch_id: 'branch-1',
  department_id: 'department-1',
  patient_id: 'patient-1',
  patient_number: 'MRN-0001',
  patient_name: 'Emergency Patient',
  provisional_identity: null,
  arrival_mode: 'AMBULANCE',
  arrival_at: '2026-08-29T10:00:00.000Z',
  chief_complaint: 'Chest pain',
  arrival_notes: null,
  status: 'WAITING_FOR_TRIAGE',
  version: 1,
  triage: null,
  priority_history: [],
  queue_history: [],
  assigned_doctor_id: null,
  assigned_doctor_name: null,
  consultation: null,
  referral: null,
  orders: [],
  disposition: null,
  inpatient_admission_id: null,
  converted_to_ip_at: null,
  converted_to_ip_by: null,
  created_at: '2026-08-29T10:00:00.000Z',
  updated_at: '2026-08-29T10:00:00.000Z',
};

const testState = vi.hoisted(() => ({
  selected: null as typeof encounter | null,
  loading: false,
  error: null as Error | null,
  triageMutation: vi.fn(async () => encounter),
  capabilities: {
    viewEncounters: true,
    editEncounters: true,
    register: true,
    linkPatient: true,
    viewTriage: true,
    assessTriage: true,
    overridePriority: true,
    viewConsultation: true,
    editConsultation: true,
    viewOrders: true,
    createOrders: true,
    viewDisposition: true,
    markNoShow: true,
    markLeft: true,
    cancel: true,
    discharge: true,
    transfer: true,
    admit: true,
    viewDocuments: true,
    createDocuments: true,
    viewReferral: true,
  },
}));

vi.mock('../hooks/emergency/useEmergencyWorkspaceFeature', () => ({
  useEmergencyWorkspaceFeature: () => ({
    state: {
      branchId: 'branch-1',
      selected: testState.selected,
      encounters: testState.selected ? [testState.selected] : [],
      availableMedicines: [],
      labServices: [],
      imagingServices: [],
      services: [],
      departments: [],
      doctors: [],
      patients: [],
      loading: testState.loading,
      error: testState.error,
      capabilities: testState.capabilities,
      pending: {
        triage: false,
        consultation: false,
        order: false,
        referral: false,
        disposition: false,
        linkPatient: false,
        overridePriority: false,
      },
    },
    actions: {
      setPatientSearch: vi.fn(),
      saveTriage: vi.fn(),
      saveConsultation: vi.fn(),
      submitOrder: vi.fn(),
      submitReferral: vi.fn(),
      completeDisposition: vi.fn(),
      linkPatient: vi.fn(),
      overridePriority: vi.fn(),
      openQueue: vi.fn(),
    },
    mutations: {
      triage: { isPending: false, mutateAsync: testState.triageMutation },
      consultation: { isPending: false, mutateAsync: vi.fn() },
      order: { isPending: false, mutateAsync: vi.fn() },
      referral: { isPending: false, mutateAsync: vi.fn() },
      disposition: { isPending: false, mutateAsync: vi.fn() },
      linkPatient: { isPending: false, mutateAsync: vi.fn() },
      overridePriority: { isPending: false, mutateAsync: vi.fn() },
      call: { isPending: false, mutateAsync: vi.fn() },
      create: { isPending: false, mutateAsync: vi.fn() },
      reasonAction: { isPending: false, mutateAsync: vi.fn() },
    },
  }),
}));

import { EmergencyWorkspacePage } from './EmergencyWorkspacePage';

describe('EmergencyWorkspacePage feature-hook rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    testState.selected = encounter;
    testState.loading = false;
    testState.error = null;
    testState.triageMutation.mockClear();
    testState.capabilities = {
      viewEncounters: true,
      editEncounters: true,
      register: true,
      linkPatient: true,
      viewTriage: true,
      assessTriage: true,
      overridePriority: true,
      viewConsultation: true,
      editConsultation: true,
      viewOrders: true,
      createOrders: true,
      viewDisposition: true,
      markNoShow: true,
      markLeft: true,
      cancel: true,
      discharge: true,
      transfer: true,
      admit: true,
      viewDocuments: true,
      createDocuments: true,
      viewReferral: true,
    };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the selected patient and encounter context supplied by the feature hook', async () => {
    await act(async () => root.render(<EmergencyWorkspacePage />));

    expect(container.textContent).toContain('Emergency Workspace');
    expect(container.textContent).toContain('Emergency Patient');
    expect(container.textContent).toContain('MRN-0001');
    expect(container.textContent).toContain('Chest pain');
  });

  it('preserves the no-selection state while feature data is unavailable', async () => {
    testState.selected = null;
    testState.loading = true;
    testState.error = new Error('Emergency encounter unavailable.');

    await act(async () => root.render(<EmergencyWorkspacePage />));

    expect(container.textContent).toContain('No Emergency Case Selected');
    expect(container.textContent).toContain('Open Emergency Queue');
  });

  it('renders only administrative intake tabs for receptionist permissions', async () => {
    testState.capabilities = {
      viewEncounters: true,
      editEncounters: false,
      register: true,
      linkPatient: true,
      viewTriage: true,
      assessTriage: false,
      overridePriority: false,
      viewConsultation: false,
      editConsultation: false,
      viewOrders: false,
      createOrders: false,
      viewDisposition: false,
      markNoShow: true,
      markLeft: false,
      cancel: true,
      discharge: false,
      transfer: false,
      admit: false,
      viewDocuments: true,
      createDocuments: true,
      viewReferral: false,
    };

    await act(async () => root.render(<EmergencyWorkspacePage />));

    const tabButtons = Array.from(container.querySelectorAll('.segmented-control button')).map(
      (b) => b.textContent || '',
    );

    expect(tabButtons.some((t) => t.includes('Registration'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Documents'))).toBe(true);

    // Clinical tabs must NOT be present for receptionist
    expect(tabButtons.some((t) => t.includes('Triage'))).toBe(false);
    expect(tabButtons.some((t) => t.includes('Consultation'))).toBe(false);
    expect(tabButtons.some((t) => t.includes('Treatment'))).toBe(false);
    expect(tabButtons.some((t) => t.includes('Medication'))).toBe(false);
    expect(tabButtons.some((t) => t.includes('Lab Orders'))).toBe(false);
    expect(tabButtons.some((t) => t.includes('Imaging Orders'))).toBe(false);
    expect(tabButtons.some((t) => t.includes('Disposition'))).toBe(false);

    // Receptionist active duty header
    expect(container.textContent).toContain('Primary Intake Duty');
  });

  it('renders clinical workflow tabs for doctor permissions and defaults to Consultation', async () => {
    testState.capabilities = {
      viewEncounters: true,
      editEncounters: false,
      register: false,
      linkPatient: false,
      viewTriage: true,
      assessTriage: false,
      overridePriority: false,
      viewConsultation: true,
      editConsultation: true,
      viewOrders: true,
      createOrders: true,
      viewDisposition: true,
      markNoShow: false,
      markLeft: true,
      cancel: false,
      discharge: true,
      transfer: true,
      admit: true,
      viewDocuments: true,
      createDocuments: true,
      viewReferral: true,
    };

    await act(async () => root.render(<EmergencyWorkspacePage />));

    const tabButtons = Array.from(container.querySelectorAll('.segmented-control button')).map(
      (b) => b.textContent || '',
    );

    expect(tabButtons.some((t) => t.includes('Registration'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Triage'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Consultation'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Treatment'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Medication'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Lab Orders'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Imaging Orders'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Referral'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Notes'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Documents'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Disposition'))).toBe(true);

    expect(container.textContent).toContain('Primary Physician Duty – Clinical Consultation');

    const triageTab = Array.from(container.querySelectorAll('.segmented-control button')).find(
      (button) => button.textContent?.includes('Triage'),
    );
    await act(async () => triageTab?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Complete Triage');

  });

  it('submits valid triage data and opens Consultation only after completion succeeds', async () => {
    testState.capabilities = {
      viewEncounters: true,
      editEncounters: false,
      register: false,
      linkPatient: false,
      viewTriage: true,
      assessTriage: true,
      overridePriority: false,
      viewConsultation: true,
      editConsultation: false,
      viewOrders: false,
      createOrders: false,
      viewDisposition: false,
      markNoShow: false,
      markLeft: false,
      cancel: false,
      discharge: false,
      transfer: false,
      admit: false,
      viewDocuments: false,
      createDocuments: false,
      viewReferral: false,
    };

    await act(async () => root.render(<EmergencyWorkspacePage />));
    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    const painScore = container.querySelector<HTMLInputElement>('input[name="pain_score"][value="6"]');
    const systolicBp = container.querySelector<HTMLInputElement>('input[name="systolic_bp"]');
    expect(painScore).not.toBeNull();
    expect(systolicBp).not.toBeNull();
    await act(async () => {
      painScore?.click();
      if (systolicBp) {
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setValue?.call(systolicBp, '118');
        systolicBp.dispatchEvent(new Event('input', { bubbles: true }));
        systolicBp.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await act(async () => form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    expect(testState.triageMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'encounter-1',
        body: expect.objectContaining({
          level: 'LEVEL_3_MEDIUM',
          area: 'General ER',
          pain_score: 6,
          vitals: expect.objectContaining({ systolic_bp: 118 }),
        }),
      }),
    );
    const consultationTab = Array.from(container.querySelectorAll('.segmented-control button')).find(
      (button) => button.textContent?.includes('Consultation'),
    );
    expect(consultationTab?.classList.contains('active')).toBe(true);
  });

  it('renders nursing workflow tabs for nurse permissions and defaults to Triage', async () => {
    testState.capabilities = {
      viewEncounters: true,
      editEncounters: false,
      register: false,
      linkPatient: false,
      viewTriage: true,
      assessTriage: true,
      overridePriority: false,
      viewConsultation: true,
      editConsultation: false,
      viewOrders: true,
      createOrders: false,
      viewDisposition: true,
      markNoShow: false,
      markLeft: false,
      cancel: false,
      discharge: false,
      transfer: false,
      admit: false,
      viewDocuments: true,
      createDocuments: true,
      viewReferral: false,
    };

    await act(async () => root.render(<EmergencyWorkspacePage />));

    const tabButtons = Array.from(container.querySelectorAll('.segmented-control button')).map(
      (b) => b.textContent || '',
    );

    expect(tabButtons.some((t) => t.includes('Registration'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Triage'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Consultation'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Medication'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Lab Orders'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Imaging Orders'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Notes'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Documents'))).toBe(true);
    expect(tabButtons.some((t) => t.includes('Disposition'))).toBe(true);

    // Doctor specific edit/treatment actions must not show Doctor treatment tab
    expect(tabButtons.some((t) => t.includes('Treatment'))).toBe(false);
    expect(tabButtons.some((t) => t.includes('Referral'))).toBe(false);

    // Nurse primary duty header is active on Triage
    expect(container.textContent).toContain('Primary Nursing Duty – Emergency Triage');
  });
});
