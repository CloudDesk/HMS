import mongoose, { Schema, Types } from 'mongoose';
import type { OphthalmologyOpticalPrescriptionType, OphthalmologyTreatmentPlanPriority,
  OphthalmologyTreatmentPlanStatus, OphthalmologyTreatmentPlanActionType } from './ophthalmology.types.js';

export type OphthalmologyTreatmentPlanFields = {
  _id: Types.ObjectId; diagnosisCode: string; diagnosisLaterality: 'OD' | 'OS' | 'OU' | 'NOT_APPLICABLE'; treatment: string;
  actionType?: OphthalmologyTreatmentPlanActionType | null; category?: string | null;
  priority: OphthalmologyTreatmentPlanPriority; status: OphthalmologyTreatmentPlanStatus;
  medicationPrescriptionId?: Types.ObjectId | null; opticalPrescriptionId?: Types.ObjectId | null;
  clinicalOrderIds: Types.ObjectId[]; procedureRecommendationId?: Types.ObjectId | null;
  referralId?: Types.ObjectId | null; followUpId?: Types.ObjectId | null; clinicianUserId: Types.ObjectId;
};
export type OphthalmologyClinicalReviewVersionFields = {
  clinicalVersion: number; clinicalSummary: string; treatmentPlans: OphthalmologyTreatmentPlanFields[];
  followUpDecision?: 'FOLLOW_UP_RECORDED' | 'NO_FOLLOW_UP' | null; patientInstructions?: string | null;
  createdBy: Types.ObjectId; createdAt: Date;
};
export type OphthalmologyClinicalReviewFields = {
  contextId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId; departmentId: Types.ObjectId;
  currentClinicalVersion: number; status: 'DRAFT' | 'COMPLETED'; versions: OphthalmologyClinicalReviewVersionFields[]; version: number;
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};

const treatmentPlanSchema = new Schema<OphthalmologyTreatmentPlanFields>({
  diagnosisCode: { type: String, required: true, trim: true, uppercase: true },
  diagnosisLaterality: { type: String, enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'], required: true },
  treatment: { type: String, required: true, trim: true },
  actionType: { type: String, enum: ['MEDICATION', 'OPTICAL', 'INVESTIGATION', 'PROCEDURE', 'REFERRAL', 'FOLLOW_UP', 'OTHER'], default: null },
  category: { type: String, default: null, trim: true, uppercase: true },
  priority: { type: String, enum: ['ROUTINE', 'URGENT', 'EMERGENCY'], required: true },
  status: { type: String, enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'], required: true },
  medicationPrescriptionId: { type: Schema.Types.ObjectId, ref: 'OpdPrescription', default: null },
  opticalPrescriptionId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyOpticalPrescription', default: null },
  clinicalOrderIds: { type: [Schema.Types.ObjectId], ref: 'OpdClinicalOrder', default: [] },
  procedureRecommendationId: { type: Schema.Types.ObjectId, ref: 'ProcedureRecommendation', default: null },
  referralId: { type: Schema.Types.ObjectId, ref: 'OpdReferral', default: null },
  followUpId: { type: Schema.Types.ObjectId, ref: 'OpdFollowUp', default: null },
  clinicianUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});
const clinicalReviewVersionSchema = new Schema<OphthalmologyClinicalReviewVersionFields>({
  clinicalVersion: { type: Number, min: 1, required: true }, clinicalSummary: { type: String, default: '', trim: true },
  treatmentPlans: { type: [treatmentPlanSchema], default: [] }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  followUpDecision: { type: String, enum: ['FOLLOW_UP_RECORDED', 'NO_FOLLOW_UP', null], default: null }, patientInstructions: { type: String, default: null },
  createdAt: { type: Date, required: true },
}, { _id: false });
const clinicalReviewSchema = new Schema<OphthalmologyClinicalReviewFields>({
  contextId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyContext', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true }, patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  currentClinicalVersion: { type: Number, min: 1, required: true }, status: { type: String, enum: ['DRAFT', 'COMPLETED'], default: 'DRAFT', required: true },
  versions: { type: [clinicalReviewVersionSchema], required: true }, version: { type: Number, min: 0, default: 0, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
clinicalReviewSchema.index({ visitId: 1 }, { unique: true });
clinicalReviewSchema.index({ patientId: 1, branchId: 1, updatedAt: -1 });
export const OphthalmologyClinicalReviewModel = mongoose.model<OphthalmologyClinicalReviewFields>('OphthalmologyClinicalReview', clinicalReviewSchema);

export type OphthalmologyOpticalPowerFields = { sphere: number; cylinder?: number | null; axis?: number | null; addition?: number | null;
  prism?: number | null; prismBase?: string | null };
export type OphthalmologyOpticalPrescriptionVersionFields = {
  clinicalVersion: number; status: 'DRAFT' | 'APPROVED'; prescriptionType: OphthalmologyOpticalPrescriptionType;
  power: { OD?: OphthalmologyOpticalPowerFields | null; OS?: OphthalmologyOpticalPowerFields | null };
  pupillaryDistance: { format: 'BINOCULAR' | 'MONOCULAR'; binocular?: number | null; OD?: number | null; OS?: number | null };
  segmentHeight?: { OD?: number | null; OS?: number | null } | null; lensType: string; material: string; coatingCodes: string[];
  usageInstructions: string; validUntil: Date; reviewDate?: Date | null; approverUserId?: Types.ObjectId | null;
  approverDoctorId?: Types.ObjectId | null; approvedAt?: Date | null; createdBy: Types.ObjectId; createdAt: Date;
};
export type OphthalmologyOpticalPrescriptionFields = {
  contextId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId; departmentId: Types.ObjectId;
  currentClinicalVersion: number; status: 'DRAFT' | 'APPROVED'; versions: OphthalmologyOpticalPrescriptionVersionFields[];
  version: number; createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
const opticalPowerSchema = new Schema<OphthalmologyOpticalPowerFields>({
  sphere: { type: Number, required: true }, cylinder: { type: Number, default: null }, axis: { type: Number, min: 0, max: 180, default: null },
  addition: { type: Number, default: null }, prism: { type: Number, min: 0, default: null }, prismBase: { type: String, default: null },
}, { _id: false });
const opticalPrescriptionVersionSchema = new Schema<OphthalmologyOpticalPrescriptionVersionFields>({
  clinicalVersion: { type: Number, min: 1, required: true }, status: { type: String, enum: ['DRAFT', 'APPROVED'], required: true },
  prescriptionType: { type: String, enum: ['DISTANCE', 'NEAR', 'BIFOCAL', 'PROGRESSIVE', 'OCCUPATIONAL'], required: true },
  power: { OD: { type: opticalPowerSchema, default: null }, OS: { type: opticalPowerSchema, default: null } },
  pupillaryDistance: { format: { type: String, enum: ['BINOCULAR', 'MONOCULAR'], required: true }, binocular: { type: Number, default: null },
    OD: { type: Number, default: null }, OS: { type: Number, default: null } },
  segmentHeight: { OD: { type: Number, default: null }, OS: { type: Number, default: null } },
  lensType: { type: String, required: true, trim: true, uppercase: true }, material: { type: String, required: true, trim: true, uppercase: true },
  coatingCodes: { type: [String], default: [] }, usageInstructions: { type: String, required: true, trim: true },
  validUntil: { type: Date, required: true }, reviewDate: { type: Date, default: null },
  approverUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, approverDoctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
  approvedAt: { type: Date, default: null }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, createdAt: { type: Date, required: true },
}, { _id: false });
const opticalPrescriptionSchema = new Schema<OphthalmologyOpticalPrescriptionFields>({
  contextId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyContext', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true }, patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  currentClinicalVersion: { type: Number, min: 1, required: true }, status: { type: String, enum: ['DRAFT', 'APPROVED'], required: true },
  versions: { type: [opticalPrescriptionVersionSchema], required: true }, version: { type: Number, min: 0, default: 0, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
opticalPrescriptionSchema.index({ visitId: 1 }, { unique: true });
opticalPrescriptionSchema.index({ patientId: 1, branchId: 1, status: 1, updatedAt: -1 });
export const OphthalmologyOpticalPrescriptionModel = mongoose.model<OphthalmologyOpticalPrescriptionFields>('OphthalmologyOpticalPrescription', opticalPrescriptionSchema);
