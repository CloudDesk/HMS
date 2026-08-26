import mongoose, { Types, type ClientSession } from 'mongoose';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { WardModel } from '../admissions-configuration/admissions-configuration.model.js';
import { AdmissionRequestModel, InpatientAdmissionModel, type AdmissionRequestFields, type InpatientAdmissionFields } from './inpatient-admission.model.js';
import type { AdmissionRequest, AdmissionRequestListQuery, AdmissionRequestMetadata, AdmissionPrerequisiteSnapshot, AdmissionSourceType, CreateAdmissionRequestDTO, CreateInpatientAdmissionDTO, InpatientAdmission, InpatientAdmissionListQuery, ValidateAdmissionRequestDTO } from './inpatient-admission.types.js';
const oid = (value: string) => new Types.ObjectId(value);
const meta = (total: number, page: number, limit: number) => ({ total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
const toDto = (item: InpatientAdmissionFields & { _id: Types.ObjectId; wardName?: string; bedNumber?: string }): InpatientAdmission => ({ id: item._id.toString(), admission_number: item.admissionNumber, patient_id: item.patientId.toString(), patient_number: item.patientNumber, patient_name: item.patientName, branch_id: item.branchId.toString(), ward_id: item.wardId.toString(), ward_name: item.wardName ?? '', bed_id: item.bedId.toString(), bed_number: item.bedNumber ?? '', admitting_doctor_id: item.admittingDoctorId.toString(), admitting_doctor_name: item.admittingDoctorName, department_id: item.departmentId.toString(), department_name: item.departmentName, admission_date: item.admissionDate, admission_type: item.admissionType, reason: item.reason, notes: item.notes ?? null, status: item.status, request_id: item.requestId?.toString() ?? null, source_type: item.sourceType ?? 'DIRECT', source_id: item.sourceId?.toString() ?? null, created_at: item.createdAt, updated_at: item.updatedAt });
const toRequest = (item: AdmissionRequestFields & { _id: Types.ObjectId }): AdmissionRequest => ({
  id: item._id.toString(), request_number: item.requestNumber, patient_id: item.patientId.toString(), patient_number: item.patientNumber,
  patient_name: item.patientName, branch_id: item.branchId.toString(), department_id: item.departmentId.toString(), department_name: item.departmentName,
  recommending_doctor_id: item.recommendingDoctorId.toString(), recommending_doctor_name: item.recommendingDoctorName,
  source_type: item.sourceType, source_id: item.sourceId?.toString() ?? null, source_reference: item.sourceReference ?? null,
  admission_type: item.admissionType, priority: item.priority, reason: item.reason, notes: item.notes ?? null, status: item.status,
  hold_id: item.holdId?.toString() ?? null, ward_id: item.wardId?.toString() ?? null, bed_id: item.bedId?.toString() ?? null,
  consent_document_id: item.consentDocumentId?.toString() ?? null, deposit_invoice_id: item.depositInvoiceId?.toString() ?? null,
  prerequisite_snapshot: (item.prerequisiteSnapshot as AdmissionPrerequisiteSnapshot | null | undefined) ?? null,
  admission_id: item.admissionId?.toString() ?? null, cancellation_reason: item.cancellationReason ?? null,
  created_at: item.createdAt, updated_at: item.updatedAt,
});
export class InpatientAdmissionRepository {
  constructor(private readonly sequenceService: SequenceService) {}
  async departmentScope(userId: string) { const user = await UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null }).select('departmentIds roleIds').lean(); if (!user) return []; const superAdmin = await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null }); return superAdmin ? undefined : (user.departmentIds ?? []).map((id) => id.toString()); }
  async hasActiveAdmission(patientId: string, session: ClientSession) { return Boolean(await InpatientAdmissionModel.exists({ patientId: oid(patientId), status: 'ADMITTED' }).session(session)); }
  async hasBranchAccess(userId: string, branchId: string) { const [user, branch] = await Promise.all([UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).select('branchIds roleIds').lean(), BranchModel.exists({ _id: branchId, status: 'ACTIVE', deletedAt: null })]); if (!user || !branch) return false; if ((user.branchIds ?? []).some((id) => id.toString() === branchId)) return true; return Boolean(await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null })); }
  async references(data: CreateInpatientAdmissionDTO, session: ClientSession) { const [patient, doctor, department, ward] = await Promise.all([PatientModel.findOne({ _id: oid(data.patient_id), status: 'ACTIVE', deletedAt: null }).lean(), DoctorModel.findOne({ _id: oid(data.admitting_doctor_id), branchId: oid(data.branch_id), status: 'ACTIVE', deletedAt: null }).lean(), DepartmentModel.findOne({ _id: oid(data.department_id), branchIds: oid(data.branch_id), status: 'ACTIVE', deletedAt: null }).lean(), WardModel.findOne({ _id: oid(data.ward_id), branchId: oid(data.branch_id), status: 'ACTIVE' }).session(session).lean()]); return { patient, doctor, department, ward }; }
  async create(data: CreateInpatientAdmissionDTO, refs: { patientNumber: string; patientName: string; doctorName: string; departmentName: string }, userId: string, session: ClientSession, source: { requestId?: string | null; sourceType?: AdmissionSourceType; sourceId?: string | null } = {}) { const sequence = await this.sequenceService.getNextSequence('admission', session); const created = await InpatientAdmissionModel.create([{ admissionNumber: this.sequenceService.formatTimestampSequence('ADM', sequence), patientId: oid(data.patient_id), patientNumber: refs.patientNumber, patientName: refs.patientName, branchId: oid(data.branch_id), wardId: oid(data.ward_id), bedId: oid(data.bed_id), admittingDoctorId: oid(data.admitting_doctor_id), admittingDoctorName: refs.doctorName, departmentId: oid(data.department_id), departmentName: refs.departmentName, admissionDate: new Date(data.admission_date), admissionType: data.admission_type, reason: data.reason, notes: data.notes ?? null, status: 'ADMITTED', requestId: source.requestId ? oid(source.requestId) : null, sourceType: source.sourceType ?? 'DIRECT', sourceId: source.sourceId ? oid(source.sourceId) : null, createdBy: oid(userId), updatedBy: oid(userId) }], { session }); const first = created[0]; if (!first) throw new Error('Admission create returned no record'); return toDto(first.toObject() as InpatientAdmissionFields & { _id: Types.ObjectId }); }

  async requestReferences(data: CreateAdmissionRequestDTO, session: ClientSession) { const patient = await PatientModel.findOne({ _id: oid(data.patient_id), status: 'ACTIVE', deletedAt: null }).session(session).lean(); const doctor = await DoctorModel.findOne({ _id: oid(data.recommending_doctor_id), branchId: oid(data.branch_id), status: 'ACTIVE', deletedAt: null }).session(session).lean(); const department = await DepartmentModel.findOne({ _id: oid(data.department_id), branchIds: oid(data.branch_id), status: 'ACTIVE', deletedAt: null }).session(session).lean(); return { patient, doctor, department }; }
  async createRequest(data: CreateAdmissionRequestDTO, refs: { patientNumber: string; patientName: string; doctorName: string; departmentName: string; sourceReference?: string | null }, userId: string, session: ClientSession) {
    const sequence = await this.sequenceService.getNextSequence('admission_request', session);
    const created = await AdmissionRequestModel.create([{ requestNumber: this.sequenceService.formatTimestampSequence('AR', sequence), patientId: oid(data.patient_id), patientNumber: refs.patientNumber, patientName: refs.patientName, branchId: oid(data.branch_id), departmentId: oid(data.department_id), departmentName: refs.departmentName, recommendingDoctorId: oid(data.recommending_doctor_id), recommendingDoctorName: refs.doctorName, sourceType: data.source_type, sourceId: data.source_id ? oid(data.source_id) : null, sourceReference: refs.sourceReference ?? null, activeSourceKey: data.source_id ? `${data.source_type}:${data.source_id}` : null, admissionType: data.admission_type, priority: data.priority, reason: data.reason, notes: data.notes ?? null, status: 'PENDING_VALIDATION', createdBy: oid(userId), updatedBy: oid(userId) }], { session });
    const first = created[0]; if (!first) throw new Error('Admission request create returned no record'); return toRequest(first.toObject() as AdmissionRequestFields & { _id: Types.ObjectId });
  }
  async listRequests(query: AdmissionRequestListQuery, departmentIds?: string[]) { const page = query.page ?? 1; const limit = query.limit ?? 20; const filter: Record<string, unknown> = { branchId: oid(query.branch_id) }; if (departmentIds) filter.departmentId = { $in: departmentIds.map(oid) }; if (query.status) filter.status = query.status; if (query.source_type) filter.sourceType = query.source_type; if (query.patient_id) filter.patientId = oid(query.patient_id); if (query.search) { const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const value = new RegExp(escaped, 'i'); filter.$or = [{ requestNumber: value }, { patientNumber: value }, { patientName: value }]; } const [items, total] = await Promise.all([AdmissionRequestModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean<(AdmissionRequestFields & { _id: Types.ObjectId })[]>(), AdmissionRequestModel.countDocuments(filter)]); return { data: items.map(toRequest), meta: meta(total, page, limit) }; }

  async getRequestStatusCounts(branchId: string, departmentIds?: string[], session?: ClientSession) {
    const filter: Record<string, unknown> = { branchId: oid(branchId) };
    if (departmentIds) {
      filter.departmentId = { $in: departmentIds.map(oid) };
    }
    
    const query = AdmissionRequestModel.aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    if (session) query.session(session);
    
    const results = await query;
    const counts = {
      pendingValidation: 0,
      readyForConfirmation: 0,
      confirmed: 0,
      cancelled: 0
    };
    
    for (const res of results) {
      if (res._id === 'PENDING_VALIDATION') counts.pendingValidation = res.count;
      else if (res._id === 'READY_FOR_CONFIRMATION') counts.readyForConfirmation = res.count;
      else if (res._id === 'CONFIRMED') counts.confirmed = res.count;
      else if (res._id === 'CANCELLED') counts.cancelled = res.count;
    }
    
    return counts;
  }
  async getRequest(id: string, branchId: string, session?: ClientSession) { const query = AdmissionRequestModel.findOne({ _id: oid(id), branchId: oid(branchId) }).lean<AdmissionRequestFields & { _id: Types.ObjectId }>(); if (session) query.session(session); const item = await query; return item ? toRequest(item) : null; }
  async validateRequest(id: string, branchId: string, data: ValidateAdmissionRequestDTO, actor: string, session: ClientSession) { const item = await AdmissionRequestModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId), status: { $in: ['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION'] } }, { $set: { wardId: oid(data.ward_id), bedId: oid(data.bed_id), holdId: data.hold_id ? oid(data.hold_id) : null, consentDocumentId: data.consent_document_id ? oid(data.consent_document_id) : null, depositInvoiceId: data.deposit_invoice_id ? oid(data.deposit_invoice_id) : null, status: 'READY_FOR_CONFIRMATION', updatedBy: oid(actor) } }, { new: true, session, runValidators: true }).lean<AdmissionRequestFields & { _id: Types.ObjectId }>(); return item ? toRequest(item) : null; }
  async confirmRequest(id: string, admissionId: string, snapshot: AdmissionPrerequisiteSnapshot, actor: string, session: ClientSession) { const item = await AdmissionRequestModel.findOneAndUpdate({ _id: oid(id), status: 'READY_FOR_CONFIRMATION', admissionId: null }, { $set: { status: 'CONFIRMED', admissionId: oid(admissionId), prerequisiteSnapshot: snapshot, updatedBy: oid(actor) } }, { new: true, session }).lean<AdmissionRequestFields & { _id: Types.ObjectId }>(); return item ? toRequest(item) : null; }
  async cancelRequest(id: string, branchId: string, reason: string, actor: string, session: ClientSession) { const item = await AdmissionRequestModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId), status: { $in: ['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION'] } }, { $set: { status: 'CANCELLED', activeSourceKey: null, cancellationReason: reason, cancelledAt: new Date(), cancelledBy: oid(actor), updatedBy: oid(actor) } }, { new: true, session }).lean<AdmissionRequestFields & { _id: Types.ObjectId }>(); return item ? toRequest(item) : null; }

  async getRecord(id: string, branchId: string, session: ClientSession) { return InpatientAdmissionModel.findOne({ _id: oid(id), branchId: oid(branchId) }).session(session).lean<InpatientAdmissionFields & { _id: Types.ObjectId }>(); }
  async list(query: InpatientAdmissionListQuery, departmentIds?: string[]) { const page = query.page ?? 1; const limit = query.limit ?? 20; const filter: Record<string, unknown> = { branchId: oid(query.branch_id) }; if (departmentIds) filter.departmentId = { $in: departmentIds.map(oid) }; if (query.status) filter.status = query.status; const [items, total] = await Promise.all([InpatientAdmissionModel.aggregate<InpatientAdmissionFields & { _id: Types.ObjectId; wardName?: string; bedNumber?: string }>([{ $match: filter }, { $lookup: { from: 'hmswards', localField: 'wardId', foreignField: '_id', as: 'ward' } }, { $lookup: { from: 'hmsbeds', localField: 'bedId', foreignField: '_id', as: 'bed' } }, { $set: { wardName: { $ifNull: [{ $arrayElemAt: ['$ward.name', 0] }, ''] }, bedNumber: { $ifNull: [{ $arrayElemAt: ['$bed.bedNumber', 0] }, ''] } } }, { $sort: { admissionDate: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }]), InpatientAdmissionModel.countDocuments(filter)]); return { data: items.map(toDto), meta: meta(total, page, limit) }; }
  async getById(id: string, branchId: string) { const item = await InpatientAdmissionModel.findOne({ _id: oid(id), branchId: oid(branchId) }).lean(); return item ? toDto(item as InpatientAdmissionFields & { _id: Types.ObjectId }) : null; }
  async audit(eventType: string, actor: string, metadata: AdmissionRequestMetadata, details: Record<string, unknown>, session: ClientSession) { await AuditLogModel.create([{ eventType, actorUserId: actor, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadataJson: details }], { session }); }
  async session() { return mongoose.startSession(); }
}
