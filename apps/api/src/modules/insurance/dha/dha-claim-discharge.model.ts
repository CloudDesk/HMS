import mongoose, { Schema, type Types } from 'mongoose';

export type DhaMockClaimDischargeFields = {
  claimId: Types.ObjectId;
  sourceFingerprint: string;
  mockSubmissionReference: string;
  externalDischargeReference: string;
  source: 'MOCK';
  status: 'MOCK_DISCHARGED';
  claimedTotal: number;
  lineCount: number;
  dischargedAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
};

const schema = new Schema<DhaMockClaimDischargeFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    sourceFingerprint: { type: String, required: true },
    mockSubmissionReference: { type: String, required: true },
    externalDischargeReference: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: {
      type: String,
      enum: ['MOCK_DISCHARGED'],
      default: 'MOCK_DISCHARGED',
      required: true,
    },
    claimedTotal: { type: Number, required: true, min: 0 },
    lineCount: { type: Number, required: true, min: 0 },
    dischargedAt: { type: Date, default: Date.now, required: true },
    correlationId: { type: String, required: true },
    actorUserId: String,
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

schema.index({ claimId: 1, sourceFingerprint: 1 }, { unique: true });
schema.index({ externalDischargeReference: 1 }, { unique: true });
schema.index({ claimId: 1, createdAt: -1 });

export const DhaMockClaimDischargeModel = mongoose.model<DhaMockClaimDischargeFields>(
  'DhaMockClaimDischarge',
  schema,
);
