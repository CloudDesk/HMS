import mongoose, { Schema, Types } from 'mongoose';

export type OpdVitalsFields = {
  visitId: Types.ObjectId;
  patientId: Types.ObjectId;
  patientNumber: string;
  patientName: string;
  recordedAt: Date;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  bmi: number;
  temperatureC?: number | null;
  pulseBpm?: number | null;
  respiratoryRatePerMin?: number | null;
  oxygenSaturationPercent?: number | null;
  notes?: string | null;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const opdVitalsSchema = new Schema<OpdVitalsFields>(
  {
    visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    patientNumber: { type: String, required: true },
    patientName: { type: String, required: true },
    recordedAt: { type: Date, required: true, default: Date.now },
    bloodPressureSystolic: { type: Number, default: null },
    bloodPressureDiastolic: { type: Number, default: null },
    weightKg: { type: Number, default: null },
    heightCm: { type: Number, default: null },
    bmi: { type: Number, default: 0 },
    temperatureC: { type: Number, default: null },
    pulseBpm: { type: Number, default: null },
    respiratoryRatePerMin: { type: Number, default: null },
    oxygenSaturationPercent: { type: Number, default: null },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

opdVitalsSchema.index({ visitId: 1, recordedAt: -1 });
opdVitalsSchema.index({ patientId: 1, recordedAt: -1 });
opdVitalsSchema.index({ patientNumber: 1 });

export const OpdVitalsModel = mongoose.model<OpdVitalsFields>('OpdVitals', opdVitalsSchema);
