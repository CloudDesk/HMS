import mongoose, { Schema, type Types } from 'mongoose';

export type MockPaymentAllocationStatus = 'MOCK_ALLOCATED';

export interface DhaMockPaymentAllocationLineField {
  invoiceItemId: Types.ObjectId;
  serviceId: Types.ObjectId;
  serviceCode?: string;
  claimedAmount: number;
  remittedAmount: number;
  allocatedAmount: number;
}

export type DhaMockPaymentAllocationFields = {
  claimId: Types.ObjectId;
  remittanceAdviceId: Types.ObjectId;
  sourceFingerprint: string;
  externalRemittanceReference: string;
  externalAllocationReference: string;
  source: 'MOCK';
  status: MockPaymentAllocationStatus;
  currency: string;
  allocatedAmount: number;
  previouslyAllocatedTotal: number;
  newlyAllocatedTotal: number;
  remainingAllocatableAmount: number;
  idempotencyKey?: string | null;
  lines?: DhaMockPaymentAllocationLineField[];
  allocatedAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

const lineSchema = new Schema<DhaMockPaymentAllocationLineField>(
  {
    invoiceItemId: { type: Schema.Types.ObjectId, required: true },
    serviceId: { type: Schema.Types.ObjectId, required: true },
    serviceCode: String,
    claimedAmount: { type: Number, required: true, min: 0 },
    remittedAmount: { type: Number, required: true, min: 0 },
    allocatedAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const schema = new Schema<DhaMockPaymentAllocationFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    remittanceAdviceId: {
      type: Schema.Types.ObjectId,
      ref: 'DhaMockRemittanceAdvice',
      required: true,
    },
    sourceFingerprint: { type: String, required: true },
    externalRemittanceReference: { type: String, required: true },
    externalAllocationReference: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: {
      type: String,
      enum: ['MOCK_ALLOCATED'],
      default: 'MOCK_ALLOCATED',
      required: true,
    },
    currency: { type: String, default: 'KES', required: true },
    allocatedAmount: { type: Number, required: true, min: 0 },
    previouslyAllocatedTotal: { type: Number, required: true, min: 0 },
    newlyAllocatedTotal: { type: Number, required: true, min: 0 },
    remainingAllocatableAmount: { type: Number, required: true, min: 0 },
    idempotencyKey: { type: String, default: null },
    lines: { type: [lineSchema], default: undefined },
    allocatedAt: { type: Date, default: Date.now, required: true },
    correlationId: { type: String, required: true },
    actorUserId: String,
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

schema.index(
  { claimId: 1, remittanceAdviceId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
schema.index({ externalAllocationReference: 1 }, { unique: true });
schema.index({ remittanceAdviceId: 1, createdAt: 1 });
schema.index({ claimId: 1, createdAt: -1 });

export const DhaMockPaymentAllocationModel =
  mongoose.model<DhaMockPaymentAllocationFields>(
    'DhaMockPaymentAllocation',
    schema,
  );
