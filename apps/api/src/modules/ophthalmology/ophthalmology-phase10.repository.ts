import { AppointmentModel } from '../appointments/appointment.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { publicOphthalmologyPayload } from './ophthalmology-public-payload.js';
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
import type { OphthalmologyPublicationListQuery, CreateOphthalmologyPublicationDTO, OphthalmologyAttachment, OphthalmologyAttachmentListQuery, OphthalmologyPublication,
  OphthalmologyReportQuery, OphthalmologyReportType } from './ophthalmology-phase10.types.js';
import type { OphthalmologyRequestMetadata } from './ophthalmology.types.js';

type PublicationRecord = OphthalmologyPublicationFields & { _id: Types.ObjectId };
type AttachmentRecord = OphthalmologyAttachmentFields & { _id: Types.ObjectId };
const oid = (value: string) => new Types.ObjectId(value);
const toPublication = (item: PublicationRecord): OphthalmologyPublication => ({
  id: item._id.toString(), context_id: item.contextId.toString(), visit_id: item.visitId.toString(),
  patient_id: item.patientId.toString(), branch_id: item.branchId.toString(), department_id: item.departmentId.toString(),
  source_type: item.sourceType, source_id: item.sourceId.toString(), source_version: item.sourceVersion,
  status: item.status, portal_payload: publicOphthalmologyPayload(item.sourceType, item.portalPayload), published_by: item.publishedBy.toString(), published_at: item.publishedAt,
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

export const publicationDocumentIds = (payload: Record<string, unknown>) => Array.isArray(payload.report_document_ids)
  ? payload.report_document_ids.filter((id): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)) : [];
export async function synchronizeAttachmentPublication(patientId: string, documentIds: string[], session: ClientSession) {
  for (const documentId of new Set(documentIds)) {
    const active = await OphthalmologyPublicationModel.exists({ patientId: oid(patientId), sourceType: 'TEST_RESULT', status: 'APPROVED_FOR_PORTAL', 'portalPayload.report_document_ids': documentId }).session(session);
    await OphthalmologyAttachmentModel.updateMany({ patientId: oid(patientId), patientDocumentId: oid(documentId) },
      { $set: { publicationState: active ? 'APPROVED_FOR_PORTAL' : 'WITHDRAWN', ...(active ? { reviewState: 'VERIFIED' } : {}) } }, { session });
  }
}

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

  async attachmentRequestMatches(branchId: string, key: string, requestFingerprint: string) {
    return Boolean(await OphthalmologyAttachmentModel.exists({ branchId: oid(branchId), idempotencyKey: key, requestFingerprint }));
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
      if (!item || item.status !== 'COMPLETED' || !completion || item.completions.at(-1)?.clinicalVersion !== data.source_version) return null;
      const snapshot = completion.summarySnapshot;
      return { contextId: item.contextId, visitId: item.visitId, patientId: item.patientId, branchId: item.branchId,
        departmentId: item.departmentId, payload: { kind: 'CONSULTATION_SUMMARY', clinical_version: completion.clinicalVersion,
          approved_at: completion.approvedAt, consultation: snapshot['consultation'] ?? null, medication_prescriptions: snapshot['medication_prescriptions'] ?? [], clinical_review: snapshot['clinical_review'] ?? null,
          diagnoses: typeof snapshot['consultation'] === 'object' && snapshot['consultation'] !== null
            ? (snapshot['consultation'] as Record<string, unknown>)['diagnoses'] ?? [] : [],
          optical_prescription: snapshot['optical_prescription'] ?? null,
          procedure_recommendations: snapshot['procedure_recommendations'] ?? [], referrals: snapshot['referrals'] ?? [],
          follow_ups: snapshot['follow_ups'] ?? [] } };
    }
    if (data.source_type === 'OPTICAL_PRESCRIPTION') {
      const query = OphthalmologyOpticalPrescriptionModel.findById(oid(data.source_id)); if (session) query.session(session); const item = await query.lean();
      const version = item?.versions.find((entry) => entry.clinicalVersion === data.source_version);
      if (!item || item.status !== 'APPROVED' || version?.status !== 'APPROVED' || item.currentClinicalVersion !== data.source_version) return null;
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
        report_document_ids: version.documentIds.map((id) => id.toString()) } };
  }

  async getPublicationByIdempotency(branchId: string, key: string, session?: ClientSession) {
    const query = OphthalmologyPublicationModel.findOne({ branchId: oid(branchId), idempotencyKey: key }); if (session) query.session(session);
    const item = await query.lean<PublicationRecord>(); return item ? toPublication(item) : null;
  }
  async createPublication(scope: { contextId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId;
    departmentId: Types.ObjectId; payload: Record<string, unknown> }, data: CreateOphthalmologyPublicationDTO,
    key: string, fingerprint: string, userId: string, session: ClientSession) {
    const [item] = await OphthalmologyPublicationModel.create([{ ...scope, portalPayload: publicOphthalmologyPayload(data.source_type, scope.payload), sourceType: data.source_type, sourceId: oid(data.source_id),
      sourceVersion: data.source_version, status: 'APPROVED_FOR_PORTAL', idempotencyKey: key,
      requestFingerprint: fingerprint, publishedBy: oid(userId), publishedAt: new Date(), version: 0 }], { session });
    if (!item) throw new Error('Ophthalmology publication could not be created');
    return toPublication(item.toObject<PublicationRecord>());
  }
  async listPublications(query: OphthalmologyPublicationListQuery, departmentIds: string[] | null) {
    const filter = { branchId: oid(query.branch_id), ...(departmentIds === null ? {} : { departmentId: { $in: departmentIds.map(oid) } }),
      ...(query.visit_id ? { visitId: oid(query.visit_id) } : {}), ...(query.source_id ? { sourceId: oid(query.source_id) } : {}), ...(query.source_version ? { sourceVersion: query.source_version } : {}), ...(query.source_type ? { sourceType: query.source_type } : {}),
      ...(query.status ? { status: query.status } : {}) };
    const page = query.page ?? 1; const limit = query.limit ?? 20;
    const [records, total] = await Promise.all([
      OphthalmologyPublicationModel.find(filter).select('-portalPayload -idempotencyKey -requestFingerprint').sort({ publishedAt: -1, _id: -1 })
        .skip((page - 1) * limit).limit(limit).lean<PublicationRecord[]>(),
      OphthalmologyPublicationModel.countDocuments(filter),
    ]);
    return { data: records.map((record) => { const item = toPublication(record); const { portal_payload, ...metadata } = item; void portal_payload; return metadata; }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async acquirePublicationFence(contextId: string, session: ClientSession) {
    const result = await OphthalmologyContextModel.updateOne({ _id: oid(contextId) }, { $inc: { publicationRevision: 1 } }, { session });
    return result.matchedCount === 1;
  }

  async synchronizePublicationDocuments(publication: OphthalmologyPublication, session: ClientSession) {
    await synchronizeAttachmentPublication(publication.patient_id, publicationDocumentIds(publication.portal_payload), session);
  }

  async publicationLocked(contextId: string, session?: ClientSession) {
    const query = OphthalmologyConsultationFinalizationModel.exists({ contextId: oid(contextId), status: 'AMENDMENT_OPEN' });
    if (session) query.session(session); return Boolean(await query);
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

  private async visitVolumePipeline(query: OphthalmologyReportQuery, departmentIds: string[] | null): Promise<PipelineStage[]> {
    const departments = await DepartmentModel.find({ status: 'ACTIVE', isClinical: true, branchIds: oid(query.branch_id),
      ...(departmentIds === null ? {} : { _id: { $in: departmentIds.map(oid) } }),
      $or: [{ code: /^OPHTHALMOLOGY$/i }, { name: /^OPHTHALMOLOGY$/i }] }).select('_id').lean<{ _id: Types.ObjectId }[]>();
    const filter = { branchId: oid(query.branch_id), departmentId: { $in: departments.map((row) => row._id) }, deletedAt: null,
      ...(query.date_from || query.date_to ? { visitDate: { ...(query.date_from ? { $gte: new Date(query.date_from) } : {}), ...(query.date_to ? { $lte: new Date(query.date_to) } : {}) } } : {}) };
    return [{ $match: filter }, { $sort: { visitDate: -1, _id: -1 } },
      { $lookup: { from: AppointmentModel.collection.name, let: { appointment: '$appointmentId', patient: '$patientId', branch: '$branchId', department: '$departmentId', doctor: '$doctorId' }, pipeline: [
        { $match: { deletedAt: null, $expr: { $and: [{ $eq: ['$_id', '$$appointment'] }, { $eq: ['$patientId', '$$patient'] }, { $eq: ['$branchId', '$$branch'] }, { $eq: ['$departmentId', '$$department'] }, { $eq: ['$doctorId', '$$doctor'] }] } } },
        { $project: { _id: 0, subtype: '$ophthalmology.visit_subtype', sub_speciality_code: '$ophthalmology.sub_speciality_code', sub_speciality_configuration_id: '$ophthalmology.sub_speciality_configuration_id' } },
      ], as: 'scheduling' } },
      { $set: { scheduling: { $arrayElemAt: ['$scheduling', 0] } } },
      { $project: { _id: 0, visit_id: { $toString: '$_id' },
      branch_id: { $toString: '$branchId' }, department_id: { $toString: '$departmentId' }, doctor_id: { $toString: '$doctorId' },
      doctor_name: '$doctorName', visit_type: '$visitType', visit_date: '$visitDate', status: 1, scheduling_subtype: { $ifNull: ['$scheduling.subtype', null] }, sub_speciality_code: { $ifNull: ['$scheduling.sub_speciality_code', null] }, sub_speciality_configuration_id: { $ifNull: ['$scheduling.sub_speciality_configuration_id', null] } } }];
  }
  private taskReportMatch(query: OphthalmologyReportQuery, departmentIds: string[] | null): Record<string, unknown> {
    const match: Record<string, unknown> = { branchId: oid(query.branch_id), ...(departmentIds === null ? {} : { departmentId: { $in: departmentIds.map(oid) } }) };
    if (query.station_id) match['stationId'] = oid(query.station_id);
    if (query.date_from || query.date_to) match['orderedAt'] = { ...(query.date_from ? { $gte: new Date(query.date_from) } : {}),
      ...(query.date_to ? { $lte: new Date(query.date_to) } : {}) };
    return match;
  }
  private reportPipeline(type: OphthalmologyReportType, query: OphthalmologyReportQuery, departmentIds: string[] | null): PipelineStage[] {
    const match = this.taskReportMatch(query, departmentIds);
    const group: Record<string, unknown> | null = type === 'CLINICAL_VOLUME'
      ? { _id: '$contextId', visit_id: { $first: '$visitId' }, first_ordered_at: { $min: '$orderedAt' }, tests: { $sum: 1 } }
      : type === 'DIAGNOSTIC_UTILIZATION'
        ? { _id: { test_code: '$testCode', station_id: '$stationId' }, ordered: { $sum: 1 },
            completed: { $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'SUBMITTED_FOR_REVIEW', 'REVIEWED']] }, 1, 0] } } }
        : null;
    const extraMatch = type === 'PENDING_REVIEW' ? { $or: [{ status: 'SUBMITTED_FOR_REVIEW' }, { status: { $in: ['COMPLETED', 'REVIEWED'] }, doctorReviewRequired: true }] }
      : type === 'REPEAT_UNABLE' ? { status: { $in: ['REPEAT_REQUIRED', 'UNABLE_TO_PERFORM'] } } : {};
    const project: Record<string, unknown> = type === 'TEST_TURNAROUND'
      ? { _id: 0, task_id: { $toString: '$_id' }, test_code: '$testCode', station_id: { $toString: '$stationId' }, status: 1,
          order_to_start_ms: { $cond: ['$startedAt', { $subtract: ['$startedAt', '$orderedAt'] }, null] },
          start_to_completion_ms: { $cond: [{ $and: ['$startedAt', '$completedAt'] }, { $subtract: ['$completedAt', '$startedAt'] }, null] },
          completion_to_review_ms: { $cond: [{ $and: ['$completedAt', '$reviewedAt'] }, { $subtract: ['$reviewedAt', '$completedAt'] }, null] } }
      : { _id: 0, task_id: { $toString: '$_id' }, visit_id: { $toString: '$visitId' }, test_code: '$testCode', test_name: '$testName',
          station_id: { $toString: '$stationId' }, device_code: '$deviceCode', status: 1, priority: 1, ordered_at: '$orderedAt',
          waiting_since: '$waitingSince', started_at: '$startedAt', completed_at: '$completedAt', reviewed_at: '$reviewedAt' };
    if (type === 'REPEAT_UNABLE') project.reason = { $let: { vars: { transition: { $arrayElemAt: [{ $filter: { input: '$transitionHistory', as: 'entry', cond: { $eq: ['$$entry.toStatus', '$status'] } } }, -1] } }, in: { $ifNull: ['$$transition.reason', null] } } };
    const pending: PipelineStage[] = type !== 'PENDING_REVIEW' ? [] : [
      { $lookup: { from: OphthalmologyTestResultModel.collection.name, let: { task: '$_id', patient: '$patientId', branch: '$branchId', department: '$departmentId' }, pipeline: [
        { $match: { status: 'COMPLETED', $expr: { $and: [{ $eq: ['$taskId', '$$task'] }, { $eq: ['$patientId', '$$patient'] }, { $eq: ['$branchId', '$$branch'] }, { $eq: ['$departmentId', '$$department'] }] } } },
        { $project: { _id: 0, currentClinicalVersion: 1, currentCompleted: { $anyElementTrue: { $map: { input: '$versions', as: 'entry', in: { $and: [{ $eq: ['$$entry.clinicalVersion', '$currentClinicalVersion'] }, { $eq: ['$$entry.status', 'COMPLETED'] }] } } } } } },
      ], as: 'pendingResult' } },
      { $unwind: '$pendingResult' },
      { $match: { 'pendingResult.currentCompleted': true, $expr: { $ne: [{ $ifNull: ['$reviewedClinicalVersion', null] }, '$pendingResult.currentClinicalVersion'] } } },
    ];
    const base: PipelineStage[] = [{ $match: { ...match, ...extraMatch } }, ...pending, ...(group ? [{ $group: group } as PipelineStage] : []), { $sort: { orderedAt: -1, _id: 1 } }];
    return [...base, ...(group ? [] : [{ $project: project } as PipelineStage])];
  }
  async report(type: OphthalmologyReportType, query: Required<Pick<OphthalmologyReportQuery, 'branch_id' | 'page' | 'limit'>> & OphthalmologyReportQuery, departmentIds: string[] | null = null) {
    if (type === 'CLINICAL_VOLUME' && query.volume_basis === 'VISITS') {
      const pipeline = await this.visitVolumePipeline(query, departmentIds);
      const [data, counts] = await Promise.all([
        OpdVisitModel.aggregate<Record<string, unknown>>([...pipeline, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }]),
        OpdVisitModel.aggregate<{ total: number }>([...pipeline, { $count: 'total' }]),
      ]);
      const total = counts[0]?.total ?? 0;
      return { basis: 'VISITS' as const, data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) || 1 } };
    }
    const base = this.reportPipeline(type, query, departmentIds);
    const skip = (query.page - 1) * query.limit;
    const [items, counts] = await Promise.all([
      OphthalmologyTestTaskModel.aggregate([...base, { $skip: skip }, { $limit: query.limit }]),
      OphthalmologyTestTaskModel.aggregate([...base, { $count: 'total' }]),
    ]);
    const summary = type === 'REPEAT_UNABLE' ? await this.repeatUnableSummary(query, departmentIds) : undefined;
    const total = Number(counts[0]?.total ?? 0); return { data: items, ...(summary ? { summary } : {}), meta: { total, page: query.page, limit: query.limit,
      totalPages: Math.ceil(total / query.limit) || 1 } };
  }
  private async repeatUnableSummary(query: OphthalmologyReportQuery, departmentIds: string[] | null) {
    const [row] = await OphthalmologyTestTaskModel.aggregate<{ denominator: number; repeat: number; unable: number }>([
      { $match: this.taskReportMatch(query, departmentIds) }, { $group: { _id: null, denominator: { $sum: 1 },
        repeat: { $sum: { $cond: [{ $eq: ['$status', 'REPEAT_REQUIRED'] }, 1, 0] } }, unable: { $sum: { $cond: [{ $eq: ['$status', 'UNABLE_TO_PERFORM'] }, 1, 0] } } } },
    ]);
    const total = row?.denominator ?? 0; const repeat = row?.repeat ?? 0; const unable = row?.unable ?? 0;
    return { basis: 'CURRENT_TASK_STATUS' as const, denominator_tasks: total, repeat_required_tasks: repeat, unable_tasks: unable,
      repeat_required_percent: total ? Math.round(repeat / total * 10000) / 100 : null,
      unable_percent: total ? Math.round(unable / total * 10000) / 100 : null };

  }

  async *exportReport(type: OphthalmologyReportType, query: OphthalmologyReportQuery, departmentIds: string[] | null): AsyncGenerator<Record<string, unknown>> {
    if (type === 'CLINICAL_VOLUME' && query.volume_basis === 'VISITS') {
      const cursor = OpdVisitModel.aggregate<Record<string, unknown>>(await this.visitVolumePipeline(query, departmentIds)).cursor({ batchSize: 100 });
      try { for await (const row of cursor) yield row; } finally { await cursor.close(); }
      return;
    }
    const cursor = OphthalmologyTestTaskModel.aggregate<Record<string, unknown>>(this.reportPipeline(type, query, departmentIds)).cursor({ batchSize: 100 });
    try { for await (const row of cursor) yield row; } finally { await cursor.close(); }
  }

  async activeDashboardDepartments(branchId: string) {
    const rows = await DepartmentModel.find({ status: 'ACTIVE', isClinical: true, branchIds: oid(branchId),
      $or: [{ code: /^OPHTHALMOLOGY$/i }, { name: /^OPHTHALMOLOGY$/i }] }).select('_id').lean<{ _id: Types.ObjectId }[]>();
    return rows.map((row) => row._id.toString()).sort();
  }
  async refreshDashboard(branchId: string, departmentIds: string[]) {
    const [row] = await OphthalmologyTestTaskModel.aggregate([{ $match: { branchId: oid(branchId), departmentId: { $in: departmentIds.map(oid) } } }, { $group: { _id: null,
      waiting: { $sum: { $cond: [{ $in: ['$status', ['ORDERED', 'PATIENT_WAITING', 'PATIENT_CALLED']] }, 1, 0] } },
      in_progress: { $sum: { $cond: [{ $in: ['$status', ['IN_PROGRESS', 'DRAFT']] }, 1, 0] } },
      pending_review: { $sum: { $cond: [{ $eq: ['$status', 'SUBMITTED_FOR_REVIEW'] }, 1, 0] } },
      reviewed: { $sum: { $cond: [{ $eq: ['$status', 'REVIEWED'] }, 1, 0] } },
      repeat_required: { $sum: { $cond: [{ $eq: ['$status', 'REPEAT_REQUIRED'] }, 1, 0] } },
      unable: { $sum: { $cond: [{ $eq: ['$status', 'UNABLE_TO_PERFORM'] }, 1, 0] } } } }]);
    const pending = await OphthalmologyTestTaskModel.aggregate<{ total: number }>([...this.reportPipeline('PENDING_REVIEW', { branch_id: branchId }, departmentIds), { $count: 'total' }]);
    const metrics = { waiting: Number(row?.waiting ?? 0), in_progress: Number(row?.in_progress ?? 0),
      pending_review: pending[0]?.total ?? 0, reviewed: Number(row?.reviewed ?? 0),
      repeat_required: Number(row?.repeat_required ?? 0), unable: Number(row?.unable ?? 0) };
    const generatedAt = new Date(); return OphthalmologyDashboardSnapshotModel.findOneAndUpdate({ branchId: oid(branchId) },
      { $set: { generatedAt, metrics, departmentIds: departmentIds.map(oid) } },
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
