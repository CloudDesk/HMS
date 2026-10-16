import mongoose, { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { PatientTimelineEventModel } from '../patients/patient.model.js';
import type { PatientTimelineEventType } from '../patients/patient.types.js';
import { OphthalmologyConsultationFinalizationModel } from './ophthalmology-consultation.model.js';
import { OphthalmologyContextModel } from './ophthalmology.model.js';
import { OphthalmologyOpticalPrescriptionModel } from './ophthalmology-review.model.js';
import { OphthalmologyTestResultModel } from './ophthalmology-test-result.model.js';
import { OphthalmologyTestTaskModel } from './ophthalmology-test-task.model.js';
import { OphthalmologyAttachmentModel, OphthalmologyDashboardSnapshotModel, OphthalmologyPublicationModel,
  type OphthalmologyAttachmentFields, type OphthalmologyPublicationFields } from './ophthalmology-phase10.model.js';
import type { CreateOphthalmologyPublicationDTO, OphthalmologyAttachment, OphthalmologyAttachmentListQuery, OphthalmologyPublication,
  OphthalmologyReportQuery, OphthalmologyReportType } from './ophthalmology-phase10.types.js';
import type { OphthalmologyRequestMetadata } from './ophthalmology.types.js';

type PublicationRecord = OphthalmologyPublicationFields & { _id: Types.ObjectId };
type AttachmentRecord = OphthalmologyAttachmentFields & { _id: Types.ObjectId };
const oid = (value: string) => new Types.ObjectId(value);
const toPublication = (item: PublicationRecord): OphthalmologyPublication => ({
  id: item._id.toString(), context_id: item.contextId.toString(), visit_id: item.visitId.toString(),
  patient_id: item.patientId.toString(), branch_id: item.branchId.toString(), department_id: item.departmentId.toString(),
  source_type: item.sourceType, source_id: item.sourceId.toString(), source_version: item.sourceVersion,
  status: item.status, portal_payload: item.portalPayload, published_by: item.publishedBy.toString(), published_at: item.publishedAt,
  withdrawn_by: item.withdrawnBy?.toString() ?? null, withdrawn_at: item.withdrawnAt ?? null,
  withdrawal_reason: item.withdrawalReason ?? null, version: item.version, created_at: item.createdAt, updated_at: item.updatedAt,
});
const toAttachment = (item: AttachmentRecord): OphthalmologyAttachment => ({
  id: item._id.toString(), context_id: item.contextId.toString(), visit_id: item.visitId.toString(), patient_id: item.patientId.toString(),
  branch_id: item.branchId.toString(), department_id: item.departmentId.toString(), task_id: item.taskId.toString(),
  result_id: item.resultId?.toString() ?? null, patient_document_id: item.patientDocumentId.toString(), test_code: item.testCode,
  laterality: item.laterality, device_code: item.deviceCode ?? null, acquired_at: item.acquiredAt, provenance: item.provenance,
  checksum_sha256: item.checksumSha256, mime_type: item.mimeType, file_size_bytes: item.fileSizeBytes,
  original_file_name: item.originalFileName, review_state: item.reviewState, publication_state: item.publicationState,
  uploaded_by: item.uploadedBy.toString(), created_at: item.createdAt, updated_at: item.updatedAt,
});

export class OphthalmologyPhase10Repository {
  session() { return mongoose.startSession(); }

  async getContext(id: string, session?: ClientSession) {
    const query = OphthalmologyContextModel.findById(oid(id)); if (session) query.session(session); return query.lean();
  }

  async attachmentEligibility(taskId: string, resultId?: string | null, session?: ClientSession) {
    const taskQuery = OphthalmologyTestTaskModel.findById(oid(taskId)); if (session) taskQuery.session(session);
    const task = await taskQuery.lean(); if (!task) return null;
    if (resultId) {
      const resultQuery = OphthalmologyTestResultModel.findOne({ _id: oid(resultId), taskId: task._id });
      if (session) resultQuery.session(session);
      const result = await resultQuery.lean();
      if (!result) return null;
      return { task, result };
    }
    return { task, result: null };
  }

  async getAttachmentByIdempotency(branchId: string, key: string, session?: ClientSession) {
    const query = OphthalmologyAttachmentModel.findOne({ branchId: oid(branchId), idempotencyKey: key });
    if (session) query.session(session); const item = await query.lean<AttachmentRecord>(); return item ? toAttachment(item) : null;
  }

  async createAttachment(data: Omit<OphthalmologyAttachmentFields, 'createdAt' | 'updatedAt'>, session: ClientSession) {
    const [item] = await OphthalmologyAttachmentModel.create([data], { session });
    if (!item) throw new Error('Ophthalmology attachment could not be created');
    return toAttachment(item.toObject<AttachmentRecord>());
  }

  async listAttachments(query: Required<Pick<OphthalmologyAttachmentListQuery, 'branch_id' | 'page' | 'limit'>> & OphthalmologyAttachmentListQuery) {
    const filter: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.task_id) filter['taskId'] = oid(query.task_id);
    if (query.result_id) filter['resultId'] = oid(query.result_id);
    if (query.visit_id) filter['visitId'] = oid(query.visit_id);
    const [items, total] = await Promise.all([
      OphthalmologyAttachmentModel.find(filter).sort({ acquiredAt: -1, _id: -1 }).skip((query.page - 1) * query.limit)
        .limit(query.limit).lean<AttachmentRecord[]>(),
      OphthalmologyAttachmentModel.countDocuments(filter),
    ]);
    return { data: items.map(toAttachment), meta: { total, page: query.page, limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1 } };
  }

  async publicationEligibility(data: CreateOphthalmologyPublicationDTO, session?: ClientSession) {
    if (data.source_type === 'CONSULTATION_SUMMARY') {
      const query = OphthalmologyConsultationFinalizationModel.findById(oid(data.source_id)); if (session) query.session(session);
      const item = await query.lean(); const completion = item?.completions.find((entry) => entry.clinicalVersion === data.source_version);
      if (!item || item.status !== 'COMPLETED' || !completion) return null;
      const snapshot = completion.summarySnapshot;
      return { contextId: item.contextId, visitId: item.visitId, patientId: item.patientId, branchId: item.branchId,
        departmentId: item.departmentId, payload: { kind: 'CONSULTATION_SUMMARY', clinical_version: completion.clinicalVersion,
          approved_at: completion.approvedAt, clinical_review: snapshot['clinical_review'] ?? null,
          diagnoses: typeof snapshot['consultation'] === 'object' && snapshot['consultation'] !== null
            ? (snapshot['consultation'] as Record<string, unknown>)['diagnoses'] ?? [] : [],
          optical_prescription: snapshot['optical_prescription'] ?? null,
          procedure_recommendations: snapshot['procedure_recommendations'] ?? [], referrals: snapshot['referrals'] ?? [],
          follow_ups: snapshot['follow_ups'] ?? [] } };
    }
    if (data.source_type === 'OPTICAL_PRESCRIPTION') {
      const query = OphthalmologyOpticalPrescriptionModel.findById(oid(data.source_id)); if (session) query.session(session); const item = await query.lean();
      const version = item?.versions.find((entry) => entry.clinicalVersion === data.source_version);
      if (!item || item.status !== 'APPROVED' || version?.status !== 'APPROVED') return null;
      return { contextId: item.contextId, visitId: item.visitId, patientId: item.patientId, branchId: item.branchId,
        departmentId: item.departmentId, payload: { kind: 'OPTICAL_PRESCRIPTION', clinical_version: version.clinicalVersion,
          prescription_type: version.prescriptionType, power: version.power, pupillary_distance: version.pupillaryDistance,
          segment_height: version.segmentHeight ?? null, lens_type: version.lensType, material: version.material,
          coating_codes: version.coatingCodes, usage_instructions: version.usageInstructions, valid_until: version.validUntil,
          review_date: version.reviewDate ?? null, approved_at: version.approvedAt ?? null } };
    }
    const resultQuery = OphthalmologyTestResultModel.findById(oid(data.source_id)); if (session) resultQuery.session(session); const result = await resultQuery.lean();
    const version = result?.versions.find((entry) => entry.clinicalVersion === data.source_version);
    if (!result || version?.status !== 'COMPLETED') return null;
    const taskQuery = OphthalmologyTestTaskModel.findOne({ _id: result.taskId, status: 'REVIEWED', reviewedClinicalVersion: data.source_version });
    if (session) taskQuery.session(session); const task = await taskQuery.lean(); if (!task) return null;
    return { contextId: result.contextId, visitId: result.visitId, patientId: result.patientId, branchId: result.branchId,
      departmentId: result.departmentId, payload: { kind: 'TEST_RESULT', clinical_version: version.clinicalVersion,
        test_code: task.testCode, test_name: task.testName, laterality: version.laterality, performed_at: version.performedAt,
        completed_at: version.completedAt ?? null, reviewed_at: task.reviewedAt ?? null, reliability: version.reliability,
        report_document_ids: version.documentIds } };
  }

  async getPublicationByIdempotency(branchId: string, key: string, session?: ClientSession) {
    const query = OphthalmologyPublicationModel.findOne({ branchId: oid(branchId), idempotencyKey: key }); if (session) query.session(session);
    const item = await query.lean<PublicationRecord>(); return item ? toPublication(item) : null;
  }
  async createPublication(scope: { contextId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId;
    departmentId: Types.ObjectId; payload: Record<string, unknown> }, data: CreateOphthalmologyPublicationDTO,
    key: string, fingerprint: string, userId: string, session: ClientSession) {
    const [item] = await OphthalmologyPublicationModel.create([{ ...scope, sourceType: data.source_type, sourceId: oid(data.source_id),
      sourceVersion: data.source_version, status: 'APPROVED_FOR_PORTAL', portalPayload: scope.payload, idempotencyKey: key,
      requestFingerprint: fingerprint, publishedBy: oid(userId), publishedAt: new Date(), version: 0 }], { session });
    if (!item) throw new Error('Ophthalmology publication could not be created');
    return toPublication(item.toObject<PublicationRecord>());
  }
  async getPublication(id: string, session?: ClientSession) { const query = OphthalmologyPublicationModel.findById(oid(id));
    if (session) query.session(session); const item = await query.lean<PublicationRecord>(); return item ? toPublication(item) : null; }
  async withdrawPublication(id: string, expectedVersion: number, reason: string, userId: string, session: ClientSession) {
    const item = await OphthalmologyPublicationModel.findOneAndUpdate({ _id: oid(id), status: 'APPROVED_FOR_PORTAL', version: expectedVersion },
      { $set: { status: 'WITHDRAWN', withdrawnBy: oid(userId), withdrawnAt: new Date(), withdrawalReason: reason }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session }).lean<PublicationRecord>(); return item ? toPublication(item) : null;
  }
  async listPortalPublications(patientId: string) { const items = await OphthalmologyPublicationModel.find({ patientId: oid(patientId),
    status: 'APPROVED_FOR_PORTAL' }).sort({ publishedAt: -1 }).select('-idempotencyKey -requestFingerprint').lean<PublicationRecord[]>();
    return items.map(toPublication); }

  async report(type: OphthalmologyReportType, query: Required<Pick<OphthalmologyReportQuery, 'branch_id' | 'page' | 'limit'>> & OphthalmologyReportQuery) {
    const match: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.station_id) match['stationId'] = oid(query.station_id);
    if (query.date_from || query.date_to) match['orderedAt'] = { ...(query.date_from ? { $gte: new Date(query.date_from) } : {}),
      ...(query.date_to ? { $lte: new Date(query.date_to) } : {}) };
    const skip = (query.page - 1) * query.limit;
    const group: Record<string, unknown> | null = type === 'CLINICAL_VOLUME'
      ? { _id: '$contextId', visit_id: { $first: '$visitId' }, first_ordered_at: { $min: '$orderedAt' }, tests: { $sum: 1 } }
      : type === 'DIAGNOSTIC_UTILIZATION'
        ? { _id: { test_code: '$testCode', station_id: '$stationId' }, ordered: { $sum: 1 },
            completed: { $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'SUBMITTED_FOR_REVIEW', 'REVIEWED']] }, 1, 0] } } }
        : null;
    const extraMatch = type === 'PENDING_REVIEW' ? { status: 'SUBMITTED_FOR_REVIEW' }
      : type === 'REPEAT_UNABLE' ? { status: { $in: ['REPEAT_REQUIRED', 'UNABLE_TO_PERFORM'] } } : {};
    const project: Record<string, unknown> = type === 'TEST_TURNAROUND'
      ? { _id: 0, task_id: { $toString: '$_id' }, test_code: '$testCode', station_id: { $toString: '$stationId' }, status: 1,
          order_to_start_ms: { $cond: ['$startedAt', { $subtract: ['$startedAt', '$orderedAt'] }, null] },
          start_to_completion_ms: { $cond: [{ $and: ['$startedAt', '$completedAt'] }, { $subtract: ['$completedAt', '$startedAt'] }, null] },
          completion_to_review_ms: { $cond: [{ $and: ['$completedAt', '$reviewedAt'] }, { $subtract: ['$reviewedAt', '$completedAt'] }, null] } }
      : { _id: 0, task_id: { $toString: '$_id' }, visit_id: { $toString: '$visitId' }, test_code: '$testCode', test_name: '$testName',
          station_id: { $toString: '$stationId' }, device_code: '$deviceCode', status: 1, priority: 1, ordered_at: '$orderedAt',
          waiting_since: '$waitingSince', started_at: '$startedAt', completed_at: '$completedAt', reviewed_at: '$reviewedAt' };
    const base: PipelineStage[] = [{ $match: { ...match, ...extraMatch } }, ...(group ? [{ $group: group } as PipelineStage] : []), { $sort: { orderedAt: -1, _id: 1 } }];
    const [items, counts] = await Promise.all([
      OphthalmologyTestTaskModel.aggregate([...base, ...(group ? [] : [{ $project: project } as PipelineStage]), { $skip: skip }, { $limit: query.limit }]),
      OphthalmologyTestTaskModel.aggregate([...base, { $count: 'total' }]),
    ]);
    const total = Number(counts[0]?.total ?? 0); return { data: items, meta: { total, page: query.page, limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1 } };
  }

  async refreshDashboard(branchId: string) {
    const [row] = await OphthalmologyTestTaskModel.aggregate([{ $match: { branchId: oid(branchId) } }, { $group: { _id: null,
      waiting: { $sum: { $cond: [{ $in: ['$status', ['ORDERED', 'PATIENT_WAITING', 'PATIENT_CALLED']] }, 1, 0] } },
      in_progress: { $sum: { $cond: [{ $in: ['$status', ['IN_PROGRESS', 'DRAFT']] }, 1, 0] } },
      pending_review: { $sum: { $cond: [{ $eq: ['$status', 'SUBMITTED_FOR_REVIEW'] }, 1, 0] } },
      reviewed: { $sum: { $cond: [{ $eq: ['$status', 'REVIEWED'] }, 1, 0] } },
      repeat_required: { $sum: { $cond: [{ $eq: ['$status', 'REPEAT_REQUIRED'] }, 1, 0] } },
      unable: { $sum: { $cond: [{ $eq: ['$status', 'UNABLE_TO_PERFORM'] }, 1, 0] } } } }]);
    const metrics = { waiting: Number(row?.waiting ?? 0), in_progress: Number(row?.in_progress ?? 0),
      pending_review: Number(row?.pending_review ?? 0), reviewed: Number(row?.reviewed ?? 0),
      repeat_required: Number(row?.repeat_required ?? 0), unable: Number(row?.unable ?? 0) };
    const generatedAt = new Date(); return OphthalmologyDashboardSnapshotModel.findOneAndUpdate({ branchId: oid(branchId) },
      { $set: { generatedAt, metrics } },
      { upsert: true, returnDocument: 'after', lean: true });
  }
  async getDashboard(branchId: string) { return OphthalmologyDashboardSnapshotModel.findOne({ branchId: oid(branchId) }).lean(); }

  async audit(eventType: string, userId: string, resource: Record<string, unknown>, metadata: OphthalmologyRequestMetadata, session: ClientSession) {
    await AuditLogModel.create([{ actorUserId: userId, eventType, ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent, metadataJson: resource }], { session });
  }
  async timeline(patientId: string, eventType: PatientTimelineEventType, title: string, description: string, userId: string, session: ClientSession) {
    await PatientTimelineEventModel.create([{ patientId: oid(patientId), eventType, title, description,
      occurredAt: new Date(), createdBy: oid(userId) }], { session });
  }
}
