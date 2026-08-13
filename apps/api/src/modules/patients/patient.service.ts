import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { env } from '../../config/env.js';
import type { PatientDocumentStorageService } from '../../shared/storage/patient-document-storage.service.js';
import type { PatientRepository } from './patient.repository.js';
import type {
  CreatePatientDTO,
  CreatePatientDocumentDTO,
  PatientDocument,
  PatientDocumentListQuery,
  PatientListQuery,
  PatientTimelineListQuery,
  UpdatePatientDTO,
  UploadPatientDocumentDTO,
} from './patient.types.js';

const isValidDate = (value: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const createPatientNumber = (sequence: number) => {
  const year = new Date().getFullYear();
  return `HMS-${year}-${String(sequence + 1).padStart(6, '0')}`;
};

export class PatientService {
  constructor(
    private readonly repository: PatientRepository,
    private readonly documentStorage: PatientDocumentStorageService,
  ) {}

  async list(query: PatientListQuery) {
    return this.repository.list(query);
  }

  async getById(id: string) {
    const patient = await this.repository.getById(id);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'NOT_FOUND');
    }
    return patient;
  }

  async create(data: CreatePatientDTO, userId: string) {
    if (!isValidDate(data.date_of_birth)) {
      throw new AppError('Date of birth is invalid', 400, 'VALIDATION_ERROR');
    }

    const duplicates = await this.repository.findDuplicateCandidates(data);
    if (duplicates.length > 0) {
      throw new AppError('Potential duplicate patient found', 409, 'DUPLICATE_PATIENT', {
        duplicates,
      });
    }

    const sequence = await this.repository.nextPatientSequence();
    const patient = await this.repository.create(createPatientNumber(sequence), data, userId);

    await this.repository.addTimelineEvent(
      patient.id,
      {
        event_type: 'REGISTRATION',
        title: 'Patient registered',
        description: `${patient.first_name} ${patient.last_name} was registered.`,
      },
      userId,
    );

    return patient;
  }

  async update(id: string, data: UpdatePatientDTO, userId: string) {
    await this.getById(id);

    if (data.date_of_birth && !isValidDate(data.date_of_birth)) {
      throw new AppError('Date of birth is invalid', 400, 'VALIDATION_ERROR');
    }

    const patient = await this.repository.update(id, data, userId);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'NOT_FOUND');
    }

    await this.repository.addTimelineEvent(
      id,
      {
        event_type: 'PROFILE_UPDATED',
        title: 'Patient profile updated',
        description: 'Patient demographic or contact information was updated.',
      },
      userId,
    );

    return patient;
  }

  async getHistory(id: string) {
    const patient = await this.getById(id);
    const timeline = await this.repository.listTimeline(id, { page: 1, limit: 10 });
    const documents = await this.repository.listDocuments(id, { limit: 100 });

    return {
      patient,
      timeline: timeline.data,
      documents: documents.data,
      visits: [],
    };
  }

  async getTimeline(id: string, query: PatientTimelineListQuery) {
    await this.getById(id);
    this.validateTimelineQuery(query);
    return this.repository.listTimeline(id, query);
  }

  async listDocuments(id: string, query: PatientDocumentListQuery) {
    await this.getById(id);
    if (query.visit_id && !Types.ObjectId.isValid(query.visit_id)) {
      throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    }
    return this.repository.listDocuments(id, query);
  }

  async createDocument(id: string, data: CreatePatientDocumentDTO, userId: string) {
    await this.getById(id);
    const document = await this.repository.createDocument(id, data, userId);
    const isConsent = document.document_type === 'CONSENT';

    await this.repository.addTimelineEvent(
      id,
      {
        event_type: isConsent ? 'CONSENT_ADDED' : 'DOCUMENT_ADDED',
        title: isConsent ? 'Consent added' : 'Document added',
        description: `${document.title} was linked to the patient record.`,
      },
      userId,
    );

    return document;
  }

  async uploadDocument(id: string, data: UploadPatientDocumentDTO, userId: string) {
    await this.getById(id);
    this.validateDocumentUpload(data);

    const { storageKey } = await this.documentStorage.uploadPatientDocument({
      patientId: id,
      fileName: data.file_name,
      mimeType: data.mime_type,
      data: data.data,
    });

    try {
      return await this.createDocument(
        id,
        {
          visit_id: data.visit_id,
          document_type: data.document_type,
          title: data.title,
          file_name: data.file_name,
          mime_type: data.mime_type,
          file_size_bytes: data.file_size_bytes,
          storage_key: storageKey,
          description: data.description,
          consent_status: data.consent_status,
          signed_at: data.signed_at,
          valid_until: data.valid_until,
          signed_by_name: data.signed_by_name,
        },
        userId,
      );
    } catch (error) {
      await this.documentStorage.deleteIfExists(storageKey);
      throw error;
    }
  }

  async replaceDocument(patientId: string, documentId: string, data: UploadPatientDocumentDTO, userId: string) {
    await this.getById(patientId);
    this.validateDocumentUpload(data);
    const activeDocument = await this.getActiveDocument(patientId, documentId);
    const { storageKey } = await this.documentStorage.uploadPatientDocument({
      patientId,
      fileName: data.file_name,
      mimeType: data.mime_type,
      data: data.data,
    });

    try {
      const document = await this.repository.replaceDocument(
        patientId,
        documentId,
        {
          visit_id: activeDocument.visit_id,
          document_type: data.document_type,
          title: data.title,
          file_name: data.file_name,
          mime_type: data.mime_type,
          file_size_bytes: data.file_size_bytes,
          storage_key: storageKey,
          description: data.description,
          consent_status: data.consent_status,
          signed_at: data.signed_at,
          valid_until: data.valid_until,
          signed_by_name: data.signed_by_name,
        },
        userId,
      );
      if (!document) {
        throw new AppError('Patient document not found', 404, 'NOT_FOUND');
      }
      await this.documentStorage.deleteIfExists(activeDocument.storage_key);
      return document;
    } catch (error) {
      await this.documentStorage.deleteIfExists(storageKey);
      throw error;
    }
  }

  async downloadDocument(patientId: string, documentId: string) {
    await this.getById(patientId);
    const document = await this.getActiveDocument(patientId, documentId);
    const storedFile = await this.documentStorage.download(document.storage_key);

    return {
      document,
      data: storedFile.data,
      contentType: storedFile.contentType ?? document.mime_type,
    };
  }

  async deleteDocument(patientId: string, documentId: string, userId: string) {
    await this.getById(patientId);
    const activeDocument = await this.getActiveDocument(patientId, documentId);
    await this.documentStorage.deleteIfExists(activeDocument.storage_key);
    const document = await this.repository.deleteDocument(patientId, documentId, userId);
    if (!document) {
      throw new AppError('Patient document not found', 404, 'NOT_FOUND');
    }

    await this.repository.addTimelineEvent(
      patientId,
      {
        event_type: 'DOCUMENT_DELETED',
        title: 'Document removed',
        description: `${document.title} was removed from the patient record.`,
      },
      userId,
    );

    return document;
  }

  private async getActiveDocument(patientId: string, documentId: string): Promise<PatientDocument> {
    const document = await this.repository.getDocument(patientId, documentId);
    if (!document) {
      throw new AppError('Patient document not found', 404, 'NOT_FOUND');
    }

    return document;
  }

  private validateDocumentUpload(data: UploadPatientDocumentDTO) {
    if (data.file_size_bytes <= 0 || data.data.byteLength <= 0) {
      throw new AppError('Document file is required', 400, 'VALIDATION_ERROR');
    }

    if (data.file_size_bytes > env.upload.patientDocumentMaxFileSizeBytes) {
      throw new AppError('Document file exceeds the allowed size', 400, 'FILE_TOO_LARGE');
    }

    if (!env.upload.patientDocumentAllowedMimeTypes.includes(data.mime_type)) {
      throw new AppError('Document file type is not allowed', 400, 'INVALID_FILE_TYPE');
    }

    if (data.document_type === 'CONSENT') {
      if (!data.consent_status) {
        throw new AppError('Consent status is required', 400, 'VALIDATION_ERROR');
      }
      if (data.signed_at && !isValidDate(data.signed_at)) {
        throw new AppError('Consent signed date is invalid', 400, 'VALIDATION_ERROR');
      }
      if (data.valid_until && !isValidDate(data.valid_until)) {
        throw new AppError('Consent validity date is invalid', 400, 'VALIDATION_ERROR');
      }
    }
  }

  private validateTimelineQuery(query: PatientTimelineListQuery) {
    if (query.from && !isValidDate(query.from)) {
      throw new AppError('Timeline from date is invalid', 400, 'VALIDATION_ERROR');
    }

    if (query.to && !isValidDate(query.to)) {
      throw new AppError('Timeline to date is invalid', 400, 'VALIDATION_ERROR');
    }

    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw new AppError('Timeline from date must be before to date', 400, 'VALIDATION_ERROR');
    }
  }
}

