import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  superAdmin: true,
  update: vi.fn(async (input: unknown) => input),
  upload: vi.fn(async (input: unknown) => input),
  download: vi.fn(async (input: unknown) => ({ blob: new Blob(['record']), fileName: 'record.pdf', input })),
  review: vi.fn(async (input: unknown) => input),
}));

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      roles: testState.superAdmin ? [{ code: 'SUPER_ADMIN', name: 'Super Admin' }] : [],
      permissions: [],
    },
  }),
}));
vi.mock('../../api/useSettings', () => ({
  useCurrencyFormatter: () => (value: number) => `INR ${value}`,
}));
vi.mock('../appointments/useAppointments', () => ({
  useAppointmentsList: () => ({ data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }, isLoading: false }),
}));
vi.mock('../billing/useBilling', () => ({
  useBillingInvoices: () => ({ data: { data: [] }, isLoading: false }),
}));
vi.mock('../doctors/useDoctors', () => ({
  useDoctorsList: () => ({ data: { data: [] } }),
}));
vi.mock('../imaging/useImaging', () => ({
  useImagingOrders: () => ({ data: { data: [] }, isLoading: false }),
}));
vi.mock('../laboratory/useLaboratory', () => ({
  useLaboratoryOrders: () => ({ data: { data: [] }, isLoading: false }),
}));
vi.mock('../opd/useOpd', () => ({
  useOpdVisits: () => ({ data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }, isLoading: false }),
}));
vi.mock('./usePatients', () => ({
  usePatientDetails: (id: string | null) => ({ data: id ? { id, patient_number: 'MRN-001' } : null, isLoading: false, error: null }),
  usePatientDocuments: () => ({ data: { data: [] }, isLoading: false }),
  usePatientHistory: () => ({ data: null, isLoading: false }),
  usePatientTimeline: () => ({ data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }, isLoading: false }),
  useUpdatePatient: () => ({ mutateAsync: testState.update, isPending: false }),
  useUploadPatientDocument: () => ({ mutateAsync: testState.upload, isPending: false }),
  useDownloadPatientDocument: () => ({ mutateAsync: testState.download, isPending: false }),
  useReviewPatientDocument: () => ({ mutateAsync: testState.review, isPending: false }),
}));

import { usePatientProfileFeature } from './usePatientProfileFeature';

describe('usePatientProfileFeature orchestration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let feature: ReturnType<typeof usePatientProfileFeature> | undefined;

  function Harness() {
    feature = usePatientProfileFeature('patient-1');
    return null;
  }

  beforeEach(async () => {
    testState.superAdmin = true;
    for (const mock of [testState.update, testState.upload, testState.download, testState.review]) {
      mock.mockClear();
    }
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps the requested patient context in feature state', () => {
    expect(feature?.state.patient).toEqual(expect.objectContaining({ id: 'patient-1', patient_number: 'MRN-001' }));
    expect(feature?.state.loadingDetails).toBe(false);
    expect(feature?.capabilities.canEdit).toBe(true);
  });

  it('keeps profile editing permission-gated', async () => {
    testState.superAdmin = false;
    await act(async () => root.render(<Harness />));

    expect(feature?.capabilities.canEdit).toBe(false);
  });

  it('forwards unchanged profile and document mutation payloads', async () => {
    const updatePayload = { first_name: 'Asha', last_name: 'Rao', date_of_birth: '1990-01-01', gender: 'FEMALE' as const };
    const file = new File(['clinical'], 'clinical.pdf', { type: 'application/pdf' });
    const uploadPayload = { document_type: 'CLINICAL' as const, title: 'Clinical record', file };

    await act(async () => {
      await feature?.actions.handleUpdateProfile(updatePayload);
      await feature?.actions.handleUploadDocument(uploadPayload);
    });

    expect(testState.update).toHaveBeenCalledWith({ id: 'patient-1', payload: updatePayload });
    expect(testState.upload).toHaveBeenCalledWith({ id: 'patient-1', payload: uploadPayload });
  });

  it('preserves document download and review sequencing and payloads', async () => {
    const reviewPayload = { review_status: 'REJECTED' as const, review_notes: 'Identity mismatch' };

    await act(async () => {
      await feature?.actions.handleDownloadDocument('document-1');
      await feature?.actions.handleReviewDocument('document-1', reviewPayload);
    });

    expect(testState.download).toHaveBeenCalledWith({ patientId: 'patient-1', docId: 'document-1' });
    expect(testState.review).toHaveBeenCalledWith({
      patientId: 'patient-1',
      documentId: 'document-1',
      payload: reviewPayload,
    });
    expect(testState.download.mock.invocationCallOrder[0]).toBeLessThan(testState.review.mock.invocationCallOrder[0] ?? Infinity);
  });
});
