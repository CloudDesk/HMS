import mongoose, { Schema, type Types } from 'mongoose';

export type MockPaymentReconciliationStatus =
  | 'MOCK_RECONCILED'
  | 'MOCK_PARTIALLY_RECONCILED'
  | 'MOCK_DISCREPANCY';

export type DhaMockPaymentReconciliationFields = {
  claimId: Types.ObjectId;
  remittanceAdviceId: Types.ObjectId;
  sourceFingerprint: string;
  externalRemittanceReference: string;
  externalReconciliationReference: string;
  source: 'MOCK';
  status: MockPaymentReconciliationStatus;
  currency: string;
  remittedTotal: number;
  allocatedTotal: number;
  unallocatedAmount: number;
  allocationDifference: number;
  allocationCount: number;
  allocationIds: Types.ObjectId[];
  discrepancyReasons?: string[];
  snapshotFingerprint: string;
  idempotencyKey?: string | null;
  reconciledAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<DhaMockPaymentReconciliationFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    remittanceAdviceId: {
      type: Schema.Types.ObjectId,
      ref: 'DhaMockRemittanceAdvice',
      required: true,
    },
    sourceFingerprint: { type: String, required: true },
    externalRemittanceReference: { type: String, required: true },
    externalReconciliationReference: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: {
      type: String,
      enum: ['MOCK_RECONCILED', 'MOCK_PARTIALLY_RECONCILED', 'MOCK_DISCREPANCY'],
      required: true,
    },
    currency: { type: String, default: 'KES', required: true },
    remittedTotal: { type: Number, required: true, min: 0 },
    allocatedTotal: { type: Number, required: true, min: 0 },
    unallocatedAmount: { type: Number, required: true, min: 0 },
    allocationDifference: { type: Number, default: 0, required: true, min: 0 },
    allocationCount: { type: Number, default: 0, required: true, min: 0 },
    allocationIds: { type: [Schema.Types.ObjectId], default: [] },
    discrepancyReasons: { type: [String], default: undefined },
    snapshotFingerprint: { type: String, required: true },
    idempotencyKey: { type: String, default: null },
    reconciledAt: { type: Date, default: Date.now, required: true },
    correlationId: { type: String, required: true },
    actorUserId: String,
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

schema.index(
  { claimId: 1, remittanceAdviceId: 1, snapshotFingerprint: 1 },
  { unique: true },
);
schema.index({ externalReconciliationReference: 1 }, { unique: true });
schema.index(
  { claimId: 1, remittanceAdviceId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
schema.index({ remittanceAdviceId: 1, createdAt: -1 });
schema.index({ claimId: 1, createdAt: -1 });

export const DhaMockPaymentReconciliationModel =
  mongoose.model<DhaMockPaymentReconciliationFields>(
    'DhaMockPaymentReconciliation',
    schema,
  );
