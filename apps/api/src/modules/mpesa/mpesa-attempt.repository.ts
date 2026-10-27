import mongoose, { type ClientSession } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { MpesaAttemptModel, type MpesaAttempt, type MpesaSubmissionState } from './mpesa-attempt.model.js';

export class MpesaAttemptRepository {
  session() { return mongoose.startSession(); }
  async ensureIndexes() { await MpesaAttemptModel.init(); }
  get(id: string, session?: ClientSession) {
    return MpesaAttemptModel.findById(id).select('+payerPhone').session(session ?? null).lean();
  }
  byCheckout(environment: MpesaAttempt['environment'], checkoutRequestId: string, session?: ClientSession) {
    return MpesaAttemptModel.findOne({ environment, checkoutRequestId }).select('+payerPhone').session(session ?? null).lean();
  }
  async create(record: Omit<MpesaAttempt, 'createdAt' | 'updatedAt'>, session: ClientSession) {
    await MpesaAttemptModel.create([record], { session });
  }
  transition(id: string, version: number, from: MpesaSubmissionState, fields: Partial<MpesaAttempt>, session: ClientSession) {
    return MpesaAttemptModel.findOneAndUpdate({ _id: id, version, submissionState: from },
      { $set: fields, $inc: { version: 1 } }, { returnDocument: 'after', session }).select('+payerPhone').lean();
  }
  recordOutcome(attempt: MpesaAttempt, fields: Partial<MpesaAttempt>, session: ClientSession) {
    return MpesaAttemptModel.findOneAndUpdate({ _id: attempt._id, version: attempt.version, reportedOutcome: 'PENDING' },
      { $set: fields, $inc: { version: 1 } }, { returnDocument: 'after', session }).lean();
  }
  async audit(eventType: string, attempt: MpesaAttempt, actor: string | undefined, details: Record<string, unknown>, session: ClientSession) {
    await AuditLogModel.create([{
      eventType, actorUserId: actor,
      metadataJson: { attemptId: attempt._id, invoiceId: attempt.invoiceId, branchId: attempt.branchId,
        initiatedBy: attempt.createdBy, source: actor ? 'STAFF' : 'MPESA_CALLBACK', ...details },
    }], { session });
  }
}
