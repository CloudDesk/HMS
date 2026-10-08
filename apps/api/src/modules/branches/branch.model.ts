import mongoose, { Schema, Document, Types } from 'mongoose';

export interface BranchIdentifierFields {
  _id: Types.ObjectId;
  identifierType: string;
  value: string;
  issuingAuthority: string;
  status: 'ACTIVE' | 'INACTIVE' | 'REVOKED';
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  verifiedAt?: Date | null;
  verifiedBy?: Types.ObjectId | null;
}

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
  identifiers?: BranchIdentifierFields[];
  
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const branchIdentifierSchema = new Schema<BranchIdentifierFields>(
  {
    identifierType: { type: String, required: true },
    value: { type: String, required: true, trim: true },
    issuingAuthority: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'REVOKED'],
      default: 'ACTIVE',
      required: true,
    },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true, timestamps: false },
);

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
    identifiers: { type: [branchIdentifierSchema], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
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

branchSchema.index({ name: 1 });
branchSchema.index({ deletedAt: 1, status: 1, createdAt: -1 });
branchSchema.index(
  { 'identifiers.value': 1, 'identifiers.issuingAuthority': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'identifiers.status': 'ACTIVE',
      deletedAt: null,
    },
  },
);
branchSchema.index({ 'identifiers.identifierType': 1, 'identifiers.status': 1 });

export const BranchModel = mongoose.model<IBranch>('Branch', branchSchema);

