import mongoose, { Schema, Types } from 'mongoose';

type ClinicalContext = {
  admissionId: Types.ObjectId;
  patientId: Types.ObjectId;
  branchId: Types.ObjectId;
  encounterId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InpatientRoundNoteFields = ClinicalContext & {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type InpatientVitalFields = ClinicalContext & {
  bpSystolic: number;
  bpDiastolic: number;
  heartRate: number;
  temperature: number;
  spo2: number;
  respiratoryRate: number;
  painScore: number;
};

const context = {
  admissionId: { type: Schema.Types.ObjectId, ref: 'InpatientAdmission', required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  encounterId: { type: Schema.Types.ObjectId, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true, trim: true },
} as const;

const roundNoteSchema = new Schema<InpatientRoundNoteFields>({
  ...context,
  subjective: { type: String, required: true, trim: true },
  objective: { type: String, required: true, trim: true },
  assessment: { type: String, required: true, trim: true },
  plan: { type: String, required: true, trim: true },
}, { timestamps: true });
roundNoteSchema.index({ admissionId: 1, branchId: 1, createdAt: -1 });
roundNoteSchema.index({ patientId: 1, createdAt: -1 });

const vitalSchema = new Schema<InpatientVitalFields>({
  ...context,
  bpSystolic: { type: Number, required: true },
  bpDiastolic: { type: Number, required: true },
  heartRate: { type: Number, required: true },
  temperature: { type: Number, required: true },
  spo2: { type: Number, required: true },
  respiratoryRate: { type: Number, required: true },
  painScore: { type: Number, required: true },
}, { timestamps: true });
vitalSchema.index({ admissionId: 1, branchId: 1, createdAt: -1 });
vitalSchema.index({ patientId: 1, createdAt: -1 });

export const InpatientRoundNoteModel = mongoose.model<InpatientRoundNoteFields>('InpatientRoundNote', roundNoteSchema);
export const InpatientVitalModel = mongoose.model<InpatientVitalFields>('InpatientVital', vitalSchema);
