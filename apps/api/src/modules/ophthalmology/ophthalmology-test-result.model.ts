import mongoose, { Schema, Types } from 'mongoose';
import type {
  OphthalmologyTestFormType,
  OphthalmologyResultReliability,
  OphthalmologyResultSourceType,
  OphthalmologyTestResultStatus,
} from './ophthalmology.types.js';

export type OphthalmologyTestResultVersionFields = {
  clinicalVersion: number;
  status: OphthalmologyTestResultStatus;
  formType: OphthalmologyTestFormType;
  formSchemaVersion: string;
  formProfileVersionId: Types.ObjectId;
  formProfileRevision: number;
  formProfileSnapshot: Record<string, unknown>;
  laterality: 'OD' | 'OS' | 'OU' | 'NOT_APPLICABLE';
  stationId: Types.ObjectId;
  deviceCode?: string | null;
  deviceSnapshot?: { code: string; name: string; calibrationStatus: 'CURRENT' | 'DUE' | 'EXPIRED' | 'NOT_REQUIRED';
    calibratedAt?: Date | null; calibrationDueAt?: Date | null } | null;
  performerUserId: Types.ObjectId;
  performedAt: Date;
  sourceType: OphthalmologyResultSourceType;
  reliability: OphthalmologyResultReliability;
  reliabilityReason?: string | null;
  comments?: string | null;
  documentIds: Types.ObjectId[];
  payload: Record<string, unknown>;
  supersedesClinicalVersion?: number | null;
  amendmentReason?: string | null;
  completedAt?: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
};

export type OphthalmologyTestResultFields = {
  taskId: Types.ObjectId;
  contextId: Types.ObjectId;
  visitId: Types.ObjectId;
  patientId: Types.ObjectId;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  currentClinicalVersion: number;
  status: OphthalmologyTestResultStatus;
  versions: OphthalmologyTestResultVersionFields[];
  version: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const deviceSnapshotSchema = new Schema({
  code: { type: String, required: true }, name: { type: String, required: true },
  calibrationStatus: { type: String, enum: ['CURRENT', 'DUE', 'EXPIRED', 'NOT_REQUIRED'], required: true },
  calibratedAt: { type: Date, default: null }, calibrationDueAt: { type: Date, default: null },
}, { _id: false });

const resultVersionSchema = new Schema<OphthalmologyTestResultVersionFields>({
  clinicalVersion: { type: Number, min: 1, required: true },
  status: { type: String, enum: ['DRAFT', 'COMPLETED'], required: true },
  formType: { type: String, enum: ['VISUAL_ACUITY', 'LENSOMETRY', 'AUTOREFRACTION_KERATOMETRY', 'OBJECTIVE_REFRACTION',
    'SUBJECTIVE_REFRACTION', 'INTRAOCULAR_PRESSURE', 'SLIT_LAMP_ANTERIOR_SEGMENT', 'POSTERIOR_FUNDUS_EXAM', 'PACHYMETRY',
    'COLOUR_VISION', 'MOTILITY_SQUINT_BINOCULAR', 'DRY_EYE', 'VISUAL_FIELD', 'OCT', 'FUNDUS_PHOTOGRAPHY',
    'CORNEAL_TOPOGRAPHY', 'BIOMETRY_IOL', 'B_SCAN', 'GONIOSCOPY', 'CONTACT_LENS', 'PAEDIATRIC_VISION'], required: true },
  formSchemaVersion: { type: String, required: true, trim: true },
  formProfileVersionId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyConfiguration', required: true },
  formProfileRevision: { type: Number, min: 1, required: true },
  formProfileSnapshot: { type: Schema.Types.Mixed, required: true },
  laterality: { type: String, enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'], required: true },
  stationId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyStation', required: true },
  deviceCode: { type: String, default: null, trim: true, uppercase: true },
  deviceSnapshot: { type: deviceSnapshotSchema, default: null },
  performerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  performedAt: { type: Date, required: true },
  sourceType: { type: String, enum: ['MANUAL', 'DEVICE_IMPORT', 'MANUAL_CORRECTION'], required: true },
  reliability: { type: String, enum: ['GOOD', 'FAIR', 'POOR'], required: true },
  reliabilityReason: { type: String, default: null, trim: true },
  comments: { type: String, default: null, trim: true },
  documentIds: [{ type: Schema.Types.ObjectId, ref: 'PatientDocument' }],
  payload: { type: Schema.Types.Mixed, required: true },
  supersedesClinicalVersion: { type: Number, default: null },
  amendmentReason: { type: String, default: null, trim: true },
  completedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, required: true },
}, { _id: false });

const testResultSchema = new Schema<OphthalmologyTestResultFields>({
  taskId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyTestTask', required: true },
  contextId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyContext', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  currentClinicalVersion: { type: Number, min: 1, required: true },
  status: { type: String, enum: ['DRAFT', 'COMPLETED'], required: true },
  versions: { type: [resultVersionSchema], required: true },
  version: { type: Number, min: 0, default: 0, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

testResultSchema.index({ taskId: 1 }, { unique: true });
testResultSchema.index({ contextId: 1, status: 1, updatedAt: -1 });
testResultSchema.index({ patientId: 1, 'versions.formType': 1, updatedAt: -1 });
testResultSchema.index({ branchId: 1, status: 1, updatedAt: -1 });

export const OphthalmologyTestResultModel = mongoose.model<OphthalmologyTestResultFields>('OphthalmologyTestResult', testResultSchema);
