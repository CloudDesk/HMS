import { Types } from 'mongoose';
import { UserModel } from '../users/user.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { env } from '../../config/env.js';
import type { PatientDocumentStorageService } from '../../shared/storage/patient-document-storage.service.js';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import type { PatientRepository } from './patient.repository.js';
import type {
  CreatePatientDTO,
  CreatePatientDocumentDTO,
  PatientDocument,
  PatientDocumentListQuery,
  PatientListQuery,
  PatientTimelineListQuery,
  ReviewPatientDocumentDTO,
  UpdatePatientDTO,
  UploadPatientDocumentDTO,
} from './patient.types.js';
import { allocatePatientNumber } from './patient-number.service.js';

const isValidDate = (value: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const isValidAfricanPhone = (phone: string): boolean => {
  if (!phone || !phone.trim()) return true;
  const cleaned = phone.replace(/[\s()-]/g, '');
  return /^(\+?(?:2[0-9]{2}|27|20|21[0-9]|22[0-9]|23[0-9]|24[0-9]|25[0-9]|26[0-9]|29[0-9])|0)?[0-9]{8,12}$/.test(cleaned);
};

export class PatientService {
  constructor(
    private readonly repository: PatientRepository,
    private readonly documentStorage: PatientDocumentStorageService,
    private readonly sequenceService: SequenceService,
  ) {}

  async list(query: PatientListQuery, userId?: string) {
    const scope = userId ? await this.repository.resolveBranchScope(userId) : undefined;
    return this.repository.list(query, scope);
  }

  async getById(id: string, userId?: string) {
    const scope = userId ? await this.repository.resolveBranchScope(userId) : undefined;
    const patient = await this.repository.getById(id, scope);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'NOT_FOUND');
    }
    return patient;
  }

  async create(data: CreatePatientDTO, userId: string) {
    if (!isValidDate(data.date_of_birth)) {
      throw new AppError('Date of birth is invalid', 400, 'VALIDATION_ERROR');
    }
    if (data.phone && !isValidAfricanPhone(data.phone)) {
      throw new AppError('Phone number must be a valid African regional phone number', 400, 'VALIDATION_ERROR');
    }

    const user = await UserModel.findById(userId).lean();
    const defaultBranchId = user?.branchIds?.[0]?.toString();

    const scope = await this.repository.resolveBranchScope(userId, data.registration_branch_id ?? undefined);
    const registrationBranchId = data.registration_branch_id ?? (scope?.length === 1 ? scope[0] : defaultBranchId);
    if (!registrationBranchId) {
      throw new AppError('Registration branch is required', 400, 'BRANCH_REQUIRED');
    }
    const scopedData = { ...data, registration_branch_id: registrationBranchId };
    const duplicates = await this.repository.findDuplicateCandidates(scopedData, scope);
    if (duplicates.length > 0) {
      throw new AppError('Potential duplicate patient found', 409, 'DUPLICATE_PATIENT', {
        duplicates,
      });
    }

    const sequence = await this.sequenceService.getNextSequence('patient');
    const patient = await this.repository.create(this.sequenceService.formatStandardSequence('HMS', sequence), scopedData, userId);

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
    const scope = await this.repository.resolveBranchScope(userId, data.registration_branch_id ?? undefined);
    await this.repository.getById(id, scope).then((patient) => {
      if (!patient) throw new AppError('Patient not found', 404, 'NOT_FOUND');
    });

    if (data.date_of_birth && !isValidDate(data.date_of_birth)) {
      throw new AppError('Date of birth is invalid', 400, 'VALIDATION_ERROR');
    }

    const patient = await this.repository.update(id, data, userId, scope);
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

  async getHistory(id: string, userId?: string) {
    const patient = await this.getById(id, userId);
    const timeline = await this.repository.listTimeline(id, { page: 1, limit: 10 });
    const documents = await this.repository.listDocuments(id, { limit: 100 });

    return {
      patient,
      timeline: timeline.data,
      documents: documents.data,
      visits: [],
    };
  }

  async getTimeline(id: string, query: PatientTimelineListQuery, userId?: string) {
    await this.getById(id, userId);
    this.validateTimelineQuery(query);
    return this.repository.listTimeline(id, query);
  }

  async listDocuments(id: string, query: PatientDocumentListQuery, userId?: string) {
    await this.getById(id, userId);
    if (query.visit_id && !Types.ObjectId.isValid(query.visit_id)) {
      throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    }
    for (const contextId of [query.admission_id, query.procedure_id]) {
      if (contextId && !Types.ObjectId.isValid(contextId)) throw new AppError('Consent context id is invalid', 400, 'VALIDATION_ERROR');
    }
    return this.repository.listDocuments(id, query);
  }

  async listDocumentsForPortal(patientId: string, query: PatientDocumentListQuery = {}) {
    if (query.visit_id && !Types.ObjectId.isValid(query.visit_id)) {
      throw new AppError('OPD visit id is invalid', 400, 'VALIDATION_ERROR');
    }
    return this.repository.listDocuments(patientId, query);
  }

  async uploadDocumentForPortal(patientId: string, data: UploadPatientDocumentDTO, userId: string) {
    this.validateDocumentUpload(data);
    const { storageKey } = await this.documentStorage.uploadPatientDocument({
      patientId,
      fileName: data.file_name,
      mimeType: data.mime_type,
      data: data.data,
    });
    try {
      const document = await this.repository.createDocument(patientId, {
        document_type: data.document_type,
        title: data.title,
        file_name: data.file_name,
        mime_type: data.mime_type,
        file_size_bytes: data.file_size_bytes,
        storage_key: storageKey,
        description: data.description,
        source: data.source,
        review_status: data.review_status,
        document_date: data.document_date,
        provider_name: data.provider_name,
      }, userId);
      await this.repository.addTimelineEvent(patientId, {
        event_type: 'DOCUMENT_ADDED',
        title: 'Patient-supplied document added',
        description: `${document.title} was uploaded and is pending clinical review.`,
      }, userId);
      return document;
    } catch (error) {
      await this.documentStorage.deleteIfExists(storageKey);
      throw error;
    }
  }

  async downloadDocumentForPortal(patientId: string, documentId: string) {
    const document = await this.getActiveDocument(patientId, documentId);
    const storedFile = await this.documentStorage.download(document.storage_key);
    return { document, data: storedFile.data, contentType: storedFile.contentType ?? document.mime_type };
  }

  async reviewDocument(
    patientId: string,
    documentId: string,
    data: ReviewPatientDocumentDTO,
    userId: string,
  ) {
    await this.getById(patientId, userId);
    const document = await this.getActiveDocument(patientId, documentId);
    if (document.source === 'HOSPITAL' || document.review_status === 'NOT_REQUIRED') {
      throw new AppError('Hospital-uploaded documents do not require review', 400, 'DOCUMENT_REVIEW_NOT_REQUIRED');
    }
    if (document.review_status !== 'PENDING') {
      throw new AppError('This document has already been reviewed', 409, 'DOCUMENT_ALREADY_REVIEWED');
    }
    const reviewNotes = data.review_notes?.trim() || null;
    if (data.review_status === 'REJECTED' && !reviewNotes) {
      throw new AppError('A rejection reason is required', 400, 'REVIEW_REASON_REQUIRED');
    }

    const reviewed = await this.repository.reviewDocument(
      patientId,
      documentId,
      data.review_status,
      reviewNotes,
      userId,
    );
    if (!reviewed) {
      throw new AppError('Document is no longer awaiting review', 409, 'DOCUMENT_ALREADY_REVIEWED');
    }
    await this.repository.addTimelineEvent(patientId, {
      event_type: 'DOCUMENT_REVIEWED',
      title: data.review_status === 'VERIFIED' ? 'Document verified' : 'Document rejected',
      description: reviewNotes
        ? `${reviewed.title}: ${reviewNotes}`
        : `${reviewed.title} was verified by hospital staff.`,
    }, userId);
    return reviewed;
  }

  async getDocument(patientId: string, documentId: string, userId?: string) {
    await this.getById(patientId, userId);
    return this.getActiveDocument(patientId, documentId);
  }

  async createDocument(id: string, data: CreatePatientDocumentDTO, userId: string) {
    await this.getById(id, userId);
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

    if (isConsent) {
      await this.repository.auditClinicalEvent('consent.document.attached', userId, {
        patientId: id, documentId: document.id, consentTemplateId: document.consent_template_id,
        contextType: document.context_type, contextId: document.context_id, status: document.consent_status,
      });
    }
    return document;
  }

  async uploadDocument(id: string, data: UploadPatientDocumentDTO, userId: string) {
    await this.getById(id, userId);
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
          admission_id: data.admission_id,
          procedure_id: data.procedure_id,
          context_type: data.context_type,
          context_id: data.context_id,
          consent_template_id: data.consent_template_id,
          consent_category: data.consent_category,
          consent_version: data.consent_version,
          document_type: data.document_type,
          title: data.title,
          file_name: data.file_name,
          mime_type: data.mime_type,
          file_size_bytes: data.file_size_bytes,
          storage_key: storageKey,
          description: data.description,
          consent_status: data.consent_status,
          consent_kind: data.consent_kind,
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
    await this.getById(patientId, userId);
    const activeDocument = await this.getActiveDocument(patientId, documentId);
    this.validateDocumentUpload({
      ...data,
      consent_template_id: activeDocument.consent_template_id,
      consent_category: activeDocument.consent_category,
      consent_version: activeDocument.consent_version,
      context_type: activeDocument.context_type,
    });
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
          admission_id: activeDocument.admission_id,
          procedure_id: activeDocument.procedure_id,
          context_type: activeDocument.context_type,
          context_id: activeDocument.context_id,
          consent_template_id: activeDocument.consent_template_id,
          consent_category: activeDocument.consent_category,
          consent_version: activeDocument.consent_version,
          document_type: data.document_type,
          title: data.title,
          file_name: data.file_name,
          mime_type: data.mime_type,
          file_size_bytes: data.file_size_bytes,
          storage_key: storageKey,
          description: data.description,
          consent_status: data.consent_status,
          consent_kind: data.consent_kind,
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
      if (document.document_type === 'CONSENT') {
        await this.repository.auditClinicalEvent('consent.document.replaced', userId, { patientId, documentId, status: 'ATTACHED' });
      }
      return document;
    } catch (error) {
      await this.documentStorage.deleteIfExists(storageKey);
      throw error;
    }
  }

  async downloadDocument(patientId: string, documentId: string, userId?: string) {
    await this.getById(patientId, userId);
    const document = await this.getActiveDocument(patientId, documentId);
    const storedFile = await this.documentStorage.download(document.storage_key);

    return {
      document,
      data: storedFile.data,
      contentType: storedFile.contentType ?? document.mime_type,
    };
  }

  async deleteDocument(patientId: string, documentId: string, userId: string) {
    await this.getById(patientId, userId);
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
    if (document.document_type === 'CONSENT') {
      await this.repository.auditClinicalEvent('consent.document.deleted', userId, { patientId, documentId });
    }

    return document;
  }

  async verifyConsent(patientId: string, documentId: string, userId: string) {
    await this.getById(patientId, userId);
    const current = await this.getActiveDocument(patientId, documentId);
    if (current.document_type !== 'CONSENT') throw new AppError('Document is not a consent', 400, 'NOT_A_CONSENT');
    if (current.consent_status !== 'ATTACHED') throw new AppError('Only an attached consent can be verified', 409, 'CONSENT_NOT_ATTACHED');
    const document = await this.repository.verifyConsent(patientId, documentId, userId);
    if (!document) throw new AppError('Consent status changed; refresh and try again', 409, 'CONSENT_STATUS_CONFLICT');
    await this.repository.addTimelineEvent(patientId, { event_type: 'CONSENT_VERIFIED', title: 'Consent verified', description: `${document.title} was verified.` }, userId);
    await this.repository.auditClinicalEvent('consent.document.verified', userId, {
      patientId, documentId, consentTemplateId: document.consent_template_id,
      contextType: document.context_type, contextId: document.context_id,
    });
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

    if (data.document_date && !isValidDate(data.document_date)) {
      throw new AppError('Document date is invalid', 400, 'VALIDATION_ERROR');
    }

    if (data.document_type === 'CONSENT') {
      if (!data.consent_template_id || !data.consent_category || !data.consent_version || !data.context_type) {
        throw new AppError('Consent template, category, version, and context are required', 400, 'VALIDATION_ERROR');
      }
      if (data.signed_at && !isValidDate(data.signed_at)) {
        throw new AppError('Consent signed date is invalid', 400, 'VALIDATION_ERROR');
      }
      if (data.valid_until && !isValidDate(data.valid_until)) {
        throw new AppError('Consent validity date is invalid', 400, 'VALIDATION_ERROR');
      }
      if ((data.context_type && !data.context_id) || (!data.context_type && data.context_id)) {
        throw new AppError('Consent context type and id must be provided together', 400, 'VALIDATION_ERROR');
      }
      if (data.context_id && !Types.ObjectId.isValid(data.context_id)) throw new AppError('Consent context id is invalid', 400, 'VALIDATION_ERROR');
    }
  }

  async verifyContextConsent(patientId: string, documentId: string | null, contextType: 'INPATIENT_ADMISSION' | 'PROCEDURE_BOOKING', contextId: string, required: boolean, session: import('mongoose').ClientSession) {
    if (!required && !documentId) return null;
    if (!documentId) throw new AppError('A signed admission consent is required', 409, 'CONSENT_REQUIRED');
    const document = await this.repository.getValidContextConsent(patientId, documentId, contextType, contextId, session);
    if (!document) throw new AppError('The selected consent is missing, expired, unsigned, or belongs to another context', 409, 'CONSENT_REQUIRED');
    return document;
  }

  async addAdmissionTimeline(patientId: string, eventType: 'ADMISSION_REQUEST_CREATED' | 'INPATIENT_ADMISSION_CONFIRMED' | 'ADMISSION_REQUEST_CANCELLED', title: string, description: string, actor: string, session: import('mongoose').ClientSession) {
    return this.repository.addTimelineEvent(patientId, { event_type: eventType, title, description }, actor, session);
  }

  async addProcedureTimeline(patientId: string, eventType: Extract<import('./patient.types.js').PatientTimelineEventType, `PROCEDURE_${string}`>, title: string, description: string, actor: string, session: import('mongoose').ClientSession) {
    return this.repository.addTimelineEvent(patientId, { event_type: eventType, title, description }, actor, session);
  }

  async addEmergencyTimeline(patientId: string, eventType: Extract<import('./patient.types.js').PatientTimelineEventType, `EMERGENCY_${string}`>, title: string, description: string, actor: string, session: import('mongoose').ClientSession) {
    return this.repository.addTimelineEvent(patientId, { event_type: eventType, title, description }, actor, session);
  }

  async addDownstreamTimeline(patientId: string, eventType: Extract<import('./patient.types.js').PatientTimelineEventType, `INPATIENT_${string}` | `PROCEDURE_${'PRESCRIPTION' | 'LAB_ORDER' | 'IMAGING_ORDER'}_SUBMITTED`>, title: string, description: string, actor: string, session: import('mongoose').ClientSession) {
    return this.repository.addTimelineEvent(patientId, { event_type: eventType, title, description }, actor, session);
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

