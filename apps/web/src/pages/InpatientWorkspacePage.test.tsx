import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const admission = vi.hoisted(() => ({
  id: 'admission-1', admission_number: 'IP-001', patient_id: 'patient-1', patient_number: 'MRN-001',
  patient_name: 'Asha Rao', branch_id: 'branch-1', ward_id: 'ward-1', ward_name: 'Medical Ward',
  bed_id: 'bed-1', bed_number: 'B-01', admitting_doctor_id: 'doctor-1', admitting_doctor_name: 'Dr Shah',
  department_id: 'department-1', department_name: 'Medicine', admission_date: '2026-08-28T10:00:00.000Z',
  admission_type: 'MEDICAL', reason: 'Observation', notes: null, status: 'ADMITTED', request_id: null,
  source_type: 'DIRECT', source_id: null, created_at: '2026-08-28T10:00:00.000Z', updated_at: '2026-08-28T10:00:00.000Z',
}));

const testState = vi.hoisted(() => ({
  admissionsLoading: false,
  roundsError: null as Error | null,
  useFeature: vi.fn(),
}));

vi.mock('../utils/inpatient-clinical-storage', () => ({ removeLegacyInpatientClinicalStorage: vi.fn() }));
vi.mock('../hooks/admissions/useInpatientWorkspaceFeature', () => ({
  useInpatientWorkspaceFeature: (filters: unknown) => {
    testState.useFeature(filters);
    return {
      state: {
        branchId: 'branch-1', selectedAdmission: admission,
        branches: [{ id: 'branch-1', name: 'Main Branch' }], wards: [{ id: 'ward-1', name: 'Medical Ward' }],
        doctors: [], procedureServices: [], admittedList: [admission], filteredInpatients: [admission],
        recommendations: [], bookings: [], roundNotes: [], vitals: [], diagnosticOrders: [],
        laboratoryServices: [], imagingServices: [],
        loading: {
          admissions: testState.admissionsLoading, recommendations: false, bookings: false,
          roundNotes: false, vitals: false, diagnosticOrders: false,
        },
        errors: {
          admissions: null, recommendations: null, bookings: null,
          roundNotes: testState.roundsError, vitals: null, diagnosticOrders: null,
        },
        pending: { createRecommendation: false, createRoundNote: false, createVital: false, submitClinicalOrder: false },
      },
      actions: {
        setBranchId: vi.fn(), selectAdmission: vi.fn(), refreshAdmissions: vi.fn(),
        createRecommendation: vi.fn(), createRoundNote: vi.fn(), createVital: vi.fn(), submitClinicalOrder: vi.fn(),
      },
    };
  },
}));

import { InpatientWorkspacePage } from './InpatientWorkspacePage';

describe('InpatientWorkspacePage feature-hook rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    testState.admissionsLoading = false;
    testState.roundsError = null;
    testState.useFeature.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the patient, admission, ward, bed, and diagnosis context supplied by the feature hook', async () => {
    await act(async () => root.render(<InpatientWorkspacePage />));

    expect(testState.useFeature).toHaveBeenCalledWith({ selectedWard: '', selectedCareLevel: '', searchQuery: '' });
    expect(container.textContent).toContain('Inpatient Clinical Workspace');
    expect(container.textContent).toContain('Asha Rao');
    expect(container.textContent).toContain('MRN-001');
    expect(container.textContent).toContain('Medical Ward');
    expect(container.textContent).toContain('B-01');
    expect(container.textContent).toContain('Observation');
  });

  it('preserves admitted-roster loading and representative clinical error rendering', async () => {
    testState.admissionsLoading = true;
    await act(async () => root.render(<InpatientWorkspacePage />));
    expect(container.textContent).toContain('Loading admitted patients');

    testState.admissionsLoading = false;
    testState.roundsError = new Error('Rounds unavailable.');
    await act(async () => root.render(<InpatientWorkspacePage />));
    const roundsTab = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Daily Doctor Rounds'));
    await act(async () => roundsTab?.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Ward-round notes could not be loaded');
  });
});
