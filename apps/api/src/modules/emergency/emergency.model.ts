import mongoose, { Schema, Types } from 'mongoose';
import type {
  EmergencyDisposition,
  EmergencyOrderType,
  EmergencyReferralPriority,
  EmergencyStatus,
  EmergencyTriageLevel,
} from './emergency.types.js';

export type EmergencyEncounterFields = {
  encounterNumber: string;
  emergencyIdentifier: string;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  patientId?: Types.ObjectId | null;
  patientNumber?: string | null;
  patientName: string;
  provisionalIdentity?: {
    displayName: string;
    estimatedAge?: number | null;
    gender?: string | null;
    contact?: string | null;
    identityNotes?: string | null;
  } | null;
  arrivalMode: string;
  arrivalAt: Date;
  chiefComplaint: string;
  arrivalNotes?: string | null;
  status: EmergencyStatus;
  version: number;
  triage?: {
    level: EmergencyTriageLevel;
    effectiveLevel: EmergencyTriageLevel;
    area: string;
    nurseUserId: Types.ObjectId;
    assessedAt: Date;
    painScore?: number | null;
    vitals: Record<string, number | null>;
    abcde: Record<string, string>;
    notes?: string | null;
  } | null;
  priorityHistory: Array<{
    previousLevel: EmergencyTriageLevel;
    newLevel: EmergencyTriageLevel;
    reason: string;
    changedBy: Types.ObjectId;
    changedAt: Date;
  }>;
  queueHistory: Array<{
    action: string;
    fromStatus: EmergencyStatus;
    toStatus: EmergencyStatus;
    reason?: string | null;
    actorId: Types.ObjectId;
    occurredAt: Date;
  }>;
  assignedDoctorId?: Types.ObjectId | null;
  assignedDoctorName?: string | null;
  consultation?: {
    startedAt: Date;
    updatedAt: Date;
    chiefComplaint: string;
    history: string;
    examination: string;
    diagnosis: string;
    plan: string;
    treatment?: string | null;
    notes?: string | null;
  } | null;
  referral?: {
    sourceType: 'EMERGENCY_ENCOUNTER';
    targetDepartmentId: Types.ObjectId;
    targetDepartmentName: string;
    targetDoctorId?: Types.ObjectId | null;
    targetDoctorName?: string | null;
    priority: EmergencyReferralPriority;
    reason: string;
    clinicalNotes: string;
    status: 'SUBMITTED';
    submittedAt: Date;
    submittedBy: Types.ObjectId;
    appointmentId?: Types.ObjectId | null;
    appointmentNumber?: string | null;
    appointmentDate?: Date | null;
    appointmentStartTime?: string | null;
    appointmentDurationMinutes?: number | null;
  } | null;
  orders: Array<{
    orderType: EmergencyOrderType;
    downstreamId: Types.ObjectId;
    sourceType: 'EMERGENCY_ENCOUNTER';
    sourceId: Types.ObjectId;
    status: string;
    createdAt: Date;
    createdBy: Types.ObjectId;
  }>;
  disposition?: {
    decision: EmergencyDisposition;
    reason?: string | null;
    summary?: string | null;
    instructions?: string | null;
    transferDestination?: string | null;
    billingStatus?: string | null;
    confirmedAt: Date;
    confirmedBy: Types.ObjectId;
  } | null;
  inpatientAdmissionId?: Types.ObjectId | null;
  convertedToIpAt?: Date | null;
  convertedToIpBy?: Types.ObjectId | null;
  linkedAt?: Date | null;
  linkedBy?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const encounterSchema = new Schema<EmergencyEncounterFields>(
  {
    encounterNumber: { type: String, required: true, unique: true },
    emergencyIdentifier: { type: String, required: true, unique: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', default: null },
    patientNumber: { type: String, default: null },
    patientName: { type: String, required: true },
    provisionalIdentity: {
      type: {
        displayName: { type: String, required: true },
        estimatedAge: { type: Number, default: null },
        gender: { type: String, default: null },
        contact: { type: String, default: null },
        identityNotes: { type: String, default: null },
      },
      default: null,
    },
    arrivalMode: { type: String, required: true },
    arrivalAt: { type: Date, required: true },
    chiefComplaint: { type: String, required: true },
    arrivalNotes: { type: String, default: null },
    status: {
      type: String,
      enum: [
        'REGISTERED',
        'WAITING_FOR_TRIAGE',
        'TRIAGED',
        'WAITING_FOR_DOCTOR',
        'IN_CONSULTATION',
        'IN_TREATMENT',
        'READY_FOR_DISPOSITION',
        'DISCHARGED',
        'TRANSFERRED',
        'CONVERTED_TO_IP',
        'LEFT',
        'NO_SHOW',
        'CANCELLED',
      ],
      default: 'WAITING_FOR_TRIAGE',
      required: true,
    },
    version: { type: Number, default: 0, required: true },
    triage: {
      type: {
        level: { type: String, required: true },
        effectiveLevel: { type: String, required: true },
        area: { type: String, required: true },
        nurseUserId: { type: Schema.Types.ObjectId, required: true },
        assessedAt: { type: Date, required: true },
        painScore: { type: Number, default: null },
        vitals: { type: Schema.Types.Mixed, required: true },
        abcde: { type: Schema.Types.Mixed, required: true },
        notes: { type: String, default: null },
      },
      default: null,
    },
    priorityHistory: {
      type: [
        {
          previousLevel: String,
          newLevel: String,
          reason: String,
          changedBy: Schema.Types.ObjectId,
          changedAt: Date,
        },
      ],
      default: [],
    },
    queueHistory: {
      type: [
        {
          action: String,
          fromStatus: String,
          toStatus: String,
          reason: { type: String, default: null },
          actorId: Schema.Types.ObjectId,
          occurredAt: Date,
        },
      ],
      default: [],
    },
    assignedDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
    assignedDoctorName: { type: String, default: null },
    consultation: {
      type: {
        startedAt: Date,
        updatedAt: Date,
        chiefComplaint: String,
        history: String,
        examination: String,
        diagnosis: String,
        plan: String,
        treatment: { type: String, default: null },
        notes: { type: String, default: null },
      },
      default: null,
    },
    referral: {
      type: {
        sourceType: { type: String, enum: ['EMERGENCY_ENCOUNTER'], required: true },
        targetDepartmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
        targetDepartmentName: { type: String, required: true },
        targetDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
        targetDoctorName: { type: String, default: null },
        priority: { type: String, enum: ['ROUTINE', 'URGENT', 'EMERGENCY'], required: true },
        reason: { type: String, required: true },
        clinicalNotes: { type: String, required: true },
        status: { type: String, enum: ['SUBMITTED'], required: true },
        submittedAt: { type: Date, required: true },
        submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
        appointmentNumber: { type: String, default: null },
        appointmentDate: { type: Date, default: null },
        appointmentStartTime: { type: String, default: null },
        appointmentDurationMinutes: { type: Number, default: null },
      },
      default: null,
    },
    orders: {
      type: [
        {
          orderType: String,
          downstreamId: Schema.Types.ObjectId,
          sourceType: String,
          sourceId: Schema.Types.ObjectId,
          status: String,
          createdAt: Date,
          createdBy: Schema.Types.ObjectId,
        },
      ],
      default: [],
    },
    disposition: {
      type: {
        decision: String,
        reason: { type: String, default: null },
        summary: { type: String, default: null },
        instructions: { type: String, default: null },
        transferDestination: { type: String, default: null },
        billingStatus: { type: String, default: null },
        confirmedAt: Date,
        confirmedBy: Schema.Types.ObjectId,
      },
      default: null,
    },
    inpatientAdmissionId: { type: Schema.Types.ObjectId, ref: 'InpatientAdmission', default: null },
    convertedToIpAt: { type: Date, default: null },
    convertedToIpBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    linkedAt: { type: Date, default: null },
    linkedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
encounterSchema.index({ branchId: 1, createdAt: -1 });
encounterSchema.index({ branchId: 1, status: 1, arrivalAt: -1 });
encounterSchema.index({ branchId: 1, status: 1, 'triage.effectiveLevel': 1, arrivalAt: 1 });
encounterSchema.index({ departmentId: 1, status: 1, arrivalAt: 1 });
encounterSchema.index({ patientId: 1, createdAt: -1 }, { sparse: true });
encounterSchema.index({ patientName: 1, encounterNumber: 1 });
encounterSchema.index({ branchId: 1, 'referral.status': 1, 'referral.submittedAt': -1 });
encounterSchema.index({ 'referral.targetDoctorId': 1, 'referral.status': 1, 'referral.submittedAt': -1 });
encounterSchema.index(
  { inpatientAdmissionId: 1 },
  {
    unique: true,
    partialFilterExpression: { inpatientAdmissionId: { $type: 'objectId' } },
  },
);
export const EmergencyEncounterModel = mongoose.model<EmergencyEncounterFields>(
  'EmergencyEncounter',
  encounterSchema,
);
