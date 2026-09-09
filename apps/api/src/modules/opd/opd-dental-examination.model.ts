import mongoose, { Schema, Types } from 'mongoose';
import type {
  DentalExaminationStatus,
  DentalTreatmentPriority,
  DentalTreatmentStatus,
  DentitionType,
  ToothMobility,
  ToothStatus,
  ToothSurface,
} from './opd-dental-examination.types.js';

export type DentalHistoryFields = {
  chiefComplaint?: string | null;
  painScale?: number | null;
  bleedingGums?: boolean | null;
  sensitivityHotColdSweet?: boolean | null;
  bruxism?: boolean | null;
  habits?: string[];
  medicalAlerts?: string[];
};

export type SoftTissueFields = {
  gingivaCondition?: string | null;
  calculusPlaque?: string | null;
  oralMucosa?: string | null;
  tonguePalateFloor?: string | null;
  tmjEvaluation?: string | null;
  occlusionClass?: string | null;
};

export type ToothFindingFields = {
  toothNumber: number;
  dentition: DentitionType;
  status: ToothStatus;
  surfaces: ToothSurface[];
  conditions: string[];
  mobility?: ToothMobility | null;
  pocketDepthMm?: number | null;
  furcationInvolvement?: string | null;
  notes?: string | null;
};

export type DentalTreatmentPlanItemFields = {
  _id?: Types.ObjectId;
  serviceId?: string | null;
  toothNumber?: number | null;
  procedureName: string;
  surfaces?: ToothSurface[];
  priority?: DentalTreatmentPriority;
  estimatedCost?: number | null;
  notes?: string | null;
  status?: DentalTreatmentStatus;
};

export type OpdDentalExaminationFields = {
  visitId: Types.ObjectId;
  consultationId?: Types.ObjectId | null;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  doctorId: Types.ObjectId;
  doctorName: string;
  branchId: Types.ObjectId;
  departmentId: Types.ObjectId;
  status: DentalExaminationStatus;
  dentalHistory?: DentalHistoryFields | null;
  softTissue?: SoftTissueFields | null;
  teeth: ToothFindingFields[];
  treatmentPlanItems: DentalTreatmentPlanItemFields[];
  completedAt?: Date | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const dentalHistorySchema = new Schema<DentalHistoryFields>(
  {
    chiefComplaint: { type: String, default: null },
    painScale: { type: Number, min: 0, max: 10, default: null },
    bleedingGums: { type: Boolean, default: null },
    sensitivityHotColdSweet: { type: Boolean, default: null },
    bruxism: { type: Boolean, default: null },
    habits: [{ type: String, trim: true }],
    medicalAlerts: [{ type: String, trim: true }],
  },
  { _id: false },
);

const softTissueSchema = new Schema<SoftTissueFields>(
  {
    gingivaCondition: { type: String, default: null },
    calculusPlaque: { type: String, default: null },
    oralMucosa: { type: String, default: null },
    tonguePalateFloor: { type: String, default: null },
    tmjEvaluation: { type: String, default: null },
    occlusionClass: { type: String, default: null },
  },
  { _id: false },
);

const toothFindingSchema = new Schema<ToothFindingFields>(
  {
    toothNumber: { type: Number, required: true },
    dentition: {
      type: String,
      enum: ['PERMANENT', 'PRIMARY'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'MISSING', 'IMPACTED', 'EXTRACTED', 'UNERUPTED'],
      default: 'PRESENT',
      required: true,
    },
    surfaces: [
      {
        type: String,
        enum: ['MESIAL', 'DISTAL', 'OCCLUSAL', 'BUCCAL', 'LINGUAL'],
      },
    ],
    conditions: [{ type: String, trim: true }],
    mobility: {
      type: String,
      enum: ['NONE', 'GRADE_I', 'GRADE_II', 'GRADE_III'],
      default: null,
    },
    pocketDepthMm: { type: Number, min: 0, max: 20, default: null },
    furcationInvolvement: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { _id: false },
);

const treatmentPlanItemSchema = new Schema<DentalTreatmentPlanItemFields>(
  {
    serviceId: { type: String, default: null, trim: true },
    toothNumber: { type: Number, default: null },
    procedureName: { type: String, required: true, trim: true },
    surfaces: [
      {
        type: String,
        enum: ['MESIAL', 'DISTAL', 'OCCLUSAL', 'BUCCAL', 'LINGUAL'],
      },
    ],
    priority: {
      type: String,
      enum: ['ROUTINE', 'URGENT', 'ELECTIVE', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'ROUTINE',
      trim: true,
    },
    estimatedCost: { type: Number, min: 0, default: null },
    notes: { type: String, default: null },
    status: {
      type: String,
      enum: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED'],
      default: 'PROPOSED',
      trim: true,
    },
  },
  { _id: true },
);

const opdDentalExaminationSchema = new Schema<OpdDentalExaminationFields>(
  {
    visitId: {
      type: Schema.Types.ObjectId,
      ref: 'OpdVisit',
      required: true,
      unique: true,
    },
    consultationId: {
      type: Schema.Types.ObjectId,
      ref: 'OpdConsultation',
      default: null,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    doctorName: { type: String, required: true },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'COMPLETED'],
      default: 'DRAFT',
      required: true,
    },
    dentalHistory: { type: dentalHistorySchema, default: null },
    softTissue: { type: softTissueSchema, default: null },
    teeth: { type: [toothFindingSchema], default: [] },
    treatmentPlanItems: { type: [treatmentPlanItemSchema], default: [] },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

opdDentalExaminationSchema.index({ patientId: 1, createdAt: -1 });
opdDentalExaminationSchema.index({ branchId: 1, departmentId: 1, createdAt: -1 });
opdDentalExaminationSchema.index({ doctorId: 1, createdAt: -1 });
opdDentalExaminationSchema.index({ status: 1, createdAt: -1 });

export const OpdDentalExaminationModel = mongoose.model<OpdDentalExaminationFields>(
  'OpdDentalExamination',
  opdDentalExaminationSchema,
);
