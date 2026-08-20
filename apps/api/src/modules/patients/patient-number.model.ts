import mongoose, { Schema } from 'mongoose';

type PatientNumberSequenceFields = {
  key: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
};

const patientNumberSequenceSchema = new Schema<PatientNumberSequenceFields>({
  key: { type: String, required: true, unique: true },
  value: { type: Number, required: true, min: 0 },
}, { timestamps: true });

export const PatientNumberSequenceModel = mongoose.model<PatientNumberSequenceFields>(
  'PatientNumberSequence',
  patientNumberSequenceSchema,
);
