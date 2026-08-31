import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  recommendationsLoading: false,
  bookingsLoading: false,
  recommendationsError: null as Error | null,
  bookingsError: null as Error | null,
  navigate: vi.fn(),
  createRecommendation: vi.fn(async (input: unknown) => input),
  createBooking: vi.fn(async (input: unknown) => input),
  cancelRecommendation: vi.fn(async (input: unknown) => input),
  confirmBooking: vi.fn(async (input: unknown) => input),
  rescheduleBooking: vi.fn(async (input: unknown) => input),
  cancelBooking: vi.fn(async (input: unknown) => input),
  completeBooking: vi.fn(async (input: unknown) => input),
  advancePayment: vi.fn(),
  downstream: vi.fn(),
}));

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { roles: [], permissions: [], branches: [{ id: 'branch-1', name: 'Main Branch' }] } }),
}));
vi.mock('../../routing/navigation', () => ({
  navigate: testState.navigate,
  useAppLocation: () => ({ pathname: '/surgery', search: '?branch_id=branch-1&tab=recommendations' }),
}));
vi.mock('../branches/useBranches', () => ({ useBranchesList: () => ({ data: { data: [] } }) }));
vi.mock('../departments/useDepartments', () => ({ useDepartmentsList: () => ({ data: { data: [] } }) }));
vi.mock('../doctors/useDoctors', () => ({ useDoctorsList: () => ({ data: { data: [] } }) }));
vi.mock('../patients/usePatients', () => ({
  usePatientsList: () => ({ data: { data: [] } }),
  useUploadPatientDocument: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../services/useServices', () => ({ useServicesList: () => ({ data: { data: [] } }) }));
vi.mock('../billing/useBilling', () => ({
  useLinkProcedureBillingContext: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../consents/useConsents', () => ({
  useConsentTemplates: () => ({ data: { data: [] }, isLoading: false }),
}));
vi.mock('../advance-payment/useAdvancePaymentFeature', () => ({
  useAdvancePaymentFeature: (...args: unknown[]) => {
    testState.advancePayment(...args);
    return { advancePayment: null, isLoading: false, error: null, syncAdvancePayment: vi.fn(), isSyncing: false };
  },
}));
vi.mock('./useSurgeryDownstreamFeature', () => ({
  useSurgeryDownstreamFeature: (...args: unknown[]) => {
    testState.downstream(...args);
    return { prescription: {}, laboratory: {}, imaging: {}, submitPrescription: {}, submitClinicalOrder: {} };
  },
}));
vi.mock('./useSurgery', () => ({
  useSurgeryAlternatives: () => ({ data: { available_doctors: [], recommended_slots: [] }, isFetching: false }),
  useSurgery: () => ({
    recommendations: {
      data: { data: [{ id: 'recommendation-1', patient_id: 'patient-1', patient_name: 'Surgery Patient' }] },
      isLoading: testState.recommendationsLoading,
      error: testState.recommendationsError,
    },
    bookings: {
      data: { data: [] },
      isLoading: testState.bookingsLoading,
      error: testState.bookingsError,
    },
    createRecommendation: { mutateAsync: testState.createRecommendation, isPending: false },
    cancelRecommendation: { mutateAsync: testState.cancelRecommendation, isPending: false },
    createBooking: { mutateAsync: testState.createBooking, isPending: false },
    confirmBooking: { mutateAsync: testState.confirmBooking, isPending: false },
    rescheduleBooking: { mutateAsync: testState.rescheduleBooking, isPending: false },
    cancelBooking: { mutateAsync: testState.cancelBooking, isPending: false },
    completeBooking: { mutateAsync: testState.completeBooking, isPending: false },
  }),
}));

import { useSurgeryWorkspaceFeature } from './useSurgeryWorkspaceFeature';

describe('useSurgeryWorkspaceFeature orchestration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let feature: ReturnType<typeof useSurgeryWorkspaceFeature> | undefined;

  function Harness() {
    feature = useSurgeryWorkspaceFeature({
      selectedBookingId: 'booking-1',
      selectedBookingStatus: 'BOOKED',
    });
    return null;
  }

  beforeEach(async () => {
    testState.recommendationsLoading = false;
    testState.bookingsLoading = false;
    testState.recommendationsError = null;
    testState.bookingsError = null;
    for (const mock of [
      testState.navigate, testState.createRecommendation, testState.createBooking,
      testState.cancelRecommendation, testState.confirmBooking, testState.rescheduleBooking,
      testState.cancelBooking, testState.completeBooking, testState.advancePayment, testState.downstream,
    ]) mock.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('exposes recommendation patient context and selected-booking downstream context', () => {
    expect(feature?.state.recommendations[0]).toEqual(
      expect.objectContaining({ patient_id: 'patient-1', patient_name: 'Surgery Patient' }),
    );
    expect(testState.advancePayment).toHaveBeenCalledWith('PROCEDURE_BOOKING', 'booking-1');
    expect(testState.downstream).toHaveBeenCalledWith('booking-1', 'branch-1', true);
    expect(feature?.state.loading).toBe(false);
    expect(feature?.state.error).toBeNull();
  });

  it('passes unchanged recommendation and booking payloads to the Surgery domain hook', async () => {
    const recommendation = {
      patient_id: 'patient-1', branch_id: 'branch-1', department_id: 'department-1',
      recommending_doctor_id: 'doctor-1', service_id: 'service-1', encounter_type: 'DIRECT' as const,
      encounter_id: null, clinical_reason: 'Clinical indication', notes: null,
    };
    const booking = {
      recommendation_id: 'recommendation-1', branch_id: 'branch-1', doctor_id: 'doctor-1',
      scheduled_start: '2026-09-01T10:00', hold_id: null, consent_document_id: null,
      deposit_invoice_id: null, notes: null,
    };

    await act(async () => {
      await feature?.actions.createRecommendation(recommendation);
      await feature?.actions.createBooking(booking);
    });

    expect(testState.createRecommendation).toHaveBeenCalledWith(recommendation);
    expect(testState.createBooking).toHaveBeenCalledWith(booking);
  });

  it('validates then dispatches the reschedule workflow without changing its payload', async () => {
    const variables = {
      id: 'booking-1',
      body: {
        scheduled_start: '2026-09-02T11:00', doctor_id: 'doctor-2', hold_id: null,
        consent_document_id: null, deposit_invoice_id: null, reason: 'Clinical priority changed',
      },
    };

    await act(async () => {
      await feature?.actions.executeWorkflowAction({ mode: 'reschedule', variables });
    });

    expect(testState.rescheduleBooking).toHaveBeenCalledWith(variables);
    expect(() => feature?.actions.executeWorkflowAction({
      mode: 'reschedule',
      variables: { ...variables, body: { ...variables.body, reason: '' } },
    })).toThrow('Reschedule reason is required.');
  });

  it('aggregates active Surgery query loading and error state', async () => {
    testState.recommendationsLoading = true;
    testState.recommendationsError = new Error('Recommendations unavailable.');

    await act(async () => root.render(<Harness />));

    expect(feature?.state.loading).toBe(true);
    expect(feature?.state.error).toBe(testState.recommendationsError);
  });
});
