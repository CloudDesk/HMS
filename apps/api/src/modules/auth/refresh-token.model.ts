import mongoose, { Schema, Document, Types } from 'mongoose';

export type NativeRefreshMetadata = {
  sessionId: Types.ObjectId;
  replacedBy?: Types.ObjectId;
  // Only the first token in the family carries session metadata.
  session?: {
    installationId: string;
    platform: 'android' | 'ios';
    appVersion?: string;
    lastUsedAt: Date;
    revokedAt?: Date;
  };
};

export interface IRefreshToken extends Document {
  token: string;
  userId: string | Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  native?: NativeRefreshMetadata;
  // Legacy repository writes these with strict:false. Do not change web schema semantics.
  revokedAt?: Date;
}

const nativeSessionSchema = new Schema({
  installationId: { type: String, required: true },
  platform: { type: String, enum: ['android', 'ios'], required: true },
  appVersion: { type: String },
  lastUsedAt: { type: Date, required: true },
  revokedAt: { type: Date },
}, { _id: false });

const nativeRefreshSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, required: true },
  replacedBy: { type: Schema.Types.ObjectId },
  session: { type: nativeSessionSchema, default: undefined },
}, { _id: false });

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    native: { type: nativeRefreshSchema, default: undefined },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
