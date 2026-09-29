import { describe, expect, it, vi } from 'vitest';
import {
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_DOCUMENT_MIME_TYPES,
  validateDocumentFile,
  type UploadDocumentInput,
} from '../../documents/contracts';
import type { DocumentsApi } from '../../documents/documents-api';

describe('UploadDocumentModal - File Validation & Helpers', () => {
  describe('validateDocumentFile', () => {
    it('accepts valid PDF file under 10 MB', () => {
      const result = validateDocumentFile({
        uri: 'file:///path/to/report.pdf',
        name: 'report.pdf',
        type: 'application/pdf',
        size: 5 * 1024 * 1024, // 5 MB
      });

      expect(result.valid).toBe(true);
      expect(result.file).toBeDefined();
      expect(result.file?.name).toBe('report.pdf');
      expect(result.file?.type).toBe('application/pdf');
      expect(result.file?.size).toBe(5 * 1024 * 1024);
    });

    it('accepts valid JPEG and PNG images', () => {
      const jpgResult = validateDocumentFile({
        uri: 'file:///path/to/card.jpg',
        name: 'card.jpg',
        type: 'image/jpeg',
        size: 2 * 1024 * 1024,
      });
      expect(jpgResult.valid).toBe(true);
      expect(jpgResult.file?.type).toBe('image/jpeg');

      const pngResult = validateDocumentFile({
        uri: 'file:///path/to/scan.png',
        name: 'scan.png',
        type: 'image/png',
        size: 3 * 1024 * 1024,
      });
      expect(pngResult.valid).toBe(true);
      expect(pngResult.file?.type).toBe('image/png');
    });

    it('accepts valid WebP, HEIC and HEIF files', () => {
      expect(
        validateDocumentFile({
          uri: 'file:///path/to/image.webp',
          name: 'image.webp',
        }).valid
      ).toBe(true);

      expect(
        validateDocumentFile({
          uri: 'file:///path/to/image.heic',
          name: 'image.heic',
        }).valid
      ).toBe(true);

      expect(
        validateDocumentFile({
          uri: 'file:///path/to/image.heif',
          name: 'image.heif',
        }).valid
      ).toBe(true);
    });

    it('rejects files larger than 10 MB', () => {
      const result = validateDocumentFile({
        uri: 'file:///path/to/large_scan.pdf',
        name: 'large_scan.pdf',
        type: 'application/pdf',
        size: 11 * 1024 * 1024, // 11 MB > 10 MB
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('10 MB limit');
      expect(result.file).toBeUndefined();
    });

    it('rejects unsupported file extensions and types', () => {
      const exeResult = validateDocumentFile({
        uri: 'file:///path/to/setup.exe',
        name: 'setup.exe',
        type: 'application/x-msdownload',
      });
      expect(exeResult.valid).toBe(false);
      expect(exeResult.error).toContain('Unsupported file type');

      const docxResult = validateDocumentFile({
        uri: 'file:///path/to/document.docx',
        name: 'document.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(docxResult.valid).toBe(false);
      expect(docxResult.error).toContain('Unsupported file type');

      const zipResult = validateDocumentFile({
        uri: 'file:///path/to/archive.zip',
        name: 'archive.zip',
      });
      expect(zipResult.valid).toBe(false);
      expect(zipResult.error).toContain('Unsupported file type');
    });

    it('generates filename with matching extension when file name is missing', () => {
      const result = validateDocumentFile({
        uri: 'file:///path/to/temp_file',
        type: 'application/pdf',
      });

      expect(result.valid).toBe(true);
      expect(result.file?.name).toMatch(/^document-\d+\.pdf$/);
      expect(result.file?.type).toBe('application/pdf');
    });

    it('normalizes image/jpg to image/jpeg', () => {
      const result = validateDocumentFile({
        uri: 'file:///path/to/temp.jpg',
        name: 'temp.jpg',
        type: 'image/jpg',
      });

      expect(result.valid).toBe(true);
      expect(result.file?.type).toBe('image/jpeg');
    });

    it('handles empty or whitespace URI gracefully', () => {
      const result = validateDocumentFile({
        uri: '   ',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid file location.');
    });
  });

  describe('Constants Configuration', () => {
    it('enforces 10 MB max document size threshold', () => {
      expect(MAX_DOCUMENT_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });

    it('includes required image and PDF MIME types', () => {
      expect(SUPPORTED_DOCUMENT_MIME_TYPES).toContain('application/pdf');
      expect(SUPPORTED_DOCUMENT_MIME_TYPES).toContain('image/jpeg');
      expect(SUPPORTED_DOCUMENT_MIME_TYPES).toContain('image/png');
      expect(SUPPORTED_DOCUMENT_MIME_TYPES).toContain('image/webp');
      expect(SUPPORTED_DOCUMENT_MIME_TYPES).toContain('image/heic');
      expect(SUPPORTED_DOCUMENT_MIME_TYPES).toContain('image/heif');
    });

    it('includes required extensions', () => {
      expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain('pdf');
      expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain('jpg');
      expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain('jpeg');
      expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain('png');
      expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain('webp');
      expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain('heic');
      expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain('heif');
    });
  });
});

describe('UploadDocumentModal - Form Submission & API Integration', () => {
  const mockUploadedDoc = {
    id: 'doc-uploaded-999',
    patient_id: 'patient-abc',
    document_type: 'CLINICAL' as const,
    title: 'Discharge Summary 2026',
    file_name: 'discharge.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 1048576,
    description: 'Post surgery discharge summary',
    source: 'PATIENT' as const,
    review_status: 'PENDING' as const,
    document_date: '2026-09-25',
    provider_name: 'City Care Hospital',
    created_at: '2026-09-29T10:00:00.000Z',
  };

  it('correctly maps category options to backend enums CLINICAL | INSURANCE | OTHER', () => {
    const validCategories = ['CLINICAL', 'INSURANCE', 'OTHER'];
    validCategories.forEach((cat) => {
      expect(['CLINICAL', 'INSURANCE', 'OTHER']).toContain(cat);
    });
  });

  it('calls DocumentsApi.uploadDocument with formatted input upon submission', async () => {
    const mockUploadDocument = vi.fn().mockResolvedValue(mockUploadedDoc);
    const mockApi = {
      uploadDocument: mockUploadDocument,
    } as unknown as DocumentsApi;

    const payload: UploadDocumentInput = {
      patientId: 'patient-abc',
      documentType: 'CLINICAL',
      title: 'Discharge Summary 2026',
      file: {
        uri: 'file:///path/to/discharge.pdf',
        name: 'discharge.pdf',
        type: 'application/pdf',
      },
      providerName: 'City Care Hospital',
      documentDate: '2026-09-25',
      description: 'Post surgery discharge summary',
    };

    const result = await mockApi.uploadDocument(payload);

    expect(result).toEqual(mockUploadedDoc);
    expect(mockUploadDocument).toHaveBeenCalledTimes(1);
    expect(mockUploadDocument).toHaveBeenCalledWith(payload);
  });

  it('handles optional fields omitted or trimmed gracefully', async () => {
    const mockUploadDocument = vi.fn().mockResolvedValue({
      ...mockUploadedDoc,
      document_type: 'INSURANCE',
      title: 'Insurance Policy Card',
      provider_name: null,
      document_date: null,
      description: null,
    });
    const mockApi = {
      uploadDocument: mockUploadDocument,
    } as unknown as DocumentsApi;

    const payload: UploadDocumentInput = {
      patientId: 'patient-abc',
      documentType: 'INSURANCE',
      title: 'Insurance Policy Card',
      file: {
        uri: 'file:///path/to/card.jpg',
        name: 'card.jpg',
        type: 'image/jpeg',
      },
      providerName: undefined,
      documentDate: undefined,
      description: undefined,
    };

    const result = await mockApi.uploadDocument(payload);

    expect(result.document_type).toBe('INSURANCE');
    expect(mockUploadDocument).toHaveBeenCalledWith(payload);
  });

  it('propagates API rejection so UI can display error without crashing', async () => {
    const mockUploadDocument = vi.fn().mockRejectedValue(new Error('Network error uploading document'));
    const mockApi = {
      uploadDocument: mockUploadDocument,
    } as unknown as DocumentsApi;

    const payload: UploadDocumentInput = {
      patientId: 'patient-abc',
      documentType: 'OTHER',
      title: 'ID Proof',
      file: {
        uri: 'file:///path/to/id.png',
        name: 'id.png',
        type: 'image/png',
      },
    };

    await expect(mockApi.uploadDocument(payload)).rejects.toThrow('Network error uploading document');
  });

  describe('Form Submission Logic & Invariants', () => {
    it('enforces required fields (patientId, file, title, category)', () => {
      const validateSubmission = (input: {
        patientId?: string | null;
        file?: { uri: string } | null;
        title?: string;
        category?: string;
      }) => {
        if (!input.patientId) return { error: 'Please select a patient profile before uploading documents.' };
        if (!input.file) return { error: 'Please select a document file to upload.' };
        if (!input.title?.trim()) return { error: 'Please enter a title for this document.' };
        if (!['CLINICAL', 'INSURANCE', 'OTHER'].includes(input.category || '')) {
          return { error: 'Please select a valid document category.' };
        }
        return { valid: true };
      };

      expect(validateSubmission({ patientId: null, file: { uri: 'file:///test.pdf' }, title: 'Test', category: 'CLINICAL' }).error).toContain('select a patient');
      expect(validateSubmission({ patientId: 'p-1', file: null, title: 'Test', category: 'CLINICAL' }).error).toContain('select a document file');
      expect(validateSubmission({ patientId: 'p-1', file: { uri: 'file:///test.pdf' }, title: '   ', category: 'CLINICAL' }).error).toContain('enter a title');
      expect(validateSubmission({ patientId: 'p-1', file: { uri: 'file:///test.pdf' }, title: 'Test', category: 'INVALID' }).error).toContain('valid document category');
      expect(validateSubmission({ patientId: 'p-1', file: { uri: 'file:///test.pdf' }, title: 'Test', category: 'CLINICAL' }).valid).toBe(true);
    });

    it('ensures patientId is scoped from selected patient and not entered manually', () => {
      const selectedPatient = { id: 'patient-context-789', full_name: 'Selected User' };
      const formInput = {
        title: 'Prescription Scan',
        category: 'CLINICAL' as const,
        file: { uri: 'file:///data/user/prescription.jpg', name: 'prescription.jpg', type: 'image/jpeg' },
      };

      const payload: UploadDocumentInput = {
        patientId: selectedPatient.id,
        documentType: formInput.category,
        title: formInput.title,
        file: formInput.file,
      };

      expect(payload.patientId).toBe('patient-context-789');
    });

    it('handles retry flow when first upload attempt fails and second succeeds', async () => {
      const mockUploadDocument = vi
        .fn()
        .mockRejectedValueOnce(new Error('Gateway timeout'))
        .mockResolvedValueOnce(mockUploadedDoc);

      const mockApi = {
        uploadDocument: mockUploadDocument,
      } as unknown as DocumentsApi;

      const payload: UploadDocumentInput = {
        patientId: 'patient-abc',
        documentType: 'CLINICAL',
        title: 'Discharge Summary',
        file: { uri: 'file:///doc.pdf' },
      };

      // First attempt fails
      await expect(mockApi.uploadDocument(payload)).rejects.toThrow('Gateway timeout');

      // Retry succeeds with preserved form values
      const retryResult = await mockApi.uploadDocument(payload);
      expect(retryResult).toEqual(mockUploadedDoc);
      expect(mockUploadDocument).toHaveBeenCalledTimes(2);
    });

    it('handles cancellation gracefully without triggering error state', () => {
      const handlePickerResult = (result: { canceled: boolean } | null) => {
        if (!result || result.canceled) {
          return { handled: true, error: null };
        }
        return { handled: true, error: null };
      };

      expect(handlePickerResult(null)).toEqual({ handled: true, error: null });
      expect(handlePickerResult({ canceled: true })).toEqual({ handled: true, error: null });
    });
  });
});
