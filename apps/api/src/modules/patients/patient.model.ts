import mongoose, { Schema, Types } from 'mongoose';
import type {
  PatientConsentStatus,
  PatientDocumentType,
  PatientGender,
  PatientStatus,
  PatientTimelineEventType,
} from './patient.types.js';

export type PatientDocumentFields = {
  patientNumber: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: Date;
  gender: PatientGender;
  phone?: string | null;
  email?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postalCode?: string | null;
  };
  emergencyContact?: {
    name?: string | null;
    relationship?: string | null;
    phone?: string | null;
  };
  parentGuardian?: string | null;
  registrationBranchId?: Types.ObjectId | null;
  bloodGroup?: string | null;
  status: PatientStatus;
  notes?: string | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const patientSchema = new Schema<PatientDocumentFields>(
  {
    patientNumber: { type: String, required: true, unique: true },
    firstName: { type: String, default: null },
    middleName: { type: String, default: null },
    lastName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'], required: true },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    address: {
      line1: { type: String, default: null },
      line2: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { type: String, default: null },
      postalCode: { type: String, default: null },
    },
    emergencyContact: {
      name: { type: String, default: null },
      relationship: { type: String, default: null },
      phone: { type: String, default: null },
    },
    parentGuardian: { type: String, default: null },
    registrationBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    bloodGroup: { type: String, default: null },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'DECEASED'], default: 'ACTIVE', required: true },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

patientSchema.index({ firstName: 1, lastName: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ email: 1 });
patientSchema.index({ status: 1 });

export type PatientDocumentMetadataFields = {
  patientId: Types.ObjectId;
  visitId?: Types.ObjectId | null;
  admissionId?: Types.ObjectId | null;
  procedureId?: Types.ObjectId | null;

  consentTemplateId?: Types.ObjectId | null;
  consentCategory?: string | null;
  consentVersion?: number | null;
  documentType: PatientDocumentType;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  description?: string | null;
  consentStatus?: PatientConsentStatus | null;
  contextType?: 'INPATIENT_ADMISSION' | 'PROCEDURE_BOOKING' | 'PATIENT' | 'PROCEDURE' | 'ADMISSION' | null;
  contextId?: Types.ObjectId | null;
  consentKind?: string | null;
  signedAt?: Date | null;
  validUntil?: Date | null;
  signedByName?: string | null;
  status: 'ACTIVE' | 'DELETED';
  uploadedBy?: Types.ObjectId;
  verifiedBy?: Types.ObjectId | null;
  verifiedAt?: Date | null;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const patientDocumentSchema = new Schema<PatientDocumentMetadataFields>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', default: null },
    admissionId: { type: Schema.Types.ObjectId, ref: 'InpatientAdmission', default: null },
    procedureId: { type: Schema.Types.ObjectId, default: null },
    consentTemplateId: { type: Schema.Types.ObjectId, ref: 'ConsentTemplate', default: null },
    consentCategory: { type: String, default: null, trim: true },
    consentVersion: { type: Number, min: 1, default: null },
    documentType: {
      type: String,
      enum: ['IDENTITY', 'INSURANCE', 'CLINICAL', 'CONSENT', 'OTHER'],
      required: true,
    },
    title: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    storageKey: { type: String, required: true },
    description: { type: String, default: null },
    consentStatus: { type: String, enum: ['SIGNED', 'PENDING', 'EXPIRED', 'REJECTED', 'ATTACHED', 'VERIFIED'], default: null },
    contextType: { type: String, enum: ['INPATIENT_ADMISSION', 'PROCEDURE_BOOKING', 'PATIENT', 'PROCEDURE', 'ADMISSION'], default: null },
    contextId: { type: Schema.Types.ObjectId, default: null },
    consentKind: { type: String, default: null, trim: true },
    signedAt: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    signedByName: { type: String, default: null },
    status: { type: String, enum: ['ACTIVE', 'DELETED'], default: 'ACTIVE', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

patientDocumentSchema.index({ patientId: 1, status: 1 });
patientDocumentSchema.index({ patientId: 1, visitId: 1, status: 1, createdAt: -1 });
patientDocumentSchema.index({ patientId: 1, admissionId: 1, status: 1, createdAt: -1 });
patientDocumentSchema.index({ patientId: 1, consentTemplateId: 1, contextType: 1, contextId: 1, status: 1 });
patientDocumentSchema.index({ documentType: 1 });
patientDocumentSchema.index({ patientId: 1, contextType: 1, contextId: 1, status: 1 });

export type PatientTimelineEventFields = {
  patientId: Types.ObjectId;
  eventType: PatientTimelineEventType;
  title: string;
  description?: string | null;
  occurredAt: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const patientTimelineEventSchema = new Schema<PatientTimelineEventFields>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    eventType: {
      type: String,
      enum: [
        'REGISTRATION',
        'PROFILE_UPDATED',
        'DOCUMENT_ADDED',
        'DOCUMENT_DELETED',
        'CONSENT_ADDED',
        'CONSENT_VERIFIED',
        'OPD_VISIT_CREATED',
        'OPD_VISIT_STATUS_UPDATED',
        'VITALS_RECORDED',
        'OPD_CONSULTATION_COMPLETED',
        'OPD_PRESCRIPTION_SUBMITTED',
        'OPD_LAB_ORDER_SUBMITTED',
        'OPD_IMAGING_ORDER_SUBMITTED',
        'OPD_FOLLOW_UP_SCHEDULED',
        'OPD_REFERRAL_SUBMITTED',
        'OPD_REFERRAL_BOOKED',
        'ADMISSION_REQUEST_CREATED',
        'INPATIENT_ADMISSION_CONFIRMED',
        'ADMISSION_REQUEST_CANCELLED',
        'PROCEDURE_RECOMMENDATION_CREATED',
        'PROCEDURE_RECOMMENDATION_CANCELLED',
        'PROCEDURE_BOOKING_CREATED',
        'PROCEDURE_BOOKING_CONFIRMED',
        'PROCEDURE_BOOKING_RESCHEDULED',
        'PROCEDURE_BOOKING_CANCELLED',
        'PROCEDURE_BOOKING_COMPLETED',
        'EMERGENCY_ENCOUNTER_REGISTERED',
        'EMERGENCY_PATIENT_LINKED',
        'EMERGENCY_TRIAGE_COMPLETED',
        'EMERGENCY_CONSULTATION_UPDATED',
        'EMERGENCY_DISPOSITION_CONFIRMED',
        'EMERGENCY_CONVERTED_TO_IP',
      ],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: null },
    occurredAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
  },
);

patientTimelineEventSchema.index({ patientId: 1, occurredAt: -1 });

export const PatientModel = mongoose.model<PatientDocumentFields>('Patient', patientSchema);
export const PatientDocumentModel = mongoose.model<PatientDocumentMetadataFields>(
  'PatientDocument',
  patientDocumentSchema,
);
export const PatientTimelineEventModel = mongoose.model<PatientTimelineEventFields>(
  'PatientTimelineEvent',
  patientTimelineEventSchema,
);

