import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBranch extends Document {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  status: 'ACTIVE' | 'INACTIVE';
  
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const branchSchema = new Schema<IBranch>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    shortName: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', required: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
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

branchSchema.index({ name: 1 });
branchSchema.index({ deletedAt: 1, status: 1, createdAt: -1 });

export const BranchModel = mongoose.model<IBranch>('Branch', branchSchema);
