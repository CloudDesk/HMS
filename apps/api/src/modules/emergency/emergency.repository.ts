import mongoose, { Types, type ClientSession } from 'mongoose';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { EmergencyEncounterModel, type EmergencyEncounterFields } from './emergency.model.js';
import type {
  CreateEmergencyDTO,
  EmergencyListQuery,
  EmergencyMetadata,
  EmergencyStatus,
  EmergencyTriageLevel,
} from './emergency.types.js';

export type EmergencyLean = EmergencyEncounterFields & { _id: Types.ObjectId };
const oid = (value: string) => new Types.ObjectId(value);
const clean = (value: string | null | undefined) => value?.trim() || null;
export const emergencyDto = (row: EmergencyLean) => ({
  id: row._id.toString(),
  encounter_number: row.encounterNumber,
  emergency_identifier: row.emergencyIdentifier,
  branch_id: row.branchId.toString(),
  department_id: row.departmentId.toString(),
  patient_id: row.patientId?.toString() ?? null,
  patient_number: row.patientNumber ?? null,
  patient_name: row.patientName,
  provisional_identity: row.provisionalIdentity
    ? {
        display_name: row.provisionalIdentity.displayName,
        estimated_age: row.provisionalIdentity.estimatedAge ?? null,
        gender: row.provisionalIdentity.gender ?? null,
        contact: row.provisionalIdentity.contact ?? null,
        identity_notes: row.provisionalIdentity.identityNotes ?? null,
      }
    : null,
  arrival_mode: row.arrivalMode,
  arrival_at: row.arrivalAt,
  chief_complaint: row.chiefComplaint,
  arrival_notes: row.arrivalNotes ?? null,
  status: row.status,
  version: row.version,
  triage: row.triage
    ? {
        level: row.triage.level,
        effective_level: row.triage.effectiveLevel,
        area: row.triage.area,
        nurse_user_id: row.triage.nurseUserId.toString(),
        assessed_at: row.triage.assessedAt,
        pain_score: row.triage.painScore ?? null,
        vitals: row.triage.vitals,
        abcde: row.triage.abcde,
        notes: row.triage.notes ?? null,
      }
    : null,
  priority_history: row.priorityHistory.map((item) => ({
    previous_level: item.previousLevel,
    new_level: item.newLevel,
    reason: item.reason,
    changed_by: item.changedBy.toString(),
    changed_at: item.changedAt,
  })),
  queue_history: row.queueHistory.map((item) => ({
    action: item.action,
    from_status: item.fromStatus,
    to_status: item.toStatus,
    reason: item.reason ?? null,
    actor_id: item.actorId.toString(),
    occurred_at: item.occurredAt,
  })),
  assigned_doctor_id: row.assignedDoctorId?.toString() ?? null,
  assigned_doctor_name: row.assignedDoctorName ?? null,
  consultation: row.consultation ?? null,
  orders: row.orders.map((item) => ({
    order_type: item.orderType,
    downstream_id: item.downstreamId.toString(),
    source_type: item.sourceType,
    source_id: item.sourceId.toString(),
    status: item.status,
    created_at: item.createdAt,
    created_by: item.createdBy.toString(),
  })),
  disposition: row.disposition ?? null,
  inpatient_admission_id: row.inpatientAdmissionId?.toString() ?? null,
  converted_to_ip_at: row.convertedToIpAt ?? null,
  converted_to_ip_by: row.convertedToIpBy?.toString() ?? null,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
});

const emergencyQueueDto = (row: EmergencyLean) => ({
  id: row._id.toString(),
  encounter_number: row.encounterNumber,
  emergency_identifier: row.emergencyIdentifier,
  branch_id: row.branchId.toString(),
  department_id: row.departmentId.toString(),
  patient_id: row.patientId?.toString() ?? null,
  patient_number: row.patientNumber ?? null,
  patient_name: row.patientName,
  arrival_mode: row.arrivalMode,
  arrival_at: row.arrivalAt,
  chief_complaint: row.chiefComplaint,
  status: row.status,
  version: row.version,
  triage: row.triage
    ? {
        level: row.triage.level,
        effective_level: row.triage.effectiveLevel,
        area: row.triage.area,
        assessed_at: row.triage.assessedAt,
      }
    : null,
  assigned_doctor_id: row.assignedDoctorId?.toString() ?? null,
  assigned_doctor_name: row.assignedDoctorName ?? null,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
});

export class EmergencyRepository {
  constructor(private readonly sequenceService: SequenceService) {}
  async session() {
    return mongoose.startSession();
  }
  async hasBranchAccess(userId: string, branchId: string) {
    const user = await UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null })
      .select('branchIds roleIds')
      .lean();
    if (!user) return false;
    const superAdmin = await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    });
    return Boolean(superAdmin || (user.branchIds ?? []).some((id) => id.toString() === branchId));
  }
  async departmentScope(userId: string) {
    const user = await UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null })
      .select('departmentIds roleIds')
      .lean();
    if (!user) return [];
    const superAdmin = await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    });
    return superAdmin ? undefined : (user.departmentIds ?? []).map((id) => id.toString());
  }
  async references(data: CreateEmergencyDTO, session: ClientSession) {
    const branch = await BranchModel.findOne({
      _id: oid(data.branch_id),
      status: 'ACTIVE',
      deletedAt: null,
    })
      .session(session)
      .lean();
    const department = await DepartmentModel.findOne({
      _id: oid(data.department_id),
      branchIds: oid(data.branch_id),
      status: 'ACTIVE',
      isClinical: true,
      deletedAt: null,
    })
      .session(session)
      .lean();
    const patient = data.patient_id
      ? await PatientModel.findOne({
          _id: oid(data.patient_id),
          status: 'ACTIVE',
          deletedAt: null,
        })
          .session(session)
          .lean()
      : null;
    return { branch, department, patient };
  }
  async patient(id: string, session: ClientSession) {
    return PatientModel.findOne({ _id: oid(id), status: 'ACTIVE', deletedAt: null })
      .session(session)
      .lean();
  }
  async doctor(id: string, branchId: string, departmentId: string, session: ClientSession) {
    return DoctorModel.findOne({
      _id: oid(id),
      branchId: oid(branchId),
      departmentId: oid(departmentId),
      status: 'ACTIVE',
      deletedAt: null,
    })
      .session(session)
      .lean();
  }
  async create(
    data: CreateEmergencyDTO,
    identity: {
      patientId: Types.ObjectId | null;
      patientNumber: string | null;
      patientName: string;
    },
    actor: string,
    session: ClientSession,
  ) {
    const sequence = await this.sequenceService.getNextSequence('emergency_encounter', session);
    const ts = this.sequenceService.formatTimestampSequence(null, sequence);
    const rows = await EmergencyEncounterModel.create(
      [
        {
          encounterNumber: `ER-${ts}`,
          emergencyIdentifier: `EID-${ts}`,
          branchId: oid(data.branch_id),
          departmentId: oid(data.department_id),
          patientId: identity.patientId,
          patientNumber: identity.patientNumber,
          patientName: identity.patientName,
          provisionalIdentity: data.patient_id
            ? null
            : {
                displayName: data.provisional_identity!.display_name,
                estimatedAge: data.provisional_identity?.estimated_age ?? null,
                gender: data.provisional_identity?.gender ?? null,
                contact: clean(data.provisional_identity?.contact),
                identityNotes: clean(data.provisional_identity?.identity_notes),
              },
          arrivalMode: data.arrival_mode,
          arrivalAt: data.arrival_at ? new Date(data.arrival_at) : new Date(),
          chiefComplaint: data.chief_complaint,
          arrivalNotes: clean(data.arrival_notes),
          status: 'WAITING_FOR_TRIAGE',
          version: 0,
          queueHistory: [
            {
              action: 'REGISTERED',
              fromStatus: 'REGISTERED',
              toStatus: 'WAITING_FOR_TRIAGE',
              actorId: oid(actor),
              occurredAt: new Date(),
            },
          ],
          createdBy: oid(actor),
          updatedBy: oid(actor),
        },
      ],
      { session },
    );
    const row = rows[0];
    if (!row) throw new Error('Emergency encounter create returned no record');
    return emergencyDto(row.toObject() as EmergencyLean);
  }
  async getRecord(id: string, branchId: string, session?: ClientSession) {
    const query = EmergencyEncounterModel.findOne({
      _id: oid(id),
      branchId: oid(branchId),
    }).lean<EmergencyLean>();
    if (session) query.session(session);
    return query;
  }
  async get(id: string, branchId: string) {
    const row = await this.getRecord(id, branchId);
    return row ? emergencyDto(row) : null;
  }
  async list(query: EmergencyListQuery, departments?: string[]) {
    const page = query.page ?? 1,
      limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      branchId: oid(query.branch_id),
      ...(departments ? { departmentId: { $in: departments.map(oid) } } : {}),
    };
    if (query.department_id) filter.departmentId = oid(query.department_id);
    if (query.status) filter.status = query.status;
    if (query.triage_level) filter['triage.effectiveLevel'] = query.triage_level;
    if (query.search) {
      const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { encounterNumber: expression },
        { emergencyIdentifier: expression },
        { patientNumber: expression },
        { patientName: expression },
      ];
    }
    const [rows, total] = await Promise.all([
      EmergencyEncounterModel.find(filter)
        .sort({ 'triage.effectiveLevel': 1, arrivalAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<EmergencyLean[]>(),
      EmergencyEncounterModel.countDocuments(filter),
    ]);
    return {
      data: rows.map(emergencyQueueDto),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
  async summary(branchId: string, departments?: string[]) {
    const match: Record<string, unknown> = {
      branchId: oid(branchId),
      ...(departments ? { departmentId: { $in: departments.map(oid) } } : {}),
    };
    const rows = await EmergencyEncounterModel.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }
  async transition(
    id: string,
    branchId: string,
    from: EmergencyStatus | EmergencyStatus[],
    to: EmergencyStatus,
    action: string,
    actor: string,
    set: Record<string, unknown>,
    reason: string | null,
    session: ClientSession,
  ) {
    const row = await EmergencyEncounterModel.findOneAndUpdate(
      {
        _id: oid(id),
        branchId: oid(branchId),
        status: { $in: Array.isArray(from) ? from : [from] },
      },
      {
        $set: { ...set, status: to, updatedBy: oid(actor) },
        $inc: { version: 1 },
        $push: {
          queueHistory: {
            action,
            fromStatus: Array.isArray(from) ? from[0] : from,
            toStatus: to,
            reason,
            actorId: oid(actor),
            occurredAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true, session },
    ).lean<EmergencyLean>();
    return row ? emergencyDto(row) : null;
  }
  async linkPatient(
    id: string,
    branchId: string,
    patient: {
      _id: Types.ObjectId;
      patientNumber: string;
      firstName?: string | null;
      middleName?: string | null;
      lastName: string;
    },
    actor: string,
    correction: boolean,
    session: ClientSession,
  ) {
    const filter: Record<string, unknown> = { _id: oid(id), branchId: oid(branchId) };
    if (!correction) filter.patientId = null;
    const row = await EmergencyEncounterModel.findOneAndUpdate(
      filter,
      {
        $set: {
          patientId: patient._id,
          patientNumber: patient.patientNumber,
          patientName: [patient.firstName, patient.middleName, patient.lastName]
            .filter(Boolean)
            .join(' '),
          linkedAt: new Date(),
          linkedBy: oid(actor),
          updatedBy: oid(actor),
        },
        $inc: { version: 1 },
      },
      { new: true, session },
    ).lean<EmergencyLean>();
    return row ? emergencyDto(row) : null;
  }
  async overridePriority(
    id: string,
    branchId: string,
    previous: EmergencyTriageLevel,
    level: EmergencyTriageLevel,
    reason: string,
    actor: string,
    session: ClientSession,
  ) {
    const row = await EmergencyEncounterModel.findOneAndUpdate(
      {
        _id: oid(id),
        branchId: oid(branchId),
        'triage.effectiveLevel': previous,
        status: {
          $nin: ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'],
        },
      },
      {
        $set: { 'triage.effectiveLevel': level, updatedBy: oid(actor) },
        $inc: { version: 1 },
        $push: {
          priorityHistory: {
            previousLevel: previous,
            newLevel: level,
            reason,
            changedBy: oid(actor),
            changedAt: new Date(),
          },
        },
      },
      { new: true, session },
    ).lean<EmergencyLean>();
    return row ? emergencyDto(row) : null;
  }
  async addOrder(
    id: string,
    branchId: string,
    orderType: string,
    downstreamId: string,
    actor: string,
    session: ClientSession,
  ) {
    const row = await EmergencyEncounterModel.findOneAndUpdate(
      {
        _id: oid(id),
        branchId: oid(branchId),
        status: { $in: ['IN_CONSULTATION', 'IN_TREATMENT', 'READY_FOR_DISPOSITION'] },
      },
      {
        $push: {
          orders: {
            orderType,
            downstreamId: oid(downstreamId),
            sourceType: 'EMERGENCY_ENCOUNTER',
            sourceId: oid(id),
            status: 'SUBMITTED',
            createdAt: new Date(),
            createdBy: oid(actor),
          },
        },
        $set: { status: 'IN_TREATMENT', updatedBy: oid(actor) },
        $inc: { version: 1 },
      },
      { new: true, session },
    ).lean<EmergencyLean>();
    return row ? emergencyDto(row) : null;
  }
  async markAdmissionConverted(
    id: string,
    branchId: string,
    admissionId: string,
    actor: string,
    session: ClientSession,
  ) {
    const row = await EmergencyEncounterModel.findOneAndUpdate(
      {
        _id: oid(id),
        branchId: oid(branchId),
        status: 'READY_FOR_DISPOSITION',
        'disposition.decision': 'ADMIT',
        inpatientAdmissionId: null,
      },
      {
        $set: {
          status: 'CONVERTED_TO_IP',
          inpatientAdmissionId: oid(admissionId),
          convertedToIpAt: new Date(),
          convertedToIpBy: oid(actor),
          updatedBy: oid(actor),
        },
        $inc: { version: 1 },
        $push: {
          queueHistory: {
            action: 'CONVERTED_TO_IP',
            fromStatus: 'READY_FOR_DISPOSITION',
            toStatus: 'CONVERTED_TO_IP',
            reason: null,
            actorId: oid(actor),
            occurredAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true, session },
    ).lean<EmergencyLean>();
    return row ? emergencyDto(row) : null;
  }
  async hasFinancialRecords(id: string) {
    const row = await EmergencyEncounterModel.findById(oid(id))
      .select('orders')
      .lean<EmergencyLean>();
    return Boolean(row?.orders.length);
  }
  async audit(
    eventType: string,
    actor: string,
    metadata: EmergencyMetadata,
    details: Record<string, unknown>,
    session: ClientSession,
  ) {
    await AuditLogModel.create(
      [
        {
          eventType,
          actorUserId: actor,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadataJson: details,
        },
      ],
      { session },
    );
  }
}
