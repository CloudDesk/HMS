import mongoose, { type ClientSession } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { MpesaAttemptModel, type MpesaAttempt, type MpesaSubmissionState } from './mpesa-attempt.model.js';

export type ListMpesaAttemptsFilter = {
  branchIds?: string[];
  invoiceId?: string;
  submissionState?: string;
  verificationStatus?: string;
  postingStatus?: string;
  unresolvedOnly?: boolean;
  exceptionsOnly?: boolean;
  page: number;
  limit: number;
};

export class MpesaAttemptRepository {
  session() {
    return mongoose.startSession();
  }

  async ensureIndexes() {
    await MpesaAttemptModel.init();
  }

  get(id: string, session?: ClientSession) {
    return MpesaAttemptModel.findById(id).select('+payerPhone').session(session ?? null).lean();
  }

  byCheckout(environment: MpesaAttempt['environment'], checkoutRequestId: string, session?: ClientSession) {
    return MpesaAttemptModel.findOne({ environment, checkoutRequestId }).select('+payerPhone').session(session ?? null).lean();
  }

  byBillingPaymentId(billingPaymentId: string, session?: ClientSession) {
    return MpesaAttemptModel.findOne({ billingPaymentId }).select('+payerPhone').session(session ?? null).lean();
  }

  async create(record: Omit<MpesaAttempt, 'createdAt' | 'updatedAt'>, session: ClientSession) {
    await MpesaAttemptModel.create([record], { session });
  }

  transition(
    id: string,
    version: number,
    from: MpesaSubmissionState,
    fields: Partial<MpesaAttempt>,
    session: ClientSession,
  ) {
    return MpesaAttemptModel.findOneAndUpdate(
      { _id: id, version, submissionState: from },
      { $set: fields, $inc: { version: 1 } },
      { returnDocument: 'after', session: session ?? null },
    ).select('+payerPhone').lean();
  }

  recordOutcome(attempt: MpesaAttempt, fields: Partial<MpesaAttempt>, session: ClientSession) {
    return MpesaAttemptModel.findOneAndUpdate(
      { _id: attempt._id, version: attempt.version, reportedOutcome: 'PENDING' },
      { $set: fields, $inc: { version: 1 } },
      { returnDocument: 'after', session },
    ).select('+payerPhone').lean();
  }

  updateVerification(
    id: string,
    version: number,
    fields: Partial<MpesaAttempt>,
    session: ClientSession,
  ) {
    return MpesaAttemptModel.findOneAndUpdate(
      { _id: id, version },
      { $set: fields, $inc: { version: 1 } },
      { returnDocument: 'after', session },
    ).select('+payerPhone').lean();
  }

  updatePosting(
    id: string,
    version: number,
    fields: Partial<MpesaAttempt>,
    session?: ClientSession,
  ) {
    return MpesaAttemptModel.findOneAndUpdate(
      { _id: id, version },
      { $set: fields, $inc: { version: 1 } },
      { returnDocument: 'after', session },
    ).select('+payerPhone').lean();
  }

  async claimForReconciliation(
    environment: MpesaAttempt['environment'],
    workerId: string,
    leaseDurationMs = 60_000,
  ): Promise<MpesaAttempt | null> {
    const now = new Date();
    const leaseExpired = new Date(now.getTime() - leaseDurationMs);
    const stuckSubmittingThreshold = new Date(now.getTime() - 30_000);

    return MpesaAttemptModel.findOneAndUpdate(
      {
        environment,
        active: true,
        recoveryStatus: { $nin: ['MANUAL_REVIEW_REQUIRED', 'RESOLVED', 'ABANDONED'] },
        reconciliationRetries: { $lt: 5 },
        $or: [
          { submissionState: 'SUBMITTING', submittedAt: { $lt: stuckSubmittingThreshold } },
          { submissionState: 'UNKNOWN' },
          {
            submissionState: 'PENDING',
            verificationStatus: 'UNVERIFIED',
            $or: [
              { nextReconciliationAt: { $exists: false } },
              { nextReconciliationAt: null },
              { nextReconciliationAt: { $lte: now } },
            ],
          },
        ],
        $and: [
          {
            $or: [
              { reconciliationClaimedAt: { $exists: false } },
              { reconciliationClaimedAt: null },
              { reconciliationClaimedAt: { $lt: leaseExpired } },
            ],
          },
        ],
      },
      {
        $set: {
          reconciliationClaimedAt: now,
          reconciliationClaimedBy: workerId,
          recoveryStatus: 'IN_RECOVERY',
        },
      },
      { returnDocument: 'after' },
    ).select('+payerPhone').lean();
  }

  async list(filter: ListMpesaAttemptsFilter): Promise<{
    items: MpesaAttempt[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query: Record<string, unknown> = {};
    if (filter.branchIds) {
      query.branchId = { $in: filter.branchIds };
    }
    if (filter.invoiceId) {
      query.invoiceId = filter.invoiceId;
    }
    if (filter.submissionState) {
      query.submissionState = filter.submissionState;
    }
    if (filter.verificationStatus) {
      query.verificationStatus = filter.verificationStatus;
    }
    if (filter.postingStatus) {
      query.postingStatus = filter.postingStatus;
    }
    if (filter.unresolvedOnly) {
      query.verificationStatus = { $in: ['UNVERIFIED', 'CONFLICT', 'UNRESOLVED'] };
      query.active = true;
    }
    if (filter.exceptionsOnly) {
      query.$or = [
        { recoveryStatus: 'MANUAL_REVIEW_REQUIRED' },
        { postingStatus: 'POSTING_FAILED' },
        { verificationStatus: 'CONFLICT' },
      ];
    }

    const skip = (filter.page - 1) * filter.limit;
    const [items, total] = await Promise.all([
      MpesaAttemptModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filter.limit)
        .select('+payerPhone')
        .lean(),
      MpesaAttemptModel.countDocuments(query),
    ]);

    return { items, total, page: filter.page, limit: filter.limit };
  }

  async audit(
    eventType: string,
    attempt: MpesaAttempt,
    actor: string | undefined,
    details: Record<string, unknown>,
    session: ClientSession,
  ) {
    await AuditLogModel.create([{
      eventType,
      actorUserId: actor,
      metadataJson: {
        attemptId: attempt._id,
        invoiceId: attempt.invoiceId,
        branchId: attempt.branchId,
        initiatedBy: attempt.createdBy,
        source: actor ? 'STAFF' : 'MPESA_CALLBACK',
        ...details,
      },
    }], { session });
  }
}
