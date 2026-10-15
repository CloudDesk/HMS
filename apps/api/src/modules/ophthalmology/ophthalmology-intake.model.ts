import mongoose, { Schema, Types } from 'mongoose';
import type {
  OphthalmologyAlertStatus,
  OphthalmologyAlertType,
  OphthalmologyComplaintOnset,
  OphthalmologyComplaintProgression,
  OphthalmologyComplaintSeverity,
  OphthalmologyContextLaterality,
  OphthalmologyDurationUnit,
  OphthalmologyIntakeStatus,
} from './ophthalmology.types.js';

type EyeSurgeryFields = { procedure: string; laterality: 'OD' | 'OS' | 'OU' | 'NOT_APPLICABLE'; date: Date };
type EyeTreatmentFields = { type: string; details: string };
type EyeInjuryOrLaserFields = { type: 'INJURY' | 'LASER'; laterality: 'OD' | 'OS' | 'OU' | 'NOT_APPLICABLE'; date?: Date | null; details: string };
type VisionCorrectionUseFields = { uses: boolean; ageMonths?: number | null; wearingPattern?: string | null };

export type OphthalmologyIntakeFields = {
  contextId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId; departmentId: Types.ObjectId;
  status: OphthalmologyIntakeStatus; complaintConfigurationVersionId: Types.ObjectId; emergencyConfigurationVersionId: Types.ObjectId;
  complaintCodes: string[]; affectedEye: OphthalmologyContextLaterality; durationValue?: number | null;
  durationUnit?: OphthalmologyDurationUnit | null; onset?: OphthalmologyComplaintOnset | null;
  progression?: OphthalmologyComplaintProgression | null; severity?: OphthalmologyComplaintSeverity | null;
  associatedSymptomCodes: string[]; description?: string | null; noSignificantOphthalmicHistory: boolean;
  previousEyeDiseaseCodes: string[]; previousEyeSurgeries: EyeSurgeryFields[]; currentEyeTreatments: EyeTreatmentFields[];
  previousEyeInjuryOrLaser: EyeInjuryOrLaserFields[]; spectacleUse: VisionCorrectionUseFields;
  contactLensUse: VisionCorrectionUseFields; longTermSteroidUse: boolean; longTermSteroidDetails?: string | null;
  familyHistoryCodes: string[]; previousReportDocumentIds: Types.ObjectId[]; sharedMedicalHistoryReviewed: boolean;
  sharedAllergyReviewed: boolean; emergencyCriterionCodes: string[]; otherUrgentConditionDetail?: string | null;
  completedBy?: Types.ObjectId | null; completedAt?: Date | null; version: number; createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};

export type OphthalmologyAlertFields = {
  contextId: Types.ObjectId; intakeId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId;
  branchId: Types.ObjectId; departmentId: Types.ObjectId; type: OphthalmologyAlertType; status: OphthalmologyAlertStatus;
  sourceVersion: number; criterionCodes: string[]; reason: string; notifiedUserIds: Types.ObjectId[];
  triggeredBy: Types.ObjectId; triggeredAt: Date; acknowledgedBy?: Types.ObjectId | null;
  acknowledgedAt?: Date | null; acknowledgementNote?: string | null; version: number; createdAt: Date; updatedAt: Date;
};

const eyeSurgerySchema = new Schema<EyeSurgeryFields>({
  procedure: { type: String, required: true, trim: true },
  laterality: { type: String, enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'], required: true },
  date: { type: Date, required: true },
}, { _id: false });
const eyeTreatmentSchema = new Schema<EyeTreatmentFields>({
  type: { type: String, required: true, trim: true }, details: { type: String, required: true, trim: true },
}, { _id: false });
const eyeInjuryOrLaserSchema = new Schema<EyeInjuryOrLaserFields>({
  type: { type: String, enum: ['INJURY', 'LASER'], required: true },
  laterality: { type: String, enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'], required: true },
  date: { type: Date, default: null }, details: { type: String, required: true, trim: true },
}, { _id: false });
const visionCorrectionUseSchema = new Schema<VisionCorrectionUseFields>({
  uses: { type: Boolean, default: false, required: true }, ageMonths: { type: Number, min: 0, default: null },
  wearingPattern: { type: String, trim: true, default: null },
}, { _id: false });

const intakeSchema = new Schema<OphthalmologyIntakeFields>({
  contextId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyContext', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true }, patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  status: { type: String, enum: ['DRAFT', 'COMPLETED'], default: 'DRAFT', required: true },
  complaintConfigurationVersionId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyConfiguration', required: true },
  emergencyConfigurationVersionId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyConfiguration', required: true },
  complaintCodes: { type: [String], default: [] }, affectedEye: { type: String, enum: ['OD', 'OS', 'OU', 'NOT_SPECIFIED'], required: true },
  durationValue: { type: Number, min: 0, default: null }, durationUnit: { type: String, enum: ['DAY', 'WEEK', 'MONTH', 'YEAR', null], default: null },
  onset: { type: String, enum: ['SUDDEN', 'GRADUAL', 'UNKNOWN', null], default: null },
  progression: { type: String, enum: ['IMPROVING', 'STABLE', 'WORSENING', 'INTERMITTENT', null], default: null },
  severity: { type: String, enum: ['MILD', 'MODERATE', 'SEVERE', null], default: null },
  associatedSymptomCodes: { type: [String], default: [] }, description: { type: String, trim: true, default: null },
  noSignificantOphthalmicHistory: { type: Boolean, default: false, required: true }, previousEyeDiseaseCodes: { type: [String], default: [] },
  previousEyeSurgeries: { type: [eyeSurgerySchema], default: [] }, currentEyeTreatments: { type: [eyeTreatmentSchema], default: [] },
  previousEyeInjuryOrLaser: { type: [eyeInjuryOrLaserSchema], default: [] },
  spectacleUse: { type: visionCorrectionUseSchema, default: () => ({ uses: false, ageMonths: null, wearingPattern: null }) },
  contactLensUse: { type: visionCorrectionUseSchema, default: () => ({ uses: false, ageMonths: null, wearingPattern: null }) },
  longTermSteroidUse: { type: Boolean, default: false, required: true }, longTermSteroidDetails: { type: String, trim: true, default: null },
  familyHistoryCodes: { type: [String], default: [] }, previousReportDocumentIds: [{ type: Schema.Types.ObjectId, ref: 'PatientDocument' }],
  sharedMedicalHistoryReviewed: { type: Boolean, default: false, required: true }, sharedAllergyReviewed: { type: Boolean, default: false, required: true },
  emergencyCriterionCodes: { type: [String], default: [] }, otherUrgentConditionDetail: { type: String, trim: true, default: null },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, completedAt: { type: Date, default: null },
  version: { type: Number, min: 0, default: 0, required: true }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
intakeSchema.index({ contextId: 1 }, { unique: true });
intakeSchema.index({ visitId: 1 }, { unique: true });
intakeSchema.index({ branchId: 1, status: 1, updatedAt: -1 });
intakeSchema.index({ patientId: 1, updatedAt: -1 });

const alertSchema = new Schema<OphthalmologyAlertFields>({
  contextId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyContext', required: true },
  intakeId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyIntake', required: true }, visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true }, branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true }, type: { type: String, enum: ['EMERGENCY_SCREENING'], required: true },
  status: { type: String, enum: ['ACTIVE', 'ACKNOWLEDGED'], default: 'ACTIVE', required: true }, sourceVersion: { type: Number, min: 1, required: true },
  criterionCodes: { type: [String], default: [] }, reason: { type: String, required: true, trim: true },
  notifiedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }], triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  triggeredAt: { type: Date, required: true }, acknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgedAt: { type: Date, default: null }, acknowledgementNote: { type: String, trim: true, default: null },
  version: { type: Number, min: 0, default: 0, required: true },
}, { timestamps: true });
alertSchema.index({ contextId: 1, type: 1, sourceVersion: 1 }, { unique: true });
alertSchema.index({ branchId: 1, status: 1, triggeredAt: -1 });
alertSchema.index({ notifiedUserIds: 1, status: 1 });

export const OphthalmologyIntakeModel = mongoose.model<OphthalmologyIntakeFields>('OphthalmologyIntake', intakeSchema);
export const OphthalmologyAlertModel = mongoose.model<OphthalmologyAlertFields>('OphthalmologyAlert', alertSchema);
