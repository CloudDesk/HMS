import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const testState = vi.hoisted(() => ({
  loading: false,
  error: null as Error | null,
  useFeature: vi.fn(),
}));

const patient = {
  id: 'patient-1',
  patient_number: 'MRN-001',
  first_name: 'Asha',
  middle_name: null,
  last_name: 'Rao',
  date_of_birth: '1990-01-01T00:00:00.000Z',
  gender: 'FEMALE' as const,
  parent_guardian: null,
  phone: '9999999999',
  email: 'asha@example.com',
  address: { line1: '1 Hospital Road', city: 'Bengaluru', state: null, country: 'India', postal_code: '560001' },
  emergency_contact: {},
  registration_branch_id: 'branch-1',
  blood_group: 'O+',
  status: 'ACTIVE' as const,
  notes: null,
  created_by: 'user-1',
  updated_by: 'user-1',
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-08-01T10:00:00.000Z',
};

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: { roles: [{ code: 'ADMIN', name: 'Administrator' }], permissions: [] } }),
}));
vi.mock('../routing/navigation', () => ({
  navigate: vi.fn(),
  useAppLocation: () => ({ pathname: '/patients/profile', search: '?id=patient-1&tab=Overview' }),
}));
vi.mock('../hooks/patients/usePatientProfileFeature', () => ({
  usePatientProfileFeature: (...args: unknown[]) => {
    testState.useFeature(...args);
    return {
      state: {
        activeTab: 'Overview',
        patient: testState.loading || testState.error ? null : patient,
        loadingDetails: testState.loading,
        loadingHistory: false,
        detailsError: testState.error,
        timeline: [],
        timelineMeta: { page: 1, limit: 10, total: 0, totalPages: 1 },
        loadingTimeline: false,
        history: null,
        visits: [],
        visitsMeta: { page: 1, limit: 10, total: 0, totalPages: 1 },
        loadingVisits: false,
        appointments: [],
        appointmentsMeta: { page: 1, limit: 10, total: 0, totalPages: 1 },
        loadingAppointments: false,
        labOrders: [],
        loadingLabOrders: false,
        imagingOrders: [],
        loadingImagingOrders: false,
        documents: [],
        loadingDocuments: false,
        consents: [],
        billingInvoices: [],
        loadingBillingInvoices: false,
        doctors: [],
        formatMoney: (value: number) => `INR ${value}`,
        filters: {
          timeline: { from: '', to: '' },
          visits: { date_from: '', date_to: '' },
          appointments: { date_from: '', date_to: '', doctor_id: '' },
        },
        pageInfo: {
          timeline: { page: 1, limit: 10 },
          visits: { page: 1, limit: 10 },
          appointments: { page: 1, limit: 10 },
        },
        isSubmittingUpdate: false,
        isSubmittingUpload: false,
        isSubmittingDocumentReview: false,
      },
      capabilities: { canEdit: true },
      actions: {
        setActiveTab: vi.fn(),
        setTimelineFilters: vi.fn(),
        setTimelinePage: vi.fn(),
        setVisitsFilters: vi.fn(),
        setVisitsPage: vi.fn(),
        setAppointmentFilters: vi.fn(),
        setAppointmentsPage: vi.fn(),
        handleUpdateProfile: vi.fn(),
        handleUploadDocument: vi.fn(),
        handleDownloadDocument: vi.fn(),
        handleReviewDocument: vi.fn(),
      },
    };
  },
}));

import { PatientProfilePage } from './PatientProfilePage';

describe('PatientProfilePage feature-hook rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    testState.loading = false;
    testState.error = null;
    testState.useFeature.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders the patient identity and branch-bound profile context from the feature hook', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={queryClient}><PatientProfilePage /></QueryClientProvider>));

    expect(testState.useFeature).toHaveBeenCalledWith('patient-1', 'Overview');
    expect(container.textContent).toContain('Patient Workspace');
    expect(container.textContent).toContain('Asha Rao');
    expect(container.textContent).toContain('MRN-MRN-001');
    expect(container.textContent).toContain('Book Appointment');
  });

  it('preserves patient-profile loading and error states', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    testState.loading = true;
    await act(async () => root.render(<QueryClientProvider client={queryClient}><PatientProfilePage /></QueryClientProvider>));
    expect(container.textContent).toContain('Loading patient workspace');

    testState.loading = false;
    testState.error = new Error('Patient profile unavailable.');
    await act(async () => root.render(<QueryClientProvider client={queryClient}><PatientProfilePage /></QueryClientProvider>));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Patient profile unavailable.');
  });
});
