import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  id: string;
  username: string;
  email: string;
  fullName: string;
  employeeCode?: string;
  passwordHash: string;
  roleIds: Types.ObjectId[];
  branchIds: Types.ObjectId[];
  departmentIds: Types.ObjectId[];
  status: 'active' | 'inactive' | 'locked';
  
  phone?: string;
  jobTitle?: string;
  employeeType?: string;
  hireDate?: Date;
  profilePhotoUrl?: string;
  address?: string;
  patientId?: Types.ObjectId | null;

  failedLoginAttempts?: number;
  lockedUntil?: Date;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;

  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    employeeCode: { type: String },
    passwordHash: { type: String, required: true },
    
    roleIds: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    departmentIds: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    status: { type: String, enum: ['active', 'inactive', 'locked'], default: 'active', required: true },

    phone: { type: String },
    jobTitle: { type: String },
    employeeType: { type: String },
    hireDate: { type: Date },
    profilePhotoUrl: { type: String },
    address: { type: String },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', default: null },

    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },

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

userSchema.index({ deletedAt: 1, status: 1, createdAt: -1 });
userSchema.index({ branchIds: 1, deletedAt: 1 });
userSchema.index({ departmentIds: 1, deletedAt: 1 });
userSchema.index({ roleIds: 1, deletedAt: 1 });
userSchema.index({ employeeCode: 1 }, { unique: true, sparse: true });
userSchema.index(
  { patientId: 1 },
  { unique: true, partialFilterExpression: { patientId: { $type: 'objectId' } } },
);

export const UserModel = mongoose.model<IUser>('User', userSchema);
