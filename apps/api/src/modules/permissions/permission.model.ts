import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPermissionCategory extends Document {
  id: string;
  code: string;
  name: string;
  description?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const permissionCategorySchema = new Schema<IPermissionCategory>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
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

export const PermissionCategoryModel = mongoose.model<IPermissionCategory>('PermissionCategory', permissionCategorySchema);

export interface IPermissionGroup extends Document {
  id: string;
  categoryId: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const permissionGroupSchema = new Schema<IPermissionGroup>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: 'PermissionCategory', required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
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

export const PermissionGroupModel = mongoose.model<IPermissionGroup>('PermissionGroup', permissionGroupSchema);

export interface IPermission extends Document {
  id: string;
  code: string;
  name: string;
  module: string;
  screen: string;
  action: string;
  description?: string;
  type: string;
  status: string;
  categoryId?: Types.ObjectId;
  groupId?: Types.ObjectId;
  
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  deletedBy?: Types.ObjectId;
  deletedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    module: { type: String, required: true },
    screen: { type: String, required: true },
    action: { type: String, required: true },
    description: { type: String },
    type: { type: String, default: 'custom' },
    status: { type: String, default: 'active' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'PermissionCategory' },
    groupId: { type: Schema.Types.ObjectId, ref: 'PermissionGroup' },

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

export const PermissionModel = mongoose.model<IPermission>('Permission', permissionSchema);
