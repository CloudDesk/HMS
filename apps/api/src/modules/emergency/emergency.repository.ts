import mongoose, { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { SequenceService } from '../../shared/sequence/sequence.service.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { AdmissionRequestModel } from '../inpatient-admissions/inpatient-admission.model.js';
import type { Appointment } from '../appointments/appointment.types.js';
import { EmergencyEncounterModel, type EmergencyEncounterFields } from './emergency.model.js';
import type {
  CreateEmergencyDTO,
  EmergencyListQuery,
  EmergencyMetadata,
  EmergencyReferralDTO,
  EmergencyReferralListQuery,
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
  referral: row.referral
    ? {
        source_type: row.referral.sourceType,
        target_department_id: row.referral.targetDepartmentId.toString(),
        target_department_name: row.referral.targetDepartmentName,
        target_doctor_id: row.referral.targetDoctorId?.toString() ?? null,
        target_doctor_name: row.referral.targetDoctorName ?? null,
        priority: row.referral.priority,
        reason: row.referral.reason,
        clinical_notes: row.referral.clinicalNotes,
        status: row.referral.status,
        submitted_at: row.referral.submittedAt,
        appointment_id: row.referral.appointmentId?.toString() ?? null,
        appointment_number: row.referral.appointmentNumber ?? null,
      }
    : null,
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

export const emergencyReferralDto = (row: EmergencyLean) => {
  const referral = row.referral;
  if (!referral) throw new AppError('Emergency referral data is missing', 500, 'EMERGENCY_REFERRAL_INVALID');
  return {
    id: row._id.toString(),
    source_type: referral.sourceType,
    source_id: row._id.toString(),
    encounter_number: row.encounterNumber,
    emergency_identifier: row.emergencyIdentifier,
    branch_id: row.branchId.toString(),
    patient_id: row.patientId?.toString() ?? null,
    patient_number: row.patientNumber ?? row.emergencyIdentifier,
    patient_name: row.patientName,
    referring_doctor_id: row.assignedDoctorId?.toString() ?? null,
    referring_doctor_name: row.assignedDoctorName ?? 'Emergency team',
    target_department_id: referral.targetDepartmentId.toString(),
    target_department_name: referral.targetDepartmentName,
    referred_doctor_id: referral.targetDoctorId?.toString() ?? null,
    referred_doctor_name: referral.targetDoctorName ?? null,
    priority: referral.priority,
    reason: referral.reason,
    clinical_summary: referral.clinicalNotes,
    status: referral.status,
    submitted_at: referral.submittedAt,
    appointment_id: referral.appointmentId?.toString() ?? null,
    appointment_number: referral.appointmentNumber ?? null,
    appointment_date: referral.appointmentDate ?? null,
    appointment_start_time: referral.appointmentStartTime ?? null,
    appointment_duration_minutes: referral.appointmentDurationMinutes ?? null,
  };
};

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
  async branchScope(userId: string) {
    const user = await UserModel.findOne({ _id: oid(userId), status: 'active', deletedAt: null })
      .select('branchIds roleIds')
      .lean();
    if (!user) return [];
    const superAdmin = await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    });
    return superAdmin ? undefined : (user.branchIds ?? []).map((id) => id.toString());
  }
  async references(data: CreateEmergencyDTO, session: ClientSession) {
    const branch = await BranchModel.findOne({
      _id: oid(data.branch_id),
      status: 'ACTIVE',
      deletedAt: null,
    })
      .session(session)
      .lean();
    let department = await DepartmentModel.findOne({
      _id: oid(data.department_id),
      branchIds: oid(data.branch_id),
      status: 'ACTIVE',
      deletedAt: null,
    })
      .session(session)
      .lean();
    if (!department) {
      department = await DepartmentModel.findOne({
        _id: oid(data.department_id),
        status: 'ACTIVE',
        deletedAt: null,
      })
        .session(session)
        .lean();
    }
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
  async doctorByUserId(userId: string) {
    return DoctorModel.findOne({ userId: oid(userId), deletedAt: null }).lean();
  }
  async doctor(id: string, branchId?: string, departmentId?: string, session?: ClientSession) {
    const query = DoctorModel.findOne({
      _id: oid(id),
      ...(branchId ? { branchId: oid(branchId) } : {}),
      ...(departmentId ? { departmentId: oid(departmentId) } : {}),
      status: 'ACTIVE',
      deletedAt: null,
    });
    if (session) query.session(session);
    return query.lean();
  }
  async department(id: string, branchId: string, session?: ClientSession) {
    const query = DepartmentModel.findOne({
      _id: oid(id),
      branchIds: oid(branchId),
      status: 'ACTIVE',
      deletedAt: null,
    });
    if (session) query.session(session);
    return query.lean();
  }
  async createProvisionalPatient(
    identity: {
      displayName: string;
      estimatedAge?: number | null;
      gender?: string | null;
      contact?: string | null;
      identityNotes?: string | null;
    },
    branchId: string,
    actor: string,
    session: ClientSession,
  ) {
    const sequence = await this.sequenceService.getNextSequence('patient', session);
    const year = new Date().getFullYear();
    const patientNumber = `HMS-${year}-${String(sequence).padStart(6, '0')}`;
    const names = identity.displayName.trim().split(/\s+/);
    const firstName = names[0] || 'Unknown';
    const lastName = names.slice(1).join(' ') || 'Patient';

    let dateOfBirth = new Date(1990, 0, 1);
    if (identity.estimatedAge && identity.estimatedAge > 0) {
      const birthYear = year - identity.estimatedAge;
      dateOfBirth = new Date(birthYear, 0, 1);
    }

    const gender = (identity.gender && ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'].includes(identity.gender)
      ? identity.gender
      : 'UNKNOWN') as import('../patients/patient.types.js').PatientGender;

    const patient = new PatientModel({
      patientNumber,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone: identity.contact || null,
      registrationBranchId: oid(branchId),
      status: 'ACTIVE',
      notes: identity.identityNotes ? `Provisional Emergency Patient: ${identity.identityNotes}` : 'Provisional Emergency Patient',
      createdBy: oid(actor),
      updatedBy: oid(actor),
    });
    await patient.save({ session });
    return patient;
  }
  async updatePatientIdentity(
    id: string,
    branchId: string,
    patientId: Types.ObjectId,
    patientNumber: string,
    patientName: string,
    session: ClientSession,
  ) {
    return EmergencyEncounterModel.updateOne(
      { _id: oid(id), branchId: oid(branchId) },
      {
        $set: {
          patientId,
          patientNumber,
          patientName,
          updatedAt: new Date(),
        },
      },
      { session },
    );
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
  async getReferral(id: string, branchId: string) {
    const row = await EmergencyEncounterModel.findOne({
      _id: oid(id),
      branchId: oid(branchId),
      'referral.status': 'SUBMITTED',
    }).lean<EmergencyLean>();
    return row ? emergencyReferralDto(row) : null;
  }
  async listSubmittedReferrals(query: EmergencyReferralListQuery, branchIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      'referral.status': 'SUBMITTED',
      ...(branchIds ? { branchId: { $in: branchIds.map(oid) } } : {}),
    };
    if (query.booked !== undefined) {
      filter['referral.appointmentId'] = query.booked ? { $ne: null } : null;
    }
    const [rows, total] = await Promise.all([
      EmergencyEncounterModel.find(filter)
        .sort({ 'referral.submittedAt': -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<EmergencyLean[]>(),
      EmergencyEncounterModel.countDocuments(filter),
    ]);
    return {
      data: rows.map(emergencyReferralDto),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
  async list(query: EmergencyListQuery, departments?: string[], doctorId?: string) {
    const page = query.page ?? 1,
      limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      branchId: oid(query.branch_id),
      ...(departments ? { departmentId: { $in: departments.map(oid) } } : {}),
    };
    if (query.department_id) filter.departmentId = oid(query.department_id);
    if (query.status) filter.status = query.status;
    if (query.triage_level) filter['triage.effectiveLevel'] = query.triage_level;

    const andConditions: Array<Record<string, unknown>> = [];

    if (doctorId) {
      andConditions.push({
        $or: [
          { assignedDoctorId: null },
          { assignedDoctorId: { $exists: false } },
          { assignedDoctorId: oid(doctorId) },
        ],
      });
    }

    if (query.search) {
      const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andConditions.push({
        $or: [
          { encounterNumber: expression },
          { emergencyIdentifier: expression },
          { patientNumber: expression },
          { patientName: expression },
        ],
      });
    }

    if (andConditions.length === 1) {
      Object.assign(filter, andConditions[0]);
    } else if (andConditions.length > 1) {
      filter.$and = andConditions;
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
  async summary(branchId: string, departments?: string[], doctorId?: string) {
    const match: Record<string, unknown> = {
      branchId: oid(branchId),
      ...(departments ? { departmentId: { $in: departments.map(oid) } } : {}),
    };
    if (doctorId) {
      match.$or = [
        { assignedDoctorId: null },
        { assignedDoctorId: { $exists: false } },
        { assignedDoctorId: oid(doctorId) },
      ];
    }
    const rows = await EmergencyEncounterModel.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }
  async saveReferral(
    id: string,
    branchId: string,
    data: EmergencyReferralDTO,
    targetDepartmentName: string,
    targetDoctorName: string | null,
    actor: string,
    session: ClientSession,
  ) {
    const row = await EmergencyEncounterModel.findOneAndUpdate(
      { _id: oid(id), branchId: oid(branchId), referral: null },
      {
        $set: {
          referral: {
            sourceType: 'EMERGENCY_ENCOUNTER',
            targetDepartmentId: oid(data.target_department_id),
            targetDepartmentName,
            targetDoctorId: data.target_doctor_id ? oid(data.target_doctor_id) : null,
            targetDoctorName,
            priority: data.priority,
            reason: data.reason.trim(),
            clinicalNotes: data.clinical_notes.trim(),
            status: 'SUBMITTED',
            submittedAt: new Date(),
            submittedBy: oid(actor),
            appointmentId: null,
            appointmentNumber: null,
            appointmentDate: null,
            appointmentStartTime: null,
            appointmentDurationMinutes: null,
          },
          updatedBy: oid(actor),
        },
      },
      { returnDocument: 'after', session },
    ).lean<EmergencyLean>();
    return row ? emergencyReferralDto(row) : null;
  }
  async linkReferralAppointment(id: string, branchId: string, appointment: Appointment, actor: string) {
    const row = await EmergencyEncounterModel.findOneAndUpdate(
      {
        _id: oid(id),
        branchId: oid(branchId),
        'referral.status': 'SUBMITTED',
        'referral.appointmentId': null,
      },
      {
        $set: {
          'referral.appointmentId': oid(appointment.id),
          'referral.appointmentNumber': appointment.appointment_number,
          'referral.appointmentDate': appointment.appointment_date,
          'referral.appointmentStartTime': appointment.start_time,
          'referral.appointmentDurationMinutes': appointment.duration_minutes,
          updatedBy: oid(actor),
        },
      },
      { returnDocument: 'after' },
    ).lean<EmergencyLean>();
    return row ? emergencyReferralDto(row) : null;
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
    previousStatus?: EmergencyStatus,
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
            fromStatus: previousStatus ?? (Array.isArray(from) ? from[0] : from),
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
        status: { $nin: ['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'] },
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
  async createOrGetAdmissionRequest(
    encounter: EmergencyLean,
    reason: string,
    notes: string | null | undefined,
    actor: string,
    session: ClientSession,
  ) {
    if (!encounter.patientId || !encounter.patientNumber) return null;

    const existing = await AdmissionRequestModel.findOne({
      sourceType: 'EMERGENCY_ENCOUNTER',
      sourceId: encounter._id,
      status: { $ne: 'CANCELLED' },
    }).session(session);

    if (existing) return existing;

    const sequence = await this.sequenceService.getNextSequence('admission_request', session);
    const requestNumber = this.sequenceService.formatTimestampSequence('AR', sequence);
    const department = await DepartmentModel.findById(encounter.departmentId).session(session).lean();

    const created = await AdmissionRequestModel.create(
      [
        {
          requestNumber,
          patientId: encounter.patientId,
          patientNumber: encounter.patientNumber,
          patientName: encounter.patientName,
          branchId: encounter.branchId,
          departmentId: encounter.departmentId,
          departmentName: department?.name || 'Emergency Department',
          recommendingDoctorId: encounter.assignedDoctorId || oid(actor),
          recommendingDoctorName: encounter.assignedDoctorName || 'Emergency Doctor',
          sourceType: 'EMERGENCY_ENCOUNTER',
          sourceId: encounter._id,
          sourceReference: encounter.encounterNumber,
          activeSourceKey: `EMERGENCY_ENCOUNTER:${encounter._id.toString()}`,
          admissionType: encounter.triage?.effectiveLevel === 'LEVEL_1_CRITICAL' ? 'ICU' : 'INPATIENT',
          priority: 'EMERGENCY',
          reason: reason || encounter.consultation?.diagnosis || encounter.chiefComplaint || 'Emergency Inpatient Admission',
          notes: notes || encounter.consultation?.plan || null,
          status: 'PENDING_VALIDATION',
          createdBy: oid(actor),
          updatedBy: oid(actor),
        },
      ],
      { session },
    );

    return created[0] ?? null;
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
        status: { $in: ['READY_FOR_DISPOSITION', 'IN_CONSULTATION', 'IN_TREATMENT'] },
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
