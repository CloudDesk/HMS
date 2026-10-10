import mongoose, { Schema, type Types } from 'mongoose';

export type MockClaimQueryStatus = 'OPEN' | 'RESPONSE_SUBMITTED' | 'MOCK_RESOLVED';

export interface DhaMockClaimQueryResponseItem {
  responseReference: string;
  responseNote: string;
  documentIds?: Types.ObjectId[];
  respondedAt: Date;
  respondedBy?: string;
  correlationId: string;
  simulatedOutcome: 'RESPONSE_SUBMITTED' | 'MOCK_RESOLVED';
}

export type DhaMockClaimQueryFields = {
  claimId: Types.ObjectId;
  sourceFingerprint: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  externalQueryReference: string;
  queryReason: string;
  source: 'MOCK';
  status: MockClaimQueryStatus;
  responses: DhaMockClaimQueryResponseItem[];
  createdAt: Date;
  updatedAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
};

const responseItemSchema = new Schema<DhaMockClaimQueryResponseItem>(
  {
    responseReference: { type: String, required: true },
    responseNote: { type: String, required: true },
    documentIds: { type: [Schema.Types.ObjectId], default: [] },
    respondedAt: { type: Date, default: Date.now, required: true },
    respondedBy: String,
    correlationId: { type: String, required: true },
    simulatedOutcome: {
      type: String,
      enum: ['RESPONSE_SUBMITTED', 'MOCK_RESOLVED'],
      required: true,
    },
  },
  { _id: false },
);

const schema = new Schema<DhaMockClaimQueryFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    sourceFingerprint: { type: String, required: true },
    mockDischargeReference: { type: String, required: true },
    mockAdjudicationReference: { type: String, required: true },
    externalQueryReference: { type: String, required: true },
    queryReason: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: {
      type: String,
      enum: ['OPEN', 'RESPONSE_SUBMITTED', 'MOCK_RESOLVED'],
      default: 'OPEN',
      required: true,
    },
    responses: { type: [responseItemSchema], default: [] },
    correlationId: { type: String, required: true },
    actorUserId: String,
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

schema.index(
  { claimId: 1, sourceFingerprint: 1, mockAdjudicationReference: 1 },
  { unique: true },
);
schema.index({ externalQueryReference: 1 }, { unique: true });
schema.index({ claimId: 1, status: 1 });
schema.index({ claimId: 1, createdAt: -1 });

export const DhaMockClaimQueryModel = mongoose.model<DhaMockClaimQueryFields>(
  'DhaMockClaimQuery',
  schema,
);
