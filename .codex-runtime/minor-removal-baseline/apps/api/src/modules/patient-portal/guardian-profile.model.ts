import mongoose, { Schema, Types } from 'mongoose';

export type GuardianRelationship = 'PARENT' | 'LEGAL_GUARDIAN';

type GuardianProfileFields = {
  userId: Types.ObjectId;
  fullName: string;
  phone: string;
  email: string;
  relationship: GuardianRelationship;
  address: { line1?: string | null; city?: string | null; state?: string | null; country?: string | null; postalCode?: string | null };
  identification: { type?: string | null; number?: string | null };
  legalConsentAccepted: boolean;
  legalConsentAcceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const guardianProfileSchema = new Schema<GuardianProfileFields>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  relationship: { type: String, enum: ['PARENT', 'LEGAL_GUARDIAN'], required: true },
  address: {
    line1: { type: String, default: null }, city: { type: String, default: null }, state: { type: String, default: null },
    country: { type: String, default: null }, postalCode: { type: String, default: null },
  },
  identification: { type: { type: String, default: null }, number: { type: String, default: null } },
  legalConsentAccepted: { type: Boolean, required: true },
  legalConsentAcceptedAt: { type: Date, required: true },
}, { timestamps: true });

export const GuardianProfileModel = mongoose.model<GuardianProfileFields>('GuardianProfile', guardianProfileSchema);
