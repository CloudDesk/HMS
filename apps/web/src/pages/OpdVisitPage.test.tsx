// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  loading: true,
  loadError: '',
  visitId: '',
  consultation: null as { id: string; visit_id: string; assessment: string; chief_complaint: string; diagnoses: []; status: 'DRAFT' } | null,
  save: vi.fn(),
  setTab: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../hooks/opd/useOpdVisitFeature', () => ({
  useOpdVisitFeature: () => ({
    state: {
      activeVisitId: testState.visitId,
      activeTab: 'Consultation',
      recentVisits: [],
      visit: testState.visitId ? { id: testState.visitId, patient_id: `patient-${testState.visitId}`, patient_name: 'Test Patient', patient_number: 'MRN-TEST', visit_number: 'OPD-TEST', doctor_name: 'Test Doctor', doctor_specialization: '', branch_id: 'branch-1', status: 'IN_CONSULTATION', visit_type: 'NEW_CONSULTATION', priority: 'ROUTINE' } : null,
      patient: null,
      vitals: null,
      consultation: testState.consultation,
      prescription: null,
      followUp: null,
      referral: null,
      laboratoryOrder: null,
      imagingOrder: null,
      doctors: [],
      masterMedicines: [],
      services: [],
      branches: [],
      departments: [],
      documents: [],
      loading: testState.loading,
      loadError: testState.loadError,
      updating: false,
      canEditConsultation: true,
    },
    actions: {
      setActiveTab: testState.setTab,
      selectVisit: vi.fn(),
      refetchVisit: vi.fn(),
      createVitals: vi.fn(),
      submitReferral: vi.fn(),
      scheduleFollowUp: vi.fn(),
      saveWorkspaceDraft: testState.save,
      submitPrescription: vi.fn(),
      submitClinicalOrder: vi.fn(),
      completeWorkspace: vi.fn(),
      uploadDocument: vi.fn(),
      downloadDocument: vi.fn(),
      deleteDocument: vi.fn(),
      callNextPatient: vi.fn(),
    },
  }),
}));

vi.mock('../routing/navigation', () => ({ navigate: vi.fn() }));
vi.mock('../context/BranchContext', () => ({ useActiveBranch: () => ({ activeBranchId: 'branch-1' }) }));
vi.mock('../api/useSettings', () => ({ useTimezone: () => 'UTC' }));
vi.mock('sonner', () => ({ toast: { success: testState.success, error: testState.error } }));

import { OpdVisitPage } from './OpdVisitPage';

describe('OpdVisitPage feature-hook rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    testState.loading = true;
    testState.loadError = '';
    testState.visitId = '';
    testState.consultation = null;
    testState.save.mockReset();
    testState.setTab.mockReset(); testState.success.mockReset(); testState.error.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the loading state supplied by the feature hook', async () => {
    await act(async () => root.render(<OpdVisitPage />));

    expect(container.textContent).toContain('Loading consultation workspace');
  });

  it('renders the feature-hook error and empty states', async () => {
    testState.loading = false;
    testState.loadError = 'Unable to load OPD visit.';

    await act(async () => root.render(<OpdVisitPage />));

    expect(container.textContent).toContain('Unable to load OPD visit.');
    expect(container.textContent).toContain('No Active Visit Selected');
  });

  it('clears persisted and unsaved fields immediately when switching to an empty encounter', async () => {
    testState.loading = false;
    testState.visitId = 'visit-1';
    testState.consultation = { id: 'consult-1', visit_id: 'visit-1', chief_complaint: 'Previous patient complaint', assessment: 'Previous assessment', diagnoses: [], status: 'DRAFT' };
    await act(async () => root.render(<OpdVisitPage />));
    expect(container.querySelector<HTMLTextAreaElement>('#chief-complaint')?.value).toBe('Previous patient complaint');
    testState.visitId = 'visit-2'; testState.consultation = null;
    await act(async () => root.render(<OpdVisitPage />));
    expect(container.querySelector<HTMLTextAreaElement>('#chief-complaint')?.value).toBe('');
    expect(container.textContent).not.toContain('Previous assessment');
  });

  it('keeps the current tab when Save and Continue fails', async () => {
    testState.loading = false; testState.visitId = 'visit-1';
    testState.save.mockRejectedValueOnce(new Error('Save rejected'));
    await act(async () => root.render(<OpdVisitPage />));
    const next = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Next: Diagnosis'));
    expect(next).toBeDefined();
    await act(async () => next?.click());
    expect(testState.save).toHaveBeenCalledTimes(1);
    expect(testState.setTab).not.toHaveBeenCalled();
    expect(testState.error).toHaveBeenCalledWith('Save rejected', { position: 'top-right' });
    expect(container.querySelector<HTMLTextAreaElement>('#chief-complaint')).not.toBeNull();
  });

  it('clears hydrated fields when access to the current record is removed', async () => {
    testState.loading = false; testState.visitId = 'visit-1';
    testState.consultation = { id: 'consult-1', visit_id: 'visit-1', chief_complaint: 'Restricted complaint', assessment: 'Restricted assessment', diagnoses: [], status: 'DRAFT' };
    await act(async () => root.render(<OpdVisitPage />));
    testState.consultation = null;
    await act(async () => root.render(<OpdVisitPage />));
    expect(container.querySelector<HTMLTextAreaElement>('#chief-complaint')?.value).toBe('');
    expect(container.querySelector<HTMLTextAreaElement>('#assessment')?.value).toBe('');
  });

  it('ignores late save notifications and next-tab actions from a previous encounter', async () => {
    testState.loading = false; testState.visitId = 'visit-1';
    let resolve: (() => void) | undefined;
    testState.save.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    await act(async () => root.render(<OpdVisitPage />));
    const next = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Next: Diagnosis'));
    await act(async () => next?.click());
    testState.visitId = 'visit-2';
    await act(async () => root.render(<OpdVisitPage />));
    await act(async () => resolve?.());
    expect(testState.success).not.toHaveBeenCalled(); expect(testState.setTab).not.toHaveBeenCalled();
  });
});
