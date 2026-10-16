import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useOpdVisitFeature as UseOpdVisitFeature } from './useOpdVisitFeature';
import type { MedicineResponse } from '../../api/medicines';

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
    loadedVisitId: 'visit-1',
    medicines: [] as MedicineResponse[],
    workspaceArgs: vi.fn(),
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
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: { permissions: [] } }) }));

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
  useOpdWorkspace: (...args: unknown[]) => {
    testState.workspaceArgs(...args);
    return {
    visit: { id: testState.loadedVisitId, patient_id: 'patient-1', branch_id: 'branch-1', status: 'IN_CONSULTATION' },
    vitals: null,
    consultation: null,
    prescription: null,
    labOrder: null,
    imagingOrder: null,
    doctors: [],
    medicines: testState.medicines,
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
  }; },
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
    testState.search = '?id=visit-1';
    testState.loadedVisitId = 'visit-1';
    testState.medicines = [];
    testState.workspaceArgs.mockClear();
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

  it('blocks all generic completion and downstream writes for specialty-origin encounters', async () => {
    testState.search = '?id=visit-1&specialty=ophthalmology'; await act(async () => root.render(<Harness />));
    expect(feature?.state.specialtyCompletionRequired).toBe(true);
    await expect(feature?.actions.completeWorkspace({ consultation: {}, prescription: { items: [] } })).rejects.toThrow('Return to Ophthalmology readiness');
    expect(testState.calls).toEqual([]);
  });
  it('does not carry a specialty completion marker into a different selected encounter', async () => {
    testState.search = '?id=visit-1&specialty=ophthalmology'; await act(async () => root.render(<Harness />));
    feature?.actions.selectVisit('visit-2'); expect(testState.navigate).toHaveBeenCalledWith('/opd/consultation?id=visit-2');
  });
  it('completes before downstream routing without replaying the backend visit transition', async () => {
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
    ]);
    expect(testState.completeConsultation).toHaveBeenCalledWith({ visitId: 'visit-1', payload: consultation });
    expect(testState.updateVisitStatus).not.toHaveBeenCalled();
  });

  it('reads tabs from the URL, preserves query state, and never navigates on mount', async () => {
    expect(testState.navigate).not.toHaveBeenCalled();
    testState.search = '?id=visit-1&tab=Prescription&branch_id=branch-1';
    await act(async () => root.render(<Harness />));
    expect(feature?.state.activeTab).toBe('Prescription');
    expect(testState.workspaceArgs).toHaveBeenLastCalledWith('visit-1', 'Prescription');
    feature?.actions.setActiveTab('Diagnosis');
    expect(testState.navigate).toHaveBeenLastCalledWith('/opd/consultation?id=visit-1&tab=Diagnosis&branch_id=branch-1', { replace: true });
    feature?.actions.setActiveTab('not-a-tab');
    expect(testState.navigate).toHaveBeenCalledTimes(1);
  });

  it('rejects stale loaded visit data immediately after a URL context switch', async () => {
    testState.search = '?id=visit-2';
    await act(async () => root.render(<Harness />));
    expect(feature?.state.activeVisitId).toBe('visit-2');
    expect(feature?.state.visit).toBeNull();
    expect(feature?.state.patient).toBeNull();
    await expect(feature?.actions.saveWorkspaceDraft({ consultation: {} })).rejects.toThrow('selected encounter changed');
    expect(testState.saveConsultationDraft).not.toHaveBeenCalled();
  });

  it('stops a pending save chain when the user changes encounters', async () => {
    let resolveSave: (() => void) | undefined;
    testState.saveConsultationDraft.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    const pending = feature?.actions.saveWorkspaceDraft({ consultation: {}, prescription: { items: [] } });
    const rejected = expect(pending).rejects.toThrow('selected encounter changed');
    feature?.actions.selectVisit('visit-2');
    resolveSave?.();
    await rejected;
    expect(testState.savePrescriptionDraft).not.toHaveBeenCalled();
  });

  it('surfaces partial draft failure and stops later saves', async () => {
    testState.savePrescriptionDraft.mockRejectedValueOnce(new Error('Validation rejected'));
    await expect(feature?.actions.saveWorkspaceDraft({ consultation: {}, prescription: { items: [] }, laboratory: { priority: 'ROUTINE', items: [] } })).rejects.toThrow('Prescription draft failed: Validation rejected Earlier steps were saved.');
    expect(testState.saveClinicalOrderDraft).not.toHaveBeenCalled();
  });

  it('reports billing failure after completion and prevents whole-workflow replay', async () => {
    testState.createBillingInvoice.mockRejectedValueOnce(new Error('Invoice unavailable'));
    const input = { consultation: {}, invoice: { patient_id: 'patient-1', visit_id: 'visit-1', branch_id: 'branch-1', items: [] } };
    await expect(feature?.actions.completeWorkspace(input)).rejects.toThrow('Billing handoff failed: Invoice unavailable Earlier steps were saved.');
    await expect(feature?.actions.completeWorkspace(input)).rejects.toThrow('already completed');
    expect(testState.completeConsultation).toHaveBeenCalledTimes(1);
    expect(testState.createBillingInvoice).toHaveBeenCalledTimes(1);
  });

  it('reports unknown stock instead of fabricating availability', async () => {
    testState.medicines = [{ id: 'med-1', code: 'MED', name: 'Medicine', generic_name: null, strength: null, dosage_form: null, unit: 'tablets', description: null, status: 'ACTIVE', created_by: null, updated_by: null, created_at: '', updated_at: '' }];
    await act(async () => root.render(<Harness />));
    expect(feature?.state.masterMedicines[0]?.available_quantity).toBeNull();
    expect(feature?.state.masterMedicines[0]?.unit).toBe('tablets');
  });
});
