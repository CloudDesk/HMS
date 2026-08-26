import mongoose, { Schema, Types } from 'mongoose';
import type { NotificationType } from './notification.types.js';

export type NotificationDocumentFields = {
  recipientRole?: string | null;
  recipientUserId?: Types.ObjectId | null;
  recipientBranchId?: Types.ObjectId | null;
  title: string;
  message: string;
  type: NotificationType;
  relatedEntityId?: Types.ObjectId | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const notificationSchema = new Schema<NotificationDocumentFields>(
  {
    recipientRole: { type: String, default: null },
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    recipientBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['REFERRAL', 'CALL_NEXT_PATIENT', 'GENERAL'], required: true },
    relatedEntityId: { type: Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ recipientRole: 1, isRead: 1 });
notificationSchema.index({ recipientRole: 1, recipientBranchId: 1, isRead: 1 });
notificationSchema.index({ recipientUserId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

export const NotificationModel = mongoose.model<NotificationDocumentFields>('Notification', notificationSchema);
