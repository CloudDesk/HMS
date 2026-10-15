import mongoose, { Schema, type Types } from 'mongoose';

export type MockAdjudicationStatus =
  | 'MOCK_PENDING'
  | 'MOCK_APPROVED'
  | 'MOCK_PARTIALLY_APPROVED'
  | 'MOCK_REJECTED'
  | 'MOCK_QUERY';

export interface DhaMockClaimAdjudicationLineField {
  invoiceItemId: Types.ObjectId;
  serviceId: Types.ObjectId;
  serviceCode?: string;
  quantity: number;
  claimedAmount: number;
  adjudicatedAmount: number;
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
}

export type DhaMockClaimAdjudicationFields = {
  claimId: Types.ObjectId;
  sourceFingerprint: string;
  mockDischargeReference: string;
  externalAdjudicationReference: string;
  source: 'MOCK';
  status: MockAdjudicationStatus;
  claimedTotal: number;
  adjudicatedTotal: number;
  lines: DhaMockClaimAdjudicationLineField[];
  adjudicatedAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
};

const lineSchema = new Schema<DhaMockClaimAdjudicationLineField>(
  {
    invoiceItemId: { type: Schema.Types.ObjectId, required: true },
    serviceId: { type: Schema.Types.ObjectId, required: true },
    serviceCode: String,
    quantity: { type: Number, required: true, min: 0 },
    claimedAmount: { type: Number, required: true, min: 0 },
    adjudicatedAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['APPROVED', 'REJECTED'], required: true },
    reason: String,
  },
  { _id: false },
);

const schema = new Schema<DhaMockClaimAdjudicationFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    sourceFingerprint: { type: String, required: true },
    mockDischargeReference: { type: String, required: true },
    externalAdjudicationReference: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: {
      type: String,
      enum: [
        'MOCK_PENDING',
        'MOCK_APPROVED',
        'MOCK_PARTIALLY_APPROVED',
        'MOCK_REJECTED',
        'MOCK_QUERY',
      ],
      default: 'MOCK_APPROVED',
      required: true,
    },
    claimedTotal: { type: Number, required: true, min: 0 },
    adjudicatedTotal: { type: Number, required: true, min: 0 },
    lines: { type: [lineSchema], default: [] },
    adjudicatedAt: { type: Date, default: Date.now, required: true },
    correlationId: { type: String, required: true },
    actorUserId: String,
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

schema.index({ claimId: 1, sourceFingerprint: 1 }, { unique: true });
schema.index({ externalAdjudicationReference: 1 }, { unique: true });
schema.index({ claimId: 1, createdAt: -1 });

export const DhaMockClaimAdjudicationModel = mongoose.model<DhaMockClaimAdjudicationFields>(
  'DhaMockClaimAdjudication',
  schema,
);
