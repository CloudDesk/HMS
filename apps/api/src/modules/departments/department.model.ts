import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDepartment extends Document {
  id: string;
  code: string;
  name: string;
  description?: string;
  branchId: Types.ObjectId;
  status: 'ACTIVE' | 'INACTIVE';
  
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
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

departmentSchema.index({ name: 1 });
departmentSchema.index({ branchId: 1 });

export const DepartmentModel = mongoose.model<IDepartment>('Department', departmentSchema);
