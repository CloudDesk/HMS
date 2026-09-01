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
      capabilities: {
        linkPatient: true,
        overridePriority: true,
        assessTriage: true,
        editConsultation: true,
        createOrders: true,
        viewDisposition: true,
      },
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

    expect(container.textContent).toContain('Emergency Clinical Workspace');
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
});
