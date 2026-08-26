import mongoose, { Schema } from 'mongoose';

export interface OtpChallengeFields {
  phone: string;
  otpHash: string;
  expiresAt: Date;
  resendAvailableAt: Date;
  attempts: number;
  verifiedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const otpChallengeSchema = new Schema<OtpChallengeFields>(
  {
    phone: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    resendAvailableAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 0 },
    verifiedAt: { type: Date, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

// TTL index to automatically remove challenges after they expire
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallengeModel = mongoose.model<OtpChallengeFields>('OtpChallenge', otpChallengeSchema);
