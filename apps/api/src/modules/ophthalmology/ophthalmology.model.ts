import mongoose, { Schema, Types } from 'mongoose';
import type {
  OphthalmologyConfigurationStatus,
  OphthalmologyConfigurationType,
  OphthalmologyContextLaterality,
  OphthalmologyVisitSubtype,
  OphthalmologyWorkflowStatus,
} from './ophthalmology.types.js';

export type OphthalmologyContextFields = {
  visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId; departmentId: Types.ObjectId;
  doctorId: Types.ObjectId; visitSubtype: OphthalmologyVisitSubtype; affectedEye: OphthalmologyContextLaterality;
  workflowStatus: OphthalmologyWorkflowStatus; configurationVersionId: Types.ObjectId;
  workflowProfileVersionId: Types.ObjectId; version: number; createdBy: Types.ObjectId; updatedBy: Types.ObjectId;
  createdAt: Date; updatedAt: Date;
};
export type OphthalmologyConfigurationFields = {
  branchId: Types.ObjectId; type: OphthalmologyConfigurationType; code: string; name: string;
  description?: string | null; revision: number; status: OphthalmologyConfigurationStatus;
  effectiveFrom?: Date | null; effectiveTo?: Date | null; values: Record<string, unknown>; version: number;
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; deactivatedBy?: Types.ObjectId | null;
  deactivatedAt?: Date | null; deactivationReason?: string | null; createdAt: Date; updatedAt: Date;
};
export type OphthalmologyStationFields = {
  branchId: Types.ObjectId; departmentId: Types.ObjectId; code: string; name: string; description?: string | null;
  status: 'ACTIVE' | 'INACTIVE'; supportedTestTypes: string[]; devices: Array<{ code: string; name: string;
    status: 'ACTIVE' | 'INACTIVE'; calibrationStatus: 'CURRENT' | 'DUE' | 'EXPIRED' | 'NOT_REQUIRED';
    calibratedAt?: Date | null; calibrationDueAt?: Date | null }>; memberUserIds: Types.ObjectId[]; version: number;
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
export type OphthalmologyWorkflowProfileFields = {
  branchId: Types.ObjectId; visitSubtype: OphthalmologyVisitSubtype; name: string; revision: number;
  status: OphthalmologyConfigurationStatus; effectiveFrom?: Date | null; effectiveTo?: Date | null;
  stages: Array<{ code: string; name: string; mode: 'SEQUENTIAL' | 'PARALLEL'; testCodes: string[]; bypassAllowed: boolean }>;
  version: number; createdBy: Types.ObjectId; updatedBy: Types.ObjectId; deactivatedBy?: Types.ObjectId | null;
  deactivatedAt?: Date | null; deactivationReason?: string | null; createdAt: Date; updatedAt: Date;
};

const subtypes = ['NEW_CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'POST_OPERATIVE', 'SCREENING', 'PROCEDURE_REVIEW'] as const;
const configStatuses = ['DRAFT', 'ACTIVE', 'INACTIVE'] as const;
const configTypes = ['SUB_SPECIALITY', 'COMPLAINT', 'TEST_CATALOGUE', 'VISUAL_ACUITY_SCALE', 'DIAGNOSIS_REFERENCE', 'DRUG_OPTION', 'OPTICAL_PRODUCT', 'IOL_CATALOGUE', 'CLINICAL_THRESHOLD', 'GRADE', 'REASON', 'FORM_PROFILE', 'COMPLETION_PROFILE'] as const;
const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
} as const;

const contextSchema = new Schema<OphthalmologyContextFields>({
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  visitSubtype: { type: String, enum: subtypes, required: true },
  affectedEye: { type: String, enum: ['OD', 'OS', 'OU', 'NOT_SPECIFIED'], required: true },
  workflowStatus: { type: String, enum: ['CHECKED_IN', 'PRELIMINARY_EXAMINATION', 'AWAITING_DOCTOR', 'UNDER_CONSULTATION', 'TESTS_ORDERED', 'AWAITING_RESULTS', 'CLINICAL_REVIEW', 'REVIEW_COMPLETED', 'CONSULTATION_COMPLETED'], default: 'CHECKED_IN', required: true },
  configurationVersionId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyConfiguration', required: true },
  workflowProfileVersionId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyWorkflowProfile', required: true },
  version: { type: Number, default: 0, min: 0, required: true }, ...auditFields,
}, { timestamps: true });
contextSchema.index({ visitId: 1 }, { unique: true });
contextSchema.index({ branchId: 1, workflowStatus: 1, updatedAt: -1 });
contextSchema.index({ patientId: 1, updatedAt: -1 });

const configurationSchema = new Schema<OphthalmologyConfigurationFields>({
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  type: { type: String, enum: configTypes, required: true }, code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true }, description: { type: String, default: null, trim: true },
  revision: { type: Number, min: 1, required: true }, status: { type: String, enum: configStatuses, default: 'DRAFT', required: true },
  effectiveFrom: { type: Date, default: null }, effectiveTo: { type: Date, default: null },
  values: { type: Schema.Types.Mixed, default: {} }, version: { type: Number, default: 0, min: 0, required: true },
  deactivatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, deactivatedAt: { type: Date, default: null },
  deactivationReason: { type: String, default: null }, ...auditFields,
}, { timestamps: true });
configurationSchema.index({ branchId: 1, type: 1, code: 1, revision: 1 }, { unique: true });
configurationSchema.index({ branchId: 1, type: 1, code: 1, status: 1, updatedAt: -1 });
configurationSchema.index({ branchId: 1, type: 1, code: 1 }, { unique: true, partialFilterExpression: { status: 'ACTIVE' } });

const deviceSchema = new Schema({
  code: { type: String, required: true, trim: true, uppercase: true }, name: { type: String, required: true, trim: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },
  calibrationStatus: { type: String, enum: ['CURRENT', 'DUE', 'EXPIRED', 'NOT_REQUIRED'], default: 'NOT_REQUIRED', required: true },
  calibratedAt: { type: Date, default: null }, calibrationDueAt: { type: Date, default: null },
}, { _id: false });
const stationSchema = new Schema<OphthalmologyStationFields>({
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  code: { type: String, required: true, trim: true, uppercase: true }, name: { type: String, required: true, trim: true },
  description: { type: String, default: null, trim: true }, status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },
  supportedTestTypes: { type: [String], default: [] }, devices: { type: [deviceSchema], default: [] },
  memberUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }], version: { type: Number, default: 0, min: 0, required: true }, ...auditFields,
}, { timestamps: true });
stationSchema.index({ branchId: 1, code: 1 }, { unique: true });
stationSchema.index({ branchId: 1, status: 1, name: 1 });
stationSchema.index({ branchId: 1, supportedTestTypes: 1, status: 1 });
stationSchema.index({ memberUserIds: 1, status: 1 });

const stageSchema = new Schema({
  code: { type: String, required: true, trim: true, uppercase: true }, name: { type: String, required: true, trim: true },
  mode: { type: String, enum: ['SEQUENTIAL', 'PARALLEL'], required: true }, testCodes: { type: [String], default: [] },
  bypassAllowed: { type: Boolean, default: false, required: true },
}, { _id: false });
const workflowProfileSchema = new Schema<OphthalmologyWorkflowProfileFields>({
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, visitSubtype: { type: String, enum: subtypes, required: true },
  name: { type: String, required: true, trim: true }, revision: { type: Number, min: 1, required: true },
  status: { type: String, enum: configStatuses, default: 'DRAFT', required: true }, effectiveFrom: { type: Date, default: null },
  effectiveTo: { type: Date, default: null }, stages: { type: [stageSchema], default: [] }, version: { type: Number, default: 0, min: 0, required: true },
  deactivatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, deactivatedAt: { type: Date, default: null },
  deactivationReason: { type: String, default: null }, ...auditFields,
}, { timestamps: true });
workflowProfileSchema.index({ branchId: 1, visitSubtype: 1, revision: 1 }, { unique: true });
workflowProfileSchema.index({ branchId: 1, visitSubtype: 1 }, { unique: true, partialFilterExpression: { status: 'ACTIVE' } });
workflowProfileSchema.index({ branchId: 1, status: 1, updatedAt: -1 });

export const OphthalmologyContextModel = mongoose.model<OphthalmologyContextFields>('OphthalmologyContext', contextSchema);
export const OphthalmologyConfigurationModel = mongoose.model<OphthalmologyConfigurationFields>('OphthalmologyConfiguration', configurationSchema);
export const OphthalmologyStationModel = mongoose.model<OphthalmologyStationFields>('OphthalmologyStation', stationSchema);
export const OphthalmologyWorkflowProfileModel = mongoose.model<OphthalmologyWorkflowProfileFields>('OphthalmologyWorkflowProfile', workflowProfileSchema);
