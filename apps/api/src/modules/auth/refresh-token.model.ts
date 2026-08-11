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
      transform: (_, ret) => {
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      },
    },
  },
);

export const RefreshTokenModel = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);
