import mongoose, { Schema, type Types } from 'mongoose';

export type DhaMockClaimSubmissionFields = {
  claimId: Types.ObjectId;
  sourceFingerprint: string;
  externalReference: string;
  source: 'MOCK';
  status: 'SUBMITTED';
  claimedTotal: number;
  submittedAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
};

const schema = new Schema<DhaMockClaimSubmissionFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    sourceFingerprint: { type: String, required: true },
    externalReference: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: { type: String, enum: ['SUBMITTED'], default: 'SUBMITTED', required: true },
    claimedTotal: { type: Number, required: true, min: 0 },
    submittedAt: { type: Date, default: Date.now, required: true },
    correlationId: { type: String, required: true },
    actorUserId: String,
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

schema.index({ claimId: 1, sourceFingerprint: 1 }, { unique: true });
schema.index({ externalReference: 1 }, { unique: true });
schema.index({ claimId: 1, createdAt: -1 });

export const DhaMockClaimSubmissionModel = mongoose.model<DhaMockClaimSubmissionFields>(
  'DhaMockClaimSubmission',
  schema,
);
