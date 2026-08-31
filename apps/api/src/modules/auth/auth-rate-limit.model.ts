import mongoose, { Schema } from 'mongoose';

export type AuthRateLimitFields = {
  _id: string;
  scope: string;
  keyHash: string;
  bucketStart: Date;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<AuthRateLimitFields>({
  _id: { type: String, required: true },
  scope: { type: String, required: true },
  keyHash: { type: String, required: true },
  bucketStart: { type: Date, required: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthRateLimitModel = mongoose.model<AuthRateLimitFields>('AuthRateLimit', schema);
