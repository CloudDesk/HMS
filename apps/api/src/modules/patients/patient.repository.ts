import { Types, type SortOrder } from 'mongoose';
import {
  PatientDocumentModel,
  PatientModel,
  PatientTimelineEventModel,
  type PatientDocumentFields,
  type PatientDocumentMetadataFields,
  type PatientTimelineEventFields,
} from './patient.model.js';
import type {
  CreatePatientDTO,
  CreatePatientDocumentDTO,
  Patient,
  PatientDocument,
  PatientListQuery,
  PatientTimelineEvent,
  UpdatePatientDTO,
} from './patient.types.js';

type PatientLean = PatientDocumentFields & { _id: Types.ObjectId };
type PatientDocumentLean = PatientDocumentMetadataFields & { _id: Types.ObjectId };
type PatientTimelineEventLean = PatientTimelineEventFields & { _id: Types.ObjectId };

const nullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectId = (value: string | null | undefined) => (value ? new Types.ObjectId(value) : null);

const toPatient = (patient: PatientLean): Patient => ({
  id: patient._id.toString(),
  patient_number: patient.patientNumber,
  first_name: patient.firstName,
  middle_name: patient.middleName ?? null,
  last_name: patient.lastName,
  date_of_birth: patient.dateOfBirth,
  gender: patient.gender,
  phone: patient.phone ?? null,
  email: patient.email ?? null,
  address: {
    line1: patient.address?.line1 ?? null,
    line2: patient.address?.line2 ?? null,
    city: patient.address?.city ?? null,
    state: patient.address?.state ?? null,
    country: patient.address?.country ?? null,
    postal_code: patient.address?.postalCode ?? null,
  },
  emergency_contact: {
    name: patient.emergencyContact?.name ?? null,
    relationship: patient.emergencyContact?.relationship ?? null,
    phone: patient.emergencyContact?.phone ?? null,
  },
  registration_branch_id: patient.registrationBranchId?.toString() ?? null,
  blood_group: patient.bloodGroup ?? null,
  status: patient.status,
  notes: patient.notes ?? null,
  created_by: patient.createdBy?.toString() ?? null,
  updated_by: patient.updatedBy?.toString() ?? null,
  created_at: patient.createdAt,
  updated_at: patient.updatedAt,
});

const toPatientDocument = (document: PatientDocumentLean): PatientDocument => ({
  id: document._id.toString(),
  patient_id: document.patientId.toString(),
  document_type: document.documentType,
  title: document.title,
  file_name: document.fileName,
  mime_type: document.mimeType,
  file_size_bytes: document.fileSizeBytes,
  storage_key: document.storageKey,
  description: document.description ?? null,
  status: document.status,
  uploaded_by: document.uploadedBy?.toString() ?? null,
  created_at: document.createdAt,
  updated_at: document.updatedAt,
});

const toTimelineEvent = (event: PatientTimelineEventLean): PatientTimelineEvent => ({
  id: event._id.toString(),
  patient_id: event.patientId.toString(),
  event_type: event.eventType,
  title: event.title,
  description: event.description ?? null,
  occurred_at: event.occurredAt,
  created_by: event.createdBy?.toString() ?? null,
  created_at: event.createdAt,
});

const sortColumnMap = {
  patient_number: 'patientNumber',
  first_name: 'firstName',
  last_name: 'lastName',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
} as const;

const buildPatientPayload = (data: CreatePatientDTO | UpdatePatientDTO) => ({
  ...(data.first_name !== undefined ? { firstName: data.first_name.trim() } : {}),
  ...(data.middle_name !== undefined ? { middleName: nullableString(data.middle_name) } : {}),
  ...(data.last_name !== undefined ? { lastName: data.last_name.trim() } : {}),
  ...(data.date_of_birth !== undefined ? { dateOfBirth: new Date(data.date_of_birth) } : {}),
  ...(data.gender !== undefined ? { gender: data.gender } : {}),
  ...(data.phone !== undefined ? { phone: nullableString(data.phone) } : {}),
  ...(data.email !== undefined ? { email: nullableString(data.email) } : {}),
  ...(data.address !== undefined
    ? {
        address: {
          line1: nullableString(data.address?.line1),
          line2: nullableString(data.address?.line2),
          city: nullableString(data.address?.city),
          state: nullableString(data.address?.state),
          country: nullableString(data.address?.country),
          postalCode: nullableString(data.address?.postal_code),
        },
      }
    : {}),
  ...(data.emergency_contact !== undefined
    ? {
        emergencyContact: {
          name: nullableString(data.emergency_contact?.name),
          relationship: nullableString(data.emergency_contact?.relationship),
          phone: nullableString(data.emergency_contact?.phone),
        },
      }
    : {}),
  ...(data.registration_branch_id !== undefined
    ? { registrationBranchId: toObjectId(data.registration_branch_id) }
    : {}),
  ...(data.blood_group !== undefined ? { bloodGroup: nullableString(data.blood_group) } : {}),
  ...(data.status !== undefined ? { status: data.status } : {}),
  ...(data.notes !== undefined ? { notes: nullableString(data.notes) } : {}),
});

export class PatientRepository {
  async list(query: PatientListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filter: Record<string, unknown> = { deletedAt: null };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.gender) {
      filter.gender = query.gender;
    }
    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [
        { patientNumber: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ];
    }

    const sortBy = query.sortBy ? sortColumnMap[query.sortBy] : 'createdAt';
    const sortOrder: SortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, count] = await Promise.all([
      PatientModel.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean<PatientLean[]>(),
      PatientModel.countDocuments(filter),
    ]);

    return {
      data: data.map(toPatient),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async getById(id: string): Promise<Patient | undefined> {
    const patient = await PatientModel.findOne({ _id: id, deletedAt: null }).lean<PatientLean>();
    return patient ? toPatient(patient) : undefined;
  }

  async getByPatientNumber(patientNumber: string): Promise<Patient | undefined> {
    const patient = await PatientModel.findOne({
      patientNumber: new RegExp(`^${escapeRegex(patientNumber)}$`, 'i'),
      deletedAt: null,
    }).lean<PatientLean>();
    return patient ? toPatient(patient) : undefined;
  }

  async findDuplicateCandidates(data: CreatePatientDTO) {
    const filters: Record<string, unknown>[] = [
      {
        firstName: new RegExp(`^${escapeRegex(data.first_name)}$`, 'i'),
        lastName: new RegExp(`^${escapeRegex(data.last_name)}$`, 'i'),
        dateOfBirth: new Date(data.date_of_birth),
      },
    ];

    if (data.phone) {
      filters.push({ phone: data.phone.trim() });
    }

    const patients = await PatientModel.find({ deletedAt: null, $or: filters }).limit(5).lean<PatientLean[]>();
    return patients.map(toPatient);
  }

  async create(patientNumber: string, data: CreatePatientDTO, createdBy: string): Promise<Patient> {
    const created = await PatientModel.create({
      patientNumber,
      ...buildPatientPayload(data),
      status: data.status ?? 'ACTIVE',
      createdBy: new Types.ObjectId(createdBy),
      updatedBy: new Types.ObjectId(createdBy),
    });
    return toPatient(created.toObject<PatientLean>());
  }

  async update(id: string, data: UpdatePatientDTO, updatedBy: string): Promise<Patient | undefined> {
    const updatePayload = {
      ...buildPatientPayload(data),
      updatedBy: new Types.ObjectId(updatedBy),
    };

    const patient = await PatientModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: updatePayload },
      { new: true, lean: true },
    ).lean<PatientLean>();

    return patient ? toPatient(patient) : undefined;
  }

  async nextPatientSequence() {
    return PatientModel.countDocuments();
  }

  async addTimelineEvent(
    patientId: string,
    event: Pick<PatientTimelineEvent, 'event_type' | 'title' | 'description'>,
    userId: string,
  ) {
    const created = await PatientTimelineEventModel.create({
      patientId: new Types.ObjectId(patientId),
      eventType: event.event_type,
      title: event.title,
      description: event.description,
      occurredAt: new Date(),
      createdBy: new Types.ObjectId(userId),
    });
    return toTimelineEvent(created.toObject<PatientTimelineEventLean>());
  }

  async listTimeline(patientId: string) {
    const events = await PatientTimelineEventModel.find({ patientId })
      .sort({ occurredAt: -1 })
      .lean<PatientTimelineEventLean[]>();
    return events.map(toTimelineEvent);
  }

  async listDocuments(patientId: string, documentType?: string) {
    const filter: Record<string, unknown> = {
      patientId: new Types.ObjectId(patientId),
      status: 'ACTIVE',
    };
    if (documentType) {
      filter.documentType = documentType;
    }

    const documents = await PatientDocumentModel.find(filter).sort({ createdAt: -1 }).lean<PatientDocumentLean[]>();
    return documents.map(toPatientDocument);
  }

  async createDocument(patientId: string, data: CreatePatientDocumentDTO, userId: string) {
    const created = await PatientDocumentModel.create({
      patientId: new Types.ObjectId(patientId),
      documentType: data.document_type,
      title: data.title.trim(),
      fileName: data.file_name.trim(),
      mimeType: data.mime_type.trim(),
      fileSizeBytes: data.file_size_bytes,
      storageKey: data.storage_key.trim(),
      description: nullableString(data.description),
      uploadedBy: new Types.ObjectId(userId),
      status: 'ACTIVE',
    });
    return toPatientDocument(created.toObject<PatientDocumentLean>());
  }

  async deleteDocument(patientId: string, documentId: string, userId: string) {
    const document = await PatientDocumentModel.findOneAndUpdate(
      { _id: documentId, patientId, status: 'ACTIVE' },
      {
        $set: {
          status: 'DELETED',
          deletedAt: new Date(),
          deletedBy: new Types.ObjectId(userId),
        },
      },
      { new: true, lean: true },
    ).lean<PatientDocumentLean>();

    return document ? toPatientDocument(document) : undefined;
  }
}
