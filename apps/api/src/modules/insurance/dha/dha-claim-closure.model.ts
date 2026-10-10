import mongoose, { Schema, type Types } from 'mongoose';

export type MockClaimClosureStatus =
  | 'MOCK_CLOSED_RECONCILED'
  | 'MOCK_CLOSED_NO_SETTLEMENT';

export type MockClaimClosurePath =
  | 'SETTLEMENT_RECONCILED'
  | 'NO_SETTLEMENT_REJECTED';

export type DhaMockClaimClosureFields = {
  claimId: Types.ObjectId;
  sourceFingerprint: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  mockAppealReference?: string | null;
  mockRemittanceReference?: string | null;
  mockReconciliationReference?: string | null;
  externalClosureReference: string;
  source: 'MOCK';
  status: MockClaimClosureStatus;
  closurePath: MockClaimClosurePath;
  closureReason: string;
  claimedTotal: number;
  remittedTotal: number;
  allocatedTotal: number;
  reconciledTotal: number;
  closureSnapshotFingerprint: string;
  idempotencyKey?: string | null;
  closedAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<DhaMockClaimClosureFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    sourceFingerprint: { type: String, required: true },
    mockDischargeReference: { type: String, required: true },
    mockAdjudicationReference: { type: String, required: true },
    mockAppealReference: { type: String, default: null },
    mockRemittanceReference: { type: String, default: null },
    mockReconciliationReference: { type: String, default: null },
    externalClosureReference: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: {
      type: String,
      enum: ['MOCK_CLOSED_RECONCILED', 'MOCK_CLOSED_NO_SETTLEMENT'],
      required: true,
    },
    closurePath: {
      type: String,
      enum: ['SETTLEMENT_RECONCILED', 'NO_SETTLEMENT_REJECTED'],
      required: true,
    },
    closureReason: { type: String, required: true },
    claimedTotal: { type: Number, required: true, min: 0 },
    remittedTotal: { type: Number, default: 0, required: true, min: 0 },
    allocatedTotal: { type: Number, default: 0, required: true, min: 0 },
    reconciledTotal: { type: Number, default: 0, required: true, min: 0 },
    closureSnapshotFingerprint: { type: String, required: true },
    idempotencyKey: { type: String, default: null },
    closedAt: { type: Date, default: Date.now, required: true },
    correlationId: { type: String, required: true },
    actorUserId: String,
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

schema.index(
  { claimId: 1, closureSnapshotFingerprint: 1 },
  { unique: true },
);
schema.index({ externalClosureReference: 1 }, { unique: true });
schema.index(
  { claimId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
schema.index({ claimId: 1, createdAt: -1 });

export const DhaMockClaimClosureModel =
  mongoose.model<DhaMockClaimClosureFields>(
    'DhaMockClaimClosure',
    schema,
  );
