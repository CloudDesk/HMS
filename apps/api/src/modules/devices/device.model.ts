import { Schema, model, type Document, Types } from 'mongoose';
import type { DevicePlatform } from './device.types.js';

export interface MobileDeviceDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  installationId: string;
  deviceId?: string;
  platform: DevicePlatform;
  pushToken: string;
  appVersion?: string;
  osVersion?: string;
  isActive: boolean;
  lastRegisteredAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mobileDeviceSchema = new Schema<MobileDeviceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    installationId: { type: String, required: true, index: true },
    deviceId: { type: String, default: null },
    platform: { type: String, enum: ['android', 'ios'], required: true },
    pushToken: { type: String, required: true, index: true },
    appVersion: { type: String, default: null },
    osVersion: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    lastRegisteredAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'mobile_devices',
  }
);

mobileDeviceSchema.index({ userId: 1, isActive: 1 });
mobileDeviceSchema.index({ installationId: 1, userId: 1 }, { unique: true });
mobileDeviceSchema.index(
  { pushToken: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

export const MobileDeviceModel = model<MobileDeviceDocument>('MobileDevice', mobileDeviceSchema);
