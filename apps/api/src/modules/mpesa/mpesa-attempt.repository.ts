import mongoose, { type ClientSession, type QueryFilter } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { MpesaAttemptCreationError } from './mpesa-attempt-error.js';
import { MpesaAttemptModel, type MpesaAttempt, type MpesaSubmissionState } from './mpesa-attempt.model.js';
import { MPESA_RECONCILIATION_LEASE_MS, MPESA_RECONCILIATION_MAX_RETRIES, MPESA_SUBMISSION_STALE_MS } from './mpesa-reconciliation.policy.js';

const reconciliationFilter = (environment: MpesaAttempt['environment'], branchIds: string[] | undefined, leaseDurationMs: number): QueryFilter<MpesaAttempt> => {
  const now = new Date();
  return {
    environment, active: true,
    ...(branchIds ? { branchId: { $in: branchIds } } : {}),
    recoveryStatus: { $nin: ['MANUAL_REVIEW_REQUIRED', 'RESOLVED', 'ABANDONED'] },
    verificationStatus: { $in: ['UNVERIFIED', 'UNRESOLVED'] },
    postingStatus: { $nin: ['POSTED', 'POSTING', 'MANUAL_REVIEW_REQUIRED'] },
    conflictingEvidence: { $in: [null, ''] },
    $and: [
      { $or: [
        { submissionState: 'SUBMITTING', submittedAt: { $lt: new Date(now.getTime() - MPESA_SUBMISSION_STALE_MS) } },
        { submissionState: { $in: ['UNKNOWN', 'PENDING'] } },
      ] },
      { $or: [{ nextReconciliationAt: null }, { nextReconciliationAt: { $lte: now } }] },
      { $or: [{ reconciliationClaimedAt: null }, { reconciliationClaimedAt: { $lt: new Date(now.getTime() - leaseDurationMs) } }] },
    ],
  };
};

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
    // Model.init() caches rejected initialization promises and may skip index
    // builds when autoIndex is disabled. Verify the actual unique constraints.
    if (await this.hasRequiredIndexes()) return;
    // Public, additive API: never drop or replace an incompatible existing index.
    try {
      await MpesaAttemptModel.createIndexes();
    } catch (error) {
      throw new MpesaAttemptCreationError('INDEX_BUILD', error);
    }
    if (!await this.hasRequiredIndexes()) {
      throw new AppError('Required M-PESA indexes are unavailable', 503, 'MPESA_INDEXES_NOT_READY');
    }
  }

  private async hasRequiredIndexes() {
    try {
      const indexes = await MpesaAttemptModel.listIndexes();
      return MpesaAttemptModel.schema.indexes().filter(([, options]) => options.unique === true)
        .every(([key, options]) => indexes.some((index) => index.unique === true &&
          index.sparse !== true && index.expireAfterSeconds === undefined && index.collation === undefined &&
          JSON.stringify(index.key) === JSON.stringify(key) &&
          JSON.stringify(index.partialFilterExpression ?? null) === JSON.stringify(options.partialFilterExpression ?? null)));
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 26) return false;
      throw new MpesaAttemptCreationError('INDEX_INSPECTION', error);
    }
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
    environment: MpesaAttempt['environment'], workerId: string,
    leaseDurationMs = MPESA_RECONCILIATION_LEASE_MS, branchIds?: string[], session?: ClientSession,
  ): Promise<MpesaAttempt | null> {
    const filter = reconciliationFilter(environment, branchIds, leaseDurationMs);
    return MpesaAttemptModel.findOneAndUpdate({ ...filter, $and: [...(filter.$and ?? []),
      { $or: [{ reconciliationRetries: { $lt: MPESA_RECONCILIATION_MAX_RETRIES } }, { reconciliationRetries: { $exists: false } }] },
    ] }, {
      $set: { reconciliationClaimedAt: new Date(), reconciliationClaimedBy: workerId, recoveryStatus: 'IN_RECOVERY' },
      $inc: { version: 1, reconciliationRetries: 1 },
    }, { returnDocument: 'after', session, sort: { nextReconciliationAt: 1, createdAt: 1, _id: 1 } })
      .select('+payerPhone').lean();
  }

  claimExhaustedReconciliation(environment: MpesaAttempt['environment'], workerId: string, branchIds: string[], session: ClientSession) {
    return MpesaAttemptModel.findOneAndUpdate({
      ...reconciliationFilter(environment, branchIds, MPESA_RECONCILIATION_LEASE_MS),
      reconciliationRetries: { $gte: MPESA_RECONCILIATION_MAX_RETRIES },
    }, {
      $set: { reconciliationClaimedAt: new Date(), reconciliationClaimedBy: workerId, recoveryStatus: 'IN_RECOVERY' },
      $inc: { version: 1 },
    }, { returnDocument: 'after', session, sort: { createdAt: 1, _id: 1 } }).select('+payerPhone').lean();
  }

  updateReconciliation(claim: MpesaAttempt, version: number, fields: Partial<MpesaAttempt>, session: ClientSession) {
    return MpesaAttemptModel.findOneAndUpdate({
      _id: claim._id, version, reconciliationClaimedBy: claim.reconciliationClaimedBy,
      reconciliationClaimedAt: { $eq: claim.reconciliationClaimedAt,
        $gt: new Date(Date.now() - MPESA_RECONCILIATION_LEASE_MS) },
    }, { $set: fields, $inc: { version: 1 } }, { returnDocument: 'after', session }).select('+payerPhone').lean();
  }

  releaseReconciliation(claim: MpesaAttempt, nextReconciliationAt: Date) {
    return MpesaAttemptModel.updateOne({
      _id: claim._id, reconciliationClaimedBy: claim.reconciliationClaimedBy,
      reconciliationClaimedAt: claim.reconciliationClaimedAt,
    }, { $set: { reconciliationClaimedAt: null, reconciliationClaimedBy: null, nextReconciliationAt }, $inc: { version: 1 } });
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
