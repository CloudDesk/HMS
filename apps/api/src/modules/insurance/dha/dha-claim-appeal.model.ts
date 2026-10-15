import mongoose, { Schema, type Types } from 'mongoose';

export type MockClaimAppealStatus =
  | 'OPEN'
  | 'SUBMITTED'
  | 'MOCK_UPHELD'
  | 'MOCK_OVERTURNED';

export interface DhaMockClaimAppealSubmissionItem {
  submissionReference: string;
  appealNote: string;
  documentIds?: Types.ObjectId[];
  submittedAt: Date;
  submittedBy?: string;
  correlationId: string;
  simulatedOutcome: MockClaimAppealStatus;
  decisionReason?: string;
}

export type DhaMockClaimAppealFields = {
  claimId: Types.ObjectId;
  sourceFingerprint: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  externalAppealReference: string;
  appealReason: string;
  source: 'MOCK';
  status: MockClaimAppealStatus;
  submissions: DhaMockClaimAppealSubmissionItem[];
  createdAt: Date;
  updatedAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
};

const submissionItemSchema = new Schema<DhaMockClaimAppealSubmissionItem>(
  {
    submissionReference: { type: String, required: true },
    appealNote: { type: String, required: true },
    documentIds: { type: [Schema.Types.ObjectId], default: [] },
    submittedAt: { type: Date, default: Date.now, required: true },
    submittedBy: String,
    correlationId: { type: String, required: true },
    simulatedOutcome: {
      type: String,
      enum: ['SUBMITTED', 'MOCK_UPHELD', 'MOCK_OVERTURNED'],
      required: true,
    },
    decisionReason: String,
  },
  { _id: false },
);

const schema = new Schema<DhaMockClaimAppealFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    sourceFingerprint: { type: String, required: true },
    mockDischargeReference: { type: String, required: true },
    mockAdjudicationReference: { type: String, required: true },
    externalAppealReference: { type: String, required: true },
    appealReason: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: {
      type: String,
      enum: ['OPEN', 'SUBMITTED', 'MOCK_UPHELD', 'MOCK_OVERTURNED'],
      default: 'OPEN',
      required: true,
    },
    submissions: { type: [submissionItemSchema], default: [] },
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
schema.index({ externalAppealReference: 1 }, { unique: true });
schema.index({ claimId: 1, status: 1 });

export const DhaMockClaimAppealModel = mongoose.model<DhaMockClaimAppealFields>(
  'DhaMockClaimAppeal',
  schema,
);
