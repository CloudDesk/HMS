import { AppError } from '../../shared/errors/app-error.js';
import type { PatientRepository } from './patient.repository.js';
import type { CreatePatientDTO, CreatePatientDocumentDTO, PatientListQuery, UpdatePatientDTO } from './patient.types.js';

const isValidDate = (value: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const createPatientNumber = (sequence: number) => {
  const year = new Date().getFullYear();
  return `HMS-${year}-${String(sequence + 1).padStart(6, '0')}`;
};

export class PatientService {
  constructor(private readonly repository: PatientRepository) {}

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
    const timeline = await this.repository.listTimeline(id);
    const documents = await this.repository.listDocuments(id);

    return {
      patient,
      timeline,
      documents,
      visits: [],
    };
  }

  async getTimeline(id: string) {
    await this.getById(id);
    return this.repository.listTimeline(id);
  }

  async listDocuments(id: string, documentType?: string) {
    await this.getById(id);
    return this.repository.listDocuments(id, documentType);
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

  async deleteDocument(patientId: string, documentId: string, userId: string) {
    await this.getById(patientId);
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
}

