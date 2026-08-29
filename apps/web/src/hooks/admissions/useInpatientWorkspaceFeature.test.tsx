import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const admission = {
  id: 'admission-1', admission_number: 'IP-001', patient_id: 'patient-1', patient_number: 'MRN-001',
  patient_name: 'Asha Rao', branch_id: 'branch-1', ward_id: 'ward-1', ward_name: 'Medical Ward',
  bed_id: 'bed-1', bed_number: 'B-01', admitting_doctor_id: 'doctor-1', admitting_doctor_name: 'Dr Shah',
  department_id: 'department-1', department_name: 'Medicine', admission_date: '2026-08-28T10:00:00.000Z',
  admission_type: 'MEDICAL' as const, reason: 'Observation', notes: null, status: 'ADMITTED' as const,
  request_id: null, source_type: 'DIRECT' as const, source_id: null,
  created_at: '2026-08-28T10:00:00.000Z', updated_at: '2026-08-28T10:00:00.000Z',
};

const testState = vi.hoisted(() => ({
  branches: [{ id: 'branch-1', name: 'Main Branch' }],
  admissions: [] as Array<typeof admission>,
  admissionLoading: false,
  admissionError: null as Error | null,
  wardCalls: [] as boolean[],
  surgeryCalls: [] as Array<{ params: unknown; enabled: unknown }>,
  refresh: vi.fn(async () => undefined),
  createRecommendation: vi.fn(async (payload: unknown) => payload),
  createRoundNote: vi.fn(async (payload: unknown) => payload),
  createVital: vi.fn(async (payload: unknown) => payload),
  submitClinicalOrder: vi.fn(async (payload: unknown) => payload),
}));

vi.mock('../../routing/navigation', () => ({
  useAppLocation: () => ({ pathname: '/admissions/workspace', search: '' }),
}));
vi.mock('../branches/useBranches', () => ({
  useBranchesList: () => ({ data: { data: testState.branches } }),
}));
vi.mock('../doctors/useDoctors', () => ({ useDoctorsList: () => ({ data: { data: [] } }) }));
vi.mock('../services/useServices', () => ({ useServicesList: () => ({ data: { data: [] } }) }));
vi.mock('../useAdmissionsConfiguration', () => ({
  useWardsList: (_params: unknown, enabled: boolean) => {
    testState.wardCalls.push(enabled);
    return { data: { data: [] } };
  },
}));
vi.mock('./useInpatientAdmissionsList', () => ({
  useInpatientAdmissionsList: () => ({
    data: { data: testState.admissions }, isLoading: testState.admissionLoading, error: testState.admissionError,
  }),
  useRefreshInpatientAdmissions: () => testState.refresh,
}));
vi.mock('../surgery/useSurgery', () => ({
  useSurgery: (params: unknown, enabled: unknown) => {
    testState.surgeryCalls.push({ params, enabled });
    return {
      recommendations: { data: { data: [] }, isLoading: false, error: null },
      bookings: { data: { data: [] }, isLoading: false, error: null },
      createRecommendation: { mutateAsync: testState.createRecommendation, isPending: false },
    };
  },
}));
vi.mock('./useInpatientDownstreamFeature', () => ({
  useInpatientDownstreamFeature: () => ({
    laboratory: { data: null, isLoading: false, error: null },
    imaging: { data: null, isLoading: false, error: null },
    roundNotes: { data: [{ id: 'round-1', assessment: 'Stable' }], isLoading: false, error: null },
    vitals: { data: [{ id: 'vital-1', heart_rate: 72 }], isLoading: false, error: null },
    laboratoryServices: [], imagingServices: [],
    createRoundNote: { mutateAsync: testState.createRoundNote, isPending: false },
    createVital: { mutateAsync: testState.createVital, isPending: false },
    submitClinicalOrder: { mutateAsync: testState.submitClinicalOrder, isPending: false },
  }),
}));

import { useInpatientWorkspaceFeature } from './useInpatientWorkspaceFeature';

describe('useInpatientWorkspaceFeature orchestration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let feature: ReturnType<typeof useInpatientWorkspaceFeature> | undefined;

  function Harness() {
    feature = useInpatientWorkspaceFeature({ selectedWard: '', selectedCareLevel: '', searchQuery: '' });
    return null;
  }

  beforeEach(async () => {
    testState.branches = [{ id: 'branch-1', name: 'Main Branch' }];
    testState.admissions = [admission];
    testState.admissionLoading = false;
    testState.admissionError = null;
    testState.wardCalls.length = 0;
    testState.surgeryCalls.length = 0;
    for (const mock of [testState.refresh, testState.createRecommendation, testState.createRoundNote, testState.createVital, testState.submitClinicalOrder]) mock.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps branch, admission, patient, ward, and clinical context aligned', () => {
    expect(feature?.state.branchId).toBe('branch-1');
    expect(feature?.state.selectedAdmission).toEqual(expect.objectContaining({ id: 'admission-1', patient_id: 'patient-1', ward_id: 'ward-1', bed_id: 'bed-1' }));
    expect(feature?.state.roundNotes).toEqual([expect.objectContaining({ id: 'round-1' })]);
    expect(feature?.state.vitals).toEqual([expect.objectContaining({ id: 'vital-1' })]);
    expect(testState.surgeryCalls.at(-1)).toEqual({
      params: { branch_id: 'branch-1', patient_id: 'patient-1' },
      enabled: { recommendations: true, bookings: true },
    });
  });

  it('forwards representative clinical and Surgery mutation payloads unchanged and in order', async () => {
    const recommendation = {
      patient_id: 'patient-1', branch_id: 'branch-1', department_id: 'department-1',
      recommending_doctor_id: 'doctor-1', service_id: 'service-1', encounter_type: 'DIRECT' as const,
      clinical_reason: 'Clinical indication', notes: 'Priority: ROUTINE',
    };
    const note = { subjective: 'Comfortable', objective: 'Stable', assessment: 'Improving', plan: 'Observe' };

    await act(async () => {
      await feature?.actions.createRecommendation(recommendation);
      await feature?.actions.createRoundNote(note);
    });

    expect(testState.createRecommendation).toHaveBeenCalledWith(recommendation);
    expect(testState.createRoundNote).toHaveBeenCalledWith(note);
    expect(testState.createRecommendation.mock.invocationCallOrder[0]).toBeLessThan(testState.createRoundNote.mock.invocationCallOrder[0] ?? Infinity);
  });

  it('aggregates admission loading/error state and preserves scoped request gating', async () => {
    testState.admissionLoading = true;
    testState.admissionError = new Error('Admissions unavailable.');
    await act(async () => root.render(<Harness />));
    expect(feature?.state.loading.admissions).toBe(true);
    expect(feature?.state.errors.admissions).toBe(testState.admissionError);

    testState.branches = [];
    await act(async () => {
      root.unmount();
      root = createRoot(container);
      root.render(<Harness />);
    });
    expect(testState.wardCalls.at(-1)).toBe(false);
    expect(testState.surgeryCalls.at(-1)).toEqual(expect.objectContaining({
      enabled: { recommendations: false, bookings: false },
    }));
  });
});
