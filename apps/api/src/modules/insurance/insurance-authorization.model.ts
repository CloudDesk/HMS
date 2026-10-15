import mongoose, { Schema } from 'mongoose';
import { authorizationStatuses, type AuthorizationStatus } from './insurance-authorization.schemas.js';

const reference = (ref: string, required = true) => ({ type: Schema.Types.ObjectId, ref, required });
const lineSchema = new Schema({
  serviceId: reference('Service'), serviceCode: { type: String, required: true },
  requestedQuantity: { type: Number, required: true, min: 1 },
  requestedAmount: Number,
  approvedQuantity: Number, approvedAmount: Number, rejectedQuantity: Number,
}, { _id: false });
const historySchema = new Schema({
  from: { type: String, enum: authorizationStatuses },
  to: { type: String, enum: authorizationStatuses, required: true },
  actorId: reference('User'), at: { type: Date, required: true },
  correlationId: { type: String, required: true }, reason: String,
}, { _id: false });
type AuthorizationFields = {
  memberId: mongoose.Types.ObjectId; patientId: mongoose.Types.ObjectId; policyId: mongoose.Types.ObjectId;
  payerId: mongoose.Types.ObjectId; schemeId?: mongoose.Types.ObjectId | null; branchId: mongoose.Types.ObjectId;
  encounterId?: mongoose.Types.ObjectId; requestingDoctorId?: mongoose.Types.ObjectId; clinicalDocumentId?: mongoose.Types.ObjectId;
  authorizationContext: string; requestedDate: string; correlationId: string; externalReference?: string;
  status: AuthorizationStatus; integrationMode: 'UNAVAILABLE' | 'MOCK' | 'LIVE'; reasonCode?: string; decisionDate?: Date;
  fingerprint: string; version: number; createdAt: Date; updatedAt: Date;
  lines: mongoose.InferSchemaType<typeof lineSchema>[];
  history: mongoose.InferSchemaType<typeof historySchema>[];
};
const schema = new Schema<AuthorizationFields>({
  memberId: reference('InsuranceMember'), patientId: reference('Patient'),
  policyId: reference('InsurancePolicy'), payerId: reference('Payer'), schemeId: reference('InsuranceScheme', false),
  branchId: reference('Branch'), encounterId: reference('OpdVisit', false),
  requestingDoctorId: reference('Doctor', false), clinicalDocumentId: reference('PatientDocument', false),
  authorizationContext: { type: String, required: true }, requestedDate: { type: String, required: true },
  correlationId: { type: String, required: true }, externalReference: String,
  status: { type: String, enum: authorizationStatuses, required: true },
  integrationMode: { type: String, enum: ['UNAVAILABLE', 'MOCK', 'LIVE'], required: true },
  reasonCode: String, decisionDate: Date,
  fingerprint: { type: String, required: true }, version: { type: Number, default: 0, required: true },
  lines: { type: [lineSchema], required: true }, history: { type: [historySchema], required: true },
}, { timestamps: true });
schema.index({ fingerprint: 1 }, { unique: true });
schema.index({ correlationId: 1 }, { unique: true });
schema.index({ branchId: 1, createdAt: -1 });
schema.index({ memberId: 1, status: 1 });
export const InsuranceAuthorizationModel = mongoose.model('InsuranceAuthorization', schema);
export type AuthorizationRecord = AuthorizationFields & { _id: mongoose.Types.ObjectId };
