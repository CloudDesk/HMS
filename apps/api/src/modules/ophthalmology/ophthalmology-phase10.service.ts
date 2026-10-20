import { Readable } from 'node:stream';
import { ophthalmologyReportCsv } from './ophthalmology-report-csv.js';
import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { PatientDocumentStorageService } from '../../shared/storage/patient-document-storage.service.js';
import { executeRequiredTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { OphthalmologyRepository } from './ophthalmology.repository.js';
import type { OphthalmologyPhase10Repository } from './ophthalmology-phase10.repository.js';
import type { OphthalmologyPublicationListQuery, CreateOphthalmologyPublicationDTO, OphthalmologyAttachmentListQuery, OphthalmologyDashboardQuery,
  OphthalmologyReportQuery, OphthalmologyReportType, UploadOphthalmologyAttachmentDTO,
  WithdrawOphthalmologyPublicationDTO } from './ophthalmology-phase10.types.js';
import type { OphthalmologyRequestMetadata } from './ophthalmology.types.js';

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]));
};
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
const duplicateKey = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

export class OphthalmologyPhase10Service {
  constructor(private readonly repository: OphthalmologyPhase10Repository, private readonly ophthalmology: OphthalmologyRepository,
    private readonly patients?: PatientRepository, private readonly storage?: PatientDocumentStorageService) {}

  async uploadAttachment(data: UploadOphthalmologyAttachmentDTO, key: string, userId: string,
    metadata: OphthalmologyRequestMetadata = {}) {
    this.objectId(data.task_id, 'Task id is invalid');
    if (data.result_id) this.objectId(data.result_id, 'Result id is invalid');
    const normalizedKey = key.trim();
    if (!normalizedKey) throw new AppError('Idempotency key is required', 400, 'VALIDATION_ERROR');
    this.validateAttachment(data);
    if (!this.patients || !this.storage) {
      throw new AppError('Ophthalmology attachment storage is unavailable', 503, 'OPHTHALMOLOGY_STORAGE_UNAVAILABLE');
    }
    const checksum = createHash('sha256').update(data.data).digest('hex');
    const requestFingerprint = fingerprint({ ...data, data: undefined, checksum_sha256: checksum });
    const eligible = await this.repository.attachmentEligibility(data.task_id, data.result_id);
    if (!eligible) throw new AppError('Ophthalmology task or matching result not found', 404, 'NOT_FOUND');
    await this.scope(userId, eligible.task.branchId.toString(), eligible.task.departmentId.toString());
    const allowedStatuses = ['IN_PROGRESS', 'DRAFT', 'COMPLETED', 'SUBMITTED_FOR_REVIEW', 'REVIEWED', 'REPEAT_REQUIRED'];
    if (!allowedStatuses.includes(eligible.task.status)) {
      throw new AppError('Attachments are not allowed in the current task state', 409, 'OPHTHALMOLOGY_INVALID_TRANSITION');
    }
    const replay = await this.repository.getAttachmentByIdempotency(eligible.task.branchId.toString(), normalizedKey);
    if (replay) {
      if (await this.repository.attachmentRequestMatches(eligible.task.branchId.toString(), normalizedKey, requestFingerprint)) return replay;
      throw new AppError('Idempotency key was reused with a different attachment request', 409, 'OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT');
    }
    let storageKey: string | null = null;
    try {
      storageKey = (await this.storage.uploadPatientDocument({ patientId: eligible.task.patientId.toString(), fileName: data.file_name,
        mimeType: data.mime_type, data: data.data })).storageKey;
      return await executeRequiredTransaction(this.repository, async (session) => {
        const current = await this.repository.attachmentEligibility(data.task_id, data.result_id, session);
        if (!current || current.task.branchId.toString() !== eligible.task.branchId.toString() || current.task.version !== eligible.task.version
          || !allowedStatuses.includes(current.task.status) || current.result?.version !== eligible.result?.version) {
          throw new AppError('The attachment source changed after upload', 409, 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT');
        }
        const patientDocument = await this.patients!.createDocument(current.task.patientId.toString(), {
          visit_id: current.task.visitId.toString(), document_type: 'CLINICAL', title: data.title, file_name: data.file_name,
          mime_type: data.mime_type, file_size_bytes: data.file_size_bytes, storage_key: storageKey!, source: 'HOSPITAL',
          review_status: 'PENDING', document_date: data.acquired_at,
          description: `Ophthalmology ${current.task.testCode} attachment`,
        }, userId, session);
        const attachment = await this.repository.createAttachment({ contextId: current.task.contextId, visitId: current.task.visitId,
          patientId: current.task.patientId, branchId: current.task.branchId, departmentId: current.task.departmentId,
          taskId: current.task._id, resultId: current.result?._id ?? null, patientDocumentId: new Types.ObjectId(patientDocument.id),
          testCode: current.task.testCode, laterality: current.task.laterality, deviceCode: current.task.deviceCode ?? null,
          acquiredAt: new Date(data.acquired_at), provenance: data.provenance, checksumSha256: checksum, mimeType: data.mime_type,
          fileSizeBytes: data.file_size_bytes, originalFileName: data.file_name, reviewState: 'PENDING', publicationState: 'INTERNAL',
          idempotencyKey: normalizedKey, requestFingerprint, uploadedBy: new Types.ObjectId(userId),
        }, session);
        await this.repository.audit('ophthalmology.attachment.uploaded', userId, { attachmentId: attachment.id,
          patientDocumentId: attachment.patient_document_id, taskId: attachment.task_id, resultId: attachment.result_id,
          patientId: attachment.patient_id, visitId: attachment.visit_id, branchId: attachment.branch_id,
          checksumSha256: checksum, mimeType: attachment.mime_type, fileSizeBytes: attachment.file_size_bytes,
          provenance: attachment.provenance }, metadata, session);
        await this.repository.timeline(attachment.patient_id, 'DOCUMENT_ADDED', 'Ophthalmology attachment added',
          `${attachment.test_code} clinical attachment was added for review.`, userId, session);
        return attachment;
      });
    } catch (error: unknown) {
      if (storageKey) await this.storage.deleteIfExists(storageKey).catch(() => undefined);
      if (duplicateKey(error)) {
        const raced = await this.repository.getAttachmentByIdempotency(eligible.task.branchId.toString(), normalizedKey);
        if (raced && await this.repository.attachmentRequestMatches(eligible.task.branchId.toString(), normalizedKey, requestFingerprint)) return raced;
      }
      throw error;
    }
  }

  async listAttachments(query: OphthalmologyAttachmentListQuery, userId: string) {
    await this.scope(userId, query.branch_id);
    for (const value of [query.task_id, query.result_id, query.visit_id]) if (value) this.objectId(value, 'Attachment filter id is invalid');
    return this.repository.listAttachments({ ...query, page: query.page ?? 1, limit: query.limit ?? 20 });
  }

  async listPublications(query: OphthalmologyPublicationListQuery, userId: string) {
    await this.scope(userId, query.branch_id);
    if (query.visit_id) this.objectId(query.visit_id, 'Visit id is invalid');
    if (query.source_id) this.objectId(query.source_id, 'Source id is invalid');
    return this.repository.listPublications(query, await this.ophthalmology.resolveDepartmentScope(userId));
  }

  async publish(data: CreateOphthalmologyPublicationDTO, key: string, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    this.objectId(data.source_id, 'Publication source id is invalid');
    const normalizedKey = key.trim();
    if (!normalizedKey) throw new AppError('Idempotency key is required', 400, 'VALIDATION_ERROR');
    const requestFingerprint = fingerprint(data);
    const eligible = await this.repository.publicationEligibility(data);
    if (!eligible) throw new AppError('The exact source version is not final, approved, or reviewed', 422, 'OPHTHALMOLOGY_REVIEW_REQUIRED');
    await this.scope(userId, eligible.branchId.toString(), eligible.departmentId.toString());
    if (await this.repository.publicationLocked(eligible.contextId.toString())) throw new AppError('Reapprove the amended consultation before publishing', 409, 'OPHTHALMOLOGY_CONSULTATION_LOCKED');
    const replay = await this.repository.getPublicationByIdempotency(eligible.branchId.toString(), normalizedKey);
    if (replay) {
      if (replay.source_type === data.source_type && replay.source_id === data.source_id && replay.source_version === data.source_version) return replay;
      throw new AppError('Idempotency key was reused with a different publication request', 409, 'OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT');
    }
    try {
      return await executeRequiredTransaction(this.repository, async (session) => {
        const current = await this.repository.publicationEligibility(data, session);
        if (current && await this.repository.publicationLocked(current.contextId.toString(), session)) throw new AppError('Reapprove the amended consultation before publishing', 409, 'OPHTHALMOLOGY_CONSULTATION_LOCKED');
        if (!current) throw new AppError('The exact source version is no longer eligible for publication', 409, 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT');
        const raced = await this.repository.getPublicationByIdempotency(current.branchId.toString(), normalizedKey, session);
        if (raced) {
          if (raced.source_type === data.source_type && raced.source_id === data.source_id && raced.source_version === data.source_version) return raced;
          throw new AppError('Idempotency key was reused with a different publication request', 409, 'OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT');
        }
        if (!await this.repository.acquirePublicationFence(current.contextId.toString(), session)) throw new AppError('Publication context changed', 409, 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT');
        const publication = await this.repository.createPublication(current, data, normalizedKey, requestFingerprint, userId, session);
        await this.repository.synchronizePublicationDocuments(publication, session);
        await this.repository.audit('ophthalmology.portal.published', userId, { publicationId: publication.id,
          contextId: publication.context_id, visitId: publication.visit_id, patientId: publication.patient_id,
          branchId: publication.branch_id, departmentId: publication.department_id, sourceType: publication.source_type,
          sourceId: publication.source_id, sourceVersion: publication.source_version, idempotencyKey: normalizedKey }, metadata, session);
        await this.repository.timeline(publication.patient_id, 'OPHTHALMOLOGY_PORTAL_PUBLISHED', 'Ophthalmology record published',
          `${publication.source_type} version ${publication.source_version} was approved for portal viewing.`, userId, session);
        return publication;
      });
    } catch (error: unknown) {
      if (!duplicateKey(error)) throw error;
      const raced = await this.repository.getPublicationByIdempotency(eligible.branchId.toString(), normalizedKey);
      if (raced && raced.source_type === data.source_type && raced.source_id === data.source_id && raced.source_version === data.source_version) return raced;
      throw new AppError('The exact source version already has an active publication', 409, 'OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT');
    }
  }

  async withdraw(id: string, data: WithdrawOphthalmologyPublicationDTO, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    this.objectId(id, 'Publication id is invalid'); const reason = data.reason.trim();
    if (!reason) throw new AppError('A withdrawal reason is required', 400, 'OPHTHALMOLOGY_REASON_REQUIRED');
    const current = await this.repository.getPublication(id);
    if (!current) throw new AppError('Ophthalmology publication not found', 404, 'NOT_FOUND');
    await this.scope(userId, current.branch_id, current.department_id);
    if (current.status !== data.expected_status || current.version !== data.expected_version) {
      throw new AppError('The publication changed after it was loaded', 409, 'OPHTHALMOLOGY_VERSION_CONFLICT');
    }
    return executeRequiredTransaction(this.repository, async (session) => {
      const withdrawn = await this.repository.withdrawPublication(id, data.expected_version, reason, userId, session);
      if (!withdrawn) throw new AppError('The publication changed after it was loaded', 409, 'OPHTHALMOLOGY_VERSION_CONFLICT');
      await this.repository.synchronizePublicationDocuments(withdrawn, session);
      await this.repository.audit('ophthalmology.portal.withdrawn', userId, { publicationId: withdrawn.id,
        contextId: withdrawn.context_id, visitId: withdrawn.visit_id, patientId: withdrawn.patient_id,
        branchId: withdrawn.branch_id, departmentId: withdrawn.department_id, sourceType: withdrawn.source_type,
        sourceId: withdrawn.source_id, sourceVersion: withdrawn.source_version, reason,
        previousVersion: data.expected_version, resultingVersion: withdrawn.version }, metadata, session);
      await this.repository.timeline(withdrawn.patient_id, 'OPHTHALMOLOGY_PORTAL_WITHDRAWN', 'Ophthalmology record withdrawn',
        `${withdrawn.source_type} version ${withdrawn.source_version} was withdrawn from portal viewing.`, userId, session);
      return withdrawn;
    });
  }

  async report(type: OphthalmologyReportType, query: OphthalmologyReportQuery, userId: string) {
    await this.scope(userId, query.branch_id); this.range(query); this.validateReportBasis(type, query); return this.repository.report(type, {
      ...query, page: query.page ?? 1, limit: query.limit ?? 20,
    }, await this.ophthalmology.resolveDepartmentScope(userId));
  }
  async exportReport(type: OphthalmologyReportType, query: OphthalmologyReportQuery, userId: string, metadata: OphthalmologyRequestMetadata = {}) {
    await this.scope(userId, query.branch_id); this.range(query); this.validateReportBasis(type, query);
    await executeRequiredTransaction(this.repository, (session) => this.repository.audit('ophthalmology.report.export_requested', userId,
      { branchId: query.branch_id, reportType: type, volumeBasis: query.volume_basis ?? 'ORDERED_ENCOUNTERS', stationId: query.station_id ?? null, dateFrom: query.date_from ?? null, dateTo: query.date_to ?? null }, metadata, session));
    return Readable.from(ophthalmologyReportCsv(type, this.repository.exportReport(type, query, await this.ophthalmology.resolveDepartmentScope(userId)), query.volume_basis), { objectMode: false });
  }
  async refreshDashboard(query: OphthalmologyDashboardQuery, userId: string) {
    const departments = await this.dashboardDepartments(query.branch_id, userId); return this.repository.refreshDashboard(query.branch_id, departments);
  }
  async dashboard(query: OphthalmologyDashboardQuery, userId: string) {
    const departments = await this.dashboardDepartments(query.branch_id, userId); const snapshot = await this.repository.getDashboard(query.branch_id);
    if (!snapshot || JSON.stringify((snapshot.departmentIds ?? []).map(String).sort()) !== JSON.stringify(departments)) {
      throw new AppError('Ophthalmology dashboard scope has changed or has not been generated; refresh the snapshot', 503, 'DASHBOARD_NOT_READY');
    }
    return snapshot;
  }

  private async dashboardDepartments(branchId: string, userId: string) {
    await this.scope(userId, branchId);
    const [departments, permitted] = await Promise.all([this.repository.activeDashboardDepartments(branchId), this.ophthalmology.resolveDepartmentScope(userId)]);
    if (!departments.length || (permitted !== null && departments.some((id) => !permitted.includes(id)))) {
      throw new AppError('The branch dashboard requires access to every included Ophthalmology department; use scoped reports for partial access', 403, 'OPHTHALMOLOGY_SCOPE_DENIED');
    }
    return departments;
  }

  private async scope(userId: string, branchId: string, departmentId?: string) {
    this.objectId(branchId, 'Branch id is invalid');
    if (!await this.ophthalmology.hasBranchAccess(userId, branchId)) throw new AppError('Branch access denied', 403, 'OPHTHALMOLOGY_SCOPE_DENIED');
    if (departmentId) { const departments = await this.ophthalmology.resolveDepartmentScope(userId); if (departments !== null && !departments.includes(departmentId)) throw new AppError('Department access denied', 403, 'OPHTHALMOLOGY_SCOPE_DENIED'); }
  }
  private validateReportBasis(type: OphthalmologyReportType, query: OphthalmologyReportQuery) {
    if (query.volume_basis && (type !== 'CLINICAL_VOLUME' || !['VISITS', 'ORDERED_ENCOUNTERS'].includes(query.volume_basis))) throw new AppError('Volume basis is supported only for clinical volume', 400, 'VALIDATION_ERROR');
    if (query.volume_basis === 'VISITS' && query.station_id) throw new AppError('Station filtering applies to test orders; clear the station to view all clinical visits', 400, 'VALIDATION_ERROR');
  }
  private range(query: OphthalmologyReportQuery) {
    if (query.station_id) this.objectId(query.station_id, 'Station id is invalid');
    if (query.date_from && query.date_to && new Date(query.date_from) > new Date(query.date_to)) {
      throw new AppError('Report date_from must be on or before date_to', 400, 'VALIDATION_ERROR');
    }
  }
  private validateAttachment(data: UploadOphthalmologyAttachmentDTO) {
    if (!data.title.trim() || !data.file_name.trim()) throw new AppError('Attachment title and file name are required', 400, 'VALIDATION_ERROR');
    if (data.file_size_bytes !== data.data.byteLength || data.file_size_bytes < 1) {
      throw new AppError('Attachment size does not match the uploaded file', 400, 'VALIDATION_ERROR');
    }
    if (data.file_size_bytes > env.upload.patientDocumentMaxFileSizeBytes) {
      throw new AppError('Attachment exceeds the configured file size limit', 413, 'DOCUMENT_FILE_TOO_LARGE');
    }
    if (!env.upload.patientDocumentAllowedMimeTypes.includes(data.mime_type)) {
      throw new AppError('Attachment MIME type is not allowed', 415, 'DOCUMENT_MIME_TYPE_NOT_ALLOWED');
    }
    const acquiredAt = new Date(data.acquired_at);
    if (Number.isNaN(acquiredAt.getTime()) || acquiredAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new AppError('Attachment acquisition time is invalid', 400, 'VALIDATION_ERROR');
    }
  }
  private objectId(value: string, message: string) { if (!Types.ObjectId.isValid(value)) throw new AppError(message, 400, 'VALIDATION_ERROR'); }
}
