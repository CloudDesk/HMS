import mongoose, { Schema } from 'mongoose';

export interface RegistrationTokenFields {
  phone: string;
  tokenHash: string;
  mode: 'new' | 'guardian' | 'any';
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const registrationTokenSchema = new Schema<RegistrationTokenFields>(
  {
    phone: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    mode: { type: String, enum: ['new', 'guardian', 'any'], default: 'any' },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

registrationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const RegistrationTokenModel = mongoose.model<RegistrationTokenFields>(
  'RegistrationToken',
  registrationTokenSchema,
);
