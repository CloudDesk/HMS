import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  token: string;
  userId: string | Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
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
