import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { AdmissionRequest } from '../../api/inpatient-admissions';
import {
  useInpatientAdmissionFeature,
  type InpatientAdmissionFeatureOptions,
} from './useInpatientAdmissionFeature';

// @vitest-environment jsdom

const mockDomain = {
  branches: { data: { data: [{ id: 'b-1', name: 'Main Branch' }] } },
  wards: { data: { data: [{ id: 'w-1', name: 'General Ward' }] }, isLoading: false, error: null },
  beds: { data: { data: [{ id: 'bed-1', ward_id: 'w-1', bed_number: '101' }] }, isLoading: false, error: null },
  requests: {
    data: {
      data: [
        {
          id: 'req-1',
          request_number: 'REQ-001',
          patient_id: 'p-1',
          patient_number: 'MRN-001',
          patient_name: 'John Doe',
          department_id: 'dep-1',
          department_name: 'Cardiology',
          recommending_doctor_id: 'doc-1',
          recommending_doctor_name: 'Dr. Smith',
          source_type: 'DIRECT',
          admission_type: 'INPATIENT',
          priority: 'ROUTINE',
          status: 'PENDING_VALIDATION',
          created_at: '2026-08-29T10:00:00Z',
        } as AdmissionRequest,
      ],
    },
    isLoading: false,
    error: null,
  },
  policy: { data: { admission_consent_required: true, admission_advance_deposit_required: false }, isLoading: false, error: null },
  requestStats: { data: { data: { pendingValidation: 1, readyForConfirmation: 0, confirmed: 0, cancelled: 0 } } },
  departments: { data: { data: [{ id: 'dep-1', name: 'Cardiology' }] } },
  doctors: { data: { data: [{ id: 'doc-1', display_name: 'Dr. Smith' }] } },
  allDepartments: { data: { data: [] } },
  allDoctors: { data: { data: [] } },
  activePatients: { data: { data: [{ id: 'p-1', first_name: 'John', last_name: 'Doe', patient_number: 'MRN-001' }] } },
  patients: { data: { data: [] } },
  createRequest: { mutateAsync: vi.fn(), isPending: false },
  validateRequest: { mutateAsync: vi.fn(), isPending: false },
  confirmRequest: { mutateAsync: vi.fn(), isPending: false },
  cancelRequest: { mutateAsync: vi.fn(), isPending: false },
  uploadConsent: { mutateAsync: vi.fn(), isPending: false },
};

vi.mock('../useInpatientAdmissions', () => ({
  useInpatientAdmissions: () => mockDomain,
}));

vi.mock('../opd/useOpd', () => ({
  useOpdVisits: () => ({ data: { data: [] }, isLoading: false, error: null }),
}));

vi.mock('../emergency/useEmergency', () => ({
  useEmergencyEncountersList: () => ({ data: { data: [] }, isLoading: false, error: null }),
}));

vi.mock('../advance-payment/useAdvancePaymentFeature', () => ({
  useAdvancePaymentFeature: () => ({ advancePayment: null }),
}));

vi.mock('./useInpatientDownstreamFeature', () => ({
  useInpatientDownstreamFeature: () => ({ v: 1 }),
}));

vi.mock('../../routing/navigation', () => ({
  useAppLocation: () => ({ search: '?branch_id=b-1' }),
}));

describe('useInpatientAdmissionFeature', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;
  let featureResult: ReturnType<typeof useInpatientAdmissionFeature> | null = null;

  function TestComponent(props: { options: InpatientAdmissionFeatureOptions }) {
    featureResult = useInpatientAdmissionFeature(props.options);
    return null;
  }

  beforeEach(() => {
    const reactTestEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean;
    };
    reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    queryClient.clear();
    container.remove();
    featureResult = null;
  });

  it('aggregates admission feature state and maps actions', async () => {
    const options = {
      patientSearch: '',
      requestSearch: '',
      createOpen: false,
      selectedRequest: null,
      selectedSourceType: 'DIRECT' as const,
      wardId: 'w-1',
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent options={options} />
        </QueryClientProvider>,
      );
    });

    const result = featureResult;
    if (!result) {
      throw new Error('Expected the admission feature hook to render a result.');
    }
    expect(result.state.branchId).toBe('b-1');
    expect(result.state.branches).toHaveLength(1);
    expect(result.state.requests).toHaveLength(1);
    expect(result.state.beds).toHaveLength(1);
    expect(result.state.availablePatients).toHaveLength(1);
    expect(typeof result.actions.createRequest).toBe('function');
    expect(typeof result.actions.validateRequest).toBe('function');
    expect(typeof result.actions.confirmRequest).toBe('function');
    expect(typeof result.actions.cancelRequest).toBe('function');
  });
});
