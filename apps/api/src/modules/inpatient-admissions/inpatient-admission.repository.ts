import mongoose, { Types, type ClientSession } from 'mongoose';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { OpdReferralModel, type OpdReferralFields } from '../opd/opd-referral.model.js';
import { OpdVisitModel, type OpdVisitFields } from '../opd/opd-visit.model.js';
import { WardModel } from '../admissions-configuration/admissions-configuration.model.js';
import { AdmissionRequestModel, InpatientAdmissionModel, type AdmissionRequestFields, type InpatientAdmissionFields } from './inpatient-admission.model.js';
import { InpatientRoundNoteModel, InpatientVitalModel, type InpatientRoundNoteFields, type InpatientVitalFields } from './inpatient-clinical-record.model.js';
import type { AdmissionRequest, AdmissionRequestListQuery, AdmissionRequestMetadata, AdmissionPrerequisiteSnapshot, AdmissionSourceType, CreateAdmissionRequestDTO, CreateInpatientAdmissionDTO, CreateInpatientRoundNoteDTO, CreateInpatientVitalDTO, InpatientAdmission, InpatientAdmissionListQuery, InpatientRoundNote, InpatientVital, ValidateAdmissionRequestDTO } from './inpatient-admission.types.js';
const oid = (value: string) => new Types.ObjectId(value);
const safeOid = (value: string | null | undefined) => (value && /^[a-f\d]{24}$/i.test(value) ? new Types.ObjectId(value) : null);
const departmentBranchClauses = (branchId: string) => {
  const branchObjectId = oid(branchId);

  return [
    { branchIds: branchObjectId },
    { branchId: branchObjectId },
    { branchIds: { $exists: false } },
    { branchIds: { $size: 0 } },
  ];
};
const meta = (total: number, page: number, limit: number) => ({ total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
const toDto = (item: InpatientAdmissionFields & { _id: Types.ObjectId; wardName?: string; bedNumber?: string }): InpatientAdmission => ({
  id: item._id.toString(),
  admission_number: item.admissionNumber,
  patient_id: item.patientId.toString(),
  patient_number: item.patientNumber,
  patient_name: item.patientName,
  branch_id: item.branchId.toString(),
  ward_id: item.wardId.toString(),
  ward_name: item.wardName ?? '',
  bed_id: item.bedId.toString(),
  bed_number: item.bedNumber ?? '',
  admitting_doctor_id: item.admittingDoctorId.toString(),
  admitting_doctor_name: item.admittingDoctorName,
  department_id: item.departmentId.toString(),
  department_name: item.departmentName,
  admission_date: item.admissionDate,
  admission_type: item.admissionType,
  reason: item.reason,
  notes: item.notes ?? null,
  status: item.status,
  request_id: item.requestId?.toString() ?? null,
  source_type: item.sourceType ?? 'DIRECT',
  source_id: item.sourceId?.toString() ?? null,
  discharge_summary: item.dischargeSummary ? {
    hemodynamic_stability_24h: item.dischargeSummary.hemodynamicStability24h,
    post_op_recovery_cleared: item.dischargeSummary.postOpRecoveryCleared,
    home_oral_med_converted: item.dischargeSummary.homeOralMedConverted,
    summary_finalized: item.dischargeSummary.summaryFinalized,
    notes: item.dischargeSummary.notes ?? null,
    saved_by: item.dischargeSummary.savedBy?.toString() ?? null,
    saved_by_name: item.dischargeSummary.savedByName ?? null,
    saved_at: item.dischargeSummary.savedAt ?? null,
  } : null,
  discharged_at: item.dischargedAt ?? null,
  discharged_by: item.dischargedBy?.toString() ?? null,
  discharged_by_name: item.dischargedByName ?? null,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});
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
const toRoundNote = (item: InpatientRoundNoteFields & { _id: Types.ObjectId }): InpatientRoundNote => ({
  id: item._id.toString(), admission_id: item.admissionId.toString(), patient_id: item.patientId.toString(), branch_id: item.branchId.toString(),
  encounter_id: item.encounterId?.toString() ?? null, doctor_name: item.createdByName, created_by: item.createdBy.toString(), date: item.createdAt,
  updated_at: item.updatedAt, subjective: item.subjective, objective: item.objective, assessment: item.assessment, plan: item.plan,
});
const toVital = (item: InpatientVitalFields & { _id: Types.ObjectId }): InpatientVital => ({
  id: item._id.toString(), admission_id: item.admissionId.toString(), patient_id: item.patientId.toString(), branch_id: item.branchId.toString(),
  encounter_id: item.encounterId?.toString() ?? null, recorded_by: item.createdByName, created_by: item.createdBy.toString(), recorded_at: item.createdAt,
  updated_at: item.updatedAt, bp_systolic: item.bpSystolic, bp_diastolic: item.bpDiastolic, heart_rate: item.heartRate,
  temperature: item.temperature, spo2: item.spo2, respiratory_rate: item.respiratoryRate, pain_score: item.painScore,
});
export class InpatientAdmissionRepository {
constructor(private readonly sequenceService: SequenceService) {}

async departmentScope(userId: string) {
  const user = await UserModel.findOne({
    _id: oid(userId),
    status: 'active',
    deletedAt: null,
  })
    .select('departmentIds roleIds')
    .lean();

  if (!user) return [];

  const superAdmin = await RoleModel.exists({
    _id: { $in: user.roleIds ?? [] },
    code: 'SUPER_ADMIN',
    status: 'active',
    deletedAt: null,
  });

  return superAdmin
    ? undefined
    : (user.departmentIds ?? []).map((id) => id.toString());
}

async hasActiveAdmission(
  patientId: string,
  session?: ClientSession,
) {
  const query = InpatientAdmissionModel.exists({
    patientId: oid(patientId),
    status: 'ADMITTED',
  });

  if (session) {
    query.session(session);
  }

  return Boolean(await query);
}

async hasActiveAdmissionRequest(
  patientId: string,
  branchId: string,
  session?: ClientSession,
) {
  const query = AdmissionRequestModel.exists({
    patientId: oid(patientId),
    branchId: oid(branchId),
    status: { $in: ['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION'] },
  });

  if (session) {
    query.session(session);
  }

  return Boolean(await query);
}

async hasBranchAccess(userId: string, branchId: string) {
  const [user, branch] = await Promise.all([
    UserModel.findOne({
      _id: userId,
      status: 'active',
      deletedAt: null,
    })
      .select('branchIds roleIds')
      .lean(),

    BranchModel.exists({
      _id: branchId,
      status: 'ACTIVE',
      deletedAt: null,
    }),
  ]);

  if (!user || !branch) return false;

  if (
    (user.branchIds ?? []).some(
      (id) => id.toString() === branchId,
    )
  ) {
    return true;
  }

  return Boolean(
    await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    }),
  );
}

async references(
  data: CreateInpatientAdmissionDTO,
  session?: ClientSession,
) {
  const qPatient = PatientModel.findOne({
    _id: oid(data.patient_id),
    status: 'ACTIVE',
    deletedAt: null,
  });

  const qDoctor = DoctorModel.findOne({
    _id: oid(data.admitting_doctor_id),
    branchId: oid(data.branch_id),
    status: 'ACTIVE',
    deletedAt: null,
  });

  const qDepartment = DepartmentModel.findOne({
    _id: oid(data.department_id),
    $or: departmentBranchClauses(data.branch_id),
    status: 'ACTIVE',
    deletedAt: null,
  });

  const qWard = WardModel.findOne({
    _id: oid(data.ward_id),
    branchId: oid(data.branch_id),
    status: 'ACTIVE',
  });

  if (session) {
    qPatient.session(session);
    qDoctor.session(session);
    qDepartment.session(session);
    qWard.session(session);
  }

  const [patient, doctor, department, ward] = await Promise.all([
    qPatient.lean(),
    qDoctor.lean(),
    qDepartment.lean(),
    qWard.lean(),
  ]);

  return {
    patient,
    doctor,
    department,
    ward,
  };
}

async create(
  data: CreateInpatientAdmissionDTO,
  refs: {
    patientNumber: string;
    patientName: string;
    doctorName: string;
    departmentName: string;
  },
  userId: string,
  session?: ClientSession,
  source: {
    requestId?: string | null;
    sourceType?: AdmissionSourceType;
    sourceId?: string | null;
  } = {},
) {
  const sequence = await this.sequenceService.getNextSequence(
    'admission',
    session,
  );

  const opts = session ? { session } : undefined;

  const created = await InpatientAdmissionModel.create(
    [
      {
        admissionNumber:
          this.sequenceService.formatTimestampSequence(
            'ADM',
            sequence,
          ),

        patientId: oid(data.patient_id),
        patientNumber: refs.patientNumber,
        patientName: refs.patientName,

        branchId: oid(data.branch_id),
        wardId: oid(data.ward_id),
        bedId: oid(data.bed_id),

        admittingDoctorId: oid(data.admitting_doctor_id),
        admittingDoctorName: refs.doctorName,

        departmentId: oid(data.department_id),
        departmentName: refs.departmentName,

        admissionDate: new Date(data.admission_date),
        admissionType: data.admission_type,

        reason: data.reason,
        notes: data.notes ?? null,

        status: 'ADMITTED',

        requestId: source.requestId
          ? oid(source.requestId)
          : null,

        sourceType: source.sourceType ?? 'DIRECT',

        sourceId: source.sourceId
          ? oid(source.sourceId)
          : null,

        createdBy: oid(userId),
        updatedBy: oid(userId),
      },
    ],
    opts,
  );

  const first = created[0];

  if (!first) {
    throw new Error(
      'Admission create returned no record',
    );
  }

  return toDto(
    first.toObject() as InpatientAdmissionFields & {
      _id: Types.ObjectId;
    },
  );
}

async requestReferences(
  data: CreateAdmissionRequestDTO,
  session?: ClientSession,
) {
  const qPatient = PatientModel.findOne({
    _id: oid(data.patient_id),
    status: 'ACTIVE',
    deletedAt: null,
  });

  const qDoctor = DoctorModel.findOne({
    _id: oid(data.recommending_doctor_id),
    branchId: oid(data.branch_id),
    status: 'ACTIVE',
    deletedAt: null,
  });

  const qDepartment = DepartmentModel.findOne({
    _id: oid(data.department_id),
    $or: departmentBranchClauses(data.branch_id),
    status: 'ACTIVE',
    deletedAt: null,
  });

  if (session) {
    qPatient.session(session);
    qDoctor.session(session);
    qDepartment.session(session);
  }

  const [patient, doctor, department] =
    await Promise.all([
      qPatient.lean(),
      qDoctor.lean(),
      qDepartment.lean(),
    ]);

  return {
    patient,
    doctor,
    department,
  };
}

async getReferralSource(id: string, session?: ClientSession) {
  const referralQuery = OpdReferralModel.findOne({
    _id: oid(id),
    status: 'SUBMITTED',
    deletedAt: null,
  });

  if (session) {
    referralQuery.session(session);
  }

  const referral = await referralQuery.lean<OpdReferralFields & { _id: Types.ObjectId }>();

  if (!referral) {
    return null;
  }

  const visitQuery = OpdVisitModel.findOne({
    _id: referral.visitId,
    deletedAt: null,
  }).select('patientId branchId departmentId doctorId visitNumber inpatientAdmissionId');

  if (session) {
    visitQuery.session(session);
  }

  const visit = await visitQuery.lean<OpdVisitFields & { _id: Types.ObjectId }>();

  return visit ? { referral, visit } : null;
}

async createRequest(
  data: CreateAdmissionRequestDTO,
  refs: {
    patientNumber: string;
    patientName: string;
    doctorName: string;
    departmentName: string;
    sourceReference?: string | null;
  },
  userId: string,
  session?: ClientSession,
) {
  const sequence =
    await this.sequenceService.getNextSequence(
      'admission_request',
      session,
    );

  const opts = session ? { session } : undefined;

  const created = await AdmissionRequestModel.create(
    [
      {
        requestNumber:
          this.sequenceService.formatTimestampSequence(
            'AR',
            sequence,
          ),

        patientId: oid(data.patient_id),
        patientNumber: refs.patientNumber,
        patientName: refs.patientName,

        branchId: oid(data.branch_id),

        departmentId: oid(data.department_id),
        departmentName: refs.departmentName,

        recommendingDoctorId: oid(
          data.recommending_doctor_id,
        ),
        recommendingDoctorName: refs.doctorName,

        sourceType: data.source_type,

        sourceId: data.source_id
          ? oid(data.source_id)
          : null,

        sourceReference:
          refs.sourceReference ?? null,

        activeSourceKey: data.source_id
          ? `${data.source_type}:${data.source_id}`
          : null,

        admissionType: data.admission_type,
        priority: data.priority,

        reason: data.reason,
        notes: data.notes ?? null,

        status: 'PENDING_VALIDATION',

        createdBy: oid(userId),
        updatedBy: oid(userId),
      },
    ],
    opts,
  );

  const first = created[0];

  if (!first) {
    throw new Error(
      'Admission request create returned no record',
    );
  }

  return toRequest(
    first.toObject() as AdmissionRequestFields & {
      _id: Types.ObjectId;
    },
  );
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
  async validateRequest(id: string, branchId: string, data: ValidateAdmissionRequestDTO, actor: string, session?: ClientSession) {
    const opts = session ? { new: true, session, runValidators: true } : { new: true, runValidators: true };
    const item = await AdmissionRequestModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId), status: { $in: ['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION'] } }, { $set: { wardId: oid(data.ward_id), bedId: oid(data.bed_id), holdId: safeOid(data.hold_id), consentDocumentId: safeOid(data.consent_document_id), depositInvoiceId: safeOid(data.deposit_invoice_id), status: 'READY_FOR_CONFIRMATION', updatedBy: oid(actor) } }, opts).lean<AdmissionRequestFields & { _id: Types.ObjectId }>();
    return item ? toRequest(item) : null;
  }
  async confirmRequest(id: string, admissionId: string, snapshot: AdmissionPrerequisiteSnapshot, actor: string, session?: ClientSession) {
    const opts = session ? { new: true, session } : { new: true };
    const item = await AdmissionRequestModel.findOneAndUpdate({ _id: oid(id), status: 'READY_FOR_CONFIRMATION', admissionId: null }, { $set: { status: 'CONFIRMED', admissionId: oid(admissionId), prerequisiteSnapshot: snapshot, updatedBy: oid(actor) } }, opts).lean<AdmissionRequestFields & { _id: Types.ObjectId }>();
    return item ? toRequest(item) : null;
  }
  async cancelRequest(id: string, branchId: string, reason: string, actor: string, session?: ClientSession) {
    const opts = session ? { new: true, session } : { new: true };
    const item = await AdmissionRequestModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId), status: { $in: ['PENDING_VALIDATION', 'READY_FOR_CONFIRMATION'] } }, { $set: { status: 'CANCELLED', activeSourceKey: null, cancellationReason: reason, cancelledAt: new Date(), cancelledBy: oid(actor), updatedBy: oid(actor) } }, opts).lean<AdmissionRequestFields & { _id: Types.ObjectId }>();
    return item ? toRequest(item) : null;
  }

  async getRecord(id: string, branchId: string, session?: ClientSession) {
    const q = InpatientAdmissionModel.findOne({ _id: oid(id), branchId: oid(branchId) });
    if (session) q.session(session);
    return q.lean<InpatientAdmissionFields & { _id: Types.ObjectId }>();
  }
  async list(query: InpatientAdmissionListQuery, departmentIds?: string[]) { const page = query.page ?? 1; const limit = query.limit ?? 20; const filter: Record<string, unknown> = { branchId: oid(query.branch_id) }; if (departmentIds) filter.departmentId = { $in: departmentIds.map(oid) }; if (query.status) filter.status = query.status; const [items, total] = await Promise.all([InpatientAdmissionModel.aggregate<InpatientAdmissionFields & { _id: Types.ObjectId; wardName?: string; bedNumber?: string }>([{ $match: filter }, { $lookup: { from: 'hmswards', localField: 'wardId', foreignField: '_id', as: 'ward' } }, { $lookup: { from: 'hmsbeds', localField: 'bedId', foreignField: '_id', as: 'bed' } }, { $set: { wardName: { $ifNull: [{ $arrayElemAt: ['$ward.name', 0] }, ''] }, bedNumber: { $ifNull: [{ $arrayElemAt: ['$bed.bedNumber', 0] }, ''] } } }, { $sort: { admissionDate: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }]), InpatientAdmissionModel.countDocuments(filter)]); return { data: items.map(toDto), meta: meta(total, page, limit) }; }
  async getById(id: string, branchId: string) { const item = await InpatientAdmissionModel.findOne({ _id: oid(id), branchId: oid(branchId) }).lean(); return item ? toDto(item as InpatientAdmissionFields & { _id: Types.ObjectId }) : null; }
  async actorName(actor: string) {
    const user = await UserModel.findOne({ _id: oid(actor), status: 'active', deletedAt: null }).select('fullName').lean();
    return user?.fullName ?? 'Authorized staff';
  }
  async listRoundNotes(admissionId: string, branchId: string) {
    const items = await InpatientRoundNoteModel.find({ admissionId: oid(admissionId), branchId: oid(branchId) }).sort({ createdAt: -1, _id: -1 }).lean<(InpatientRoundNoteFields & { _id: Types.ObjectId })[]>();
    return items.map(toRoundNote);
  }
  async createRoundNote(admission: InpatientAdmission, data: CreateInpatientRoundNoteDTO, actor: string, actorName: string, session?: ClientSession) {
    const created = await InpatientRoundNoteModel.create([{ admissionId: oid(admission.id), patientId: oid(admission.patient_id), branchId: oid(admission.branch_id), encounterId: safeOid(admission.source_id), createdBy: oid(actor), createdByName: actorName, ...data }], session ? { session } : undefined);
    const item = created[0]; if (!item) throw new Error('Round note create returned no record');
    return toRoundNote(item.toObject() as InpatientRoundNoteFields & { _id: Types.ObjectId });
  }
  async listVitals(admissionId: string, branchId: string) {
    const items = await InpatientVitalModel.find({ admissionId: oid(admissionId), branchId: oid(branchId) }).sort({ createdAt: -1, _id: -1 }).lean<(InpatientVitalFields & { _id: Types.ObjectId })[]>();
    return items.map(toVital);
  }
  async createVital(admission: InpatientAdmission, data: CreateInpatientVitalDTO, actor: string, actorName: string, session?: ClientSession) {
    const created = await InpatientVitalModel.create([{ admissionId: oid(admission.id), patientId: oid(admission.patient_id), branchId: oid(admission.branch_id), encounterId: safeOid(admission.source_id), createdBy: oid(actor), createdByName: actorName, bpSystolic: data.bp_systolic, bpDiastolic: data.bp_diastolic, heartRate: data.heart_rate, temperature: data.temperature, spo2: data.spo2, respiratoryRate: data.respiratory_rate, painScore: data.pain_score }], session ? { session } : undefined);
    const item = created[0]; if (!item) throw new Error('Vital create returned no record');
    return toVital(item.toObject() as InpatientVitalFields & { _id: Types.ObjectId });
  }
  async saveDischargeSummary(id: string, branchId: string, summary: { hemodynamicStability24h: boolean; postOpRecoveryCleared: boolean; homeOralMedConverted: boolean; summaryFinalized: boolean; notes?: string | null }, actor: string, actorName: string, session?: ClientSession) {
    const opts = session ? { new: true, session } : { new: true };
    const item = await InpatientAdmissionModel.findOneAndUpdate(
      { _id: oid(id), branchId: oid(branchId) },
      {
        $set: {
          dischargeSummary: {
            hemodynamicStability24h: summary.hemodynamicStability24h,
            postOpRecoveryCleared: summary.postOpRecoveryCleared,
            homeOralMedConverted: summary.homeOralMedConverted,
            summaryFinalized: summary.summaryFinalized,
            notes: summary.notes ?? null,
            savedBy: oid(actor),
            savedByName: actorName,
            savedAt: new Date(),
          },
          updatedBy: oid(actor),
        },
      },
      opts,
    ).lean<InpatientAdmissionFields & { _id: Types.ObjectId }>();
    return item ? toDto(item) : null;
  }

  async markDischarged(id: string, branchId: string, actor: string, actorName: string, session?: ClientSession) {
    const opts = session ? { new: true, session } : { new: true };
    const item = await InpatientAdmissionModel.findOneAndUpdate(
      { _id: oid(id), branchId: oid(branchId), status: 'ADMITTED' },
      {
        $set: {
          status: 'DISCHARGED',
          dischargedAt: new Date(),
          dischargedBy: oid(actor),
          dischargedByName: actorName,
          updatedBy: oid(actor),
        },
      },
      opts,
    ).lean<InpatientAdmissionFields & { _id: Types.ObjectId }>();
    return item ? toDto(item) : null;
  }

  async audit(eventType: string, actor: string, metadata: AdmissionRequestMetadata, details: Record<string, unknown>, session?: ClientSession) {
    const opts = session ? { session } : undefined;
    await AuditLogModel.create([{ eventType, actorUserId: actor, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadataJson: details }], opts);
  }
  async session() { return mongoose.startSession(); }
}
