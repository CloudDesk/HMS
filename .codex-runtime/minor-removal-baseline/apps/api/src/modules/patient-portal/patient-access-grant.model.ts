import mongoose, { Schema, Types } from 'mongoose';

export type PatientAccessRelationship = 'SELF' | 'PARENT' | 'LEGAL_GUARDIAN';
export type PatientAccessGrantFields = {
  userId: Types.ObjectId;
  patientId: Types.ObjectId;
  relationship: PatientAccessRelationship;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED';
  isPrimary: boolean;
  verifiedBy?: Types.ObjectId | null;
  verifiedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const patientAccessGrantSchema = new Schema<PatientAccessGrantFields>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    relationship: { type: String, enum: ['SELF', 'PARENT', 'LEGAL_GUARDIAN'], required: true },
    status: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED', 'REVOKED'], default: 'VERIFIED', required: true },
    isPrimary: { type: Boolean, default: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

patientAccessGrantSchema.index({ userId: 1, patientId: 1 }, { unique: true });
patientAccessGrantSchema.index({ userId: 1, status: 1, createdAt: -1 });
patientAccessGrantSchema.index({ patientId: 1, status: 1 });

export const PatientAccessGrantModel = mongoose.model<PatientAccessGrantFields>(
  'PatientAccessGrant',
  patientAccessGrantSchema,
);
