import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const recommendation = {
  id: 'recommendation-1',
  recommendation_number: 'PROC-REC-001',
  patient_id: 'patient-1',
  patient_number: 'MRN-001',
  patient_name: 'Surgery Patient',
  branch_id: 'branch-1',
  department_id: 'department-1',
  department_name: 'General Surgery',
  recommending_doctor_id: 'doctor-1',
  recommending_doctor_name: 'Dr Surgeon',
  service_id: 'service-1',
  service_name: 'Appendectomy',
  encounter_type: 'DIRECT',
  encounter_id: null,
  clinical_reason: 'Acute appendicitis',
  notes: null,
  status: 'ACTIVE',
  booking_id: null,
  cancellation_reason: null,
  created_at: '2026-08-29T10:00:00.000Z',
  updated_at: '2026-08-29T10:00:00.000Z',
};

const testState = vi.hoisted(() => ({
  loading: false,
  error: false,
}));

vi.mock('../hooks/surgery/useSurgeryWorkspaceFeature', () => ({
  useSurgeryWorkspaceFeature: () => ({
    state: {
      tab: 'recommendations',
      branchId: 'branch-1',
      status: '',
      date: '2026-08-29',
      searchText: '',
      patientSearch: '',
      branches: [{ id: 'branch-1', name: 'Main Branch' }],
      departments: [],
      doctors: [],
      services: [],
      patients: [],
      recommendations: testState.loading || testState.error ? [] : [recommendation],
      bookings: [],
      scheduleRows: [],
      recommendationsQuery: { isLoading: testState.loading, isError: testState.error },
      bookingsQuery: { isLoading: false, isError: false },
      alternatives: [],
      recommendedSlots: [],
      alternativesLoading: false,
      pending: { createRecommendation: false, createBooking: false, workflowAction: false },
    },
    actions: {
      setTab: vi.fn(), setBranchId: vi.fn(), setStatus: vi.fn(), setDate: vi.fn(),
      setSearchText: vi.fn(), setPatientSearch: vi.fn(), setAvailability: vi.fn(),
      createRecommendation: vi.fn(), createBooking: vi.fn(), executeWorkflowAction: vi.fn(),
    },
  }),
}));

import { SurgeryWorkspacePage } from './SurgeryWorkspacePage';

describe('SurgeryWorkspacePage feature-hook rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    testState.loading = false;
    testState.error = false;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders patient and procedure context supplied by the feature hook', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={queryClient}><SurgeryWorkspacePage /></QueryClientProvider>));

    expect(container.textContent).toContain('Surgery & Procedures');
    expect(container.textContent).toContain('Surgery Patient');
    expect(container.textContent).toContain('MRN-001');
    expect(container.textContent).toContain('Appendectomy');
    expect(container.textContent).toContain('Acute appendicitis');
  });

  it('preserves recommendation loading and error rendering', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    testState.loading = true;
    await act(async () => root.render(<QueryClientProvider client={queryClient}><SurgeryWorkspacePage /></QueryClientProvider>));
    expect(container.textContent).toContain('Loading recommendations');

    testState.loading = false;
    testState.error = true;
    await act(async () => root.render(<QueryClientProvider client={queryClient}><SurgeryWorkspacePage /></QueryClientProvider>));
    expect(container.textContent).toContain('Unable to load recommendations');
  });
});
