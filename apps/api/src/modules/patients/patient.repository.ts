import { Types, type ClientSession, type SortOrder } from 'mongoose';
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
  PatientConsentContextType,
  PatientDocument,
  PatientDocumentListQuery,
  PatientListQuery,
  PatientTimelineListQuery,
  PatientTimelineEvent,
  UpdatePatientDTO,
} from './patient.types.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { AppError } from '../../shared/errors/app-error.js';

type PatientLean = PatientDocumentFields & { _id: Types.ObjectId };
type PatientDocumentLean = PatientDocumentMetadataFields & { _id: Types.ObjectId };
type PatientTimelineEventLean = PatientTimelineEventFields & { _id: Types.ObjectId };

const nullableString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectId = (value: string | null | undefined) => (value ? new Types.ObjectId(value) : null);
const canonicalConsentStatus = (value: string | null | undefined) => {
  if (!value) return null;
  if (value === 'SIGNED') return 'ATTACHED' as const;
  if (value === 'EXPIRED' || value === 'REJECTED') return 'PENDING' as const;
  return value as PatientDocument['consent_status'];
};

const toPatient = (patient: PatientLean): Patient => ({
  id: patient._id.toString(),
  patient_number: patient.patientNumber,
  first_name: patient.firstName ?? null,
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
  parent_guardian: patient.parentGuardian ?? null,
  registration_branch_id: patient.registrationBranchId?.toString() ?? null,
  blood_group: patient.bloodGroup ?? null,
  status: patient.status,
  notes: patient.notes ?? null,
  created_by: patient.createdBy?.toString() ?? null,
  updated_by: patient.updatedBy?.toString() ?? null,
  created_at: patient.createdAt,
  updated_at: patient.updatedAt,
});

const toPatientDocument = (document: PatientDocumentLean, uploadedByName: string | null = null): PatientDocument => ({
  id: document._id.toString(),
  patient_id: document.patientId.toString(),
  visit_id: document.visitId?.toString() ?? null,
  admission_id: document.admissionId?.toString() ?? null,
  procedure_id: document.procedureId?.toString() ?? null,
  context_type: document.contextType ?? null,
  context_id: document.contextId?.toString() ?? null,
  consent_template_id: document.consentTemplateId?.toString() ?? null,
  consent_category: document.consentCategory ?? null,
  consent_version: document.consentVersion ?? null,
  document_type: document.documentType,
  title: document.title,
  file_name: document.fileName,
  mime_type: document.mimeType,
  file_size_bytes: document.fileSizeBytes,
  storage_key: document.storageKey,
  description: document.description ?? null,
  consent_status: document.consentStatus ?? null,

  consent_kind: document.consentKind ?? null,
  signed_at: document.signedAt ?? null,
  valid_until: document.validUntil ?? null,
  signed_by_name: document.signedByName ?? null,
  status: document.status,
  uploaded_by: document.uploadedBy?.toString() ?? null,
  uploaded_by_name: uploadedByName,
  uploaded_at: document.createdAt,
  verified_by: document.verifiedBy?.toString() ?? null,
  verified_at: document.verifiedAt ?? null,
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
  ...(data.first_name !== undefined ? { firstName: nullableString(data.first_name) } : {}),
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
  ...(data.parent_guardian !== undefined ? { parentGuardian: nullableString(data.parent_guardian) } : {}),
  ...(data.registration_branch_id !== undefined
    ? { registrationBranchId: toObjectId(data.registration_branch_id) }
    : {}),
  ...(data.blood_group !== undefined ? { bloodGroup: nullableString(data.blood_group) } : {}),
  ...(data.status !== undefined ? { status: data.status } : {}),
  ...(data.notes !== undefined ? { notes: nullableString(data.notes) } : {}),
});

export class PatientRepository {
  async resolveBranchScope(userId: string, requestedBranchId?: string): Promise<string[] | undefined> {
    const user = await UserModel.findOne({ _id: userId, status: 'active', deletedAt: null })
      .select('branchIds roleIds').lean();
    if (!user) throw new AppError('Authenticated user not found', 401, 'UNAUTHORIZED');
    const isSuperAdmin = Boolean(await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null,
    }));
    if (requestedBranchId) {
      const branchExists = Boolean(await BranchModel.exists({ _id: requestedBranchId, status: 'ACTIVE', deletedAt: null }));
      if (!branchExists) throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
      const assigned = (user.branchIds ?? []).some((id) => String(id) === requestedBranchId);
      if (!isSuperAdmin && !assigned) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
      return [requestedBranchId];
    }
    if (isSuperAdmin) return undefined;
    const activeBranches = await BranchModel.find({
      _id: { $in: user.branchIds ?? [] }, status: 'ACTIVE', deletedAt: null,
    }).select('_id').lean();
    return activeBranches.map((branch) => String(branch._id));
  }

  async list(query: PatientListQuery, branchIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filter: Record<string, unknown> = { deletedAt: null };
    if (branchIds) filter.registrationBranchId = { $in: branchIds.map(toObjectId) };

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

  async getById(id: string, branchIds?: string[]): Promise<Patient | undefined> {
    const filter: Record<string, unknown> = { _id: id, deletedAt: null };
    if (branchIds) filter.registrationBranchId = { $in: branchIds.map(toObjectId) };
    const patient = await PatientModel.findOne(filter).lean<PatientLean>();
    return patient ? toPatient(patient) : undefined;
  }

  async getByPatientNumber(patientNumber: string): Promise<Patient | undefined> {
    const patient = await PatientModel.findOne({
      patientNumber: new RegExp(`^${escapeRegex(patientNumber)}$`, 'i'),
      deletedAt: null,
    }).lean<PatientLean>();
    return patient ? toPatient(patient) : undefined;
  }

  async findDuplicateCandidates(data: CreatePatientDTO, branchIds?: string[]) {
    const filters: Record<string, unknown>[] = [
      {
        ...(data.first_name ? { firstName: new RegExp(`^${escapeRegex(data.first_name)}$`, 'i') } : {}),
        lastName: new RegExp(`^${escapeRegex(data.last_name)}$`, 'i'),
        dateOfBirth: new Date(data.date_of_birth),
      },
    ];

    if (data.phone) {
      filters.push({ phone: data.phone.trim() });
    }

    const patients = await PatientModel.find({
      deletedAt: null,
      ...(branchIds ? { registrationBranchId: { $in: branchIds.map(toObjectId) } } : {}),
      $or: filters,
    }).limit(5).lean<PatientLean[]>();
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

  async update(id: string, data: UpdatePatientDTO, updatedBy: string, branchIds?: string[]): Promise<Patient | undefined> {
    const updatePayload = {
      ...buildPatientPayload(data),
      updatedBy: new Types.ObjectId(updatedBy),
    };

    const patient = await PatientModel.findOneAndUpdate(
      { _id: id, deletedAt: null, ...(branchIds ? { registrationBranchId: { $in: branchIds.map(toObjectId) } } : {}) },
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
    session?: ClientSession,
  ) {
    const records = await PatientTimelineEventModel.create([{
      patientId: new Types.ObjectId(patientId),
      eventType: event.event_type,
      title: event.title,
      description: event.description,
      occurredAt: new Date(),
      createdBy: new Types.ObjectId(userId),
    }], session ? { session } : undefined);
    const created = records[0];
    if (!created) throw new AppError('Patient timeline event could not be created', 500, 'TIMELINE_CREATE_FAILED');
    return toTimelineEvent(created.toObject<PatientTimelineEventLean>());
  }

  async auditClinicalEvent(eventType: string, actorUserId: string, details: Record<string, unknown>) {
    await AuditLogModel.create({
      actorUserId,
      eventType,
      metadataJson: details,
    });
  }

  async listTimeline(patientId: string, query: PatientTimelineListQuery = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const filter: Record<string, unknown> = {
      patientId: new Types.ObjectId(patientId),
    };

    if (query.event_type) {
      filter.eventType = query.event_type;
    }

    if (query.from || query.to) {
      filter.occurredAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const [events, count] = await Promise.all([
      PatientTimelineEventModel.find(filter)
        .sort({ occurredAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean<PatientTimelineEventLean[]>(),
      PatientTimelineEventModel.countDocuments(filter),
    ]);

    return {
      data: events.map(toTimelineEvent),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit) || 1,
      },
    };
  }

  async listDocuments(patientId: string, query: PatientDocumentListQuery = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      patientId: new Types.ObjectId(patientId),
      status: 'ACTIVE',
    };
    if (query.document_type) {
      filter.documentType = query.document_type;
    }
    if (query.visit_id) {
      filter.visitId = new Types.ObjectId(query.visit_id);
    }
    if (query.admission_id) filter.admissionId = new Types.ObjectId(query.admission_id);
    if (query.procedure_id) filter.procedureId = new Types.ObjectId(query.procedure_id);
    if (query.context_type) filter.contextType = query.context_type;

    const [documents, total] = await Promise.all([
      PatientDocumentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<PatientDocumentLean[]>(),
      PatientDocumentModel.countDocuments(filter),
    ]);
    const uploaderIds = documents.flatMap((document) => (document.uploadedBy ? [document.uploadedBy] : []));
    const uploaders = await UserModel.find({ _id: { $in: uploaderIds } })
      .select({ fullName: 1 })
      .lean<Array<{ _id: Types.ObjectId; fullName: string }>>();
    const uploaderNames = new Map(uploaders.map((user) => [user._id.toString(), user.fullName]));

    return {
      data: documents.map((document) =>
        toPatientDocument(document, document.uploadedBy ? uploaderNames.get(document.uploadedBy.toString()) ?? null : null),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getDocument(patientId: string, documentId: string) {
    const document = await PatientDocumentModel.findOne({
      _id: documentId,
      patientId: new Types.ObjectId(patientId),
      status: 'ACTIVE',
    }).lean<PatientDocumentLean>();

    return document ? toPatientDocument(document) : undefined;
  }

  async createDocument(patientId: string, data: CreatePatientDocumentDTO, userId: string) {
    const created = await PatientDocumentModel.create({
      patientId: new Types.ObjectId(patientId),
      visitId: toObjectId(data.visit_id),
      admissionId: toObjectId(data.admission_id),
      procedureId: toObjectId(data.procedure_id),
      contextType: data.context_type ?? null,
      contextId: toObjectId(data.context_id),
      consentTemplateId: toObjectId(data.consent_template_id),
      consentCategory: nullableString(data.consent_category),
      consentVersion: data.consent_version ?? null,
      documentType: data.document_type,
      title: data.title.trim(),
      fileName: data.file_name.trim(),
      mimeType: data.mime_type.trim(),
      fileSizeBytes: data.file_size_bytes,
      storageKey: data.storage_key.trim(),
      description: nullableString(data.description),
      consentStatus: data.consent_status ?? null,
      consentKind: nullableString(data.consent_kind),
      signedAt: data.signed_at ? new Date(data.signed_at) : null,
      validUntil: data.valid_until ? new Date(data.valid_until) : null,
      signedByName: nullableString(data.signed_by_name),
      uploadedBy: new Types.ObjectId(userId),
      verifiedBy: null,
      verifiedAt: null,
      status: 'ACTIVE',
    });
    return toPatientDocument(created.toObject<PatientDocumentLean>());
  }

  async replaceDocument(patientId: string, documentId: string, data: CreatePatientDocumentDTO, userId: string) {
    const document = await PatientDocumentModel.findOneAndUpdate(
      { _id: documentId, patientId: new Types.ObjectId(patientId), status: 'ACTIVE' },
      {
        $set: {
          documentType: data.document_type,
          admissionId: toObjectId(data.admission_id),
          procedureId: toObjectId(data.procedure_id),
          contextType: data.context_type ?? null,
          contextId: toObjectId(data.context_id),
          consentTemplateId: toObjectId(data.consent_template_id),
          consentCategory: nullableString(data.consent_category),
          consentVersion: data.consent_version ?? null,
          title: data.title.trim(),
          fileName: data.file_name.trim(),
          mimeType: data.mime_type.trim(),
          fileSizeBytes: data.file_size_bytes,
          storageKey: data.storage_key.trim(),
          description: nullableString(data.description),
          consentStatus: data.consent_status ?? null,
          consentKind: nullableString(data.consent_kind),
          signedAt: data.signed_at ? new Date(data.signed_at) : null,
          validUntil: data.valid_until ? new Date(data.valid_until) : null,
          signedByName: nullableString(data.signed_by_name),
          uploadedBy: new Types.ObjectId(userId),
          verifiedBy: null,
          verifiedAt: null,
        },
      },
      { new: true, lean: true },
    ).lean<PatientDocumentLean>();

    return document ? toPatientDocument(document) : undefined;
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

  async verifyConsent(patientId: string, documentId: string, userId: string) {
    const document = await PatientDocumentModel.findOneAndUpdate(
      { _id: documentId, patientId: new Types.ObjectId(patientId), documentType: 'CONSENT', status: 'ACTIVE', consentStatus: 'ATTACHED' },
      { $set: { consentStatus: 'VERIFIED', verifiedBy: new Types.ObjectId(userId), verifiedAt: new Date() } },
      { new: true, lean: true },
    ).lean<PatientDocumentLean>();
    return document ? toPatientDocument(document) : undefined;
  }

  async consentStatuses(patientId: string, templateIds: string[], contextType: PatientConsentContextType, contextId: string) {
    const records = await PatientDocumentModel.find({
      patientId: new Types.ObjectId(patientId), consentTemplateId: { $in: templateIds.map((id) => new Types.ObjectId(id)) },
      contextType, contextId: new Types.ObjectId(contextId), documentType: 'CONSENT', status: 'ACTIVE',
    }).sort({ createdAt: -1 }).lean<PatientDocumentLean[]>();
    const statuses = new Map<string, PatientDocument['consent_status']>();
    for (const record of records) {
      const templateId = record.consentTemplateId?.toString();
      if (templateId && !statuses.has(templateId)) statuses.set(templateId, canonicalConsentStatus(record.consentStatus));
    }
    return statuses;
  }

  async getValidContextConsent(patientId: string, documentId: string, contextType: 'INPATIENT_ADMISSION' | 'PROCEDURE_BOOKING', contextId: string, session: ClientSession) {
    const now = new Date();
    const document = await PatientDocumentModel.findOne({ _id: new Types.ObjectId(documentId), patientId: new Types.ObjectId(patientId), documentType: 'CONSENT', contextType, contextId: new Types.ObjectId(contextId), consentStatus: 'SIGNED', signedAt: { $lte: now }, signedByName: { $type: 'string', $ne: '' }, status: 'ACTIVE', $or: [{ validUntil: null }, { validUntil: { $gte: now } }] }).session(session).lean<PatientDocumentLean>();
    return document ? toPatientDocument(document) : null;
  }
}
