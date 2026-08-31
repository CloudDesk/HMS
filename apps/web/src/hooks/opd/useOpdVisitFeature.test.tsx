import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useOpdVisitFeature as UseOpdVisitFeature } from './useOpdVisitFeature';

const testState = vi.hoisted(() => {
  const calls: string[] = [];
  const track = (name: string) => vi.fn(async (input?: unknown) => {
    calls.push(name);
    return input;
  });

  return {
    calls,
    search: '?id=visit-1',
    visitError: null as Error | null,
    saveConsultationDraft: track('save-consultation'),
    savePrescriptionDraft: track('save-prescription'),
    saveClinicalOrderDraft: track('save-clinical-order'),
    completeConsultation: track('complete-consultation'),
    submitPrescription: track('submit-prescription'),
    submitClinicalOrder: track('submit-clinical-order'),
    createBillingInvoice: track('create-invoice'),
    updateVisitStatus: track('update-visit-status'),
    navigate: vi.fn(),
  };
});

vi.mock('../../routing/navigation', () => ({
  navigate: testState.navigate,
  useAppLocation: () => ({ pathname: '/opd/consultation', search: testState.search }),
}));

vi.mock('./useOpd', () => ({
  useOpdVisits: () => ({
    data: { data: [{ id: 'visit-1', patient_name: 'Test Patient' }] },
    isLoading: false,
  }),
  useCallNextOpdPatient: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock('../patients/usePatients', () => ({
  usePatientDetails: () => ({
    data: { id: 'patient-1', mrn: 'MRN-1' },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../branches/useBranches', () => ({
  useBranchesList: () => ({ data: { data: [] } }),
}));

vi.mock('../departments/useDepartments', () => ({
  useDepartmentsList: () => ({ data: { data: [] } }),
}));

vi.mock('./useOpdWorkspace', () => ({
  useOpdWorkspace: () => ({
    visit: { id: 'visit-1', patient_id: 'patient-1', branch_id: 'branch-1' },
    vitals: null,
    consultation: null,
    prescription: null,
    labOrder: null,
    imagingOrder: null,
    doctors: [],
    medicines: [],
    inventory: [],
    services: [],
    documents: [],
    visitLoading: false,
    visitError: testState.visitError,
    isUpdating: false,
    refetchVisit: vi.fn(),
    mutations: {
      saveConsultationDraft: testState.saveConsultationDraft,
      savePrescriptionDraft: testState.savePrescriptionDraft,
      saveClinicalOrderDraft: testState.saveClinicalOrderDraft,
      completeConsultation: testState.completeConsultation,
      submitPrescription: testState.submitPrescription,
      submitClinicalOrder: testState.submitClinicalOrder,
      createBillingInvoice: testState.createBillingInvoice,
      updateVisitStatus: testState.updateVisitStatus,
      createVitals: vi.fn(),
      submitReferral: vi.fn(),
      uploadDocument: vi.fn(),
      downloadDocument: vi.fn(),
      deleteDocument: vi.fn(),
    },
  }),
}));

import { useOpdVisitFeature } from './useOpdVisitFeature';

describe('useOpdVisitFeature', () => {
  let container: HTMLDivElement;
  let root: Root;
  let feature: ReturnType<typeof UseOpdVisitFeature> | undefined;

  function Harness() {
    feature = useOpdVisitFeature();
    return null;
  }

  beforeEach(async () => {
    testState.calls.length = 0;
    testState.visitError = null;
    testState.navigate.mockReset();
    for (const mutation of [
      testState.saveConsultationDraft,
      testState.savePrescriptionDraft,
      testState.saveClinicalOrderDraft,
      testState.completeConsultation,
      testState.submitPrescription,
      testState.submitClinicalOrder,
      testState.createBillingInvoice,
      testState.updateVisitStatus,
    ]) mutation.mockClear();

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('exposes the loaded visit and patient context with aggregated state', () => {
    expect(feature?.state.visit?.id).toBe('visit-1');
    expect(feature?.state.patient?.id).toBe('patient-1');
    expect(feature?.state.loading).toBe(false);
    expect(feature?.state.loadError).toBe('');
  });

  it('preserves draft payloads and workflow order', async () => {
    const consultation = { chief_complaint: 'Headache' };
    const prescription = { items: [] };
    const laboratory = { priority: 'ROUTINE' as const, items: [] };
    const imaging = { priority: 'URGENT' as const, items: [] };

    await act(async () => {
      await feature?.actions.saveWorkspaceDraft({ consultation, prescription, laboratory, imaging });
    });

    expect(testState.calls).toEqual([
      'save-consultation',
      'save-prescription',
      'save-clinical-order',
      'save-clinical-order',
    ]);
    expect(testState.saveConsultationDraft).toHaveBeenCalledWith({ visitId: 'visit-1', payload: consultation });
    expect(testState.savePrescriptionDraft).toHaveBeenCalledWith({ visitId: 'visit-1', payload: prescription });
    expect(testState.saveClinicalOrderDraft).toHaveBeenNthCalledWith(1, {
      visitId: 'visit-1', type: 'LABORATORY', payload: laboratory,
    });
    expect(testState.saveClinicalOrderDraft).toHaveBeenNthCalledWith(2, {
      visitId: 'visit-1', type: 'IMAGING', payload: imaging,
    });
  });

  it('completes the consultation before downstream routing and visit completion', async () => {
    const consultation = { assessment: 'J06.9' };
    const prescription = { items: [] };
    const laboratory = { priority: 'ROUTINE' as const, items: [] };
    const imaging = { priority: 'ROUTINE' as const, items: [] };
    const invoice = { patient_id: 'patient-1', visit_id: 'visit-1', branch_id: 'branch-1', items: [] };

    await act(async () => {
      await feature?.actions.completeWorkspace({ consultation, prescription, laboratory, imaging, invoice });
    });

    expect(testState.calls).toEqual([
      'complete-consultation',
      'submit-prescription',
      'submit-clinical-order',
      'submit-clinical-order',
      'create-invoice',
      'update-visit-status',
    ]);
    expect(testState.completeConsultation).toHaveBeenCalledWith({ visitId: 'visit-1', payload: consultation });
    expect(testState.updateVisitStatus).toHaveBeenCalledWith({
      id: 'visit-1',
      payload: { status: 'COMPLETED', notes: 'Consultation completed.' },
    });
  });
});
