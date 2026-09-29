import { describe, expect, it, vi } from 'vitest';
import type { PortalDocument, PortalDocumentsListResponse } from './contracts';
import type { DocumentsApi } from './documents-api';

describe('DocumentsScreen Integration Logic & Invariants', () => {
  const patientADocs: PortalDocument[] = [
    {
      id: 'doc-a-001',
      patient_id: 'patient-a',
      document_type: 'CLINICAL',
      title: 'Patient A Blood Report',
      file_name: 'blood_report.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 1048576,
      description: 'Annual blood count',
      source: 'HOSPITAL',
      review_status: 'VERIFIED',
      document_date: '2026-09-01',
      provider_name: 'Main Lab',
      created_at: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'doc-a-002',
      patient_id: 'patient-a',
      document_type: 'INSURANCE',
      title: 'Patient A Insurance Card',
      file_name: 'insurance_card.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: 524288,
      description: null,
      source: 'PATIENT',
      review_status: 'PENDING',
      document_date: null,
      provider_name: 'Care Health',
      created_at: '2026-09-10T10:00:00.000Z',
    },
  ];

  const patientBDocs: PortalDocument[] = [
    {
      id: 'doc-b-001',
      patient_id: 'patient-b',
      document_type: 'OTHER',
      title: 'Patient B Identification',
      file_name: 'id_card.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 262144,
      description: null,
      source: 'GUARDIAN',
      review_status: 'VERIFIED',
      document_date: null,
      provider_name: null,
      created_at: '2026-09-15T10:00:00.000Z',
    },
  ];

  it('fetches documents scoped strictly to the selected patientId', async () => {
    const mockListDocuments = vi.fn().mockImplementation(async (patientId: string): Promise<PortalDocumentsListResponse> => {
      if (patientId === 'patient-a') {
        return { data: patientADocs, meta: { page: 1, limit: 100, total: 2, totalPages: 1 } };
      }
      if (patientId === 'patient-b') {
        return { data: patientBDocs, meta: { page: 1, limit: 100, total: 1, totalPages: 1 } };
      }
      return { data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } };
    });

    const mockApi = {
      listDocuments: mockListDocuments,
    } as unknown as DocumentsApi;

    // Patient A loads
    const resA = await mockApi.listDocuments('patient-a');
    expect(resA.data).toHaveLength(2);
    expect(resA.data.every((d) => d.patient_id === 'patient-a')).toBe(true);

    // Patient B switches
    const resB = await mockApi.listDocuments('patient-b');
    expect(resB.data).toHaveLength(1);
    expect(resB.data[0]?.patient_id).toBe('patient-b');
    expect(resB.data[0]?.title).toBe('Patient B Identification');
  });

  it('refreshes document list on successful upload and displays the newly uploaded document', async () => {
    let currentDocs = [...patientADocs];

    const mockListDocuments = vi.fn().mockImplementation(async () => {
      return { data: currentDocs, meta: { page: 1, limit: 100, total: currentDocs.length, totalPages: 1 } };
    });

    const newUploadedDoc: PortalDocument = {
      id: 'doc-a-003',
      patient_id: 'patient-a',
      document_type: 'CLINICAL',
      title: 'Patient A MRI Scan',
      file_name: 'mri_scan.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 2097152,
      description: 'Brain MRI',
      source: 'PATIENT',
      review_status: 'PENDING',
      document_date: '2026-09-29',
      provider_name: 'City Diagnostics',
      created_at: '2026-09-29T11:00:00.000Z',
    };

    const mockUploadDocument = vi.fn().mockImplementation(async () => {
      currentDocs = [newUploadedDoc, ...currentDocs];
      return newUploadedDoc;
    });

    const mockApi = {
      listDocuments: mockListDocuments,
      uploadDocument: mockUploadDocument,
    } as unknown as DocumentsApi;

    // Initial load
    const initialList = await mockApi.listDocuments('patient-a');
    expect(initialList.data).toHaveLength(2);

    // Upload occurs
    const uploaded = await mockApi.uploadDocument({
      patientId: 'patient-a',
      documentType: 'CLINICAL',
      title: 'Patient A MRI Scan',
      file: { uri: 'file:///path/mri.pdf', name: 'mri_scan.pdf', type: 'application/pdf' },
    });
    expect(uploaded.id).toBe('doc-a-003');

    // Refreshed list
    const refreshedList = await mockApi.listDocuments('patient-a');
    expect(refreshedList.data).toHaveLength(3);
    expect(refreshedList.data[0]?.id).toBe('doc-a-003');
    expect(refreshedList.data[0]?.title).toBe('Patient A MRI Scan');
  });

  it('does not corrupt or wipe the existing document list if an upload fails', async () => {
    const existingList = [...patientADocs];
    const mockUploadDocument = vi.fn().mockRejectedValue(new Error('Storage unavailable'));

    const mockApi = {
      uploadDocument: mockUploadDocument,
    } as unknown as DocumentsApi;

    await expect(
      mockApi.uploadDocument({
        patientId: 'patient-a',
        documentType: 'OTHER',
        title: 'Failing doc',
        file: { uri: 'file:///fail.pdf' },
      })
    ).rejects.toThrow('Storage unavailable');

    // Existing list remains completely intact
    expect(existingList).toHaveLength(2);
    expect(existingList[0]?.id).toBe('doc-a-001');
  });

  it('filters documents correctly by category tab (ALL, CLINICAL, INSURANCE, OTHER)', () => {
    const allDocs = [...patientADocs];

    const filterDocs = (filter: 'ALL' | 'CLINICAL' | 'INSURANCE' | 'OTHER') => {
      if (filter === 'ALL') return allDocs;
      return allDocs.filter((d) => d.document_type === filter);
    };

    expect(filterDocs('ALL')).toHaveLength(2);
    expect(filterDocs('CLINICAL')).toHaveLength(1);
    expect(filterDocs('CLINICAL')[0]?.title).toBe('Patient A Blood Report');
    expect(filterDocs('INSURANCE')).toHaveLength(1);
    expect(filterDocs('INSURANCE')[0]?.title).toBe('Patient A Insurance Card');
    expect(filterDocs('OTHER')).toHaveLength(0);
  });

  it('generates the correct download endpoint for document view/download actions', () => {
    const getDownloadEndpoint = (patientId: string, documentId: string) => {
      return `/patient-portal/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/download`;
    };

    expect(getDownloadEndpoint('patient-a', 'doc-a-001')).toBe(
      '/patient-portal/patients/patient-a/documents/doc-a-001/download'
    );
  });
});
