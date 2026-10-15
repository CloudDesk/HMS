import mongoose, { Schema, type Types } from 'mongoose';

export type MockRemittanceStatus = 'MOCK_REMITTED';

export type MockRemittancePayableBasis =
  | 'ADJUDICATION_APPROVED'
  | 'ADJUDICATION_PARTIAL'
  | 'APPEAL_OVERTURNED';

export interface DhaMockRemittanceAdviceLineField {
  invoiceItemId: Types.ObjectId;
  serviceId: Types.ObjectId;
  serviceCode?: string;
  quantity: number;
  claimedAmount: number;
  remittedAmount: number;
  disallowedAmount: number;
  status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED';
  denialReason?: string;
}

export type DhaMockRemittanceAdviceFields = {
  claimId: Types.ObjectId;
  sourceFingerprint: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  mockAppealReference?: string | null;
  externalRemittanceReference: string;
  source: 'MOCK';
  status: MockRemittanceStatus;
  payableBasis: MockRemittancePayableBasis;
  claimedTotal: number;
  remittedTotal: number;
  disallowedTotal: number;
  currency: string;
  lines: DhaMockRemittanceAdviceLineField[];
  remittedAt: Date;
  correlationId: string;
  actorUserId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

const lineSchema = new Schema<DhaMockRemittanceAdviceLineField>(
  {
    invoiceItemId: { type: Schema.Types.ObjectId, required: true },
    serviceId: { type: Schema.Types.ObjectId, required: true },
    serviceCode: String,
    quantity: { type: Number, required: true, min: 0 },
    claimedAmount: { type: Number, required: true, min: 0 },
    remittedAmount: { type: Number, required: true, min: 0 },
    disallowedAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['APPROVED', 'PARTIALLY_APPROVED', 'DENIED'],
      required: true,
    },
    denialReason: String,
  },
  { _id: false },
);

const schema = new Schema<DhaMockRemittanceAdviceFields>(
  {
    claimId: { type: Schema.Types.ObjectId, ref: 'InsuranceClaim', required: true },
    sourceFingerprint: { type: String, required: true },
    mockDischargeReference: { type: String, required: true },
    mockAdjudicationReference: { type: String, required: true },
    mockAppealReference: { type: String, default: null },
    externalRemittanceReference: { type: String, required: true },
    source: { type: String, enum: ['MOCK'], default: 'MOCK', required: true },
    status: {
      type: String,
      enum: ['MOCK_REMITTED'],
      default: 'MOCK_REMITTED',
      required: true,
    },
    payableBasis: {
      type: String,
      enum: ['ADJUDICATION_APPROVED', 'ADJUDICATION_PARTIAL', 'APPEAL_OVERTURNED'],
      required: true,
    },
    claimedTotal: { type: Number, required: true, min: 0 },
    remittedTotal: { type: Number, required: true, min: 0 },
    disallowedTotal: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'KES', required: true },
    lines: { type: [lineSchema], default: [] },
    remittedAt: { type: Date, default: Date.now, required: true },
    correlationId: { type: String, required: true },
    actorUserId: String,
    version: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

schema.index(
  {
    claimId: 1,
    sourceFingerprint: 1,
    mockAdjudicationReference: 1,
    mockAppealReference: 1,
  },
  { unique: true },
);
schema.index({ externalRemittanceReference: 1 }, { unique: true });
schema.index({ claimId: 1, status: 1 });

export const DhaMockRemittanceAdviceModel =
  mongoose.model<DhaMockRemittanceAdviceFields>(
    'DhaMockRemittanceAdvice',
    schema,
  );
