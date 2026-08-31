import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => {
  const sequence: string[] = [];
  return {
    sequence,
    listLoading: false,
    detailLoading: false,
    listError: null as Error | null,
    detailError: null as Error | null,
    navigate: vi.fn((path: string) => {
      sequence.push(`navigate:${path}`);
    }),
    triage: vi.fn(async (input: unknown) => input),
    consultation: vi.fn(async (input: unknown) => input),
    order: vi.fn(async (input: unknown) => input),
    disposition: vi.fn(async (input: unknown) => {
      sequence.push('disposition');
      return input;
    }),
    linkPatient: vi.fn(async (input: unknown) => input),
    overridePriority: vi.fn(async (input: unknown) => input),
  };
});

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      roles: [],
      permissions: [],
      branches: [{ id: 'branch-1', name: 'Main Branch' }],
    },
  }),
}));

vi.mock('../../routing/navigation', () => ({
  navigate: testState.navigate,
  useAppLocation: () => ({
    pathname: '/emergency/workspace',
    search: '?branch_id=branch-1&encounter_id=encounter-1',
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(() => {
      testState.sequence.push('toast');
    }),
  },
}));

vi.mock('../branches/useBranches', () => ({
  useBranchesList: () => ({ data: { data: [] } }),
}));
vi.mock('../departments/useDepartments', () => ({
  useDepartmentsList: () => ({ data: { data: [] } }),
}));
vi.mock('../doctors/useDoctors', () => ({
  useDoctorsList: () => ({ data: { data: [] } }),
}));
vi.mock('../patients/usePatients', () => ({
  usePatientsList: () => ({ data: { data: [] } }),
}));
vi.mock('../services/useServices', () => ({
  useServicesList: () => ({
    data: {
      data: [
        { id: 'lab-1', name: 'Complete Blood Count', service_type: 'LAB_TEST', category: 'Laboratory' },
        { id: 'img-1', name: 'Chest X-Ray', service_type: 'IMAGING_SERVICE', category: 'Radiology' },
      ],
    },
  }),
}));
vi.mock('../medicines/useMedicines', () => ({
  useMedicinesList: () => ({
    data: { data: [{ id: 'medicine-1', name: 'Adrenaline', generic_name: null, strength: '1 mg', dosage_form: 'Injection' }] },
  }),
}));
vi.mock('../pharmacy/usePharmacy', () => ({
  usePharmacyInventoryList: () => ({
    data: {
      data: [{
        medicine_id: 'medicine-1',
        available_quantity: 12,
        medicine: { name: 'Adrenaline', generic_name: null, strength: '1 mg', dosage_form: 'Injection' },
      }],
    },
  }),
}));

vi.mock('./useEmergency', () => ({
  useEmergency: () => ({
    list: {
      data: { data: [{ id: 'encounter-list-1', patient_name: 'List Patient' }] },
      isLoading: testState.listLoading,
      error: testState.listError,
    },
    summary: { data: {} },
    detail: {
      data: { id: 'encounter-1', patient_id: 'patient-1', patient_name: 'Emergency Patient' },
      isLoading: testState.detailLoading,
      error: testState.detailError,
    },
    triage: { mutateAsync: testState.triage, isPending: false },
    consultation: { mutateAsync: testState.consultation, isPending: false },
    order: { mutateAsync: testState.order, isPending: false },
    disposition: { mutateAsync: testState.disposition, isPending: false },
    linkPatient: { mutateAsync: testState.linkPatient, isPending: false },
    overridePriority: { mutateAsync: testState.overridePriority, isPending: false },
  }),
}));

import { useEmergencyWorkspaceFeature } from './useEmergencyWorkspaceFeature';

describe('useEmergencyWorkspaceFeature workspace orchestration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let feature: ReturnType<typeof useEmergencyWorkspaceFeature> | undefined;

  function Harness() {
    feature = useEmergencyWorkspaceFeature();
    return null;
  }

  beforeEach(async () => {
    testState.sequence.length = 0;
    testState.listLoading = false;
    testState.detailLoading = false;
    testState.listError = null;
    testState.detailError = null;
    for (const mock of [
      testState.navigate,
      testState.triage,
      testState.consultation,
      testState.order,
      testState.disposition,
      testState.linkPatient,
      testState.overridePriority,
    ]) mock.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
    testState.sequence.length = 0;
    testState.navigate.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('exposes encounter context, formulary availability, and typed service lookups', () => {
    expect(feature?.state.selected?.id).toBe('encounter-1');
    expect(feature?.state.selected?.patient_id).toBe('patient-1');
    expect(feature?.state.availableMedicines).toEqual([
      expect.objectContaining({ id: 'medicine-1', name: 'Adrenaline', available_quantity: 12 }),
    ]);
    expect(feature?.state.labServices.map((service) => service.id)).toEqual(['lab-1']);
    expect(feature?.state.imagingServices.map((service) => service.id)).toEqual(['img-1']);
    expect(feature?.state.loading).toBe(false);
    expect(feature?.state.error).toBeNull();
  });

  it('passes unchanged clinical mutation payloads to the Emergency domain hook', async () => {
    const triage = {
      level: 'LEVEL_2_HIGH' as const,
      area: 'Resuscitation',
      vitals: { pulse: 120 },
      abcde: { airway: 'Patent', breathing: 'Laboured', circulation: 'Stable', disability: 'Alert', exposure: 'Clear' },
    };
    const order = {
      order_type: 'LABORATORY' as const,
      priority: 'STAT' as const,
      items: [{ service_id: 'lab-1', name: 'Complete Blood Count', category: 'Laboratory' }],
      specimen_type: 'Blood',
    };

    await act(async () => {
      await feature?.actions.saveTriage('encounter-1', triage);
      await feature?.actions.submitOrder('encounter-1', order);
    });

    expect(testState.triage).toHaveBeenCalledWith({ id: 'encounter-1', body: triage });
    expect(testState.order).toHaveBeenCalledWith({ id: 'encounter-1', body: order });
  });

  it('aggregates encounter loading and error state', async () => {
    testState.detailLoading = true;
    testState.detailError = new Error('Emergency encounter unavailable.');

    await act(async () => root.render(<Harness />));

    expect(feature?.state.loading).toBe(true);
    expect(feature?.state.error).toBe(testState.detailError);
  });

  it('completes disposition before navigating back to the same branch queue', async () => {
    const disposition = { decision: 'DISCHARGE' as const, summary: 'Stable for discharge.' };

    await act(async () => {
      await feature?.actions.completeDisposition('encounter-1', disposition);
    });

    expect(testState.disposition).toHaveBeenCalledWith({ id: 'encounter-1', body: disposition });
    expect(testState.sequence).toEqual([
      'disposition',
      'toast',
      'navigate:/emergency/queue?branch_id=branch-1',
    ]);
  });
});
