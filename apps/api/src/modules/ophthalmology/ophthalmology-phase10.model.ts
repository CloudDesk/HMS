import mongoose, { Schema, Types } from 'mongoose';
import type { OphthalmologyPublicationSourceType, OphthalmologyPublicationStatus } from './ophthalmology-phase10.types.js';
import type { OphthalmologyAttachmentProvenance, OphthalmologyAttachmentPublicationState,
  OphthalmologyAttachmentReviewState } from './ophthalmology-phase10.types.js';

export type OphthalmologyAttachmentFields = {
  contextId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId; departmentId: Types.ObjectId;
  taskId: Types.ObjectId; resultId?: Types.ObjectId | null; patientDocumentId: Types.ObjectId; testCode: string; laterality: string;
  deviceCode?: string | null; acquiredAt: Date; provenance: OphthalmologyAttachmentProvenance; checksumSha256: string;
  mimeType: string; fileSizeBytes: number; originalFileName: string; reviewState: OphthalmologyAttachmentReviewState;
  publicationState: OphthalmologyAttachmentPublicationState; idempotencyKey: string; requestFingerprint: string;
  uploadedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};

const attachmentSchema = new Schema<OphthalmologyAttachmentFields>({
  contextId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyContext', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyTestTask', required: true },
  resultId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyTestResult', default: null },
  patientDocumentId: { type: Schema.Types.ObjectId, ref: 'PatientDocument', required: true },
  testCode: { type: String, required: true, trim: true, uppercase: true },
  laterality: { type: String, enum: ['OD', 'OS', 'OU', 'NOT_APPLICABLE'], required: true },
  deviceCode: { type: String, default: null, trim: true, uppercase: true },
  acquiredAt: { type: Date, required: true },
  provenance: { type: String, enum: ['MANUAL_UPLOAD', 'DEVICE_IMPORT'], required: true },
  checksumSha256: { type: String, required: true, minlength: 64, maxlength: 64 },
  mimeType: { type: String, required: true, trim: true }, fileSizeBytes: { type: Number, min: 1, required: true },
  originalFileName: { type: String, required: true, trim: true },
  reviewState: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING', required: true },
  publicationState: { type: String, enum: ['INTERNAL', 'APPROVED_FOR_PORTAL', 'WITHDRAWN'], default: 'INTERNAL', required: true },
  idempotencyKey: { type: String, required: true, trim: true }, requestFingerprint: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
attachmentSchema.index({ patientDocumentId: 1, patientId: 1 });
attachmentSchema.index({ taskId: 1, patientDocumentId: 1 }, { unique: true });
attachmentSchema.index({ branchId: 1, idempotencyKey: 1 }, { unique: true });
attachmentSchema.index({ branchId: 1, taskId: 1, acquiredAt: -1 });
attachmentSchema.index({ patientId: 1, visitId: 1, acquiredAt: -1 });
attachmentSchema.index({ resultId: 1, reviewState: 1, publicationState: 1 });
export const OphthalmologyAttachmentModel = mongoose.model<OphthalmologyAttachmentFields>('OphthalmologyAttachment', attachmentSchema);

export type OphthalmologyPublicationFields = {
  contextId: Types.ObjectId; visitId: Types.ObjectId; patientId: Types.ObjectId; branchId: Types.ObjectId; departmentId: Types.ObjectId;
  sourceType: OphthalmologyPublicationSourceType; sourceId: Types.ObjectId; sourceVersion: number;
  status: OphthalmologyPublicationStatus; portalPayload: Record<string, unknown>;
  idempotencyKey: string; requestFingerprint: string; publishedBy: Types.ObjectId; publishedAt: Date;
  withdrawnBy?: Types.ObjectId | null; withdrawnAt?: Date | null; withdrawalReason?: string | null;
  version: number; createdAt: Date; updatedAt: Date;
};

const publicationSchema = new Schema<OphthalmologyPublicationFields>({
  contextId: { type: Schema.Types.ObjectId, ref: 'OphthalmologyContext', required: true },
  visitId: { type: Schema.Types.ObjectId, ref: 'OpdVisit', required: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  sourceType: { type: String, enum: ['CONSULTATION_SUMMARY', 'OPTICAL_PRESCRIPTION', 'TEST_RESULT'], required: true },
  sourceId: { type: Schema.Types.ObjectId, required: true }, sourceVersion: { type: Number, min: 1, required: true },
  status: { type: String, enum: ['APPROVED_FOR_PORTAL', 'WITHDRAWN'], required: true },
  portalPayload: { type: Schema.Types.Mixed, required: true }, idempotencyKey: { type: String, required: true },
  requestFingerprint: { type: String, required: true }, publishedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  publishedAt: { type: Date, required: true }, withdrawnBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  withdrawnAt: { type: Date, default: null }, withdrawalReason: { type: String, default: null },
  version: { type: Number, min: 0, default: 0, required: true },
}, { timestamps: true });

publicationSchema.index({ patientId: 1, status: 1, sourceType: 1, 'portalPayload.report_document_ids': 1 });
publicationSchema.index({ branchId: 1, status: 1, publishedAt: -1 });
publicationSchema.index({ patientId: 1, status: 1, publishedAt: -1 });
publicationSchema.index({ visitId: 1, status: 1, publishedAt: -1 });
publicationSchema.index({ branchId: 1, idempotencyKey: 1 }, { unique: true });
publicationSchema.index({ sourceType: 1, sourceId: 1, sourceVersion: 1 }, {
  unique: true, partialFilterExpression: { status: 'APPROVED_FOR_PORTAL' },
});

export const OphthalmologyPublicationModel = mongoose.model<OphthalmologyPublicationFields>(
  'OphthalmologyPublication', publicationSchema,
);

export type OphthalmologyDashboardSnapshotFields = {
  branchId: Types.ObjectId; departmentIds: Types.ObjectId[]; generatedAt: Date; metrics: Record<string, number>; createdAt: Date; updatedAt: Date;
};
const dashboardSnapshotSchema = new Schema<OphthalmologyDashboardSnapshotFields>({
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, unique: true },
  departmentIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Department' }], default: [] },
  generatedAt: { type: Date, required: true }, metrics: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });
dashboardSnapshotSchema.index({ generatedAt: -1 });
export const OphthalmologyDashboardSnapshotModel = mongoose.model<OphthalmologyDashboardSnapshotFields>(
  'OphthalmologyDashboardSnapshot', dashboardSnapshotSchema,
);
