import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRole extends Document {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  color?: string;
  permissionIds: Types.ObjectId[];
  status: 'active' | 'inactive';
  
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, default: 'custom' },
    color: { type: String },
    permissionIds: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active', required: true },

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

roleSchema.index({ name: 1 });

export const RoleModel = mongoose.model<IRole>('Role', roleSchema);
