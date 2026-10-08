import mongoose, { Schema, Types } from 'mongoose';
export const claimStatuses = ['DRAFT', 'VALIDATED', 'SUBMITTED', 'ACKNOWLEDGED', 'QUERIED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PAID', 'CLOSED', 'CANCELLED'] as const;
export type ClaimIssueSeverity = 'ERROR' | 'WARNING' | 'INFO';
export type ClaimIssue = { code: string; severity: ClaimIssueSeverity; message?: string; invoiceItemId?: string };
export type ClaimLine = {
  invoiceItemId: Types.ObjectId; serviceId: Types.ObjectId; serviceCode: string;
  quantity: number; claimedUnitAmount: number; claimedAmount: number;
  mappingId?: Types.ObjectId; interventionCode?: string; authorizationId?: Types.ObjectId;
  benefitStatus: string; readiness: 'NOT_READY_FOR_SHA_SUBMISSION'; issues: ClaimIssue[];
};
export type ClaimFields = {
  patientId: Types.ObjectId; memberId: Types.ObjectId; policyId: Types.ObjectId; payerId: Types.ObjectId;
  schemeId?: Types.ObjectId | null; branchId: Types.ObjectId; encounterId: Types.ObjectId; invoiceId: Types.ObjectId;
  serviceDate: string; status: typeof claimStatuses[number]; version: number; sourceFingerprint: string;
  lines: ClaimLine[]; claimedTotal: number; readyForShaSubmission: boolean; issues: ClaimIssue[];
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date;
};
const ref = (name: string) => ({ type: Schema.Types.ObjectId, ref: name, required: true });
const issue = new Schema<ClaimIssue>({ code: { type: String, required: true }, severity: { type: String, enum: ['ERROR', 'WARNING', 'INFO'], required: true }, message: String, invoiceItemId: String }, { _id: false });
const line = new Schema<ClaimLine>({
  invoiceItemId: ref('BillingInvoiceItem'), serviceId: ref('Service'), serviceCode: { type: String, required: true },
  quantity: { type: Number, min: 1, required: true }, claimedUnitAmount: { type: Number, min: 0, required: true }, claimedAmount: { type: Number, min: 0, required: true },
  mappingId: { type: Schema.Types.ObjectId, ref: 'ShaServiceMapping' }, interventionCode: String,
  authorizationId: { type: Schema.Types.ObjectId, ref: 'InsuranceAuthorization' }, benefitStatus: { type: String, required: true },
  readiness: { type: String, enum: ['NOT_READY_FOR_SHA_SUBMISSION'], required: true }, issues: [issue],
}, { _id: false });
const schema = new Schema<ClaimFields>({
  patientId: ref('Patient'), memberId: ref('InsuranceMember'), policyId: ref('InsurancePolicy'), payerId: ref('Payer'),
  schemeId: { type: Schema.Types.ObjectId, ref: 'InsuranceScheme' }, branchId: ref('Branch'), encounterId: ref('OpdVisit'), invoiceId: ref('BillingInvoice'),
  serviceDate: { type: String, required: true }, status: { type: String, enum: claimStatuses, required: true, default: 'DRAFT' },
  version: { type: Number, default: 0, required: true }, sourceFingerprint: { type: String, required: true },
  lines: [line], claimedTotal: { type: Number, min: 0, required: true }, readyForShaSubmission: { type: Boolean, default: false }, issues: [issue],
  createdBy: ref('User'), updatedBy: ref('User'),
}, { timestamps: true });
schema.index({ invoiceId: 1, memberId: 1 }, { unique: true });
schema.index({ branchId: 1, createdAt: -1 });
export const InsuranceClaimModel = mongoose.model<ClaimFields>('InsuranceClaim', schema);
