import mongoose, { Schema, Types } from 'mongoose';
import type { OphthalmologyCompletionRequirementCode } from './ophthalmology.types.js';

export type OphthalmologyConsultationFinalizationFields = {
  contextId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId; departmentId: Types.ObjectId;
  status: 'OPEN' | 'COMPLETED' | 'AMENDMENT_OPEN'; version: number;
  deferrals: Array<{ _id: Types.ObjectId; sourceType: 'TEST_TASK' | 'CLINICAL_ORDER'; sourceId: Types.ObjectId; reason: string;
    reviewPlan?: string | null; dueAt?: Date | null; responsibleDoctorId: Types.ObjectId; recordedBy: Types.ObjectId; recordedAt: Date }>;
  overrides: Array<{ _id: Types.ObjectId; unmetCodes: OphthalmologyCompletionRequirementCode[]; unmetSnapshot: Array<{ code: string; details: string;
    resourceIds: string[] }>; reason: string; doctorId: Types.ObjectId; actorUserId: Types.ObjectId; createdAt: Date }>;
  completions: Array<{ clinicalVersion: number; configurationVersionId: Types.ObjectId; configurationRevision: number;
    configurationSnapshot: Record<string, unknown>; consultationVersion: number; clinicalReviewVersion: number;
    opticalPrescriptionVersion?: number | null; requirementSnapshot: Array<{ code: string; satisfied: boolean; details: string; resourceIds: string[] }>;
    summarySnapshot: Record<string, unknown>; approverUserId: Types.ObjectId; approverDoctorId: Types.ObjectId; approvedAt: Date;
    idempotencyKey: string; requestFingerprint: string; supersedesClinicalVersion?: number | null }>;
  amendmentEpisodes: Array<{ _id: Types.ObjectId; sourceClinicalVersion: number; reason: string; status: 'OPEN' | 'PENDING_REAPPROVAL' | 'COMPLETED';
    openedBy: Types.ObjectId; openedAt: Date; changes: Array<{ section: string; beforeValue: unknown; afterValue: unknown; reason: string;
      changedBy: Types.ObjectId; changedAt: Date }> }>;
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
const deferralSchema = new Schema({ sourceType: { type: String, enum: ['TEST_TASK', 'CLINICAL_ORDER'], required: true },
  sourceId: { type: Schema.Types.ObjectId, required: true }, reason: { type: String, required: true, trim: true }, reviewPlan: { type: String, default: null },
  dueAt: { type: Date, default: null }, responsibleDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, recordedAt: { type: Date, required: true } });
const overrideSchema = new Schema({ unmetCodes: { type: [String], required: true }, unmetSnapshot: { type: [Schema.Types.Mixed], required: true },
  reason: { type: String, required: true }, doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, createdAt: { type: Date, required: true } });
const completionSchema = new Schema({ clinicalVersion: { type: Number, required: true }, configurationVersionId: { type: Schema.Types.ObjectId, required: true },
  configurationRevision: { type: Number, required: true }, configurationSnapshot: { type: Schema.Types.Mixed, required: true },
  consultationVersion: { type: Number, required: true }, clinicalReviewVersion: { type: Number, required: true }, opticalPrescriptionVersion: { type: Number, default: null },
  requirementSnapshot: { type: [Schema.Types.Mixed], required: true }, summarySnapshot: { type: Schema.Types.Mixed, required: true },
  approverUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, approverDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  approvedAt: { type: Date, required: true }, idempotencyKey: { type: String, required: true }, requestFingerprint: { type: String, required: true },
  supersedesClinicalVersion: { type: Number, default: null } }, { _id: false });
const changeSchema = new Schema({ section: { type: String, required: true }, beforeValue: { type: Schema.Types.Mixed, required: true },
  afterValue: { type: Schema.Types.Mixed, required: true }, reason: { type: String, required: true }, changedBy: { type: Schema.Types.ObjectId, required: true },
  changedAt: { type: Date, required: true } }, { _id: false });
const episodeSchema = new Schema({ sourceClinicalVersion: { type: Number, required: true }, reason: { type: String, required: true },
  status: { type: String, enum: ['OPEN', 'PENDING_REAPPROVAL', 'COMPLETED'], required: true }, openedBy: { type: Schema.Types.ObjectId, required: true },
  openedAt: { type: Date, required: true }, changes: { type: [changeSchema], default: [] } });
const schema = new Schema<OphthalmologyConsultationFinalizationFields>({ contextId: { type: Schema.Types.ObjectId, required: true },
  visitId: { type: Schema.Types.ObjectId, required: true }, patientId: { type: Schema.Types.ObjectId, required: true },
  branchId: { type: Schema.Types.ObjectId, required: true }, departmentId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['OPEN', 'COMPLETED', 'AMENDMENT_OPEN'], default: 'OPEN', required: true }, version: { type: Number, default: 0, required: true },
  deferrals: { type: [deferralSchema], default: [] }, overrides: { type: [overrideSchema], default: [] }, completions: { type: [completionSchema], default: [] },
  amendmentEpisodes: { type: [episodeSchema], default: [] }, createdBy: { type: Schema.Types.ObjectId, required: true },
  updatedBy: { type: Schema.Types.ObjectId, required: true } }, { timestamps: true });
schema.index({ visitId: 1 }, { unique: true }); schema.index({ patientId: 1, branchId: 1, status: 1, updatedAt: -1 });
schema.index({ contextId: 1, 'completions.idempotencyKey': 1 });
export const OphthalmologyConsultationFinalizationModel = mongoose.model<OphthalmologyConsultationFinalizationFields>('OphthalmologyConsultationFinalization', schema);
