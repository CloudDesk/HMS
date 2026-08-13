import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPasswordResetToken extends Document {
  tokenHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

export const PasswordResetTokenModel = mongoose.model<IPasswordResetToken>('PasswordResetToken', passwordResetTokenSchema);

export interface IAuditLog extends Document {
  eventType: string;
  actorUserId?: string;
  subjectUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadataJson?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    eventType: { type: String, required: true },
    actorUserId: { type: String },
    subjectUserId: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadataJson: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ eventType: 1, createdAt: -1 });
auditLogSchema.index({ 'metadataJson.roleId': 1, createdAt: -1 });

export const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
