import mongoose, { Schema, type Types } from 'mongoose';

export type DhaMockClaimPreviewIssue = {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message?: string;
  invoiceItemId?: string;
};

export type DhaMockClaimPreviewFields = {
  claimId: Types.ObjectId;
  sourceFingerprint: string;
  mockSubmissionReference: string;
  source: 'MOCK';
  status: 'PREVIEW_AVAILABLE' | 'PREVIEW_BLOCKED';
  claimedTotal: number;
  lineCount: number;
  issues: DhaMockClaimPreviewIssue[];
  previewedAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
};

const issueSchema = new Schema<DhaMockClaimPreviewIssue>(
  {
    code: { type: String, required: true },
    severity: { type: String, enum: ['ERROR', 'WARNING', 'INFO'], required: true },
    message: String,
    invoiceItemId: String,
  },
  { _id: false },
);

const schema = new Schema<DhaMockClaimPreviewFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    sourceFingerprint: { type: String, required: true },
    mockSubmissionReference: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: {
      type: String,
      enum: ['PREVIEW_AVAILABLE', 'PREVIEW_BLOCKED'],
      default: 'PREVIEW_AVAILABLE',
      required: true,
    },
    claimedTotal: { type: Number, required: true, min: 0 },
    lineCount: { type: Number, required: true, min: 0 },
    issues: { type: [issueSchema], default: [] },
    previewedAt: { type: Date, default: Date.now, required: true },
    correlationId: { type: String, required: true },
    actorUserId: String,
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

schema.index({ claimId: 1, sourceFingerprint: 1 }, { unique: true });
schema.index({ claimId: 1, createdAt: -1 });
schema.index({ mockSubmissionReference: 1 });

export const DhaMockClaimPreviewModel = mongoose.model<DhaMockClaimPreviewFields>(
  'DhaMockClaimPreview',
  schema,
);
